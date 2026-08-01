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

| Token type | Use for | Example |
|------------|---------|---------|
| Platform token | Managing projects, deploying functions, provisioning databases | Project management API |
| Anon key | User authentication (signup, signin, refresh) | Auth endpoints with anon key |
| Access token | Accessing user profile, invoking functions as a user | User-authenticated requests |
| Service key | Admin operations, invoking functions, bypassing RLS | Backend admin operations |

See [Authentication](authentication.md) for details on each token type.

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

API requests are rate limited. Rate limit information is included in response headers:

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1704128400
```

When you exceed the rate limit, you'll receive a `429` response:

```text
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
Retry-After: 60
```

Wait until the `Retry-After` period has passed before making more requests.

Function invocation responses also include:

```text
X-Volcano-Version: <version>                  # production
X-Volcano-Version: <env>-<version>            # non-production (e.g. staging-xyz)
```

## CLI version gating

A CLI reports its version via the `X-Volcano-CLI-Version` request header. The API
replies with `X-Volcano-CLI-Instruction` (`suggestion_version_upgrade` / `require_version_upgrade`)
and `X-Volcano-Device-Instruction` (`reauth`), and hard-blocks deprecated versions
with `426 Upgrade Required`. Requests without the header are unaffected. See
CLI Version Gating.

## API endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List projects |
| `GET` | `/projects/{id}` | Get a project |
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

## What's next

| Reference | Description |
|-----------|-------------|
| [Authentication](authentication.md) | Token types and auth headers |
| [Projects](projects.md) | Project management API |
| [Functions](functions.md) | Function deployment and invocation |
| [Databases](databases.md) | Database provisioning |
| [Auth endpoints](auth-endpoints.md) | User authentication API |
| [Errors](errors.md) | Error codes and handling |
