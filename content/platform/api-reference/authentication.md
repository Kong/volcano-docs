---
title: "Authentication"
description: "How to authenticate API requests."
---

How to authenticate API requests.

## Token types

| Token type | Used for | Header | Source |
|------------|----------|--------|--------|
| Platform token | Project management | `Authorization: Bearer TOKEN` | Management API |
| Anon key | Public auth endpoints | `Authorization: Bearer KEY` | Project settings |
| Access token | User operations | `Authorization: Bearer TOKEN` | Signup/signin |
| Service key | Admin operations | `Authorization: Bearer TOKEN` | Create via API |

## Anon key

| Property | Value |
|----------|-------|
| Purpose | Signup, signin, refresh, logout |
| Source | Project Settings → Authentication → Anon Keys |
| Safe to expose | Yes (in frontend code) |
| Scope | Single project |

```http
POST /auth/signup
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Access token

| Property | Value |
|----------|-------|
| Purpose | Invoking functions, accessing user profile |
| Source | Signup/signin response (`access_token` field) |
| Lifetime | 1 hour (configurable) |
| Contains | user_id, email, project_id, role |

```http
POST /functions/func-id/invoke
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Platform token

| Property | Value |
|----------|-------|
| Purpose | Managing projects, functions, databases |
| Source | Management API (port 8001) |
| Scope | Your account (all projects) |

```http
GET /projects
Authorization: Bearer 64-character-hex-string...
```

## Service key

| Property | Value |
|----------|-------|
| Purpose | Background jobs, cron, webhooks |
| Source | `POST /projects/{id}/service-keys` |
| Scope | Single project |
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

| Status | Cause |
|--------|-------|
| 401 Unauthorized | Missing Authorization header, invalid token, expired token, or token for wrong project |
| 403 Forbidden | Valid token but no permission, CORS blocked, anon key revoked, or account banned |

## What's next

| Guide | Description |
|-------|-------------|
| [Auth endpoints](auth-endpoints.md) | Using anon keys and access tokens |
| [Token types](../authentication/security/token-types.md) | Detailed comparison |
| [Anon keys](../authentication/security/anon-keys.md) | Anon key security model |




