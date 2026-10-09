---
title: "Databases"
description: "PostgreSQL databases you can branch in under a minute, restore to a point in time, and secure with row-level security."
---

Volcano provides PostgreSQL databases. Any database forks into a
copy-on-write [branch](branching.md) in under a minute, so every pull request,
migration, or test run can have its own copy of the data. Compute scales with
load, and row-level security is built in.

## Features

| Feature | Description |
|---------|-------------|
| [Branching](branching.md) | Fork a database into an isolated, expiring copy with its own connection string, usually in under a minute |
| [Backups and restore](backups.md) | Back up on demand or on a schedule, and restore in place to a backup or a point in time (SUPERAGENT) |
| Auto-scaling | Auto-scales compute based on demand, pauses when idle |
| PostgreSQL | Full PostgreSQL compatibility (versions 16, 17, and 18) |
| Query Builder | Query from browsers without writing SQL |
| Direct connection | Connect from your functions with standard PostgreSQL clients |
| Row-level security | Automatic data isolation per user |
| Auth helpers | Built-in functions for user context (`auth.uid()`, `auth.email()`) |
| Multiple databases | Create multiple databases per project |

## Branch a database

A branch starts as an exact copy of its parent — schema, rows, roles, and
row-level security policies — and diverges from there. Writes never reach the
parent. Each branch has its own connection string and password, is charged only
for the data it changes, and is deleted when its lifetime ends.

```bash
# Fork main_db for pull request 482; it expires on its own after 72 hours
volcano cloud databases branches create main_db pr_482 --ttl 72h

# Once it reports active, read its connection string
volcano cloud databases branches get main_db pr_482 --show-connection-string

# Rewind it to the parent's current data, or delete it when you are done
volcano cloud databases branches reset main_db pr_482 --yes
volcano cloud databases branches delete main_db pr_482 --yes
```

See [Branching](branching.md) for the API, a branch-per-pull-request CI
recipe, costs, and limits.

## Access methods

You can access your database two ways:

### Query Builder (browser and mobile)

The Query Builder lets you query your database directly from frontend code using a chainable API:

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.volcano.dev',
  anonKey: 'your-anon-key'
});
volcano.database('main');

// Sign in first
await volcano.auth.signIn({ email: 'user@example.com', password: 'password' });

// Query with the SDK
const { data, error } = await volcano
  .from('posts')
  .select('id, title, content')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10);
```

The Query Builder:
- Works directly from browsers
- Enforces row-level security automatically
- Doesn't require SQL knowledge
- Supports filtering, ordering, and pagination

See [Query Builder API](query-builder-api.md) for the complete reference.

### Direct connection (functions)

Connect directly to PostgreSQL from your functions using any PostgreSQL client:

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  const { rows } = await client.query(`
    SELECT id, title, content
    FROM posts
    WHERE status = 'published'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify(rows)
  };
};
```

Direct connections:
- Support full PostgreSQL features (JOINs, CTEs, transactions)
- Work with ORMs (Sequelize, Prisma, TypeORM)
- Can include user identity for RLS enforcement

> **Note:** The example above uses `DATABASE_URL` as-is, which carries
> `application_name=volcano_full_access` (admin access, bypasses RLS) by default. To
> scope a query to the invoking user under RLS, rewrite `application_name` to
> `volcano_user_access:{user_id}` before connecting — see [Direct connection](direct-connection.md#authentication--user-impersonation).

See [Direct connection](direct-connection.md) for details.

## Quick example

### Create a database

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/databases" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "main"}'
```

Response:

```json
{
  "id": "db_abc123",
  "name": "main",
  "status": "provisioning",
  "region": "us-east-1",
  "pg_version": "18"
}
```

### Use in a function

Set the connection string as a project variable, then reference it from your function. Volcano doesn't auto-set any variables, so create it explicitly:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/variables" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "DATABASE_URL", "value": "<connection_string from GET /databases/{id}>"}'
```

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

exports.handler = async (event) => {
  const { rows } = await pool.query('SELECT NOW()');
  return {
    statusCode: 200,
    body: JSON.stringify({ time: rows[0].now })
  };
};
```

