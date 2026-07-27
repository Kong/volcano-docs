---
title: "Databases API"
description: "Manage PostgreSQL databases."
---

Manage PostgreSQL databases.

## List Databases

```http
GET /projects/{projectId}/databases
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "abc-123-456-789",
      "database_name": "main_db",
      "status": "active",
      "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/myapp_main?sslmode=require&application_name=volcano_full_access",
      "region": "aws-us-east-1",
      "pg_version": "16",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Get Database

```http
GET /projects/{projectId}/databases/{databaseName}
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "id": "abc-123-456-789",
  "database_name": "main_db",
  "status": "active",
  "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/myapp_main?sslmode=require&application_name=volcano_full_access",
  "region": "aws-us-east-1",
  "pg_version": "16",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Note:** `connection_string` is only shown when `status` is `active`. Use this connection string to connect from your functions or applications. It contains Volcano-managed per-database client credentials (`volcano_client_{database_id}` with a `vpg_` password); Neon credentials are never returned and will not authenticate through pgproxy.

## Create Database

```http
POST /projects/{projectId}/databases
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "main_db"
}
```

**Response:** 201 Created

Database name is normalized to PostgreSQL format (lowercase, underscores).
Names can be up to 64 characters.

**Limit:** Each project can contain up to 100 databases. Creating a database over this cap returns `403 Forbidden`.

## Delete Database

```http
DELETE /projects/{projectId}/databases/{databaseName}
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

Permanently deletes the database. Cannot be undone.

## Reset Password

```http
POST /projects/{projectId}/databases/{databaseName}/reset-password
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "message": "Password reset successful",
  "role_name": "volcano_client_11111111-1111-1111-1111-111111111111",
  "new_password": "vpg_new_secure_password",
  "connection_string": "postgresql://volcano_client_11111111-1111-1111-1111-111111111111:vpg_new_secure_password@database.volcano.dev:5432/mydb?sslmode=require&application_name=volcano_full_access"
}
```

Update your `DATABASE_URL` environment variable with the new connection string.
The previous Volcano password stops working after reset. Reset does not expose or rotate the internal Neon owner password.

## Database Query API

**Query databases directly via REST API** - no SQL required!

### SELECT - Query Data

```http
POST /databases/{databaseName}/query/select
Authorization: Bearer <auth_user_access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "table": "posts",
  "select": ["id", "title", "content"],
  "filters": [
    { "column": "status", "operator": "eq", "value": "published" },
    { "column": "views", "operator": "gt", "value": 100 }
  ],
  "order": [
    { "column": "created_at", "ascending": false }
  ],
  "limit": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Post",
      "content": "Post content",
      "status": "published",
      "views": 150,
      "created_at": "2026-01-13T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Authentication:** Requires **auth user access token** (from signup/signin), not platform token

**Row-Level Security:** Automatically enforced - users see only their own data

**Filter Operators:**
- `eq` (equals)
- `neq` (not equals)
- `gt` (greater than)
- `gte` (greater than or equal)
- `lt` (less than)
- `lte` (less than or equal)
- `like` (pattern match, case-sensitive)
- `ilike` (pattern match, case-insensitive)
- `is` (NULL check)
- `in` (array membership)

**See Also:** [REST API Guide](../databases/rest-api.md) | [Query Builder API](../databases/query-builder-api.md)

### INSERT - Create Data

```http
POST /databases/{databaseName}/query/insert
Authorization: Bearer <auth_user_access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "table": "posts",
  "values": {
    "title": "My New Post",
    "content": "Content here",
    "status": "draft"
  }
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My New Post",
      "content": "Content here",
      "status": "draft",
      "user_id": "user-uuid",
      "created_at": "2026-01-13T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Note:** `user_id` is automatically set to the authenticated user via trigger using `auth.uid()`

### UPDATE - Modify Data

```http
POST /databases/{databaseName}/query/update
Authorization: Bearer <auth_user_access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "table": "posts",
  "values": {
    "title": "Updated Title",
    "status": "published"
  },
  "filters": [
    { "column": "id", "operator": "eq", "value": "post-uuid" }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Updated Title",
      "status": "published",
      "updated_at": "2026-01-13T10:05:00Z"
    }
  ],
  "count": 1
}
```

**Row-Level Security:** If RLS blocks the update (not your data), returns empty array

### DELETE - Remove Data

```http
POST /databases/{databaseName}/query/delete
Authorization: Bearer <auth_user_access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "table": "posts",
  "filters": [
    { "column": "id", "operator": "eq", "value": "post-uuid" }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Deleted Post"
    }
  ],
  "count": 1
}
```

**Safety:** UPDATE and DELETE require at least one filter to prevent accidental mass changes

**Row-Level Security:** If RLS blocks the delete (not your data), returns empty array

---

## Get Database Stats

```http
GET /projects/{projectId}/databases/{databaseName}/stats
Authorization: Bearer <platform_token>
```

**Query Parameters:**
- `from` - Start time (RFC3339, default: 24h ago)
- `to` - End time (RFC3339, default: now)
- `granularity` - `hourly`, `daily`, `monthly` (default: `hourly`)

**Response:**
```json
{
  "storage_bytes": 12345678,
  "data_written_bytes": 9876543,
  "data_transfer_bytes": 5432109,
  "compute_time_seconds": 123.45,
  "active_time_seconds": 456.78,
  "time_range": "2024-01-01T00:00:00Z to 2024-01-02T00:00:00Z",
  "granularity": "hourly"
}
```

---

## Get Database Queries

```http
GET /projects/{projectId}/databases/{databaseName}/queries
Authorization: Bearer <platform_token>
```

Returns the database's current top queries from `pg_stat_statements`, ranked by total execution time.

**PRO plan required.**

**Query Parameters:**
- `limit` - Maximum number of queries to return, from 1 to 100 (default: 10)

**Response:**
```json
{
  "data": [
    {
      "query_id": "123456789",
      "query": "select * from posts where user_id = ?",
      "database": {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "app"
      },
      "role": "authenticated",
      "calls": 42,
      "total_exec_time_seconds": 1.25,
      "max_exec_time_seconds": 0.2,
      "mean_exec_time_seconds": 0.03,
      "min_exec_time_seconds": 0.01,
      "rows_processed": 420
    }
  ]
}
```

## Database Status

- `provisioning` - Being created (5-10 seconds)
- `active` - Ready to use
- `failed` - Creation failed

## See Also

- [Creating Databases](../databases/creating-databases.md)
- [Connection Strings](../databases/connection-strings.md)
- [Row-Level Security](../databases/row-level-security.md)
