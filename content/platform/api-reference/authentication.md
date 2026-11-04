---
title: 'Authentication'
description: 'How to authenticate API requests.'
---

How to authenticate API requests.

## Token types

| Token type           | Used for                                            | Header                        | Source                              |
| -------------------- | --------------------------------------------------- | ----------------------------- | ----------------------------------- |
| Platform token       | Managing every project in your account              | `Authorization: Bearer TOKEN` | `volcano login`, or the dashboard   |
| Project access token | Managing one project from CI, a script, or an agent | `Authorization: Bearer TOKEN` | `POST /projects/{id}/access-tokens` |
| Anon key             | Public auth endpoints                               | `Authorization: Bearer KEY`   | Project settings                    |
| Access token         | User operations                                     | `Authorization: Bearer TOKEN` | Signup/signin                       |
| Service key          | Admin operations                                    | `Authorization: Bearer TOKEN` | Create via API                      |

## Anon key

| Property       | Value                                         |
| -------------- | --------------------------------------------- |
| Purpose        | Signup, signin, refresh, logout               |
| Source         | Project Settings → Authentication → Anon Keys |
| Safe to expose | Yes (in frontend code)                        |
| Scope          | Single project                                |

```http
POST /auth/signup
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Access token

| Property | Value                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Purpose  | Invoking `authenticated` and `public` functions, accessing user profile |
| Source   | Signup/signin response (`access_token` field)                           |
| Lifetime | 1 hour (configurable)                                                   |
| Contains | user_id, email, project_id, role                                        |

```http
POST /functions/func-id/invoke
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Platform token

| Property | Value                                               |
| -------- | --------------------------------------------------- |
| Purpose  | Managing projects, functions, databases             |
| Source   | `volcano login` (browser sign-in), or the dashboard |
| Scope    | Your account (all projects)                         |
| Prefix   | `pk-`                                               |

```http
GET /projects
Authorization: Bearer pk-...
```

A platform token reaches every project you own. For automation, create a project access token with it instead of handing it to the job.

### Revoke the token you are using

To end a login from a script, CI job, or agent, send its token to `DELETE /user/tokens/current`:

```bash
curl -X DELETE https://api.volcano.dev/user/tokens/current \
  -H "Authorization: Bearer pk-..."
```

```http
HTTP/1.1 204 No Content
```

The call also ends the sign-in session the token came from, which revokes every other token created from that session. Every later request with the token answers `401`. Tokens from other sign-ins, and tokens created without one, keep working. Only a platform token can call it: a project access token gets `403`. In local mode the route answers `501`, because a local stack has no server-side sign-in to end.

### List and end your sessions

Your account's sign-ins are sessions: one per dashboard sign-in (`kind: browser`) and one per CLI login (`kind: cli`). A platform token can list them and end them:

| Request                             | Effect                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `GET /user/sessions`                | Lists the sessions. The one your token came from is `is_current: true`        |
| `DELETE /user/sessions/{sessionId}` | Ends one session and revokes the tokens exchanged from it; `404` if not yours |
| `DELETE /user/sessions`             | Ends every session except the current one, and revokes their exchanged tokens |

```bash
curl https://api.volcano.dev/user/sessions \
  -H "Authorization: Bearer pk-..."
```

```json
{
  "sessions": [
    {
      "id": "6f1c0b9e-1d7a-4a3e-9f0e-2a4b5c6d7e8f",
      "user_id": "0b7c6d5e-4f3a-2b1c-0d9e-8f7a6b5c4d3e",
      "provider": "device:volcano-cli",
      "kind": "cli",
      "user_agent": "volcano-cli/1.8.0",
      "is_active": true,
      "is_current": true,
      "expires_at": "2026-11-29T10:00:00Z",
      "created_at": "2026-10-30T10:00:00Z",
      "updated_at": "2026-10-30T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "total_pages": 1
}
```

Pagination matches [`GET /auth/user/sessions`](auth-endpoints.md).

A platform token created in the dashboard or through the management API, rather than by signing in, has no session. A token saved with `volcano login --token` keeps the session it came from, if any. Ending sessions does not revoke a token without one, and a call made with it has no current session, so `DELETE /user/sessions` ends every session. Revoke such a token with `DELETE /user/tokens/current`.

## Project access token

| Property    | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Purpose     | Managing one project from CI, a script, or an agent                  |
| Source      | `POST /projects/{id}/access-tokens`, which requires a platform token |
| Scope       | A single project, at `full` or `read_only`                           |
| Prefix      | `pt-`                                                                |
| Retrievable | No — the secret is returned once, at creation                        |

```http
POST /projects/7c9e6679-7425-40de-944b-e07fc1f90ae7/functions
Authorization: Bearer pt-...
```

A project token is refused on account-scoped endpoints, on other projects, and on the token-management endpoints themselves, all with `403`. A `read_only` token is refused on mutations, and on the reads that return a credential — service keys, anon keys, variable values, and database connection strings. See [Project access tokens](../authentication/security/project-access-tokens.md) and [Using the API](using-the-api.md).

## Service key

| Property     | Value                                           |
| ------------ | ----------------------------------------------- |
| Purpose      | Background jobs, cron, webhooks                 |
| Source       | `POST /projects/{id}/service-keys`              |
| Scope        | Single project                                  |
| User context | None (functions don't receive `__volcano_auth`) |

```http
POST /functions/func-id/invoke
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Header format

All use Bearer authentication:

```http
Authorization: Bearer <token>
```

Don't include:

- Extra quotes
- "Token" prefix
- Line breaks

## Error responses

| Status           | Cause                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 Unauthorized | Missing Authorization header, invalid token, expired token, revoked project access token, or token for wrong project                        |
| 403 Forbidden    | Valid token but no permission, project access token out of scope or on the wrong project, CORS blocked, anon key revoked, or account banned |

An expired and a revoked project access token both return `401 {"error": "invalid token"}`. The response does not distinguish them, so a leaked secret cannot be probed for whether it still exists; read the token's record to find out which it was.

## What's next

| Guide                                                                        | Description                               |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| [Using the API](using-the-api.md)                                            | Create a token and run a workflow with it |
| [Auth endpoints](auth-endpoints.md)                                          | Using anon keys and access tokens         |
| [Token types](../authentication/security/token-types.md)                     | Detailed comparison                       |
| [Project access tokens](../authentication/security/project-access-tokens.md) | Project-scoped API credentials            |
| [Anon keys](../authentication/security/anon-keys.md)                         | Anon key security model                   |
