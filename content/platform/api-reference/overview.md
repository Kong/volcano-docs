---
title: "API reference"
description: "The Volcano REST API lets you manage projects, deploy functions and frontends, provision databases, and handle user authentication."
---

The Volcano REST API lets you manage projects, deploy functions and frontends, provision databases, and handle user authentication.

## Base URL

```text
https://api.volcano.dev
```

For local development:

```text
http://localhost:8000
```

## Authentication

All API requests require authentication. Include your token in the `Authorization` header:

```bash
curl "https://api.volcano.dev/projects" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Different endpoints require different token types:

| Token type | Use for | Where it comes from |
|------------|---------|---------------------|
| Platform token (`pk-`) | Managing every project in your account | `volcano login`, or the dashboard |
| Project access token (`pt-`) | Managing a single project from CI, a script, or an agent | `POST /projects/{id}/access-tokens` |
| Anon key | User authentication (signup, signin, refresh) | Created with the project |
| Auth user access token | Acting as one of *your* end users: their profile, invoking functions as them | Signup/signin response |
| Service key | Admin operations, invoking functions, bypassing RLS | `POST /projects/{id}/service-keys` |

See [Authentication](authentication.md) for details on each token type, and [Using the API](using-the-api.md) for a worked example from first token to first deploy.

A machine-readable description of everything below is available at
`https://api.volcano.dev/openapi.yaml` — see [OpenAPI specification](openapi.md)
for generating a client or importing the API into a REST client.

## Request format

Send JSON data in request bodies:

```bash
curl -X POST "https://api.volcano.dev/projects" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project"}'
```

For file uploads (function deployment), use `multipart/form-data`:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=hello" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler" \
  -F "code=@function.zip"
