---
title: "Databases"
description: "Serverless PostgreSQL databases powered by Neon that auto-scale, pause when idle, and support row-level security."
---

Volcano provides serverless PostgreSQL databases powered by Neon. Databases auto-scale based on usage, pause when idle, and include built-in support for row-level security.

## Features

| Feature | Description |
|---------|-------------|
| Serverless | Auto-scales compute based on demand, pauses when idle |
| PostgreSQL | Full PostgreSQL compatibility (versions 14, 15, 16) |
| Query Builder | Query from browsers without writing SQL |
| Direct connection | Connect from Lambda with standard PostgreSQL clients |
| Row-level security | Automatic data isolation per user |
| Auth helpers | Built-in functions for user context (`auth.uid()`, `auth.email()`) |
| Multiple databases | Create multiple databases per project |

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

### Direct connection (Lambda functions)

Connect directly to PostgreSQL from your Lambda functions using any PostgreSQL client:

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
  "status": "creating",
  "region": "aws-us-east-1",
  "pg_version": 16
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
| `aws-us-east-1` | US East (N. Virginia) — Default |
| `aws-us-west-2` | US West (Oregon) |
| `aws-eu-central-1` | Europe (Frankfurt) |

Get the full list of available regions:

```bash
curl "https://api.volcano.dev/databases/regions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### PostgreSQL versions

| Version | Status |
|---------|--------|
| 16 | Latest, recommended |
| 15 | Stable |
| 14 | Legacy support |

Specify the version when creating a database:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/databases" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "main", "region": "aws-eu-central-1", "pg_version": 16}'
```

## What's next

| Guide | Description |
|-------|-------------|
| [Quick start](quick-start.md) | Set up a database in 5 minutes |
| [Creating databases](creating-databases.md) | Database provisioning options |
| [Query Builder API](query-builder-api.md) | Complete SDK query reference |
| [REST API](rest-api.md) | HTTP endpoints for queries |
| [Direct connection](direct-connection.md) | Connect from Lambda functions |
| [Row-level security](row-level-security.md) | Secure data per user |
| [Auth helpers](auth-helpers.md) | SQL functions for user context |
| [Connection strings](connection-strings.md) | Connection details and pooling |
