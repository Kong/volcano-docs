---
title: "Project access tokens"
description: "Project access tokens are control-plane credentials bound to a single project, for CI, scripts, and agents that should never hold account-wide access."
---

A project access token authenticates Volcano API calls for **one project**. It starts with `pt-`, and it is what you give a CI job, a deploy script, or an AI agent instead of a platform token, whose leak would expose every project you own.

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-deploy", "scope": "full"}'
```

```json
{
  "id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "project_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "ci-deploy",
  "token_prefix": "pt-000000000",
  "scope": "full",
  "status": "active",
  "token_source": "api",
  "created_at": "2024-07-02T09:14:22Z",
  "all_time_requests": 0,
  "token": "pt-0000000000000000000000000000000000000000000000000000000000000000"
}
```

> **Warning:** `token` is returned once. Volcano stores only a hash of it, so there is no way to display, re-fetch, or decrypt it later. Save it now, or revoke the token and create another.

For the step-by-step version — first call, full workflow, error handling, moving CI off a platform token — see [Using the API](../../api-reference/using-the-api.md). The same token is what an AI agent presents to Volcano's [MCP server](../../interfaces/mcp.md), which is why that surface inherits the scope, the project binding, and the revocation described here.

## What a project access token can reach

A project access token authenticates the same control-plane API a platform token does, limited to the project it was created in:

- Deploy, update, and delete functions and frontends
- Create and delete databases, read query statistics
- Read and write project variables and settings
- Search, stream, and aggregate logs and metrics
- Manage anon keys, service keys, buckets, and auth users for that project

It cannot:

- **Touch another project.** Presenting it on a different project's route returns `403`.
- **Act on your account.** Listing your projects, creating a project, billing, and every other account-scoped endpoint returns `403`.
- **Manage project access tokens.** Creating, listing, reading, and revoking tokens all require a platform token.

That last rule is the point of the credential. A token that can mint its replacement or delete the record of its own use is not meaningfully scoped, so a leaked CI secret or a prompt-injected agent cannot clone itself or erase its tracks.

A project access token can read its own request counts, which is enough to monitor itself. The usage endpoints return only its own row; the project-wide view, listing every token by name, requires a platform token.

## Scopes

Choose the scope at creation time. It cannot be changed afterwards; create a new token instead.

| Scope | Allows |
|-------|--------|
| `full` | Everything the project owner can do on that project |
| `read_only` | Reads only, and not the reads that return a credential. Any mutation, and any request for a service key, an anon key, a variable's value, or a database connection string, returns `403` |

Read-only is enforced by what an endpoint does, not by its HTTP method. Log search, log activity, log streaming, and metrics queries are `POST` requests because they carry filters in the body, and a `read_only` token can still call all of them — which is what makes the scope usable for monitoring and for agents that should look but not touch.

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNCTION_ID" \
  -H "Authorization: Bearer $READ_ONLY_TOKEN"
```

```json
{
  "error": "project access token is read-only"
}
```

## Expiry