> **Note:** `DATABASE_URL` carries `application_name=volcano_full_access` (admin access, bypasses
> RLS) by default, as used above. To scope a query to the invoking user under RLS, rewrite
> `application_name` to `volcano_user_access:{user_id}` — see [Direct connection](direct-connection.md#authentication--user-impersonation).

## Auth helpers

When you create a database, Volcano automatically installs authentication helper functions:

| Function | Returns | Description |
|----------|---------|-------------|
| `auth.uid()` | UUID | Current user's ID |
| `auth.email()` | TEXT | Current user's email |
| `auth.role()` | TEXT | Current user's role (`authenticated` or `anonymous`) |
| `auth.is_authenticated()` | BOOLEAN | Whether a user is authenticated |

Use these in row-level security policies:

```sql
-- Users can only see their own posts
CREATE POLICY "users_own_posts" ON posts
  FOR ALL USING (user_id = auth.uid());
```

See [Auth helpers](auth-helpers.md) for details.

## Row-level security

Row-level security (RLS) lets you define policies that control which rows each user can access. Combined with auth helpers, you can write policies that automatically filter data:

```sql
-- Enable RLS on the table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can read all published posts
CREATE POLICY "public_posts" ON posts
  FOR SELECT USING (status = 'published');

-- Users can only modify their own posts
CREATE POLICY "own_posts" ON posts
  FOR ALL USING (user_id = auth.uid());
```

When a user queries the `posts` table, PostgreSQL automatically applies these policies based on the user's identity.

See [Row-level security](row-level-security.md) for complete examples.

## Authentication for database access

### User access (RLS enforced)

When users sign in through your app, their queries are automatically scoped by RLS:

```javascript
// User is signed in
await volcano.auth.signIn({ email: 'user@example.com', password: 'password' });

// Query returns only this user's data
const { data } = await volcano.from('posts').select('*');
```

### Admin access (RLS bypassed)

Use a service key when you need to access all data regardless of RLS policies:

```javascript
// Server-side only
const volcanoAdmin = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.VOLCANO_ANON_KEY,
  accessToken: process.env.VOLCANO_SERVICE_KEY
});
volcanoAdmin.database('main');

// Returns all posts, not filtered by RLS
const { data } = await volcanoAdmin.from('posts').select('*');
```

> **Warning:** Service keys bypass row-level security and can access all data. Never expose them in frontend code.

## Regions and versions

### Available regions

| Region | Location |
|--------|----------|
| `us-east-1` | US East (N. Virginia) — Default |
| `us-west-2` | US West (Oregon) |
| `eu-west-1` | Europe (Ireland) |
| `eu-central-1` | Europe (Frankfurt) |
| `ap-southeast-1` | Asia Pacific (Singapore) |
| `ap-southeast-2` | Asia Pacific (Sydney) |
| `ap-northeast-1` | Asia Pacific (Tokyo) |
| `sa-east-1` | South America (São Paulo) |

These are the same regions you can deploy functions to, and they use the same
IDs, so a project's data and its functions can sit in the same place. Region IDs
issued by earlier versions of the API are still accepted everywhere a region is,
and responses always use the IDs above. Query the list rather than hardcoding
it:

```bash
curl "https://api.volcano.dev/databases/regions"
```

```json
[
  { "id": "ap-northeast-1", "name": "Asia Pacific (Tokyo)" },
  { "id": "us-east-1", "name": "US East (N. Virginia)" }
]
```

### PostgreSQL versions

| Version | Status |
|---------|--------|
| 18 | Latest; marked `default` in the version list |
| 17 | Supported |
| 16 | Supported; the only version in local mode |

A create request must name the version:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/databases" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "main", "region": "eu-central-1", "pg_version": "18"}'
```

## How requests are counted

Your plan's [database request allowance](../guides/plans-and-limits.md#databases)
counts statements that complete, however they reach the database:

| What runs | Counts as |
| --- | --- |
| A [REST API](rest-api.md) request, which the query builder sends | 1 request |
| A statement over a direct connection, including `CALL proc()` or `SELECT fn()` | 1 request, however many statements the function runs inside |
| `BEGIN`, `COMMIT`, `ROLLBACK`, and savepoints | Free |
| The role and user-context setup Volcano runs for user access | Free |
| A statement that fails | Free |
| An empty query, such as a driver's connection ping | Free |

A query string holding several statements, such as `INSERT ...; UPDATE ...`, is
[refused](connection-strings.md#one-statement-per-query). Send them one at a
time, inside `BEGIN` and `COMMIT` if they belong together.

### Batch work into fewer statements

From a function or other server code, combine work in SQL rather than sending
one statement per row or step. Each of these counts as one request:

```sql
-- Several rows in one INSERT
INSERT INTO chat_messages (conversation_id, role, body)
VALUES ($1, 'user', $2), ($1, 'assistant', $3);

-- Dependent writes in one statement
WITH turn AS (
  INSERT INTO chat_turns (conversation_id) VALUES ($1) RETURNING id
)
INSERT INTO chat_messages (turn_id, role, body)
SELECT id, 'user', $2 FROM turn;
```

For logic that is longer than one statement, put it in a Postgres function and
call it once. `SECURITY INVOKER`, the default, runs it as the caller, so
row-level security still applies to a [user-access](#user-access-rls-enforced)
connection:

```sql
CREATE FUNCTION record_turn(conversation UUID, question TEXT, answer TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  turn_id UUID;
BEGIN
  INSERT INTO chat_turns (conversation_id) VALUES (conversation) RETURNING id INTO turn_id;
  INSERT INTO chat_messages (turn_id, role, body)
  VALUES (turn_id, 'user', question), (turn_id, 'assistant', answer);
  UPDATE conversations SET updated_at = now() WHERE id = conversation;
  RETURN turn_id;
END;
$$;
```

```javascript
const { rows } = await client.query('SELECT record_turn($1, $2, $3) AS id', [conversationId, question, answer]);
```

The REST API runs one statement per request, inserts one row per request, and
cannot call a Postgres function. Move a write-heavy path to a function with a
[direct connection](direct-connection.md) to batch it.

## Read storage usage

The dashboard's Database Storage chart shows observed storage sizes. A missing sample carries an earlier sample forward. Buckets before the first available sample show zero; the current size does not fill past dates. The Current value can be available before historical samples appear.

## What's next

| Guide | Description |
|-------|-------------|
| [Quick start](quick-start.md) | Set up a database in 5 minutes |
| [Creating databases](creating-databases.md) | Database provisioning options |
| [Branching](branching.md) | Fork a database for development, testing, and CI |
| [Backups and restore](backups.md) | Back up a database and roll it back |
| [Importing data](importing-data.md) | Restore a `pg_dump` and bulk-load rows with `COPY` |
| [Query Builder API](query-builder-api.md) | Complete SDK query reference |
| [REST API](rest-api.md) | HTTP endpoints for queries |
| [Direct connection](direct-connection.md) | Connect from your functions |
| [Row-level security](row-level-security.md) | Secure data per user |
| [Auth helpers](auth-helpers.md) | SQL functions for user context |
| [Connection strings](connection-strings.md) | Connection details and pooling |
