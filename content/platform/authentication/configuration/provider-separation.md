---
title: "Authentication Provider Separation"
description: "Volcano separates authentication provider configuration from the master signup toggle, giving you fine-grained control over your authentication system."
---

## Overview

Volcano separates authentication provider configuration from the master signup toggle, giving you fine-grained control over your authentication system.

## Two-Layer Architecture

### Layer 1: Provider Configuration

Controls **which authentication methods** are available:

| Provider | Config Field | Description |
|----------|--------------|-------------|
| Email/Password | `enable_email_password` | Traditional email and password authentication |
| Anonymous | `enable_anonymous_signins` | Guest mode without credentials |
| OAuth Google | OAuth config + `enabled: true` | Sign in with Google |
| OAuth GitHub | OAuth config + `enabled: true` | Sign in with GitHub |
| OAuth Microsoft | OAuth config + `enabled: true` | Sign in with Microsoft |
| OAuth Apple | OAuth config + `enabled: true` | Sign in with Apple |

### Layer 2: Master Signup Toggle

Controls **whether new users can join** via ANY enabled provider:

| Field | Description |
|-------|-------------|
| `enable_signup` | Master switch for signups across ALL providers |

When `enable_signup = false`:

| Action | Allowed |
|--------|---------|
| Existing users sign in | Yes |
| New user signup (any provider) | No |
| Session refresh and logout | Yes |

## Common Configurations

### 1. OAuth-Only Signups

Perfect for apps that want social login without password management:

```json
{
  "enable_signup": true,
  "enable_email_password": false,
  "enable_anonymous_signins": false,
  "oauth_providers": ["google", "github"]
}
```

Result:

| Method | Available |
|--------|-----------|
| New users via Google/GitHub | Yes |
| Email/password signups | No |
| Anonymous users | No |

### 2. Maintenance Mode

Temporarily stop new signups while keeping existing users working:

```json
{
  "enable_signup": false,
  "enable_email_password": true,
  "oauth_providers": ["google"]
}
```

Result:

| Method | Available |
|--------|-----------|
| New signups (any provider) | No |
| Existing users sign in | Yes |
| Provider configuration | Preserved |

### 3. Gaming App Pattern

Start as guest, upgrade to permanent account:

```json
{
  "enable_signup": true,
  "enable_email_password": false,
  "enable_anonymous_signins": true,
  "oauth_providers": ["google"]
}
```

Result:

| Method | Available |
|--------|-----------|
| Anonymous signup (guest mode) | Yes |
| Email/password | No |
| Upgrade via Google OAuth linking | Yes |

**User Flow:**
1. `POST /auth/signup-anonymous` → Guest account
2. User plays game
3. `POST /auth/oauth/google/link` → Permanent Google account

### 4. All Providers Enabled

Maximum flexibility for users:

```json
{
  "enable_signup": true,
  "enable_email_password": true,
  "enable_anonymous_signins": true,
  "oauth_providers": ["google", "github"]
}
```

Result:

| Method | Available |
|--------|-----------|
| Email/password signups | Yes |
| Anonymous signups | Yes |
| OAuth signups (Google, GitHub) | Yes |

## Anonymous User Upgrade Paths

Anonymous users can upgrade to permanent accounts in two ways:

### Convert to Email/Password

**Requirements:**
- `enable_email_password = true`
- `enable_signup = true`

**Endpoint:**
```text
POST /auth/user/convert-anonymous
Authorization: Bearer <access_token>

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Link OAuth Provider

**Requirements:**
- OAuth provider configured and enabled
- User is authenticated (anonymous or not)

**Endpoint:**
```text
POST /auth/oauth/{provider}/link
Authorization: Bearer <access_token>

Response:
{
  "authorization_url": "https://accounts.google.com/..."
}
```

Then redirect user to `authorization_url` to complete OAuth flow.

## Validation Rules

### Backend validation

The API enforces these rules:

| Rule | Description |
|------|-------------|
| Provider availability | At least one provider must be available at all times |
| Lockout prevention | Cannot disable `enable_signup` AND all providers |
| OAuth signup | Requires `enable_signup = true` |
| Anonymous signup | Requires `enable_signup = true` AND `enable_anonymous_signins = true` |
| Email/password signup | Requires `enable_signup = true` AND `enable_email_password = true` |

### Configuration warnings

The GUI shows warnings for potentially problematic configurations:

| Warning | Description |
|---------|-------------|
| Signup enabled but no providers | `enable_signup = true` but no providers configured |
| All providers disabled | Authentication is completely disabled |
| No anon keys | Frontend applications cannot authenticate |

## Migration from Old Architecture

Projects created before this change:
- `enable_email_password` automatically set to match `enable_signup`
- Behavior identical to before
- No breaking changes

## API Examples

### Enable OAuth-Only Signups

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -d '{
    "enable_signup": true,
    "enable_email_password": false
  }'
```

### Enable Maintenance Mode

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -d '{
    "enable_signup": false
  }'
```

### Check Available Methods

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/auth/methods \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

Response shows which providers are currently available.

## Best Practices

1. **Always have at least one provider enabled** - Users need a way to authenticate
2. **Create anon keys** - Required for frontend authentication
3. **Test signup flow** - Verify users can actually sign up before going live
4. **Use maintenance mode** - Safer than deleting provider configuration
5. **Document upgrade paths** - If using anonymous, explain how users become permanent

## Troubleshooting

### "Signups enabled but nothing works"

**Cause:** `enable_signup = true` but all providers disabled

**Solution:** Enable at least one provider:
- Email/Password: `enable_email_password = true`
- Anonymous: `enable_anonymous_signins = true`
- OAuth: Configure and enable at least one provider

### "Want OAuth-only but email/password still works"

**Cause:** `enable_email_password = true` (default)

**Solution:** Explicitly disable:
```json
{
  "enable_email_password": false
}
```

### "Existing users can't sign in after disabling signup"

**This is by design!** Existing users CAN still sign in when `enable_signup = false`.

If you want to block ALL authentication:
- Disable the specific provider (e.g., `enable_email_password = false`)
- Or delete/disable OAuth configurations

