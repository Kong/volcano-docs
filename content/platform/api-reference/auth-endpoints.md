---
title: "Auth Endpoints"
description: "Complete reference for authentication endpoints."
---

Complete reference for authentication endpoints.

## Public Endpoints

**Require:** Anon Key

### Sign Up

```http
POST /auth/signup
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "user_metadata": {
    "name": "John Doe"
  }
}
```

**Response:** 201 Created

```json
{
  "confirmation_required": true,
  "message": "If the account was created, a confirmation email has been sent. Confirm your email, then sign in."
}
```

Signup is session-less. Call `POST /auth/signin` after confirmation to create
a session. Existing emails receive the same acknowledgement.

**Errors:**

- `400` - Invalid email/password format
- `401` - Invalid, tampered, revoked, or wrong-project anon key
- `403` - Signups disabled, email domain not in `allowed_email_domains`, or anon key lacks `auth.signup` permission. `anonymous.volcano.internal` is reserved for anonymous accounts and is always refused
- `429` - Rate limit exceeded

---

### Sign In

```http
POST /auth/signin
Authorization: Bearer <anon_key>
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** 200 OK

The response contains an access token, refresh token, and user unless the
request uses eligible cookie session storage.

**Errors:**

- `400` - Missing email/password
- `401` - Invalid credentials, invalid/tampered/revoked anon key, or account banned/deleted
- `403` - Anon key lacks `auth.signin` permission, or the email domain is not in
  `allowed_email_domains` while `allowed_email_domains_mode` is
  `signup_and_signin`. The domain is taken from the account's canonical email —
  its primary identity — which is not necessarily the address you sign in with
- `429` - Rate limit exceeded

---

### Refresh Token

```http
POST /auth/refresh
Authorization: Bearer <anon_key>
```

**Request:**

```json
{
  "refresh_token": "f4e3d2c1..."
}
```

**Response:** 200 OK

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "f4e3d2c1...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Errors:**

- `401` - Invalid/expired refresh token, session timeout, invalid/tampered/revoked anon key
- `403` - Anon key lacks `auth.refresh` permission, or the email domain is not in
  `allowed_email_domains` while `allowed_email_domains_mode` is
  `signup_and_signin`

---

### Logout

```http
POST /auth/logout
Authorization: Bearer <anon_key>
```

**Request:**
```json
{
  "refresh_token": "f4e3d2c1..."
}
```

**Response:** 204 No Content

### Use HttpOnly cookie sessions

Use cookie mode when your browser app and the Volcano API share a schemeful
site, such as `app.example.com` and `api.example.com`. Configure the app's
exact origin in auth CORS, enable credentials, and send browser requests with
credentials:

```js
const response = await fetch('https://api.example.com/auth/signin', {
  method: 'POST',
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'correct-horse-battery-staple',
    session_mode: 'cookie',
  }),
});
const session = await response.json();
```

The API stores the refresh token in a project-scoped HttpOnly cookie and omits
it from the response. Refresh and logout with `credentials: 'include'` and
`{"session_mode":"cookie"}`; logout returns `204` even when the cookie is
missing or expired.

Wildcard CORS entries and cross-site origins do not qualify for cookie mode.
Those clients continue to receive and send `refresh_token` in JSON.

---

### Confirm Email

```http
POST /auth/confirm
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "token": "confirmation-token-from-email"
}
```

**Response:** 200 OK
```json
{
  "message": "Email confirmed successfully"
}
```

**Also possible (200 OK):**
```json
{
  "message": "Email already confirmed"
}
```

Confirms user's email address using token from confirmation email.

**Errors:**
- `400` - Missing confirmation token in request body
- `401` - Invalid/expired token or missing anon key
- `403` - CORS blocked

---

### Resend Confirmation

```http
POST /auth/resend-confirmation
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK
```json
{
  "message": "If the email exists and is unconfirmed, a confirmation link has been sent"
}
```

**Note:** Response is generic to prevent email enumeration.
If the user exists and is unconfirmed, a new token replaces the previous token
(old confirmation links become invalid). If the user does not exist or is
already confirmed, no email is sent.

**Errors:**
- `401` - Missing/invalid anon key
- `403` - CORS blocked

---

### Forgot Password

```http
POST /auth/forgot-password
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Note:** Response is always the same to prevent email enumeration.

**Errors:**
- `401` - Missing/invalid anon key
- `403` - Password reset disabled or CORS blocked

---

### Reset Password

```http
POST /auth/reset-password
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "token": "recovery-token-from-email",
  "new_password": "NewPassword123"
}
```

**Response:** 200 OK
```json
{
  "message": "Password reset successful. Please sign in with your new password."
}
```

**Effects:**
- Password updated
- Recovery token cleared
- All sessions revoked

**Errors:**
- `400` - Password doesn't meet requirements or in password history
- `401` - Invalid/expired token
- `403` - Password reset disabled

---

### Sign Up Anonymous

```http
POST /auth/signup-anonymous
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Response:** 201 Created
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "f4e3d2c1...",
  "user": {
    "id": "uuid",
    "email": "anon-xyz@anonymous.volcano.internal",
    "user_metadata": {"anonymous": true},
    "status": "active"
  }
}
```

Creates guest user without email/password.

**Errors:**
- `401` - Missing/invalid anon key
- `403` - Anonymous signins disabled or CORS blocked

---

## User Endpoints

**Require:** Access Token

### Get Current User

```http
GET /auth/user
Authorization: Bearer <access_token>
```

**Response:** 200 OK
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed": false,
    "user_metadata": {...},
    "status": "active",
    "created_at": "...",
    "last_sign_in_at": "..."
  }
}
```

