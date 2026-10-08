---
title: "Importing Data"
description: "Move an existing PostgreSQL database into Volcano with pg_dump and psql, and bulk-load or export rows with COPY."
---

Move an existing PostgreSQL database into Volcano with `pg_dump` and `psql`, or
bulk-load rows with `COPY`. Both run over the database's regular connection
string.

```bash
# Dump the source database as plain SQL, without its roles and grants
pg_dump "$SOURCE_DATABASE_URL" --no-owner --no-privileges --file dump.sql

# Restore it into Volcano, stopping at the first error
psql "$VOLCANO_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction --file dump.sql
```

`VOLCANO_DATABASE_URL` is the database's `connection_string` (see
[Connection strings](connection-strings.md)). Use it as returned: its
`application_name=volcano_full_access` lets the import create tables and load
every row without row-level security getting in the way.

## Restore a dump

- **Use a plain SQL dump.** That is `pg_dump`'s default format. If you have a
  custom-format archive (`pg_dump -Fc`), turn it into SQL first. Writing to a
  file does not connect to any database:

  ```bash
  pg_restore --no-owner --no-privileges --file dump.sql archive.dump
  ```

- **Leave out owners and grants.** A dump from another server refers to its
  roles in `ALTER ... OWNER TO` and `GRANT` statements, and those roles do not
  exist in your Volcano database. With `--no-owner --no-privileges` the
  restored objects belong to the connection's role. Grant your app's roles
  afterwards; see [Database roles](database-roles.md).
- **Skip the `auth` schema.** Every Volcano database already has an `auth`
  schema with the [auth helpers](auth-helpers.md). If the source has its own,
  add `--exclude-schema=auth` to `pg_dump`.
- **Into PostgreSQL 15 or 16, remove `SET transaction_timeout`.** A dump made
  with `pg_dump` 17 or later starts with `SET transaction_timeout = 0`, which
  those versions reject as an unrecognized parameter. Check your database's
  [version](overview.md#postgresql-versions), and delete the line before
  restoring into either:

  ```bash
  sed -i.bak '/^SET transaction_timeout/d' dump.sql
  ```
- **Use `psql` from the same release as `pg_dump`.** Recent `pg_dump` versions
  write `\restrict` lines that older `psql` versions reject.
- **Restore in one transaction.** A dump starts with session settings, such as
  `set_config('search_path', '', false)`, and outside a transaction Volcano
  keeps them only for the statement that set them (see
  [Session settings](direct-connection.md#session-settings)).
  `--single-transaction` carries them to every
  statement, and rolls the whole restore back if any statement fails, so a
  failed import leaves no partial schema to clean up. Fix the dump and run it
  again against the same database.

`psql` sends the dump one statement at a time, which Volcano requires; a
client that sends several statements in one query is refused. Extensions in
the dump, such as `vector` and `pgcrypto`, are created by its
`CREATE EXTENSION` statements, and sequences continue from their source
values.

Table data in a dump is written as `COPY ... FROM stdin`, so the limits below
apply to each table.

## Load and export rows with COPY

`COPY ... FROM STDIN` and `COPY ... TO STDOUT` stream rows between your client
and the database. In `psql`, `\copy` does this for a local file:

```bash
# Load a CSV file
psql "$VOLCANO_DATABASE_URL" \
  -c "\copy posts (id, title, body) FROM 'posts.csv' WITH (FORMAT csv, HEADER)"

# Export a query's results
psql "$VOLCANO_DATABASE_URL" \
  -c "\copy (SELECT id, title, body FROM posts ORDER BY id) TO 'posts.csv' WITH (FORMAT csv, HEADER)"
```

From Node.js, stream a file through
[pg-copy-streams](https://www.npmjs.com/package/pg-copy-streams):

```javascript
// load-posts.mjs
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import copyStreams from 'pg-copy-streams';

const { Client } = pg;
const copyFrom = copyStreams.from;

const client = new Client({ connectionString: process.env.VOLCANO_DATABASE_URL });
await client.connect();
try {
  const load = client.query(copyFrom('COPY posts (id, title, body) FROM STDIN WITH (FORMAT csv, HEADER)'));
  await pipeline(fs.createReadStream('posts.csv'), load);
  console.log(`Loaded ${load.rowCount} rows`);
} finally {
  await client.end();
}
```

A COPY loads all of its rows or none. If any row is rejected, the whole COPY
fails with PostgreSQL's error message and SQLSTATE, and the connection stays
usable:

```text
ERROR:  duplicate key value violates unique constraint "posts_pkey"
```

`COPY ... FROM 'file'` and `COPY ... TO 'file'` read and write files on the
database server, which you cannot reach. Use `FROM STDIN` and `TO STDOUT`, as
`\copy` does.

## Limits

| Limit | What happens | What to do |
|-------|--------------|------------|
| 60 seconds per statement | A COPY is one statement, data included. One that runs out of time fails with `COPY failed: the statement time limit was reached` and loads nothing. Building an index on a large table can also exceed the limit | Split a large table into several COPYs, or dump it with `pg_dump --rows-per-insert=1000` so each batch of rows is its own statement |
| 60 seconds between statements in a transaction | A client that stays silent that long inside a transaction gets `terminating connection due to idle-in-transaction timeout`, and the transaction rolls back | Run the restore from a file with `psql`, not by hand |
| Simple query protocol only | A COPY sent as a prepared statement fails at once with SQLSTATE `0A000` and `COPY is not supported through the extended query protocol; send it as a simple query` | Use your driver's COPY API, such as `\copy`, pgx's `PgConn().CopyFrom` with text or CSV data, psycopg's `cursor.copy()`, or pg-copy-streams; these send COPY as a simple query |
| No `pg_dump` or `pg_restore` against Volcano | `pg_dump` and `pg_restore` connect to a Volcano database but aren't supported there. A dump that includes a function fails partway through. One that finishes runs without the session settings `pg_dump` sets, such as `search_path` and `row_security`, so its output can differ from a dump of the same data elsewhere | Point them at the source database only. Restore plain SQL with `psql`, and use [backups](backups.md) to keep copies of a Volcano database |
| Row-level security | Through a `volcano_user_access` connection, PostgreSQL refuses `COPY ... FROM` into a table with row-level security enabled (SQLSTATE `0A000`) | Load with the full-access connection string, or use `INSERT` |
| Storage allowance | A database over its storage allowance refuses `COPY ... FROM` with SQLSTATE `25006`, like any other write. `COPY ... TO` still works | Free space or upgrade; see [Plans and limits](../guides/plans-and-limits.md) |

## See also

- [Connection strings](connection-strings.md) - Get the connection string to restore into
- [Direct connection](direct-connection.md) - Access modes and error codes
- [Database roles](database-roles.md) - Grant restored tables to your app's roles
- [Backups and restore](backups.md) - Roll a Volcano database back instead of re-importing
