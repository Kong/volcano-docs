---
title: "OAuth API reference"
description: "API reference for OAuth/SSO provider authentication."
---

API reference for OAuth/SSO provider authentication.

## Overview

Volcano supports OAuth 2.0 authentication with major identity providers:
- Google
- GitHub
- Microsoft (Azure AD / Personal accounts)
- Apple Sign In

Before upgrading an existing redirect-based integration, register every callback
URL in the project's `allowed_redirect_urls`. Authorization and in-flight
callbacks fail closed when the allowlist is empty or the exact scheme, host,
port, path, and query do not match. Flows that omit `redirect_url` and receive
the token response as JSON are unchanged.

## Endpoints

### Public OAuth flow

#### Start OAuth authorization

```http
GET /auth/oauth/{provider}/authorize
```

Redirects user to OAuth provider for authorization.

**Path Parameters:**
- `project_id` - UUID of your project
- `provider` - One of: `google`, `github`, `microsoft`, `apple`

**Query Parameters:**

- `anon_key` - Project anon key (required)
- `redirect_url` - URL to redirect to after OAuth completes. Must exactly
  match an entry in the project's `allowed_redirect_urls`, including the query
  string (see [Managed hosted pages](../authentication/managed-hosted-pages.md)),
  or be the project's own managed hosted-auth page URL. Omit `redirect_url` to
  get the token response as JSON from the callback instead of a redirect.
- `client_state` - Optional application nonce that is echoed after the callback
- `response_mode` - Set to `code` to return a short-lived code to the registered
  `redirect_url`, then exchange it at `POST /auth/oauth/exchange`

**Response:** `307 Temporary Redirect` to OAuth provider

**Errors:**
- `404` - OAuth provider not configured
- `400` - OAuth provider is disabled
- `400` - `redirect_url` is not registered in `allowed_redirect_urls`

**Example:**
```bash
curl -i \
  'http://localhost:8000/auth/oauth/google/authorize?anon_key=<anon_key>&redirect_url=http%3A%2F%2Flocalhost%3A3000%2Fcallback&response_mode=code'
```

---

#### Handle OAuth callback

```http
GET /auth/oauth/{provider}/callback?code={code}&state={state}
```

OAuth provider calls this endpoint after user authorization.

**Path Parameters:**
- `project_id` - UUID of your project
- `provider` - OAuth provider used

**Query Parameters:**
- `code` - Authorization code from provider (required)
- `state` - CSRF protection state (required)
- `error` - Error code if authorization failed

**Response:**
- `303 See Other` - Registered browser redirect with a single-use `code` and
  optional application `state`; no session tokens are placed in the URL
- `200 OK` - Existing user signed in when `redirect_url` was omitted
- `201 Created` - New user signed in when `redirect_url` was omitted

**Response Body:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_abc123...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed": true,
    "raw_user_meta_data": {
      "name": "John Doe",
      "picture": "https://...",
      "provider": "google",
      "email_verified": true
    },
    "status": "active",
    "created_at": "2026-01-03T10:00:00Z"
  }
}
```

**Errors:**
- `400` - Missing/invalid code or state
- `400` - State parameter expired (10 min timeout)
- `400` - the redirect URL stored with this flow is no longer registered in
  `allowed_redirect_urls` (re-checked at callback time, in case the allowlist
  changed after authorization started)
- `403` - the provider's email domain is not in `allowed_email_domains`. Creating
  an account is refused under `signup` and `signup_and_signin`; signing in an
  already-linked account is refused under `signup_and_signin`. See
  [Email Domain Allowlist](../authentication/configuration/email-domain-allowlist.md)
- `409` - Email already exists (requires linking)

---

#### Exchange callback code

```http
POST /auth/oauth/exchange
Authorization: Bearer {anon_key}
Content-Type: application/json