---

### Update User

```http
PUT /auth/user
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "password": "newpassword123",
  "user_metadata": {
    "name": "Jane Doe"
  }
}
```

**Response:** 200 OK (updated user object)

`user_metadata` is merged by key. Existing keys that are not included in the
request remain unchanged. Set a key to `null` to remove it.
Merging is shallow: a nested object replaces the stored value for that top-level key.

**Errors:**
- `400` - Password doesn't meet requirements or in password history

---

### Convert Anonymous User

```http
POST /auth/user/convert-anonymous
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "user_metadata": {
    "name": "John Doe"
  }
}
```

**Response:** 200 OK
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {...},
    "status": "active"
  }
}
```

Converts anonymous user to authenticated user. User ID is preserved.
If `require_email_confirmation=true`, the converted user must confirm email
before email/password signin succeeds. When email sending is enabled, conversion
triggers a confirmation email.

**Errors:**
- `400` - User is already authenticated (not anonymous)
- `403` - Email domain not in `allowed_email_domains`
- `409` - Email already in use

---

### Get My Sessions

```http
GET /auth/user/sessions
Authorization: Bearer <access_token>
```

**Response:** 200 OK
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "provider": "email",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1",
      "last_ip_address": "10.0.0.50",
      "is_active": true,
      "is_current": true,
      "created_at": "2024-01-14T08:00:00Z"
    }
  ],
  "total": 1
}
```

Returns all sessions for the current user. The `is_current` field indicates which session is making the current request.

---

### Delete My Session

```http
DELETE /auth/user/sessions/{sessionId}
Authorization: Bearer <access_token>
```

**Response:** 204 No Content

Signs out from a specific device/session.

**Errors:**
- `404` - Session not found or doesn't belong to user

---

### Delete All Other Sessions

```http
DELETE /auth/user/sessions
Authorization: Bearer <access_token>
```

**Response:** 204 No Content

Signs out from all devices except the current session. Useful for "sign out everywhere else" functionality.

---

## Admin Endpoints

**Require:** Platform User Token

### List Auth Users

```http
GET /auth/users?page=1&limit=10
Authorization: Bearer <platform_token>
```

**Response:** 200 OK
```json
{
  "data": [...],
  "page": 1,
  "limit": 10,
  "total": 25,
  "has_more": true
}
```

---

### Get Auth User

```http
GET /auth/users/{userId}
Authorization: Bearer <platform_token>
```

---

### Delete Auth User

```http
DELETE /auth/users/{userId}
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

**Effect:** Soft delete (status='deleted'), all sessions revoked

---

### List User Sessions

```http
GET /auth/users/{userId}/sessions
Authorization: Bearer <platform_token>
```

**Response:** 200 OK
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "user_id": "user-uuid",
      "provider": "email",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "ip_address": "192.168.1.1",
      "expires_at": "2024-01-15T12:00:00Z",
      "last_activity_at": "2024-01-14T10:30:00Z",
      "session_started_at": "2024-01-14T08:00:00Z",
      "is_active": true,
      "created_at": "2024-01-14T08:00:00Z",
      "updated_at": "2024-01-14T10:30:00Z"
    }
  ],
  "total": 1
}
```

**Fields:**
- `provider`: Authentication method (`email`, `google`, `github`, `facebook`, `apple`, `anonymous`)
- `ip_address`: Client IP that created the session

---

### Delete User Session

Revoke a specific session (log out from one device):

```http
DELETE /auth/users/{userId}/sessions/{sessionId}
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

---

### Delete All User Sessions

Revoke all sessions (log out from everywhere):

```http
DELETE /auth/users/{userId}/sessions
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

**Use cases:**
- User reports compromised account
- Force password change
- Security incident response

---

## Anon Key Endpoints

**Require:** Platform User Token

### List Anon Keys

```http
GET /projects/{projectId}/anon-keys
Authorization: Bearer <platform_token>
```

---

### Create Anon Key

```http
POST /projects/{projectId}/anon-keys
Authorization: Bearer <platform_token>
```

**Request:**
```json
{"name": "production-key"}
```

**Response:** 201 Created (includes key_value JWT)

---

### Delete Anon Key

```http
DELETE /projects/{projectId}/anon-keys/{keyId}
Authorization: Bearer <platform_token>
```

**Response:** 204 No Content

Permanently deletes the anon key. Any clients using this key will immediately lose access.

---

### Regenerate Anon Key

```http
POST /projects/{projectId}/anon-keys/{keyId}/regenerate
Authorization: Bearer <platform_token>
```

**Response:** 200 OK (new key_value)

