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
      "storage_bytes": 1610612736,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

`storage_bytes` is the database's latest observed storage: its own on-disk size,
plus what each of its [branches](../databases/branching.md#what-a-branch-costs)
has diverged from it, plus what its
[backups](../databases/backups.md#what-backups-cost) cost to hold. It is the
figure your storage allowance is enforced against, and the
[stats endpoint](#get-database-stats) breaks it down. A background pass records
it, so it is absent until the database has been sampled and can trail the stats
endpoint's `current_storage_bytes`, which measures on request.

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

**Note:** `connection_string` is only shown when `status` is `active`. Use this connection string to connect from your functions or applications. It contains Volcano-managed per-database client credentials (`volcano_client_{database_id}` with a `vpg_` password); internal credentials are never returned and will not authenticate through pgproxy.

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

**Limit:** Each project can hold 1 database on Free and up to 10,000 on Pro. Creating a database over the plan's cap returns `403 Forbidden`.

## Delete Database

```http
DELETE /projects/{projectId}/databases/{databaseName}
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

Permanently deletes the database. Cannot be undone.

Returns `409` while a restore is running on the database; wait for it to finish.
If Volcano cannot tell whether one is running it returns `503` rather than delete
a database that might be mid-restore — retry.

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
The previous Volcano password stops opening new connections within a few seconds
of the reset, and connections already open are not interrupted. Reset does not
expose or rotate the internal owner password.

Returns `409` while a restore is running on the database — a restore rewrites the
credentials on its way out — and `503` if Volcano cannot tell whether one is.

## Branches

A branch is a copy-on-write fork of a database. See
[Branching](../databases/branching.md) for the concepts; this section is the
endpoint reference.

### List Branches

```http
GET /projects/{projectId}/databases/{databaseName}/branches
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31",
      "database_id": "abc-123-456-789",
      "project_id": "11111111-1111-1111-1111-111111111111",
      "name": "feature_checkout",
      "status": "active",
      "ttl_seconds": 86400,
      "expires_at": "2024-01-02T00:00:00Z",
      "storage_bytes": 536870912,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:05Z"
    }
  ]
}
```

Every branch is listed, including those still provisioning and those that
failed, since each still holds a name. Connection strings are omitted — fetch a
single branch to get its connection string.

### Create Branch

```http
POST /projects/{projectId}/databases/{databaseName}/branches
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "feature_checkout",
  "ttl_seconds": 86400
}
```

**Response:** `202 Accepted`, with the branch in `provisioning` and no
connection string. Poll [Get Branch](#get-branch) until it reports `active`.

`ttl_seconds` is between `3600` and `2592000` (one hour to 30 days) and defaults
to seven days. Names are lowercase letters, numbers, and underscores, up to 64
characters, unique within the parent database.

| Status | Meaning |
|---|---|
| `400` | Invalid name or lifetime |
| `403` | Branch allowance reached, or branching is not on this plan |
| `404` | Project or database not found |
| `409` | Name already exists, or the database cannot be branched right now |
| `503` | Branching is temporarily unavailable |

**Limit:** 10 branches per database on Free, 25 on Pro. Branches in every state
count, including those still provisioning.

### Get Branch

```http
GET /projects/{projectId}/databases/{databaseName}/branches/{branchName}
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31",
  "database_id": "abc-123-456-789",
  "project_id": "11111111-1111-1111-1111-111111111111",
  "name": "feature_checkout",
  "status": "active",
  "connection_string": "postgresql://volcano_client_9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31:vpg_xyz789@database.volcano.dev:5432/main_db?sslmode=require&application_name=volcano_full_access",
  "ttl_seconds": 86400,
  "expires_at": "2024-01-02T00:00:00Z",
  "storage_bytes": 536870912,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:05Z"
}
```

`connection_string` is present only while the branch is `active`. It carries the
branch's own username and password; `application_name` selects the access mode
exactly as it does for the parent. `storage_bytes` is the branch's divergence
from its parent, not its apparent size.

### Extend Branch

```http
PATCH /projects/{projectId}/databases/{databaseName}/branches/{branchName}
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "ttl_seconds": 604800
}
```

Replaces the branch's lifetime and restarts the countdown from now. The new
duration is remembered, so a later reset re-arms the same lifetime.

### Reset Branch

```http
POST /projects/{projectId}/databases/{databaseName}/branches/{branchName}/reset
Authorization: Bearer <platform_token>
```

Discards everything written on the branch and re-forks it from the parent as it
is now. The branch keeps its name and connection string, and its lifetime is
re-armed. It does not serve connections for the duration of the reset.

Returns `202` with the branch in `provisioning`; the rewind runs in the
background. Poll the branch until it reports `active` before connecting again.

Returns `409` if the branch is not active, a reset is already in progress, or the
parent database is being restored — a reset re-forks from the parent, so it waits
for the restore and for the provider's cooldown afterwards.

### Rotate Branch Password

```http
POST /projects/{projectId}/databases/{databaseName}/branches/{branchName}/reset-password
Authorization: Bearer <platform_token>
```

Issues a new password and invalidates the previous connection string. Existing
connections are not interrupted, and the previous password stops opening new
ones within a few seconds. The parent database's credentials are untouched.

### Delete Branch

```http
DELETE /projects/{projectId}/databases/{databaseName}/branches/{branchName}
Authorization: Bearer <platform_token>
```

**Response:** `202 Accepted`

```json
{
  "status": "deleting",
  "message": "branch deletion in progress"
}
```

The branch stops accepting connections at once; its fork and its row are removed
by a background job. Deleting a branch that is still provisioning is allowed and
stops the build, and repeating the call while teardown is in progress is accepted
again. Once the branch is gone the call returns `404`.

### Query a Branch

Every `/query/*` verb has a branch-targeted twin:

```http
POST /databases/{databaseName}/branches/{branchName}/query/select
Authorization: Bearer <service_key or auth_user_access_token>
Content-Type: application/json
```

The request and response bodies are identical to the parent routes documented
under [Database Query API](#database-query-api). The same tokens work — service
keys and end-user tokens are project-scoped — and anonymous keys are rejected on
a branch just as they are on a parent. A branch that does not exist answers
`404`, indistinguishable from a database that does not exist.

## Backups

A backup is a copy of the database at a point in time. See [Backups and
restore](../databases/backups.md) for the concepts; this section is the endpoint
reference. Backups cover the database itself — branches are neither backed up
nor restored.

Every endpoint in this section is Pro-only. On the Free plan they all answer
`403`, reads included.

### List Backups

```http
GET /projects/{projectId}/databases/{databaseName}/backups
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "data": [
    {
      "name": "before_migration",
      "source": "manual",
      "size_bytes": 41943040,
      "expires_at": "2024-01-31T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "restore_window": {
    "earliest_restore_at": "2023-12-25T00:00:00Z",
    "latest_restore_at": "2024-01-01T00:00:00Z"
  }
}
```

Newest first. `source` is `manual` or `scheduled`; only `manual` backups count
against the plan's allowance. `size_bytes` is absent until the storage provider
has costed the backup. `restore_window` is the span a point-in-time restore may
target, and is absent on a plan without point-in-time restore. This route keeps
working while a restore is running.

A database with no storage behind it yet — typically one still provisioning —
answers `409` on the backup and schedule reads. Every other status reads fine,
including a database being restored.

### Create Backup

```http
POST /projects/{projectId}/databases/{databaseName}/backups
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "before_migration"
}
```

**Response:** `201 Created` with the backup. Backups are taken synchronously —
there is nothing to poll.

Names are lowercase letters, numbers, underscores, and hyphens, up to 63
characters, unique within the database. Names beginning with `volcano-` are
reserved for the platform's own snapshots.

| Status | Meaning |
|---|---|
| `400` | Invalid backup name |
| `403` | Backup allowance reached, or backups are Pro-only |
| `404` | Project or database not found |
| `409` | Name already exists, a backup was taken less than a minute ago, or the database is restoring |
| `503` | Backups are temporarily unavailable |

**Limit:** 50 backups per database on Pro, counting only backups you took. Free
has none — every endpoint in this section answers `403`.

### Get Backup

```http
GET /projects/{projectId}/databases/{databaseName}/backups/{backupName}
Authorization: Bearer <platform_token>
```

Returns one backup. A name that does not exist answers `404`.

### Delete Backup

```http
DELETE /projects/{projectId}/databases/{databaseName}/backups/{backupName}
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "status": "deleted",
  "message": "backup deleted"
}
```

Frees the backup's storage. Scheduled backups can be deleted too. A backup that
is already gone answers `404`, and a database being restored answers `409`: the
restore may still need the backup it is pinned to.

### Get Backup Schedule

```http
GET /projects/{projectId}/databases/{databaseName}/backup-schedule
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "entries": [
    { "frequency": "daily", "hour": 3, "retention_seconds": 2592000 }
  ]
}
```

An empty `entries` list means no automated backups.

### Replace Backup Schedule

```http
PUT /projects/{projectId}/databases/{databaseName}/backup-schedule
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "entries": [
    { "frequency": "daily", "hour": 3 },
    { "frequency": "weekly", "hour": 4, "day": 6, "retention_seconds": 1209600 }
  ]
}
```

Replaces the schedule wholesale; an empty list stops automated backups. The
response is the stored schedule, including the retention that was applied.

`frequency` is `daily`, `weekly`, or `monthly`. `hour` is UTC (`0`-`23`). `day`
is the day of the week (`1`-`7`, Monday to Sunday) for a weekly entry or the day
of the month (`1`-`28`) for a monthly one; it is required for both and ignored
for a daily entry. `retention_seconds` defaults to the plan's retention and is
clamped to it.

Scheduled backups do not count against the plan's backup allowance.

| Status | Meaning |
|---|---|
| `400` | Invalid frequency, hour, or day |
| `403` | Backups are Pro-only |
| `409` | The database is not active |

### List Restores

```http
GET /projects/{projectId}/databases/{databaseName}/restores
Authorization: Bearer <platform_token>
```

Returns the database's restore history, newest first, capped at the 50 most
recent with no pagination. Readable during a restore.

### Restore Database

```http
POST /projects/{projectId}/databases/{databaseName}/restores
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:** exactly one of `backup_name` or `restore_to`.
```json
{
  "backup_name": "before_migration"
}
```

```json
{
  "restore_to": "2024-01-01T09:30:00Z"
}
```

**Response:** `202 Accepted`
```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database_id": "abc-123-456-789",
  "project_id": "11111111-1111-1111-1111-111111111111",
  "kind": "snapshot",
  "status": "pending",
  "backup_name": "before_migration",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

The restore runs in the background with the database in `restoring` and not
accepting connections. Poll [Get Restore](#get-restore) until it reports
`completed`. Restores are in place and destructive: data written after the
restored point is discarded, and the connection string is unchanged throughout.

`restore_to` must fall inside the `restore_window` from [List
Backups](#list-backups).

| Status | Meaning |
|---|---|
| `400` | Both targets or neither, or a time outside the window |
| `403` | Backups and point-in-time restore are Pro-only |
| `404` | Project, database, or backup not found |
| `409` | A restore is already in progress, the database is not active, another database operation is running, or too many pre-restore states are still held open |
| `503` | Restores are temporarily unavailable |

### Get Restore

```http
GET /projects/{projectId}/databases/{databaseName}/restores/{restoreId}
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database_id": "abc-123-456-789",
  "project_id": "11111111-1111-1111-1111-111111111111",
  "kind": "point_in_time",
  "status": "completed",
  "restore_to": "2024-01-01T09:30:00Z",
  "completed_at": "2024-01-01T12:03:20Z",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:03:20Z"
}
```

`kind` is `snapshot` or `point_in_time`, and the restore carries whichever of
`backup_name` and `restore_to` it was started with. `status` is `pending`,
`running`, `completed`, `failed`, or `exhausted`; an attempt that fails with tries
left goes back to `pending`, while `failed` and `exhausted` both mean Volcano gave
up. Either leaves the database `failed` if its data may already have been
replaced, and `active` if the restore never started — a backup that is gone from
the provider ends the restore without touching the database. `error` carries why
the most recent attempt failed.

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
  "current_storage_bytes": 1610612736,
  "current_storage_mb": 1536.0,
  "branches": [
    { "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31", "name": "feature_checkout", "storage_bytes": 536870912 }
  ],
  "backup_storage_bytes": 429496729,
  "storage_bytes": 12345678,
  "data_written_bytes": 9876543,
  "data_transfer_bytes": 5432109,
  "compute_time_seconds": 123.45,
  "active_time_seconds": 456.78,
  "time_range": "2024-01-01T00:00:00Z to 2024-01-02T00:00:00Z",
  "granularity": "hourly"
}
```

`current_storage_bytes` is the on-disk size right now: the database itself, plus
every branch's divergence from it, plus what its backups cost to hold. This is the
figure your storage allowance is enforced against. `branches` and
`backup_storage_bytes` break it down, and `branches` is ordered most expensive
first.

A branch is charged only for what it has written since the fork. A backup is not:
one you take is charged as a full copy of the database as it was then, and a
schedule's later snapshots only for what they add. `backup_storage_bytes` is
sampled from the provider rather than measured live, so it can lag a change by a
few minutes; it is zero on a plan without backups. See
[what backups cost](../databases/backups.md#what-backups-cost).

`storage_bytes` is the historical synthetic storage figure from the consumption
API and is unrelated.

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
- `restoring` - Being restored; not connectable, and most operations on it return `409`
- `failed` - Creation failed, or a restore gave up after its data may have been replaced
- `deleting` - Being torn down

## See Also

- [Creating Databases](../databases/creating-databases.md)
- [Branching](../databases/branching.md)
- [Backups and restore](../databases/backups.md)
- [Connection Strings](../databases/connection-strings.md)
- [Row-Level Security](../databases/row-level-security.md)
