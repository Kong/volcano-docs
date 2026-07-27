---
title: "OAuth / SSO Provider Integration"
description: "Volcano Hosting supports third-party OAuth providers (Google, GitHub, Microsoft, Apple) for user authentication."
---

Volcano Hosting supports third-party OAuth providers (Google, GitHub, Microsoft, Apple) for user authentication. This allows your users to sign up and sign in using their existing accounts.

## Supported Providers

- **Google** - Sign in with Google
- **GitHub** - Sign in with GitHub  
- **Microsoft** - Sign in with Microsoft (Azure AD / Microsoft Account)
- **Apple** - Sign in with Apple

## Overview

OAuth authentication in Volcano works in three main modes:

1. **OAuth-only signup** - User creates account using OAuth provider (no password)
2. **OAuth-only signin** - User signs in with linked OAuth provider
3. **Provider linking** - User adds OAuth provider to existing password-based account

## Setup Guide

### Step 1: Configure OAuth Provider

First, configure OAuth credentials for your project via the Management API:

```bash
# Create OAuth configuration for Google
curl -X POST https://api.volcano.dev/projects/{project_id}/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "client_id": "your-client-id.apps.googleusercontent.com",
    "client_secret": "your-client-secret",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }'
```

**Important:** Keep your `client_secret` secure - it's sensitive data!

### Step 2: Get Provider Credentials

Each OAuth provider requires you to register your application and get credentials:

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `https://yourapp.com/auth/callback`
6. Copy `client_id` and `client_secret`

**Default scopes:** `openid`, `email`, `profile`

#### GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set Authorization callback URL: `https://yourapp.com/auth/callback`
4. Copy `Client ID` and generate `Client Secret`

**Default scopes:** `read:user`, `user:email`

#### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Set Redirect URI (Web): `https://yourapp.com/auth/callback`
5. Go to "Certificates & secrets" → create new client secret
6. Copy `Application (client) ID` and secret value

**Default scopes:** `openid`, `email`, `profile`

#### Apple Sign In Setup