---

## Configuration Endpoints

### Get Config

```http
GET /projects/{projectId}/auth/config
Authorization: Bearer <platform_token>
```

---

### Update Config

```http
PUT /projects/{projectId}/auth/config
Authorization: Bearer <platform_token>
```

**Request:** (all fields optional)
```json
{
  "access_token_lifetime": 7200,
  "min_password_length": 20,
  "require_numbers": true,
  "email_enabled": true,
  "require_email_confirmation": true,
  "cors_enabled": true,
  "cors_allowed_origins": ["https://myapp.com"],
  "allowed_email_domains": ["domain1.com", "domain2.com"],
  "allowed_email_domains_mode": "signup",
  "device_verification_url": "https://myapp.com/device"
}
```

**Validation rules:**
- `min_password_length` must be between 15 and 128 Unicode characters
- `require_email_confirmation=true` requires `email_enabled=true`
- `email_enabled=false` is rejected while `require_email_confirmation=true`
- `post_auth_redirect_url` and `post_logout_redirect_url` must be present in `allowed_redirect_urls`
- `allowed_email_domains` entries must be bare domains (`domain1.com`, not
  `user@domain1.com` or `localhost`), max 100. They are stored lowercased and
  replace the previous list; `[]` removes the restriction. See
  [Email Domain Allowlist](../authentication/configuration/email-domain-allowlist.md).
- `allowed_email_domains_mode` must be `disabled`, `signup` (default), or
  `signup_and_signin`. `signup_and_signin` also blocks sign-in for accounts
  outside the list and deletes their sessions when the config is saved.
- `device_verification_url`, when set, must be a valid http/https URL. It overrides
  where device-code (CLI) logins send users to approve; the `user_code` is appended
  automatically. Unlike the redirect URLs it is **not** tied to `allowed_redirect_urls`.
  Send an empty string to clear it and fall back to the managed device page. When a
  custom URL is set, device login does not require `managed_auth_enabled` (but the
  custom page's origin must be in `cors_allowed_origins` to call `/auth/device/verify`).

---

### Send Test Email

Sends a diagnostic email using the project's **saved** SMTP config so you can
verify your setup works. Save your config first — the endpoint reads the
persisted `auth_config`, not request-time settings.

```http
POST /projects/{projectId}/auth/config/test-email
Authorization: Bearer <platform_token>
```

**Request:**
```json
{
  "to_email": "you@yourdomain.com"
}
```

Supplying `html_body` and/or `text_body` (with an optional `subject`) instead
renders a custom message — used by the template editor's "Send Test" preview.
Sending `subject` alone (no body) is rejected.

**Responses:**
- `200` — `{"success": true}` on delivery
- `400` — invalid `to_email`, or `email_enabled=false` / `smtp_host` empty, or `subject` without a body
- `403` — caller is not the project owner
- `404` — project not found
- `502` — template render failure or SMTP delivery failed (message includes the SMTP-level reason)

---

### Managed Hosted Auth Pages

Admin endpoints (platform token required):

```http
GET /projects/{projectId}/auth/hosted-pages/{pageType}
PUT /projects/{projectId}/auth/hosted-pages/{pageType}
```

Supported `pageType` values:
- `login`
- `reset-password`

Public render endpoint (no auth token):

```http
GET /projects/{projectId}/auth/hosted
GET /projects/{projectId}/auth/hosted/reset-password
```

Optional unified deep links:

```http
GET /projects/{projectId}/auth/hosted?action=login
GET /projects/{projectId}/auth/hosted?action=signup
GET /projects/{projectId}/auth/hosted?action=forgot-password
GET /projects/{projectId}/auth/hosted?action=device&user_code=ABCD-EFGH&anon_key=<anon_key>
```

Smart login helpers (public):

```http
GET /projects/{projectId}/auth/hosted/login/options?anon_key=<anon_key>
POST /projects/{projectId}/auth/hosted/login/check-email
Authorization: Bearer <anon_key>
```

Rate limiting:
- Both helper endpoints are rate limited per project and client IP.
- On abuse, they apply exponential backoff and then return `429` with `Retry-After`.

Behavior notes:
- Render requires `Accept: text/html`.
- Latest saved page content is rendered.
- Managed pages render only when `managed_auth_enabled=true`.
- `GET /projects/{projectId}/auth/hosted` is the unified login/signup/forgot-password entrypoint.
- `GET /projects/{projectId}/auth/hosted?action=device&user_code=...&anon_key=...` renders managed device authorization approval UX.
- `GET /projects/{projectId}/auth/hosted/reset-password` is the dedicated reset-password page.
- Redirect users from your app to `GET /projects/{projectId}/auth/hosted?anon_key=<anon_key>` to use managed hosted auth.
- HTML validation rejects `<script>`, `javascript:` URLs, inline event handlers, and `iframe/object/embed/meta/link` tags.
- CSS validation rejects closing `</style` and `</head` tag patterns.
- HTML and CSS are each limited to 256 KiB.
- Public render responses include strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.

---

## See Also

- [Authentication](authentication.md) - Auth headers and token types
- [Errors](errors.md) - Error handling