{
  "code": "{callback_code}",
  "redirect_url": "https://yourapp.com/auth/callback"
}
```

Atomically consumes the short-lived callback code and returns the
`AuthTokenResponse` shown above. The project and exact redirect URL must match
the authorization request. A replay, expired code, or redirect mismatch returns
`400 Bad Request`.

The code outlives the callback that issued it, so email confirmation and the
email domain policy are both re-checked here: either returns `403 Forbidden`.

---

### User OAuth management

#### List linked providers

```http
GET /auth/oauth/providers
Authorization: Bearer {access_token}
```

Get list of OAuth providers linked to current user.

**Headers:**
- `Authorization` - Bearer token (user's access token)

**Response:**
```json
{
  "providers": [
    {
      "provider": "google",
      "linked_at": "2026-01-03T10:00:00Z",
      "updated_at": "2026-01-03T10:00:00Z"
    },
    {
      "provider": "github",
      "linked_at": "2026-01-05T14:30:00Z",
      "updated_at": "2026-01-05T14:30:00Z"
    }
  ]
}
```

**Errors:**
- `401` - Not authenticated or invalid token

---

#### Link OAuth provider

```http
POST /auth/oauth/{provider}/link
Authorization: Bearer {access_token}
```

Link OAuth provider to current authenticated user.

**Path Parameters:**
- `provider` - Provider to link: `google`, `github`, `microsoft`, `apple`

**Query Parameters (Optional):**
- `redirect_url` - URL to redirect to after linking completes. Same
  `allowed_redirect_urls` requirement as the authorize endpoint above.

**Headers:**
- `Authorization` - Bearer token (user's access token)

**Response:**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

User should be redirected to `authorization_url`. After authorization, provider will be linked.

**Errors:**
- `401` - Not authenticated
- `404` - OAuth provider not configured
- `409` - Provider already linked
- `400` - Provider is disabled
- `400` - `redirect_url` is not registered in `allowed_redirect_urls`

---

#### Unlink OAuth provider

```http
DELETE /auth/oauth/{provider}/unlink
Authorization: Bearer {access_token}
```

Remove OAuth provider from user's account.

**Path Parameters:**
- `provider` - Provider to unlink

**Headers:**
- `Authorization` - Bearer token (user's access token)

**Response:** `204 No Content`

**Errors:**
- `401` - Not authenticated
- `404` - Provider not linked
- `400` - Cannot unlink last authentication method

**Security:** Users cannot remove their only authentication method. They must have a password OR another OAuth provider.

---

### Admin OAuth configuration

#### List OAuth configurations

```http
GET /projects/{project_id}/oauth/configs
Authorization: Bearer {platform_token}
```

List all OAuth configurations for a project.

**Headers:**
- `Authorization` - Bearer token (platform admin token)

**Response:**
```json
{
  "configs": [
    {
      "id": "uuid",
      "provider": "google",
      "client_id": "123456.apps.googleusercontent.com",
      "enabled": true,
      "redirect_url": "https://yourapp.com/callback",
      "scopes": ["openid", "email", "profile"],
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Note:** `client_secret` is NOT included for security.

---

#### Get OAuth configuration

```http
GET /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
```

Get specific OAuth configuration.

**Response:**
```json
{
  "id": "uuid",
  "provider": "google",
  "client_id": "123456.apps.googleusercontent.com",
  "client_secret": "GOCS...****",  // Masked
  "enabled": true,
  "redirect_url": "https://yourapp.com/callback",
  "scopes": ["openid", "email", "profile"],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Note:** Secret is masked (first 4 + last 4 chars shown).

---

#### Create OAuth configuration

```http
POST /projects/{project_id}/oauth/configs
Authorization: Bearer {platform_token}
Content-Type: application/json

{
  "provider": "google",
  "client_id": "123456.apps.googleusercontent.com",
  "client_secret": "GOCSPX-your-secret",
  "redirect_url": "https://yourapp.com/auth/callback",
  "scopes": ["openid", "email", "profile"]
}
```

**Request Fields:**
- `provider` - Required: `google`, `github`, `microsoft`, `apple`, `device`
- `client_id` - Required: Client identifier
- `client_secret` - Required for non-device providers, not used for `device`
- `redirect_url` - Required for non-device providers, not used for `device`
- `scopes` - Optional for non-device providers (uses defaults), not used for `device`

For `provider=device` (RFC8628 CLI/device flow), a minimal payload is:

```json
{
  "provider": "device",
  "client_id": "myapp-cli"
}
```

> **Custom verification page:** the device-approval page is configured on the
> project's auth config, not on the device client. Set `device_verification_url`
> via `PATCH /auth/config` to point device logins at your own RFC 8628 page;
> otherwise the managed device page is used. See
> [Auth endpoints](auth-endpoints.md) and
> [Custom verification page](../authentication/managed-hosted-pages.md#custom-verification-page).

**Response:** `201 Created` with OAuth configuration (secret masked)

**Errors:**
- `400` - Invalid provider or redirect URL
- `409` - Provider already configured

**Redirect URL validation:**

| URL | Valid | Reason |
|-----|-------|--------|
| `https://yourapp.com/callback` | Yes | HTTPS with valid domain |
| `http://localhost:8080/callback` | Yes | Development only |
| `http://evil.com@yourapp.com/callback` | No | Contains @ character |
| `javascript:alert(1)` | No | Invalid protocol |

---

#### Update OAuth configuration

```http
PUT /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
Content-Type: application/json

{
  "client_id": "new-client-id",
  "client_secret": "new-secret",
  "redirect_url": "https://newapp.com/callback",
  "scopes": ["openid", "email"],
  "enabled": false
}
```

All fields are optional. Only provided fields will be updated.

For `provider=device`, use query parameter `client_id` to identify which device client to update:

```http
PUT /projects/{project_id}/oauth/configs/device?client_id=myapp-cli
```

Device clients only support updating:
- `client_id`
- `enabled`

`client_secret`, `redirect_url`, and `scopes` are not supported for `provider=device`.

**Response:** `200 OK` with updated configuration

---

#### Delete OAuth configuration

```http
DELETE /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
```

Remove OAuth configuration for a provider.

For `provider=device`, use query parameter `client_id` to identify which device client to delete:

```http
DELETE /projects/{project_id}/oauth/configs/device?client_id=myapp-cli
```

**Response:** `204 No Content`

---

#### List available providers

```http
GET /projects/{project_id}/oauth/providers
Authorization: Bearer {platform_token}
```

Get list of supported OAuth providers and their default scopes.

**Response:**
```json
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "default_scopes": ["openid", "email", "profile"]
    },
    {
      "id": "github",
      "name": "GitHub",
      "default_scopes": ["read:user", "user:email"]
    },
    {
      "id": "microsoft",
      "name": "Microsoft",
      "default_scopes": ["openid", "email", "profile"]
    },
    {
      "id": "apple",
      "name": "Apple",
      "default_scopes": ["email", "name"]
    }
  ]
}
```

---

## Security

### CSRF protection

OAuth flow uses `state` parameter to prevent CSRF attacks:
- State is randomly generated (32 bytes, base64 encoded)
- State is verified in callback
- State expires after 10 minutes
- State is one-time use only

### Open redirect prevention

Redirect URLs are validated:
- Must use `http` or `https` protocol
- Cannot contain `@` character (prevents `http://evil.com@yourapp.com`)
- No wildcards allowed

### Client secret protection

- Secrets are encrypted with AES-256-GCM before database storage
- Automatic encryption/decryption in database layer
- Secrets are masked in API responses
- Secrets not included in list endpoints
- Only first 4 and last 4 characters shown in GET requests
- Requires ENCRYPTION_KEY environment variable (32 bytes)

### Email conflict handling

If OAuth email already exists:
- Returns `409 Conflict` error
- User must sign in with password
- User can then link OAuth provider via `/link` endpoint
- Prevents account takeover

### Last authentication method

Users cannot remove their only authentication method:
- If user has ONLY OAuth (no password) → cannot unlink
- If user has password AND OAuth → can unlink OAuth
- If user has multiple OAuth → can unlink any single one
- Prevents account lockout

## Provider differences

### Google
- **User ID:** Numeric string
- **Email:** Always provided
- **Email verified:** Yes
- **Scopes:** `openid`, `email`, `profile`

### GitHub
- **User ID:** Numeric
- **Email:** Might be private (user setting)
- **Email verified:** Assumed true if provided
- **Scopes:** `read:user`, `user:email`

### Microsoft
- **User ID:** UUID
- **Email:** From `mail` or `userPrincipalName`
- **Email verified:** Assumed true
- **Works with:** Personal accounts AND Azure AD
- **Scopes:** `openid`, `email`, `profile`

### Apple
- **User ID:** Stable subject identifier
- **Email:** Might be Apple relay address
- **Email verified:** Explicitly provided
- **Name:** Only sent on first authorization
- **Scopes:** `email`, `name`

## Error codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad request (invalid params) | Check request parameters |
| 401 | Not authenticated | Provide valid access token |
| 404 | Provider not configured | Configure OAuth provider first |
| 409 | Conflict (duplicate) | Provider already exists or email conflict |

## Examples

See complete examples:
- [OAuth Example Application](../examples/frontend-auth-nextjs/README.md)
- [OAuth Setup Guide](../authentication/oauth-providers.md)

## Related

- [Authentication Overview](./authentication.md)
- [Email/Password Auth](./auth-endpoints.md)
- [Anon Keys](./auth-endpoints.md#anon-keys)