```

## Response format

### Success responses

Single resource:

```json
{
  "id": "proj_abc123",
  "name": "my-project",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

Paginated list:

```json
{
  "data": [
    { "id": "proj_abc123", "name": "project-1" },
    { "id": "proj_def456", "name": "project-2" }
  ],
  "page": 1,
  "limit": 10,
  "total": 25,
  "has_more": true,
  "next": "/projects?page=2&limit=10"
}
```

### Error responses

```json
{
  "error": "project not found"
}
```

## HTTP status codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Resource created |
| `204` | Success with no response body |
| `400` | Bad request — invalid parameters |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — valid token but insufficient permissions |
| `404` | Not found — resource doesn't exist |
| `409` | Conflict — duplicate resource or incompatible resource state |
| `429` | Too many requests — rate limited |
| `500` | Internal server error |
| `503` | Service unavailable — a required backend is unavailable |

## Pagination

List endpoints support pagination with `page` and `limit` parameters:

```bash
curl "https://api.volcano.dev/projects?page=2&limit=20" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

| Parameter | Default | Maximum | Description |
|-----------|---------|---------|-------------|
| `page` | 1 | — | Page number (1-indexed) |
| `limit` | 10 | 100 | Items per page |

The response includes pagination metadata:

```json
{
  "data": [...],
  "page": 2,
  "limit": 20,
  "total": 45,
  "has_more": true,
  "next": "/projects?page=3&limit=20"
}
```

## Rate limiting

The user authentication endpoints are rate limited per project and client IP, in hourly windows you [configure per project](../authentication/configuration/rate-limiting.md). They report the quota on every response:

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
```

Over the limit they return `429`:

```text
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704128400
```

`X-RateLimit-Reset` is a Unix timestamp for the end of the window. `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, and `/auth/user/change-email` send it on a `429`; `/auth/signin` and `/auth/refresh` do not.

No other endpoint sends these headers. Project management endpoints are not rate limited, so a request with a valid token is never refused for its rate. [Project locks](locks.md) and function invocation have their own limits and return `429` without these headers.

One case does return `429` without a quota header: repeatedly presenting credentials that are not recognized. Each unrecognized value has to be checked, so a client working through many of them is rationed per source. Retry with a credential that works, or check the token still exists — a valid token is answered from cache and never counts against this.

Every response says which build and region answered:

```text
X-Volcano-Version: <version>                  # production
X-Volcano-Version: <env>-<version>            # non-production (e.g. staging-xyz)
X-Volcano-Region: us-east-1                   # the region that served the request
```

Volcano's internal headers are never returned.

## CLI version gating

A CLI reports its version via the `X-Volcano-CLI-Version` request header. The API
can reply with these instructions:

- `X-Volcano-CLI-Instruction`: `suggestion_version_upgrade`,
  `require_version_upgrade`, `low_credit_warning`, or `not_enough_credit`.
- `X-Volcano-Credit-URL`: the billing page address sent with a credit instruction.
- `X-Volcano-Device-Instruction`: `reauth`.

Deprecated CLI versions are blocked with `426 Upgrade Required`. Credit
instructions explain the account state but do not block a request. Requests
without the version header are unaffected. See CLI Version Gating.

## API endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List projects |
| `GET` | `/projects/{id}` | Get a project |
| `GET` | `/deployments` | List deployments across every project you own |
| `PATCH` | `/projects/{id}` | Update project name/region policy |
| `DELETE` | `/projects/{id}` | Delete a project |

See [Projects](projects.md) for details.

### Functions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/functions` | Deploy a function |
| `GET` | `/projects/{id}/functions` | List functions |
| `GET` | `/projects/{id}/functions/{functionId}` | Get a function |
| `PATCH` | `/projects/{id}/functions/{functionId}` | Update function settings (visibility) |
| `DELETE` | `/projects/{id}/functions/{functionId}` | Delete a function |
| `POST` | `/functions/{functionId}/invoke` | Invoke a function |
| `GET` | `/functions/resolve` | Resolve function name to function ID |
| `POST` | `/projects/{id}/logs/search` | Search and filter function runtime logs |
| `GET` | `/projects/{id}/functions/{functionId}/deployments` | List function deployments |

See [Functions](functions.md) for details.

### Durable functions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/durable-functions` | Deploy a durable function |
| `GET` | `/projects/{id}/durable-functions` | List durable functions |
| `GET` | `/projects/{id}/durable-functions/{functionId}` | Get a durable function |
| `DELETE` | `/projects/{id}/durable-functions/{functionId}` | Delete a durable function |
| `GET` | `/projects/{id}/durable-functions/{functionId}/deployments` | List durable function deployments |
| `POST` | `/durable-functions/{functionId}/executions` | Start an execution with an application credential |
| `POST` | `/projects/{id}/durable-functions/{functionId}/executions` | Start an execution as the project owner |
| `GET` | `/projects/{id}/durable-functions/{functionId}/executions` | List executions |
| `GET` | `/projects/{id}/durable-functions/{functionId}/executions/{executionId}` | Get an execution |
| `POST` | `/projects/{id}/durable-functions/{functionId}/executions/{executionId}/stop` | Stop an execution |
| `GET` | `/projects/{id}/durable-functions/{functionId}/schedulers` | List schedules |
| `POST` | `/projects/{id}/durable-functions/{functionId}/schedulers` | Create a schedule |
| `GET` | `/projects/{id}/durable-functions/{functionId}/schedulers/{schedulerId}` | Get a schedule |
| `PATCH` | `/projects/{id}/durable-functions/{functionId}/schedulers/{schedulerId}` | Update a schedule |
| `DELETE` | `/projects/{id}/durable-functions/{functionId}/schedulers/{schedulerId}` | Delete a schedule |

Durable functions are a separate collection: a standard function's id is `404`
here, and a durable function's id is `404` under `/projects/{id}/functions`. See
[Durable functions](../functions/durable-functions.md) for details.

### Frontends

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/frontends` | Deploy a frontend archive (subject to plan deployment limits) |
| `GET` | `/projects/{id}/frontends` | List frontends |
| `GET` | `/projects/{id}/frontends/{frontendId}` | Get a frontend |
| `POST` | `/projects/{id}/frontends/{frontendId}/redeploy` | Redeploy latest frontend artifact |
| `DELETE` | `/projects/{id}/frontends/{frontendId}` | Delete/deprovision a frontend |
| `GET` | `/projects/{id}/frontends/{frontendId}/deployments` | List frontend deployments |
| `POST` | `/projects/{id}/logs/search` | Search and filter frontend runtime and deployment logs |

See [Frontend Endpoints](frontend-endpoints.md) for details.

### Databases

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/databases` | Create a database |
| `GET` | `/projects/{id}/databases` | List databases |
| `GET` | `/projects/{id}/databases/{databaseName}` | Get a database |
| `DELETE` | `/projects/{id}/databases/{databaseName}` | Delete a database |
| `GET` | `/projects/{id}/databases/{databaseName}/queries` | Get top query performance from `pg_stat_statements` |
| `GET` | `/databases/regions` | List available regions |
| `GET` | `/databases/versions` | List PostgreSQL versions |

See [Databases](databases.md) for details.

### Project locks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/locks/{key}/lease` | Acquire a project lease |
| `PATCH` | `/locks/{key}/lease` | Renew the owned lease |
| `DELETE` | `/locks/{key}/lease` | Release the owned lease |

These endpoints accept service-role keys only. See [Project locks](locks.md).

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Create a new user |
| `POST` | `/auth/signin` | Sign in a user |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Sign out a user |
| `GET` | `/auth/user` | Get current user |
| `PUT` | `/auth/user` | Update current user |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/reset-password` | Reset password with token |

See [Auth endpoints](auth-endpoints.md) for details.

### Service keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/service-keys` | Create a service key |
| `GET` | `/projects/{id}/service-keys` | List service keys |
| `DELETE` | `/projects/{id}/service-keys/{keyId}` | Delete a service key |

### Anon keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/anon-keys` | Create an anon key |
| `GET` | `/projects/{id}/anon-keys` | List anon keys |
| `DELETE` | `/projects/{id}/anon-keys/{keyId}` | Delete an anon key |

### Project access tokens

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/{id}/access-tokens` | Create a token and return its secret, once |
| `GET` | `/projects/{id}/access-tokens` | List tokens (`page`, `limit`, `search`, `include_revoked`) |
| `GET` | `/projects/{id}/access-tokens/{tokenId}` | Get one token's metadata |
| `DELETE` | `/projects/{id}/access-tokens/{tokenId}` | Revoke a token |
| `GET` | `/projects/{id}/access-tokens/usage` | Daily request counts for every token in the project |
| `GET` | `/projects/{id}/access-tokens/{tokenId}/usage` | Daily request counts for one token |

Creating, listing, reading, and revoking require a platform token: a project access token cannot manage project access tokens. The usage endpoints are ordinary project reads. See [Project access tokens](../authentication/security/project-access-tokens.md).

### MCP

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/mcp` | Model Context Protocol endpoint for AI agents |

This endpoint takes its project from the credential, so it accepts a project access token only. See [MCP server](../interfaces/mcp.md).

## What's next

| Reference | Description |
|-----------|-------------|
| [Using the API](using-the-api.md) | Create a token, deploy, and read logs over HTTP |
| [Authentication](authentication.md) | Token types and auth headers |
| [Projects](projects.md) | Project management API |
| [Functions](functions.md) | Function deployment and invocation |
| [Databases](databases.md) | Database provisioning |
| [Auth endpoints](auth-endpoints.md) | User authentication API |
| [MCP server](../interfaces/mcp.md) | Give an AI agent a scoped tool surface over one project |
| [Errors](errors.md) | Error codes and handling |
| [OpenAPI specification](openapi.md) | Generate a client from the machine-readable contract |
