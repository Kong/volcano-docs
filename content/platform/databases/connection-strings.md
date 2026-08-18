---
title: "Connection Strings"
description: "Connect to your PostgreSQL databases."
---

Connect to your PostgreSQL databases.

## Getting the Connection String

Get your database connection string from the API:

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

**Response:**
```json
{
  "id": "abc-123-456-789",
  "database_name": "my_app_db",
  "status": "active",
  "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/mydb?sslmode=require&application_name=volcano_full_access",
  "region": "aws-us-east-1",
  "pg_version": "16"
}
```

The `connection_string` is only shown when the database status is `active`.

## Connection String Format

Your connection string follows the standard PostgreSQL format:

```text
postgresql://username:password@hostname:port/database
```

**Example:**
```text
postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/myapp_main?sslmode=require&application_name=volcano_full_access
```

**Components:**
- `username` - Volcano-managed per-database client user (`volcano_client_{database_id}`)
- `password` - Volcano-managed generated password (starts with `vpg_`)
- `hostname` - Volcano pgproxy hostname
- `port` - 5432 (standard PostgreSQL port)
- `database` - Your database name

These are the only credentials the API returns; the internal owner credentials are never exposed and do not authenticate through pgproxy.

## Using in Functions

Volcano doesn't set `DATABASE_URL` (or any variable) automatically. Set it yourself as a project variable using the connection string from `GET /databases/{id}`:

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/variables \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -d '{"name":"DATABASE_URL","value":"postgresql://..."}'
```

Then reference it in your function:

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

## Direct Connection

You can connect directly using `psql` or any PostgreSQL client:

```bash
# Using psql with connection string
psql "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/mydb?sslmode=require&application_name=volcano_full_access"

# Using connection parameters
psql -h database.volcano.dev -p 5432 -U volcano_client_11111111-1111-1111-1111-111111111111 -d mydb
```

When prompted, enter your password (from the connection string).

## Connection Pooling

Recommended for serverless:

```javascript
const { Pool } = require('pg');

// Create pool once (outside handler)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1  // Limit connections in serverless
});

// Reuse in handlers
exports.handler = async (event) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW()');
    return { statusCode: 200, body: JSON.stringify(result.rows) };
  } finally {
    client.release();  // Always release
  }
};
```

## Security

**SSL/TLS:**
All database connections use SSL/TLS encryption by default for security.

**Keep Credentials Safe:**

> **Warning:**
> - Never commit connection strings to git
> - Use environment variables (DATABASE_URL)
> - Rotate passwords if exposed (see Resetting Passwords below)

## Connection Limits

Databases have connection limits based on your plan.

For serverless, use:
- Connection pooling (pg.Pool)
- max: 1 connection per function instance
- Always release connections

## Resetting Passwords

If connection string is compromised:

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/databases/DB_ID/reset-password \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

Rotates the Volcano-managed client password and returns a new connection string. The old password stops authenticating through pgproxy. Internal credentials are not reset or exposed.

## See Also

- [Creating Databases](creating-databases.md)
- [Row-Level Security](row-level-security.md)

