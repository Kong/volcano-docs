---
title: "OAuth Provider Token Refresh"
description: "Access OAuth provider APIs (Google, GitHub, etc.) on behalf of your users."
---

Access OAuth provider APIs (Google, GitHub, etc.) on behalf of your users.

## Overview

When users sign in with OAuth, providers like Google give us two tokens:

1. **Access Token** - Short-lived (1 hour), used to call provider APIs
2. **Refresh Token** - Long-lived, used to get new access tokens

Volcano stores refresh tokens (encrypted) and can refresh access tokens on demand, allowing you to call provider APIs on behalf of your users.

## Use Cases

### Google APIs

```javascript
// Get user's Google Drive files
POST /auth/oauth/google/refresh-token
// Returns fresh access token

// Use token to call Google Drive API
GET https://www.googleapis.com/drive/v3/files
Authorization: Bearer {fresh_access_token}
```

### GitHub APIs

```javascript
// Get user's GitHub repositories
POST /auth/oauth/github/refresh-token
// Returns fresh access token

// Use token to call GitHub API
GET https://api.github.com/user/repos
Authorization: Bearer {fresh_access_token}
```

### Microsoft Graph

```javascript
// Access user's OneDrive
POST /auth/oauth/microsoft/refresh-token

// Call Microsoft Graph API
GET https://graph.microsoft.com/v1.0/me/drive/root/children
```

---

## API Reference

### Refresh Provider Token

```http
POST /auth/oauth/{provider}/refresh-token
Authorization: Bearer {user_access_token}
```

Refreshes the OAuth provider's access token using stored refresh token.

**Parameters:**
- `provider` - google, github, microsoft, or apple

**Response:**

```json
{
  "message": "Provider token refreshed successfully",
  "provider": "google",
  "expires_in": 3600
}
```

**Errors:**
- `401` - Not authenticated
- `404` - Provider not linked to user
- `400` - No refresh token available

---

### Get Current Provider Token

```http
GET /auth/oauth/{provider}/token
Authorization: Bearer {user_access_token}
```

Gets valid access token for provider. Automatically refreshes if expired.

**Response:**

```json
{
  "access_token": "ya29.a0...",
  "expires_in": 3600,
  "provider": "google"
}
```

---

## Setup

### 1. Request Offline Access Scope

To get refresh tokens, you must request the appropriate scope:

**Google:**
```json
{
  "provider": "google",
  "scopes": ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.readonly"]
}
```

Add `offline_access` or specific API scopes.

**GitHub:**
```json
{
  "scopes": ["read:user", "user:email", "repo"]
}
```

**Microsoft:**
```json
{
  "scopes": ["openid", "email", "profile", "offline_access", "Files.Read"]
}
```

### 2. Tokens Stored Automatically

When user signs in via OAuth, Volcano automatically stores:
- Provider's refresh token (encrypted with AES-256)
- Token expiration time
- Provider user ID

### 3. Refresh When Needed