Pass `expires_at` as an RFC 3339 timestamp to give a token a lifetime. It must be in the future. Omit it for a token that does not expire.

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "audit-2024-q3", "scope": "read_only", "expires_at": "2024-10-01T00:00:00Z"}'
```

After that moment the token is refused with `401`. Prefer an expiry for anything short-lived: a contractor's access, an agent run, a one-off migration job.

## Revocation

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$TOKEN_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```text
HTTP/1.1 204 No Content
```

Revoking is idempotent — revoking an already-revoked token succeeds — and takes effect immediately in the region handling the call and within seconds across Volcano's other regions.

Rotation keeps the name. Only tokens that can still authenticate need distinct names, so recreating `ci-deploy` as `ci-deploy` works once the old one is revoked or has expired, and your CI config never changes. You do not have to revoke a lapsed token first — it releases its name when you ask for it, and stays recorded as `expired` rather than being marked as something you took away.

The record survives. The token's status becomes `revoked` and its name, prefix, last use, and request history stay readable, which is exactly what you need when you are revoking because a secret leaked. A token that lapses on its own reads `expired` instead — nobody took it away. Listings show only tokens that can still authenticate; pass `include_revoked=true` for the rest.

> **Important:** Revoking stops future calls. It does not undo what the token already did. Treat everything it could reach — deployed code, variables, database contents, other keys in the project — as exposed, and rotate accordingly.

Deleting a project revokes its tokens at the moment the deletion is requested, not when the teardown finishes, so they cannot keep deploying into a project on its way out.

## Limits

A project may hold at most **100 active tokens**. Creating the 101st returns `409`; revoke something you no longer use. Neither revoked nor expired tokens count.

A valid token is never refused for its rate. Presenting credentials that are *not* recognized is rationed, because each one has to be checked: a client working through many unrecognized values gets `429`. Well above any real use — a token you hold is answered without a check at all — and low enough that guessing is not free.

## Auditing what a token did

Each token records `last_used_at` (updated at most every few minutes, so it can lag slightly), `all_time_requests`, and `token_source` — whether it was created through the API, the CLI, or the dashboard.

The counts include requests the token authenticated and was then refused, such as a `read_only` token attempting a write. That is what you want after a leak: the probing is the part worth seeing, and a counter that hid it would show an idle token while someone was trying it.

For volume over time, read the per-day series:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$TOKEN_ID/usage?days=7" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "token_id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "name": "ci-deploy",
  "days": 7,
  "daily": [
    { "day": "2024-06-26", "requests": 118 },
    { "day": "2024-06-27", "requests": 96 },
    { "day": "2024-06-28", "requests": 0 },
    { "day": "2024-06-29", "requests": 0 },
    { "day": "2024-06-30", "requests": 74 },
    { "day": "2024-07-01", "requests": 131 },
    { "day": "2024-07-02", "requests": 43 }
  ],
  "total_requests": 462
}
```

Every day in the window is present, so a gap reads as `0` rather than going missing. `days` defaults to 30 and is capped at 60, which is also how long per-day counts are kept. Drop the token ID from the path for the same window broken down across every token in the project, revoked ones included.

## Choosing a credential

| | Platform token (`pk-`) | Project access token (`pt-`) | Anon key | Service key |
|---|---|---|---|---|
| Reaches | Every project you own | One project | One project | One project |
| Used for | Account and project management | Project management from CI, scripts, agents | User signup and signin from a browser | Backend data access as an admin |
| Deploy and configure | Yes | Yes (`full`), reads only with `read_only` | No | No |
| Query data, invoke functions | No | No | Limited by permissions | Yes, bypasses RLS |
| Create or delete projects | Yes | No | No | No |
| Manage project access tokens | Yes | No | No | No |
| Safe in frontend code | Never | Never | Yes | Never |
| Comes from | `volcano login` or the dashboard | `POST /projects/{id}/access-tokens` | Created with the project | `POST /projects/{id}/service-keys` |
| Readable after creation | — | No, shown once | Yes | Yes |
| If it leaks | Every project you own | One project, within its scope | Little — RLS still applies | All of that project's data |

Rules of thumb:

- **CI, scripts, agents, anything automated** — project access token. Use `read_only` unless the job deploys.
- **Creating projects, or working across several of them** — platform token, kept on a workstation.
- **Frontend code** — anon key.
- **Backend code reading or writing your users' data** — service key.

## If a token leaks

1. Revoke it. Take the seconds-long cross-region window into account before declaring the exposure closed.
2. Read its usage series and `last_used_at` to see when and how much it was used.
3. Create a replacement with a new name, and deploy it to whatever needed it.
4. Rotate everything the token could read: project variables, anon and service keys, database credentials.
5. Review deployments and log activity for the period the token was live.

Do not reuse the leaked token's name until you no longer need its record.

## What's next

| Guide | Description |
|-------|-------------|
| [Using the API](../../api-reference/using-the-api.md) | Create a token and run a full workflow with it |
| [MCP server](../../interfaces/mcp.md) | Give an AI agent a scoped tool surface over one project |
| [Token types](token-types.md) | Every credential Volcano issues |
| [Service keys](service-keys.md) | Admin keys for backend data access |
| [Anon keys](anon-keys.md) | Public keys safe for frontend use |
| [Security checklist](../../guides/security-checklist.md) | Production security review |
