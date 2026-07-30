---
title: "OAuth Integration Guide"
description: "Complete guide for integrating OAuth/SSO authentication in your application."
---

Complete guide for integrating OAuth/SSO authentication in your application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup for Each Provider](#setup-for-each-provider)
3. [Frontend Integration](#frontend-integration)
4. [Security Best Practices](#security-best-practices)
5. [Production Checklist](#production-checklist)

---

## Quick Start

### 1. Configure OAuth Provider in Volcano

```bash
# Example: Configure Google OAuth
curl -X POST https://api.volcano.dev/projects/YOUR_PROJECT_ID/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "client_id": "123456789.apps.googleusercontent.com",
    "client_secret": "GOCSPX-your-secret-here",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }'
```

### 2. Add Sign-In Button to Your Frontend

```html
<button onclick="signInWithGoogle()">Sign in with Google</button>

<script>
function signInWithGoogle() {
  window.location.href = 'https://api.volcano.dev/auth/oauth/google/authorize';
}
</script>
```

### 3. Handle Callback

When Google redirects back to your callback URL, Volcano automatically:
1. Exchanges authorization code for access token
2. Fetches user info from Google
3. Creates/signs in user
4. Redirects with a short-lived, single-use Volcano authorization code
5. Your client exchanges the code for a Volcano access_token + refresh_token

---

## Setup for Each Provider

### Google OAuth

#### Step 1: Create OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Select **Web application**
6. Add **Authorized redirect URIs:**
   - Development: `http://localhost:8000/auth/oauth/google/callback`
   - Production: `https://api.volcano.dev/auth/oauth/google/callback`
7. Click **Create**
8. Copy **Client ID** and **Client secret**

#### Step 2: Enable Google+ API

1. Navigate to **APIs & Services** → **Library**
2. Search for **Google+ API**
3. Click **Enable**

#### Step 3: Configure in Volcano

```bash
curl -X POST https://api.volcano.dev/projects/YOUR_PROJECT_ID/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }'
```

**Default Scopes:**
- `openid` - OpenID Connect
- `email` - User's email address
- `profile` - User's basic profile (name, picture)

---

### GitHub OAuth

#### Step 1: Create OAuth App

1. Go to [GitHub Settings](https://github.com/settings/developers) → **OAuth Apps**
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Your app name
   - **Homepage URL:** `https://yourapp.com`
   - **Authorization callback URL:**
     - Development: `http://localhost:8000/auth/oauth/github/callback`
     - Production: `https://api.volcano.dev/auth/oauth/github/callback`
4. Click **Register application**
5. Copy **Client ID**
6. Click **Generate a new client secret**
7. Copy **Client secret**

#### Step 2: Configure in Volcano

```bash
curl -X POST https://api.volcano.dev/projects/YOUR_PROJECT_ID/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "github",
    "client_id": "YOUR_GITHUB_CLIENT_ID",
    "client_secret": "YOUR_GITHUB_CLIENT_SECRET",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["read:user", "user:email"]
  }'
```

**Default Scopes:**
- `read:user` - Read user profile
- `user:email` - Access user's email addresses

**Note:** GitHub users can hide their email - handle this case in your app.

---

### Microsoft OAuth

#### Step 1: Register App in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name:** Your app name
   - **Supported account types:** Choose based on needs:
     - Personal Microsoft accounts only
     - Work/school accounts only
     - Both (recommended)
5. **Redirect URI:** Web platform
   - Development: `http://localhost:8000/auth/oauth/microsoft/callback`
   - Production: `https://api.volcano.dev/auth/oauth/microsoft/callback`
6. Click **Register**
7. Copy **Application (client) ID**

#### Step 2: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and expiration
4. Click **Add**
5. **Copy the secret value immediately** (shown only once!)

#### Step 3: Configure in Volcano

```bash
curl -X POST https://api.volcano.dev/projects/YOUR_PROJECT_ID/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "microsoft",
    "client_id": "YOUR_APPLICATION_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET_VALUE",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }'
```

**Default Scopes:**
- `openid` - OpenID Connect
- `email` - User's email
- `profile` - User's profile info

---

### Apple Sign In

#### Step 1: Configure Sign in with Apple

1. Go to [Apple Developer](https://developer.apple.com/account/) → **Certificates, IDs & Profiles**
2. Click **Identifiers** → **+** (Add)
3. Select **Services IDs** → Continue
4. Fill in:
   - **Description:** Your app name
   - **Identifier:** Reverse DNS (e.g., `com.yourapp.signin`)
5. Click **Continue** → **Register**

#### Step 2: Enable Sign in with Apple

1. Click on your Services ID
2. Check **Sign in with Apple**
3. Click **Configure**
4. Add **Website URLs:**
   - **Domains:** `yourapp.com`, `api.volcano.dev`
   - **Return URLs:**
     - `https://yourapp.com/auth/callback`
     - `https://api.volcano.dev/auth/oauth/apple/callback`
5. Click **Done** → **Save**

#### Step 3: Create Key

1. Go to **Keys** → **+** (Add)
2. **Key Name:** Your app name
3. Check **Sign in with Apple**
4. Click **Configure** → Select your App ID
5. Click **Save** → **Continue** → **Register**
6. **Download** the `.p8` file (private key)
7. Note the **Key ID**

#### Step 4: Configure in Volcano

```bash
curl -X POST https://api.volcano.dev/projects/YOUR_PROJECT_ID/oauth/configs \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "apple",
    "client_id": "com.yourapp.signin",
    "client_secret": "YOUR_APPLE_KEY_CONTENT",
    "redirect_url": "https://yourapp.com/auth/callback",
    "scopes": ["email", "name"]
  }'
```

**Default Scopes:**
- `email` - User's email (might be Apple relay)
- `name` - User's name (only on first auth)

**Note:** Apple configuration is more complex - see [Apple documentation](https://developer.apple.com/sign-in-with-apple/) for details.

---

## Frontend Integration

### Basic Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <title>OAuth Example</title>
</head>
<body>
    <!-- OAuth Buttons -->
    <button onclick="signInWithGoogle()">Sign in with Google</button>
    <button onclick="signInWithGitHub()">Sign in with GitHub</button>
    <button onclick="signInWithMicrosoft()">Sign in with Microsoft</button>
    <button onclick="signInWithApple()">Sign in with Apple</button>

    <script>
        const PROJECT_ID = 'your-project-id';
        const API_URL = 'https://api.volcano.dev';

        function signInWithGoogle() {
            redirectToOAuth('google');
        }

        function signInWithGitHub() {
            redirectToOAuth('github');
        }

        function signInWithMicrosoft() {
            redirectToOAuth('microsoft');
        }

        function signInWithApple() {
            redirectToOAuth('apple');
        }

        function redirectToOAuth(provider) {
            const authUrl = `${API_URL}/auth/oauth/${provider}/authorize`;
            window.location.href = authUrl;
        }
    </script>
</body>
</html>
```

### Advanced: Provider Linking

Allow users to link multiple authentication methods:

```javascript
// User is already logged in
const accessToken = localStorage.getItem('access_token');

// Link Google to existing account
async function linkGoogle() {
    const response = await fetch(
        `${API_URL}/auth/oauth/google/link`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );

    const data = await response.json();

    if (response.ok) {
        // Redirect to OAuth authorization
        window.location.href = data.authorization_url;
    } else {
        console.error('Error:', data.error);
    }
}

// After OAuth completes, provider is linked
// User can now sign in with either password OR Google
```

### Advanced: Unlink Provider

```javascript
async function unlinkGoogle() {
    const accessToken = localStorage.getItem('access_token');

    const response = await fetch(
        `${API_URL}/auth/oauth/google/unlink`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );

    if (response.ok) {
        console.log('Google unlinked successfully');
    } else {
        const data = await response.json();
        console.error('Error:', data.error);
        // Might be: "cannot unlink last authentication method"
    }
}
```

### Advanced: List Linked Providers

```javascript
async function getLinkedProviders() {
    const accessToken = localStorage.getItem('access_token');

    const response = await fetch(
        `${API_URL}/auth/oauth/providers`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );

    const data = await response.json();
    
    // data.providers = [
    //   { provider: 'google', linked_at: '...', updated_at: '...' },
    //   { provider: 'github', linked_at: '...', updated_at: '...' }
    // ]

    return data.providers;
}
```

---

## Security Best Practices

### 1. Always Use HTTPS in Production

```javascript
// GOOD
const REDIRECT_URL = 'https://yourapp.com/auth/callback';

// BAD (production)
const REDIRECT_URL = 'http://yourapp.com/auth/callback';
```

HTTP is only acceptable for local development.

### 2. Validate Redirect URLs

Volcano automatically validates redirect URLs to prevent open redirects:

```javascript
// Valid redirect URLs
'https://yourapp.com/callback'
'https://app.yourapp.com/auth/callback'
'http://localhost:8080/callback'  // Dev only

// Invalid (blocked by Volcano)
'http://evil.com@yourapp.com/callback'  // Contains @
'javascript:alert(1)'                    // Invalid protocol
```

### 3. Store Tokens Securely

```javascript
// GOOD: Use localStorage or sessionStorage
localStorage.setItem('access_token', token);

// BETTER: Use httpOnly cookies (if possible)
document.cookie = `access_token=${token}; Secure; HttpOnly; SameSite=Strict`;

// BAD: Global variables
window.myAccessToken = token;

// BAD: URL parameters
window.location.href = `/dashboard?token=${token}`;
```

### 4. Handle Email Conflicts

When OAuth email already exists:

```javascript
// User tries to sign up with Google
// But email already exists from password signup

fetch('/auth/oauth/google/authorize')
  .then(response => {
    if (response.status === 409) {
      // Show message: "Email already exists. Please sign in and link Google."
      showMessage('Please sign in with your password, then link Google from settings');
    }
  });
```

### 5. Prevent Account Lockout

```javascript
// Before unlinking provider, check if it's the last method
async function unlinkProvider(provider) {
    const response = await fetch(`/auth/oauth/${provider}/unlink`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 400) {
        const data = await response.json();
        if (data.error.includes('last authentication method')) {
            alert('You need to set a password before unlinking this provider');
            return;
        }
    }

    // Successfully unlinked
}
```

---

## Production Checklist

### OAuth Provider Setup

- [ ] Register OAuth app with provider
- [ ] Set production redirect URLs (HTTPS only)
- [ ] Copy client_id and client_secret
- [ ] Enable required APIs (Google+ for Google)
- [ ] Test OAuth flow in provider's test environment

### Volcano Configuration

- [ ] Configure OAuth via API
- [ ] Verify redirect_url matches exactly
- [ ] Test each provider's OAuth flow
- [ ] Verify secrets are not exposed in API responses
- [ ] Enable OAuth config (enabled: true)

### Frontend Implementation

- [ ] Add OAuth buttons for each provider
- [ ] Implement OAuth redirect logic
- [ ] Handle callback and token storage
- [ ] Implement error handling
- [ ] Test email conflict scenario
- [ ] Test provider linking/unlinking
- [ ] Implement "cannot unlink last method" UI

### Security

- [ ] Use HTTPS for all redirect URLs
- [ ] Validate state parameter (automatic in Volcano)
- [ ] Store tokens securely (httpOnly cookies preferred)
- [ ] Implement token refresh on 401
- [ ] Add CSRF protection to your forms
- [ ] Rate limit OAuth endpoints if needed
- [ ] Monitor OAuth callback failures

### Testing

- [ ] Test OAuth signup (new user)
- [ ] Test OAuth signin (existing user)
- [ ] Test email conflict (manual linking required)
- [ ] Test provider linking
- [ ] Test provider unlinking
- [ ] Test unlinking last method (should fail)
- [ ] Test disabled provider (should fail)
- [ ] Test with multiple providers
- [ ] Test cross-project isolation

### Monitoring

- [ ] Monitor OAuth callback success rate
- [ ] Alert on high OAuth error rates
- [ ] Track which providers are most used
- [ ] Monitor email conflict rates
- [ ] Track provider linking/unlinking

---

## Common Integration Patterns

### Pattern 1: OAuth-Only App

App that only uses OAuth (no email/password):

```javascript
// Only show OAuth buttons
<button onclick="signInWithGoogle()">Sign in with Google</button>
<button onclick="signInWithGitHub()">Sign in with GitHub</button>

// No email/password form needed
// Users MUST have at least one OAuth provider
```

**Configuration:**
```json
{
  "enable_signup": false  // Disable email/password signup
}
```

---

### Pattern 2: Hybrid App

App with both email/password AND OAuth:

```javascript
// Email/password form
<input type="email" id="email">
<input type="password" id="password">
<button onclick="signUp()">Sign Up</button>

// OR divider
<div>- OR -</div>

// OAuth buttons
<button onclick="signInWithGoogle()">Sign in with Google</button>
<button onclick="signInWithGitHub()">Sign in with GitHub</button>
```

Users can:
- Sign up with email/password
- Sign up with OAuth
- Link OAuth to existing password account

---

### Pattern 3: Enterprise SSO

Enterprise apps that require specific OAuth provider:

```javascript
// Only show Microsoft button for enterprise users
if (userDomain === 'company.com') {
    showMicrosoftButton();
} else {
    showAllProviders();
}
```

**Configuration:** Enable only specific providers per project.

---

## Troubleshooting

### "OAuth provider not configured"

**Cause:** Provider not set up in Volcano

**Solution:**
```bash
# Check existing configs
curl -H "Authorization: Bearer TOKEN" \
  https://api.volcano.dev/projects/PROJECT_ID/oauth/configs

# Create config if missing
curl -X POST ... (see setup section)
```

---

### "invalid state parameter"

**Causes:**
- State expired (10 min timeout)
- State already used (one-time use)
- CSRF attack attempt

**Solution:** Restart OAuth flow from beginning

---

### "email already exists - please link provider to existing account"

**Cause:** User's OAuth email matches existing account

**Flow:**
1. User tries: Sign in with Google
2. Error: Email already exists
3. User signs in with password
4. User clicks "Link Google" in settings
5. Success: Can now use either method

**Frontend handling:**
```javascript
if (response.status === 409) {
    showMessage(
        'Email already exists. ' +
        '<a href="/signin">Sign in</a> and link Google from your profile.'
    );
}
```

---

### OAuth redirect doesn't work

**Common causes:**

1. **Redirect URL mismatch**
   - Check: Provider settings exactly match Volcano config
   - Example: `https://yourapp.com/callback` vs `https://yourapp.com/auth/callback`

2. **Missing HTTPS**
   - Most providers require HTTPS in production
   - Use `http://localhost` for development only

3. **Wrong domain**
   - Redirect URL must match authorized domain in provider settings

---

### "OAuth provider is disabled"

**Cause:** Provider was disabled in config

**Solution:**
```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/oauth/configs/google \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

---

### GitHub doesn't return email

**Cause:** User has email privacy enabled on GitHub

**Solutions:**
1. Request `user:email` scope (already default)
2. Ask user to provide email manually after OAuth
3. Handle missing email gracefully in your app

```javascript
if (!user.email) {
    // Ask user to provide email
    promptForEmail();
}
```

---

## Testing OAuth Locally

### 1. Use ngrok for Local Testing

```bash
# Start ngrok
ngrok http 8000

# Use ngrok URL in OAuth configs
# Example: https://abc123.ngrok.io/auth/oauth/google/callback
```

### 2. Use localhost (if provider supports)

Some providers allow `http://localhost` for testing:

| Provider | Localhost Support |
|----------|-------------------|
| Google | Yes |
| GitHub | Yes |
| Microsoft | Sometimes |
| Apple | No (requires HTTPS) |

---

## Advanced Topics

### Multiple Projects, Same Provider

Each project has independent OAuth configuration:

```javascript
// Project A - Google OAuth
{
  "project_id": "project-a",
  "provider": "google",
  "client_id": "project-a-google-id",
  "redirect_url": "https://app-a.com/callback"
}

// Project B - Google OAuth (different app)
{
  "project_id": "project-b", 
  "provider": "google",
  "client_id": "project-b-google-id",
  "redirect_url": "https://app-b.com/callback"
}
```

### User with Same Email in Multiple Projects

OAuth follows same isolation as email/password auth:

- User A in Project 1: `john@example.com` via Google
- User B in Project 2: `john@example.com` via password
- These are **completely independent accounts**
- Different user IDs, different passwords/providers

### Hybrid Authentication

User can have multiple auth methods:

```text
User Account:
├── Password: Yes
├── Google: Linked
└── GitHub: Linked

Can sign in with:
- Email + password
- "Sign in with Google"
- "Sign in with GitHub"
```

---

## Resources

- [OAuth Providers Documentation](./oauth-providers.md)
- [OAuth Example Application](../examples/frontend-auth-nextjs/README.md)
- [OAuth API Reference](../api-reference/oauth.md)
- [Security Checklist](../guides/security-checklist.md)

## Need Help?

- Check troubleshooting guide
- Review security audit
- Open an issue on GitHub



