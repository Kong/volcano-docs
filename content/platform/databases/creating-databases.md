---
title: "Creating Databases"
description: "Provision PostgreSQL databases."
---

Provision PostgreSQL databases.

## List Available Regions

Get the list of available regions for database provisioning:

```bash
curl https://api.volcano.dev/databases/regions
```

**Response:**
```json
[
  {
    "id": "aws-us-east-1",
    "name": "AWS US East 1 (N. Virginia)"
  },
  {
    "id": "aws-us-east-2",
    "name": "AWS US East 2 (Ohio)"
  },
  {
    "id": "aws-eu-central-1",
    "name": "AWS Europe Central 1 (Frankfurt)"
  }
]
```

This is a public endpoint (no authentication required).

## List Available PostgreSQL Versions

Get the list of supported PostgreSQL versions:

```bash
curl https://api.volcano.dev/databases/postgres-versions
```

**Response:**
```json
[
  {
    "version": "16",
    "name": "PostgreSQL 16",
    "recommended": true,
    "default": true
  },
  {
    "version": "15",
    "name": "PostgreSQL 15"
  }
]
```

This is a public endpoint (no authentication required).

## Create a Database

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/databases \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "main_db",
    "region": "aws-us-east-1",
    "pg_version": "16",
    "database_type": "volcano-db-xs"
  }'
```

**Request Body:**
- `name` (required): Database name (lowercase, underscores)
- `region` (optional): Region ID (from `/databases/regions`)
- `pg_version` (optional): PostgreSQL version (from `/databases/postgres-versions`)
- `database_type` (optional): Compute size tier (default: `volcano-db-xs`)

**Response:**
```json
{
  "id": "db-uuid",
  "database_name": "main_db",
  "database_type": "volcano-db-xs",
  "status": "provisioning",
  "region": "aws-us-east-1",
  "pg_version": "16",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Status progression:**
- `provisioning` - Being created (5-10 seconds)
- `active` - Ready to use
- `restoring` - Being restored from a backup; not connectable, and most operations on it return `409`
- `failed` - Creation failed
- `deleting` - Being torn down

## Database Types

Choose a size based on your workload:

| Type | RAM | Use Case |
|------|-----|----------|
| `volcano-db-xs` | Up to ~1GB | Development, small apps |
| `volcano-db-s` | Up to ~4GB | Production-ready, light traffic |
| `volcano-db-m` | Up to ~8GB | Medium traffic applications |
| `volcano-db-l` | Up to ~16GB | High traffic, larger datasets |
| `volcano-db-xl` | Up to ~32GB | Heavy workloads |
| `volcano-db-2xl` | Up to ~64GB | Enterprise-scale |

**Serverless Scaling:** All databases automatically scale to zero when idle (after 3 minutes of inactivity) and scale up on demand within their type's limits.

## Update Database Type

Change the compute size of an existing database:

```bash
curl -X PATCH https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID/type \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "database_type": "volcano-db-s"
  }'
```

**Warning:** Changing the database type will briefly interrupt database connections while the compute endpoint is reconfigured.

## Get Database Details

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

When status is `active`, includes `connection_string`:

```json
{
  "id": "abc-123-456-789",
  "database_name": "main_db",
  "status": "active",
  "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/myapp_main?sslmode=require&application_name=volcano_full_access",
  "region": "aws-us-east-1",
  "pg_version": "16",
  "created_at": "2024-01-01T00:00:00Z"
}
```

Use this `connection_string` to connect from your functions or applications.
The username and password are Volcano-managed client credentials. The password starts with `vpg_`; internal credentials are never returned by the API.

## Using the Connection String

**In functions:** set `connection_string` as a project variable (e.g. `DATABASE_URL`) — Volcano doesn't set it automatically:
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

**Direct connection:**
```bash
psql "postgresql://user:pass@database.volcano.dev:5432/db"
```

## Auth Helpers (Auto-Installed)

When the database is created, Volcano automatically installs:

```sql
auth.uid()     -- Get current user ID
auth.email()   -- Get current user email
auth.role()    -- Get current user role
```

Verify:
```bash
psql $CONNECTION_STRING -c "SELECT auth.uid();"
```

See [Auth Helpers](auth-helpers.md) for usage.

## Multiple Databases

A project can hold several databases, and each one is fully isolated: it gets its
own compute, its own storage, and its own connection strings.

```text
Project "my-app"
  ├─ Database: my_app_main       (own compute + storage)
  ├─ Database: my_app_analytics  (own compute + storage)
  └─ Database: my_app_staging    (own compute + storage)
```

Because nothing is shared between them, a query load spike on one database does
not affect the others, and each scales independently within the compute size you
pick for it. There is no cross-database querying — a connection to one database
cannot read another's tables.

Each database counts against your plan's database limit, and each is billed on
its own compute usage. Creating a database with a name already used in the same
project returns `409 Conflict`; names are compared case-insensitively.

## List Databases

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/databases \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

## Delete a Database

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

This permanently deletes the database. Cannot be undone.

## Reset Password

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID/reset-password \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

**Response:**
```json
{
  "message": "Password reset successful",
  "role_name": "volcano_client_11111111-1111-1111-1111-111111111111",
  "new_password": "vpg_new_secure_password",
  "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_new_secure_password@database.volcano.dev:5432/main_db?sslmode=require&application_name=volcano_full_access"
}
```

Update your functions' DATABASE_URL with the new connection string.
The old Volcano password stops opening new connections within a few seconds of the reset; connections already open keep working until they close. The internal owner password is not rotated and is never exposed to clients.

## See Also

- [Connection Strings](connection-strings.md)
- [Row-Level Security](row-level-security.md)
- [Auth Helpers](auth-helpers.md)

