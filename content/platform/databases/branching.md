---
title: "Branching"
description: "Fork a database into a short-lived, isolated copy for development, testing, and CI."
---

A branch is a copy-on-write fork of one of your databases. It starts as an exact
copy of the parent's data — schema, rows, roles, and row-level security policies
— and diverges from there. Writing to a branch never touches the parent.

Branches are for work you would not want to do against production data: trying a
migration, running an integration suite, reproducing a bug against real-shaped
data, giving a pull request its own database.

Create one, wait for it to become `active`, then connect to it exactly as you
connect to any other Volcano database:

```bash
# Create the branch
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "feature_checkout", "ttl_seconds": 86400}'
```

```json
{
  "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31",
  "database_id": "abc-123-456-789",
  "project_id": "11111111-1111-1111-1111-111111111111",
  "name": "feature_checkout",
  "status": "provisioning",
  "ttl_seconds": 86400,
  "expires_at": "2024-01-02T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

Creation is asynchronous. The response is `202` with the branch `provisioning`
and no connection string. Poll until it reports `active`:

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31",
  "name": "feature_checkout",
  "status": "active",
  "connection_string": "postgresql://volcano_client_9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31:vpg_xyz789@database.volcano.dev:5432/main_db?sslmode=require&application_name=volcano_full_access",
  "ttl_seconds": 86400,
  "expires_at": "2024-01-02T00:00:00Z",
  "storage_bytes": 0,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:05Z"
}
```

Forks usually take under a minute. Volcano retries a fork that does not take, so
keep waiting while the branch reports `provisioning`. A branch reports `failed`
only once Volcano has stopped retrying; delete it and try again.

## Every branch expires

`expires_at` is a hard deadline, not a hint. When it passes, the branch stops
accepting connections and is deleted along with its data. This is deliberate: a
fork you forgot about still costs storage and still holds a copy of your
production data.

`ttl_seconds` sets the lifetime, between one hour and 30 days. It defaults to
seven days.

Extend a branch you are still working on. The countdown restarts from now:

```bash
curl -X PATCH https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl_seconds": 604800}'
```

The new duration is remembered, so a later reset re-arms the same lifetime.

## Connecting to a branch

A branch has its own connection string, its own username, and its own password.
Everything you know about connecting to a Volcano database applies unchanged,
including how `application_name` selects the access mode:

| `application_name` | Access |
|---|---|
| `volcano_full_access` | Full admin access — DDL, migrations |
| `volcano_user_access:{user_id}` | Acts as that end user; RLS enforced |
| `volcano_user_access` | Anonymous (`anon` role); RLS enforced |

```bash
psql "$BRANCH_CONNECTION_STRING"
```

The REST query API works the same way, under a branch-scoped path:

```bash
curl -X POST https://api.volcano.dev/databases/main_db/branches/feature_checkout/query/select \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"table": "posts", "select": ["id", "title"], "limit": 10}'
```

Service keys and end-user tokens are project-scoped, so the same tokens that
reach the parent reach its branches. Anonymous keys are not accepted on the
query API, on a branch or on a parent.

A branch's password only works for that branch. Handing a branch connection
string to a test runner or a preview environment does not hand it access to your
production data.

Deployed functions and frontends always see the parent. `DATABASE_URL` and the
project variables Volcano manages point at the primary database and are never
rewritten to a branch. To target a branch from your own code, pass its
connection string explicitly.

## Resetting a branch

Reset discards everything written to the branch and re-forks it from the parent
as it is right now:

```bash
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout/reset \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The call returns `202` immediately with the branch back in `provisioning`. Poll
it until it reports `active`, the same way you do after creating one:

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The branch keeps its name and its connection string, so anything holding that
string keeps working once it is active again, and its lifetime is re-armed. The
branch does not serve connections while the reset runs.

This is what makes a branch reusable in CI: reset before each run instead of
creating and destroying a branch every time.

## Rotating a branch's password

```bash
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout/reset-password \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The response carries a new connection string; the previous one stops
authenticating. Open connections are not interrupted. The parent database's
credentials are untouched.

## Deleting a branch

```bash
curl -X DELETE https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/branches/feature_checkout \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The branch stops accepting connections immediately and is removed in the
background. Deleting a branch that is still provisioning is allowed and stops
the build. Deleting a branch that is already gone succeeds.

## What a branch costs

A branch shares pages with its parent, so it is not charged for the data it
copied. What counts is how far it has diverged — the bytes it has written since
the fork:

```text
database storage = parent size + Σ (each branch's divergence)
```

That total is what your plan's storage allowance is enforced against.
`storage_bytes` on a branch is its divergence, and the database stats endpoint
breaks the total down per branch, most expensive first:

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/stats \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "current_storage_bytes": 1610612736,
  "current_storage_mb": 1536.0,
  "branches": [
    { "id": "9b1f0f4c-2b8e-4f43-9a71-1f6c2f0f2c31", "name": "feature_checkout", "storage_bytes": 536870912 },
    { "id": "3c2d1e0f-9a8b-7c6d-5e4f-3a2b1c0d9e8f", "name": "nightly_ci", "storage_bytes": 0 }
  ]
}
```

A freshly forked branch, or one that has only been read from, contributes
nothing. Resetting a branch releases what it had diverged by.

Requests against a branch count toward your database request allowance the same
as requests against the parent, and appear in the parent's query logs.

## Limits

| | Free | Pro |
|---|---|---|
| Branches per database | 10 | 25 |

The allowance is per database, not per project, and counts branches in every
state — a branch that is still provisioning holds a slot. Creating a branch over
the allowance returns `403`.

## Naming

Branch names are lowercase letters, numbers, and underscores, up to 64
characters, and unique within their parent database. Two different databases can
each have a branch called `staging`.

Creating a branch with a name that already exists returns `409` rather than a
second branch, so retrying a create that timed out cannot silently consume two
slots.

## Statuses

- `provisioning` — being forked, rebuilt after a reset, or waiting on a retry;
  not connectable, no connection string. Keep polling.
- `active` — ready to use
- `failed` — terminal. Volcano stopped retrying and the branch will not become
  `active` on its own; delete it and retry
- `deleting` — torn down; no longer accepts connections

## See Also

- [Databases API](../api-reference/databases.md) — full endpoint reference
- [Connection Strings](connection-strings.md)
- [Row-Level Security](row-level-security.md)
