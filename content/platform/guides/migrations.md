---
title: 'Database Migrations'
description: 'Apply SQL migrations to a Volcano database once each, rehearsed on a branch and backed up first, or run them untracked with the CLI.'
---

Migrations are SQL files in your project's `volcano/migrations/` directory.
Volcano applies them two ways:

- **Tracked migration runs**, through the API. The database records each file
  it has applied, so a file runs once. Volcano rehearses the pending files on a
  short-lived branch and takes a backup before it touches your database.
- **The CLI**, with `volcano deploy --with-migrations`, `volcano cloud
  databases migration up`, and `volcano migrations deploy`. The CLI does not
  use tracked runs yet: every file runs again on each call. See
  [Run migrations with the CLI](#run-migrations-with-the-cli).

## Apply migrations with a tracked run

Send the files to the database's migration runs:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/migration-runs" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: deploy-4f2a9c1" \
  -d '{
    "files": [
      {"name": "001_create_notes.sql", "sql": "CREATE TABLE notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL);"},
      {"name": "002_add_notes_pinned.sql", "sql": "ALTER TABLE notes ADD COLUMN pinned boolean NOT NULL DEFAULT false;"}
    ]
  }'
```

The response is `202` with the run `queued`:

```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database": { "type": "database", "id": "0b9c3f5e-2a41-4d7e-9f0a-6c8e1d2b3a45", "name": "main_db" },
  "status": "queued",
  "phase": "plan",
  "source": "api",
  "files": [
    { "name": "001_create_notes.sql", "outcome": "pending" },
    { "name": "002_add_notes_pinned.sql", "outcome": "pending" }
  ],
  "warnings": [],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

Poll the run until `status` is `succeeded` or `failed`:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/migration-runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database": { "type": "database", "id": "0b9c3f5e-2a41-4d7e-9f0a-6c8e1d2b3a45", "name": "main_db" },
  "status": "succeeded",
  "phase": "apply",
  "source": "api",
  "backup_name": "before-migration-7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "files": [
    { "name": "001_create_notes.sql", "outcome": "applied" },
    { "name": "002_add_notes_pinned.sql", "outcome": "applied" }
  ],
  "warnings": [],
  "started_at": "2024-01-01T00:00:02Z",
  "completed_at": "2024-01-01T00:01:40Z",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:01:40Z"
}
```

Send the same files every time, including the ones already applied. The run
skips those (`already_applied`) and applies only the new ones. With
`Idempotency-Key`, a retried request returns the run it started instead of
starting another. A database runs one migration run at a time; starting a
second answers `409` with code `migration_run_in_progress` and the `run_id` to
wait for. Files that break a rule answer `400` and start nothing: code
`invalid_layout` for a path that does not map to the database, and
`invalid_file` for a name that is repeated or too long. The run lists its
files in the order they run, whatever order you send them in.

A database over its [storage allowance](plans-and-limits.md#databases) takes no
run or baseline, just as it takes no writes over a connection. Both answer
`400` with a message that starts `storage limit reached`. Reclaim space with
`DROP` or `TRUNCATE` over a connection, or upgrade, then start the run again.

In CI, call the API with a `full` [project access
token](../authentication/security/project-access-tokens.md). A `read_only` token
can read the history and runs but cannot start a run.

Tracked runs need the `databases.migrations`
[capability](../api-reference/overview.md#capabilities). Where it is
unavailable, starting a run or a baseline answers `404` with code
`feature_unavailable`; reading the history and runs works either way. The
[API reference](../api-reference/databases.md#migrations) lists every endpoint
and status.

## What a run does

A run moves through four phases. `phase` says which one it is on, or which one
it ended on.

| Phase      | What happens                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`     | Compares the files with the database's history. Files the history holds are `already_applied`. With nothing pending, the run succeeds here and takes no backup.                    |
| `rehearse` | Applies the pending files to a short-lived [branch](../databases/branching.md) of the database, then deletes the branch. A file that fails here never touches the database.        |
| `backup`   | Takes a [backup](../databases/backups.md) named `before-migration-<run id>`, listed with `source: migration`. You can restore it like any other. Volcano keeps the 20 most recent. |
| `apply`    | Applies the pending files to the database, in name order, each in its own transaction with its history record.                                                                     |