```javascript
// In your application
async function callGoogleAPI(endpoint) {
  // 1. Refresh provider token
  await fetch(`/auth/oauth/google/refresh-token`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userAccessToken}` }
  });

  // 2. Get fresh token (already refreshed)
  const tokenResp = await fetch(`/auth/oauth/google/token`, {
    headers: { 'Authorization': `Bearer ${userAccessToken}` }
  });

  const { access_token } = await tokenResp.json();

  // 3. Call Google API
  const data = await fetch(`https://www.googleapis.com/drive/v3${endpoint}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  return data.json();
}
```

---

## Security

### Token Encryption

**All provider tokens encrypted with AES-256-GCM:**

```sql
-- Database storage (encrypted)
auth_providers.refresh_token = 'base64-encrypted-data'

-- NOT plaintext:
auth_providers.refresh_token ≠ '1//actual-refresh-token'
```

Protection mechanisms:

| Feature | Description |
|---------|-------------|
| Database compromise | Tokens remain protected even if database is accessed |
| AES-256 encryption | NSA Suite B compliant encryption |
| GCM mode | Tamper detection via authenticated encryption |
| Consistent encryption | Same encryption as OAuth client secrets |

### Access control

Who can refresh tokens:

| Allowed | Blocked |
|---------|---------|
| The user who linked the provider | Other users' tokens |
| Authenticated requests (valid access token) | Cross-project requests |
| Tokens tied to correct project | Unauthenticated requests |

### Token Lifecycle

**Storage:**
- Refresh token stored when user signs in via OAuth
- Encrypted before database INSERT
- Decrypted only when needed

**Refresh:**
- Used to get fresh access token from provider
- New refresh token may be returned (rotation)
- Expiration tracked automatically

**Deletion:**
- Deleted when provider unlinked
- Deleted when user deleted (CASCADE)
- Deleted when project deleted (CASCADE)

---

## Limitations

### Provider Support

| Provider | Refresh Token | Notes |
|----------|---------------|-------|
| Google | Yes | Requires `offline_access` or API scopes |
| GitHub | Yes | Refresh tokens supported |
| Microsoft | Yes | Requires `offline_access` scope |
| Apple | Limited | Apple tokens have different refresh flow |

### Token Availability

**Refresh tokens are only available if:**
1. Provider supports refresh tokens
2. Appropriate scopes requested (offline_access)
3. User granted permission during OAuth flow

**If no refresh token:**
- User must re-authenticate via OAuth
- Error: "no refresh token available for provider"

---

## Testing

### Test Token Storage

```bash
# Create user with OAuth
# Link Google provider
# Store refresh token

# Check database (should be encrypted)
psql $DATABASE_URL -c "
SELECT user_id, provider, 
       substring(refresh_token, 1, 20) as token_preview
FROM auth_providers 
WHERE provider = 'google';
"

# Should see encrypted data, NOT plaintext
```

### Test Token Refresh

```bash
# Refresh Google token
curl -X POST https://api.volcano.dev/auth/oauth/google/refresh-token \
  -H "Authorization: Bearer USER_ACCESS_TOKEN"

# Response:
{
  "message": "Provider token refreshed successfully",
  "provider": "google",
  "expires_in": 3600
}
```

---

## Error Handling

### "no refresh token available for provider"

**Cause:** Provider doesn't have refresh token stored

**Solutions:**
1. User must re-authenticate via OAuth
2. Ensure correct scopes requested (`offline_access`)
3. Check provider supports refresh tokens

### "provider not linked to user"

**Cause:** User hasn't linked this OAuth provider

**Solution:** Link provider first via `/auth/oauth/{provider}/link`

### "failed to refresh provider token"

**Causes:**
1. Refresh token expired or revoked by provider
2. OAuth config changed (client_id/secret)
3. Provider service down

**Solution:** User must re-authenticate via OAuth

---

## Best Practices

### Request minimal scopes

Only request the scopes you need:

```json
// Recommended
{
  "scopes": ["email", "profile", "drive.readonly"]
}

// Not recommended
{
  "scopes": ["email", "profile", "drive", "calendar", "contacts", "..."]
}
```

### Handle token refresh failures

```javascript
async function callProviderAPI(provider, endpoint) {
  try {
    // Try to refresh token
    await refreshProviderToken(provider);
    const token = await getProviderToken(provider);
    return await callAPI(endpoint, token);
  } catch (error) {
    if (error.message.includes('no refresh token')) {
      // User must re-authenticate
      redirectToOAuth(provider);
    }
    throw error;
  }
}
```

### Cache access tokens

```javascript
// Don't refresh on every request
const tokenCache = new Map();

async function getValidProviderToken(provider) {
  const cached = tokenCache.get(provider);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;  // Use cached token
  }

  // Refresh and cache
  const { access_token, expires_in } = await refreshProviderToken(provider);
  
  tokenCache.set(provider, {
    token: access_token,
    expiresAt: Date.now() + (expires_in * 1000) - 60000  // 1 min buffer
  });

  return access_token;
}
```

---

## Provider-Specific Notes

### Google

**Refresh Token Availability:**
- First authorization: Refresh token provided
- Subsequent authorizations: No refresh token (reuse existing)
- To force new refresh token: Add `prompt=consent` to auth URL

**Scopes for APIs:**
- Drive: `https://www.googleapis.com/auth/drive.readonly`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`
- Gmail: `https://www.googleapis.com/auth/gmail.readonly`

### GitHub

**Refresh Token:**
- Supported since 2022
- No special scope needed
- Tokens don't expire unless revoked

**Useful Scopes:**
- `repo` - Access repositories
- `read:org` - Read org data
- `gist` - Manage gists

### Microsoft

**Refresh Token:**
- Requires `offline_access` scope
- Works with personal accounts and Azure AD

**Useful Scopes:**
- `Files.Read` - OneDrive
- `Mail.Read` - Outlook
- `Calendars.Read` - Calendar

---

## Related Documentation

- [OAuth Providers](./oauth-providers.md) - Provider setup
- [OAuth Integration Guide](./oauth-integration-guide.md) - Integration
- [OAuth API Reference](../api-reference/oauth.md) - API docs