1. Go to [Apple Developer](https://developer.apple.com/account/)
2. Certificates, Identifiers & Profiles → Identifiers
3. Create new "Services ID"
4. Enable "Sign in with Apple"
5. Configure return URLs: `https://yourapp.com/auth/callback`
6. Create private key and note key ID

**Default scopes:** `email`, `name`

### Step 3: Implement Frontend Flow

See the [frontend example](../examples/frontend-auth-nextjs/README.md) for complete implementation.

**Basic flow:**

```javascript
// 1. Start OAuth flow
function signInWithGoogle() {
  // Get authorization URL from your backend
  fetch(`/api/auth/oauth/google/authorize`)
    .then(response => {
      // Backend returns 302 redirect or authorization_url
      window.location.href = response.url;
    });
}

// 2. Handle callback
// When user is redirected back to /auth/callback?code=...&state=...
// Your backend handles this automatically and returns tokens

// 3. Store tokens
function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  // The callback endpoint processes this and returns tokens
  // Store them and redirect user to your app
}
```

## API Endpoints

### Public OAuth Flow (No Auth Required)

#### Start OAuth Authorization

```http
GET /auth/oauth/{provider}/authorize
```

Redirects user to OAuth provider for authorization.

**Providers:** `google`, `github`, `microsoft`, `apple`

**Response:** 302 Redirect to provider

---

#### OAuth Callback Handler

```http
GET /auth/oauth/{provider}/callback?code={code}&state={state}
```

Handles OAuth provider callback. Automatically called by OAuth provider.

**Response:** `201 Created` (new user) or `200 OK` (existing user)

```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_abc123",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed": true,
    "raw_user_meta_data": {
      "name": "John Doe",
      "picture": "https://...",
      "provider": "google"
    }
  }
}
```

---

### User OAuth Management (Requires Access Token)

#### List Linked Providers

```http
GET /auth/oauth/providers
Authorization: Bearer {access_token}
```

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

---

#### Link OAuth Provider

```http
POST /auth/oauth/{provider}/link
Authorization: Bearer {access_token}
```

Generates authorization URL to link provider to existing account.

**Response:**

```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

User should be redirected to this URL. After authorization, the provider will be linked to their account.

---

#### Unlink OAuth Provider

```http
DELETE /auth/oauth/{provider}/unlink
Authorization: Bearer {access_token}
```

Removes OAuth provider from user's account.

**Important:** Cannot unlink if it's the user's only authentication method.

**Response:** `204 No Content`

---

### Admin OAuth Config Management (Requires Platform Token)

#### List OAuth Configurations

```http
GET /projects/{project_id}/oauth/configs
Authorization: Bearer {platform_token}
```

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

**Note:** `client_secret` is NOT included in list responses for security.

---

#### Get OAuth Configuration

```http
GET /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
```

**Response:**

```json
{
  "id": "uuid",
  "provider": "google",
  "client_id": "123456.apps.googleusercontent.com",
  "client_secret": "GOCS...****", // Masked for security
  "enabled": true,
  "redirect_url": "https://yourapp.com/callback",
  "scopes": ["openid", "email", "profile"],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

---

#### Create OAuth Configuration

```http
POST /projects/{project_id}/oauth/configs
Authorization: Bearer {platform_token}
Content-Type: application/json

{
  "provider": "google",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "redirect_url": "https://yourapp.com/callback",
  "scopes": ["openid", "email", "profile"]  // Optional, uses defaults
}
```

**Response:** `201 Created` with configuration (secret masked)

---

#### Update OAuth Configuration

```http
PUT /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
Content-Type: application/json

{
  "client_id": "new-client-id",          // Optional
  "client_secret": "new-client-secret",  // Optional
  "redirect_url": "https://new.com/callback",  // Optional
  "scopes": ["openid", "email"],         // Optional
  "enabled": false                        // Optional
}
```

**Response:** `200 OK` with updated configuration

---

#### Delete OAuth Configuration

```http
DELETE /projects/{project_id}/oauth/configs/{provider}
Authorization: Bearer {platform_token}
```

**Response:** `204 No Content`

---

#### List Available Providers

```http
GET /projects/{project_id}/oauth/providers
Authorization: Bearer {platform_token}
```

Lists all supported OAuth providers and their default scopes.

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

## Security Considerations

### CSRF Protection

OAuth flow uses `state` parameter for CSRF protection. This is handled automatically by the Volcano API.

### Redirect URL Validation

Redirect URLs are validated to prevent **open redirect attacks**. Invalid patterns:

Invalid patterns are blocked:
- `http://evil.com@yourapp.com/callback` (contains @)
- `javascript:alert(1)` (invalid protocol)

Valid patterns are allowed:
- `https://yourapp.com/auth/callback`

### Client Secret Storage

- Secrets are encrypted with AES-256-GCM before storing
- Encryption uses ENCRYPTION_KEY environment variable
- Secrets are NEVER returned in list endpoints
- Secrets are masked in GET responses (shows first/last 4 chars)
- Automatic encryption/decryption in database layer

### Email Conflicts

If a user tries to sign up via OAuth with an email that already exists:

- **Error:** `409 Conflict` - "email already exists - please link provider to existing account"
- **Solution:** User must sign in with password, then link the OAuth provider

This prevents account takeover if someone else already has an account with that email.

### Last Authentication Method

Users cannot unlink their last authentication method:

- If user has ONLY Google linked (no password) → cannot unlink Google
- If user has password AND Google → can unlink Google
- This prevents users from locking themselves out

## User Experience Flows

### Flow 1: New User Signs Up with Google

```text
1. User clicks "Sign up with Google"
2. GET /auth/oauth/google/authorize → redirect to Google
3. User approves on Google
4. Google redirects to /auth/oauth/google/callback?code=...
5. Backend:
   - Exchanges code for access token
   - Fetches user info from Google
   - Creates new auth_user (email_confirmed=true)
   - Links Google provider to user
   - Returns access_token + refresh_token
6. User is logged in!
```

### Flow 2: Existing User Signs In with Google

```text
1. User clicks "Sign in with Google"
2. Same OAuth flow as above
3. Backend finds existing user with linked Google account
4. Returns access_token + refresh_token for that user
5. User is logged in!
```

### Flow 3: User Adds Google to Existing Account

```text
1. User is already logged in (has access_token)
2. User clicks "Link Google Account"
3. POST /auth/oauth/google/link (with access_token)
   → Returns authorization_url
4. Redirect to authorization_url
5. User approves on Google
6. Google redirects to callback
7. Backend links Google to existing user (checks access_token)
8. User now has both password AND Google login
```

## Provider-Specific Details

### Google

- **User ID:** Numeric string (e.g., "1234567890")
- **Email verified:** Yes (from Google)
- **Profile picture:** Included
- **Refresh tokens:** Supported (request offline_access scope)

### GitHub

- **User ID:** Numeric (e.g., 12345)
- **Email verified:** Assumed true if email returned
- **Profile picture:** Avatar URL included
- **Note:** Email might be private - user can hide it

### Microsoft

- **User ID:** UUID
- **Email:** From `mail` or `userPrincipalName` field
- **Email verified:** Assumed true (from Microsoft)
- **Works with:** Personal Microsoft accounts AND Azure AD

### Apple

- **User ID:** Subject identifier (stable, unique)
- **Email verified:** Explicitly provided by Apple
- **Name:** Only provided on first authorization
- **Privacy:** Email may be Apple relay address

## Troubleshooting

### "OAuth provider not configured"

**Solution:** Create OAuth config via admin API first

### "OAuth provider is disabled"

**Solution:** Update config with `"enabled": true`

### "email already exists - please link provider to existing account"

**Cause:** User trying to sign up with OAuth when email already registered

**Solution:** 
1. User signs in with password
2. User links OAuth provider
3. User can now use either method

### "cannot unlink last authentication method"

**Cause:** User trying to remove their only way to log in

**Solution:** Add password or another OAuth provider first

### "invalid state parameter"

**Causes:**
- State expired (10 minute timeout)
- State was already used (one-time use)
- CSRF attack attempt

**Solution:** Restart OAuth flow

## Testing OAuth

See the [OAuth example application](../examples/frontend-auth-nextjs/README.md) for:

- Complete frontend implementation
- Multiple provider buttons
- Provider linking UI
- Error handling
- Token management

## Production Checklist

- [ ] Register OAuth apps with each provider
- [ ] Set production redirect URLs (must use HTTPS)
- [ ] Configure OAuth in Volcano (client_id, client_secret)
- [x] Client secret encryption (AES-256-GCM)
- [ ] Set ENCRYPTION_KEY environment variable (32 bytes)
- [ ] Test each provider's OAuth flow
- [ ] Handle email conflicts gracefully
- [ ] Implement proper error messages for users
- [ ] Add provider linking UI for logged-in users
- [ ] Monitor OAuth callback failures
- [ ] Set up alerts for high OAuth error rates

## Related Documentation

- [Authentication Overview](./overview.md)
- [Email/Password Authentication](./quickstart.md)
- [Anonymous Users](./anonymous-users.md)
- [Security checklist](../guides/security-checklist.md)