If a file fails while it is applied to the database, its transaction rolls
back and the run stops there. The files before it stay applied and recorded,
and the ones after it are `not_run`; fix the failing file and start a run
again. Before it runs a file, `apply` reads the history again, and the outcomes
follow what it finds: a file that another session applied or baselined after
the run planned ends `already_applied` instead of running.

If the connection drops while a file runs, or one of Volcano's own statements
around the file fails, the file's transaction rolls back too, but the file did
not fail. The run retries it, and the file reads `pending` meanwhile. If the
run ends without applying it, the file is `not_run`, and the run's code is
`connection_failed` or `internal_error`.

A run can end in `apply` before it confirms whether a file ran: it used every
attempt (`attempts_exhausted`), Volcano ended it (`operator_failed`), or the
file's `COMMIT` failed or was cut short.
That file's `outcome` is `unknown`, and it may have committed. Each file commits
with its history record, so [the history](#read-the-history) says whether it
ran, and the next run applies it only if the history does not record it. While
a run retries, the files it has not applied read `pending` again, or
`already_applied` if the history now holds them.

### Backups, branches, and your plan

On SUPERAGENT, a run that reaches `backup` takes a backup, charged as a full
copy of the database like one you take. It does not count against your backup
allowance. Volcano keeps up to 20 migration backups per database and deletes
older ones, even before their `expires_at`. To keep a pre-migration state for
its full retention, take a backup yourself before the run. See
[what backups cost](../databases/backups.md#what-backups-cost).

HOBBY has no backups, so its runs skip the backup and report a `backup_skipped`
warning. The rehearsal still runs. The rehearsal branch counts toward the
database's [branch allowance](../databases/branching.md#limits) while it
exists; when the database is at its allowance, the run fails with
`branch_limit` before it touches the database. Delete a branch and start the
run again.

The statements a run executes, on the rehearsal branch and on the database, do
not count toward your [database request allowance](plans-and-limits.md#databases),
and reaching that allowance does not stop a run. Only the storage allowance
does, as described above.

In local mode, there are no branches or backups: runs apply directly and report
both `rehearsal_skipped` and `backup_skipped`.

### Warnings

| Code                  | Meaning                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `out_of_order`        | A new file sorts before one the history already records. It still ran.                                                               |
| `missing_file`        | The history records a file the run did not include. Nothing is undone.                                                               |
| `rehearsal_skipped`   | The files were not rehearsed, because branches are not available here or on the plan.                                                |
| `backup_skipped`      | No backup was taken, because backups are not available here or on the plan.                                                          |
| `backup_prune_failed` | Volcano could not delete older migration backups. The run's outcome is unaffected, and the next run that takes a backup tries again. |
| `warnings_truncated`  | The run raised more than 100 warnings. It ends the list, and its message says how many more were not kept.                           |

A run keeps at most 100 warnings. Those about the run, such as
`backup_skipped`, are kept ahead of those about files.

## Write migration files

```text
your-project/
  volcano/
    migrations/
      001_create_notes.sql
      002_add_notes_pinned.sql
```

- **Order.** Files run in byte order of their names. Use numbered prefixes
  (`001_`, `002_`) so the order is the one you mean.
- **One transaction per file.** A file may hold several statements, and they
  commit together or not at all. A file cannot `COMMIT`, `ROLLBACK`, or use
  savepoints, and cannot `COPY` from the client; use `INSERT`. Such a file
  fails with `migration_failed`, and its error says why.
- **No statements that need to run outside a transaction.** Tracked runs do
  not support statements such as `CREATE INDEX CONCURRENTLY` yet; a file with
  one fails the same way. Run those separately over a
  [direct connection](../databases/direct-connection.md).
- **Never edit an applied file.** The history keeps each file's checksum, and
  a run that finds an applied file changed fails with `checksum_mismatch`
  before anything runs. Add a new file instead. Converting line endings
  between CRLF and LF, or adding or removing a byte order mark, does not count
  as a change.
- **Limits.** Up to 1,000 files in a request, each up to 1 MiB, and 4 MiB in
  all. The history may hold up to 1,000 files too.

### Several databases in one project

With more than one database, put each database's files in a directory named
after it:

```text
volcano/
  migrations/
    main_db/
      001_create_notes.sql
    analytics/
      001_create_events.sql
```

Send each database its own directory's files, named with the directory:

```json
{
  "files": [{ "name": "main_db/001_create_notes.sql", "sql": "CREATE TABLE notes (id uuid PRIMARY KEY);" }]
}
```

The history records the file name without the directory. Every file in a
request takes the same form, and a directory must be the database's own; one
level of directories is the most a request accepts.

### Time limits

These are starting values and may change as Volcano learns how long real
migrations take.

| Limit            | Value      | What it bounds                        |
| ---------------- | ---------- | ------------------------------------- |
| Lock wait        | 10 seconds | Each wait for a lock (`lock_timeout`) |
| File             | 5 minutes  | Each file, all of its statements      |
| Rehearsal, apply | 15 minutes | All of a phase's files together       |
| Run              | 1 hour     | The whole run, from when it starts    |

A file can set its own lock wait with `SET LOCAL lock_timeout`. A file that
waits too long for a lock is retried later; meanwhile the run stays `running`.
A run gets four attempts.

## Adopt an existing database with a baseline

A database migrated before you used tracked runs already reflects its files,
and running them again would fail. Record them as applied without running
them:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/migrations/baseline" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files": [{"name": "001_create_notes.sql", "sql": "CREATE TABLE notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL);"}]}'
```

```json
{
  "recorded": ["001_create_notes.sql"]
}
```

Later runs apply only files the baseline did not record. Repeating a baseline
records nothing new. A file the history holds with a different checksum
answers `409` with code `checksum_mismatch`, and nothing is recorded. A
baseline is refused while a run is queued or running, and no run starts while
a baseline records.

A baseline does not queue. While another request is changing the database, or
the database holds the baseline up for more than a few seconds, such as with a
lock on the history, it answers `409` with code `database_busy` and records
nothing. Try again.

## Read the history

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/migrations" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "history": [
    {
      "name": "001_create_notes.sql",
      "checksum": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "status": "applied",
      "applied_at": "2024-01-01T00:01:20Z",
      "run_id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73"
    }
  ]
}
```

The history lives in your database, in the `_volcano_migrations.history` table,
so it moves with the database: a branch has its parent's history, and a restore
takes the history back with the data. Do not change or drop anything in the
`_volcano_migrations` schema yourself, except to bring a history back under its
bound, as below.

List a database's recent runs with `GET .../migration-runs`; it returns the 50
newest, without their files.

Volcano reads at most 1,000 history entries, as many files as one run may
carry. It writes one entry per file, so a history grows past that only when
files that ran leave your directory, or rows are written to the table by hand.
Reading a larger history answers `409` with code `history_too_large`. A
baseline is refused with the same code, and a run fails with it.

To bring it back under the bound, delete the entries of files that are no
longer in your migrations directory, while no run is queued or running. Your
directory holds at most 1,000 files, so that leaves at most 1,000 entries:

```sql
DELETE FROM _volcano_migrations.history
WHERE name IN ('001_create_notes.sql', '002_add_tags.sql');
```

No run sends those files, so their entries only raised `missing_file`
warnings. A file you add again under a deleted name runs as a new one.

### Recover a lost history

If the history table is dropped from a database where migrations ran, Volcano
can no longer tell which files were applied. The rest of the
`_volcano_migrations` schema shows that a history existed, so rather than run
the files again, Volcano refuses: reading the history answers `409`, and every
run fails at `plan`, both with code `history_missing`.

Dropping the whole `_volcano_migrations` schema is not supported. Nothing is
left to show that migrations ran, so the database reads as new, and the next
run applies every file again. If that happened, record a baseline as below
before you start a run.

```json
{
  "error": "the migration history of this database was lost; record a baseline of the files that were already applied with POST /projects/{id}/databases/{databaseName}/migrations/baseline",
  "code": "history_missing"
}
```

Rebuild the history with a baseline:

1. Work out which files the database already reflects. The newest `succeeded`
   run is a good start: get it, and take the files whose `outcome` is
   `applied` or `already_applied`. Check them against the schema.
2. [Record a baseline](#adopt-an-existing-database-with-a-baseline) with
   exactly those files, with the content they had when they ran. The baseline
   recreates the table and records them as `baselined`.
3. Start a run with all your files. Only the ones the baseline did not record
   run.

A file you include that never ran is recorded and never runs. A file you leave
out runs again.

## Why a run failed

A failed run's `error.code` says why:

| Code                    | Meaning                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `migration_failed`      | A file failed. In `rehearse`, the database is untouched. In `apply`, the files before it stay applied. |
| `checksum_mismatch`     | An applied file changed.                                                                               |
| `history_missing`       | The history table is gone. [Recover it](#recover-a-lost-history) with a baseline.                      |
| `history_too_large`     | The history has more than the [1,000 entries](#read-the-history) Volcano reads.                        |
| `invalid_file`          | A file Volcano refuses to run. Starting a run usually refuses it first, with `400` and this code.      |
| `invalid_layout`        | File paths that do not map to the database.                                                            |
| `plan_changed`          | The history changed between the rehearsal and the apply. Nothing was applied; start the run again.     |
| `branch_limit`          | The rehearsal branch would exceed the branch allowance.                                                |
| `rehearsal_unavailable` | Volcano could not prepare the rehearsal branch.                                                        |
| `backup_failed`         | Volcano could not take the backup.                                                                     |
| `restore_in_progress`   | A restore holds the database.                                                                          |
| `database_unavailable`  | The database is not active, or is gone.                                                                |
| `locked`                | Another session held the migration lock, or a file waited too long for a lock on every attempt.        |
| `connection_failed`     | Volcano could not reach the database, or lost its connection, including while a file ran.              |
| `timeout`               | A phase or the run exceeded its time limit.                                                            |
| `attempts_exhausted`    | The run used every attempt.                                                                            |
| `internal_error`        | Volcano failed for a reason of its own, such as one of its own statements around a file.               |
| `operator_failed`       | Volcano ended a run that stopped making progress. Check the history, then start a new run.             |

The failed file carries the database's own error, with its SQLSTATE and line.
That message can quote values from your file or your data, so anyone who can
read the project's migration runs can see it.

## Run migrations with the CLI

The CLI applies migrations without tracking them. Every file runs again on each
`--with-migrations` deploy and each `migration up --all`: write files to be
safe to repeat, such as `CREATE TABLE IF NOT EXISTS`, or leave the flag out
once they have run.

`volcano deploy --with-migrations` applies every migration as part of a whole
project deploy, after the variables and before the functions. `volcano cloud
deploy --with-migrations -d mydb` does the same for a cloud database, and picks
the database itself when your `volcano-config.yaml` declares exactly one. See
the [CLI deploy reference](/cli/deploy). Use the commands below to apply
migrations on their own.

### Cloud databases

```bash
# Deploy all migrations to a specific database
volcano cloud databases migration up --all -d mydb

# Deploy a specific migration
volcano cloud databases migration up -d mydb -f 001_create_users

# Deploy using full path
volcano cloud databases migration up -d mydb -f volcano/migrations/001_create_users.sql
```

The `-d` (or `--database`) flag is **required**, and you must pass either
`--all`/`-a` or `-f`/`--file`. The database must exist and be `active`, and you
must be logged in with `volcano login`.

### Local development

When you run `volcano start`, a default database named `app` is created. Use
the top-level `volcano migrations deploy` command:

```bash
# Deploy all migrations to the default "app" database
volcano migrations deploy --all -d app

# Deploy a specific migration
volcano migrations deploy -d app -f 001_create_users
```

`-d` is required here as well, along with `--all`/`-a` or `-f`/`--file`.
Docker must be running with the Volcano containers started.

### One statement per file

The CLI sends each file as one query, so a file must hold exactly one SQL
statement. A file with more than one is
[refused](../databases/connection-strings.md#one-statement-per-query) before any
of it runs. Split a multi-step change into several numbered files.

When a file fails, the CLI stops there and runs nothing after it. Fix the file
and run again:

```bash
# Database doesn't exist
$ volcano cloud databases migration up --all -d nonexistent
Error: failed to get database "nonexistent": HTTP 404: database not found

# Database not ready
$ volcano cloud databases migration up --all -d mydb
Error: database "mydb" is not active (status: provisioning)

# Migration not found
$ volcano cloud databases migration up -d mydb -f missing_migration
Error: migration "missing_migration" not found in volcano/migrations/
available migrations: 001_create_users.sql, 002_add_posts.sql
```

### Other migration tools

golang-migrate sends each file as one query, so a file with more than one
statement is [refused](../databases/connection-strings.md#one-statement-per-query).
Add `x-multi-statement=true` to the database URL to have it send them one at a
time. That mode splits on every `;`, including one inside a `$$` function body,
so apply such functions with a tracked run or `psql -f` instead.

## Migration examples

### Creating a table

```sql
-- volcano/migrations/001_create_notes.sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- volcano/migrations/002_index_notes_user_id.sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

### Enabling row level security

```sql
-- volcano/migrations/003_enable_rls.sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
```

```sql
-- volcano/migrations/004_notes_select_own.sql
-- Users can only see their own notes
CREATE POLICY notes_select_own ON notes
    FOR SELECT USING (auth.uid() = user_id);
```

```sql
-- volcano/migrations/005_notes_insert_own.sql
-- Users can only insert notes for themselves
CREATE POLICY notes_insert_own ON notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

A tracked run could hold all three in one file, applied together.

### Adding a column

```sql
-- volcano/migrations/006_add_pinned.sql
ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
```

## Queries that ran before the migration

Volcano keeps the statements your application runs prepared on its database
connections. A migration that changes a table's columns, such as adding one
behind `SELECT *` or changing a type, makes Postgres refuse those statements
with `cached plan must not change result type`. Volcano then prepares them
again on every connection, so nothing needs restarting:

- **Outside a transaction**, the statement runs again on its own and returns
  the new columns. Your application sees no error.
- **Inside a transaction**, the error reaches your application once, because
  Postgres has already aborted the transaction. Roll back and run the
  transaction again.
- **When your driver cached the columns itself**, as drivers that prepare a
  statement once and reuse it do, the error reaches your application once
  even outside a transaction, as it would without Volcano. Anything the
  statement wrote is rolled back, and the driver drops its copy, so running
  the statement again is safe and returns the new columns. The exception is a
  `SELECT` that calls a function which writes, on a `volcano_full_access`
  connection: its writes are kept.

## See also

- [Branching](../databases/branching.md)
- [Backups and restore](../databases/backups.md)
- [Creating Databases](../databases/creating-databases.md)
- [Row Level Security](../databases/row-level-security.md)
- [Database Roles](../databases/database-roles.md)
