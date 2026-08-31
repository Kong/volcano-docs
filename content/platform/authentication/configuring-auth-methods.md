---
title: "Configuring Authentication Methods Per Project"
description: "Control which authentication methods each project enables — email/password, OAuth providers, and anonymous — to match your use case."
---

Control which authentication methods are available in each project. Mix and match email/password, OAuth providers, and anonymous authentication to match your use case.

## Overview

Each Volcano project can independently configure which authentication methods to enable:

- **Email & Password** - Traditional authentication
- **OAuth/SSO Providers** - Google, GitHub, Microsoft, Apple
- **Anonymous** - Guest users without credentials

You can enable any combination of these methods based on your application's needs.

---

## Quick Examples

### Example 1: Google and GitHub SSO Only (No Passwords)

**Use Case:** Modern consumer app, social login only

```bash
# 1. Configure OAuth providers
curl -X POST https://api.volcano.dev/projects/{PROJECT_ID}/oauth/configs \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
    "redirect_url": "https://yourapp.com/auth/callback"
  }'

curl -X POST https://api.volcano.dev/projects/{PROJECT_ID}/oauth/configs \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "github",
    "client_id": "YOUR_GITHUB_CLIENT_ID",
    "client_secret": "YOUR_GITHUB_CLIENT_SECRET",
    "redirect_url": "https://yourapp.com/auth/callback"
  }'

# 2. Disable email/password signup
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_signup": false
  }'
```

**Result:** Users can ONLY sign in with Google or GitHub.

---

### Example 2: Microsoft SSO Only (Enterprise)

**Use Case:** Corporate app with Azure AD integration

```bash
# 1. Configure Microsoft OAuth
curl -X POST https://api.volcano.dev/projects/{PROJECT_ID}/oauth/configs \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "microsoft",
    "client_id": "YOUR_AZURE_CLIENT_ID",
    "client_secret": "YOUR_AZURE_CLIENT_SECRET",
    "redirect_url": "https://enterprise.com/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }'

# 2. Disable email/password and anonymous
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_signup": false,
    "enable_anonymous_signins": false
  }'
```

**Result:** Users can ONLY sign in with Microsoft/Azure AD.

---

### Example 3: Hybrid (Email + OAuth)

**Use Case:** SaaS product, maximum flexibility

```bash
# 1. Configure OAuth providers
# (Google, GitHub, etc. - see Example 1)

# 2. Keep email/password enabled (default)
# No configuration needed - email/password is enabled by default

# 3. Optionally enable anonymous
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_anonymous_signins": true
  }'
```

**Result:** Users can sign in with:
- Email + password
- Google
- GitHub
- Anonymous (if enabled)

---

### Example 4: Anonymous + Google (Gaming Pattern)

**Use Case:** Mobile game, quick onboarding

```bash
# 1. Configure Google OAuth
curl -X POST https://api.volcano.dev/projects/{PROJECT_ID}/oauth/configs \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
    "redirect_url": "https://yourgame.com/auth/callback"
  }'

# 2. Disable email/password, enable anonymous
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_signup": false,
    "enable_anonymous_signins": true
  }'
```

**Result:** Users can:
- Play as guest (anonymous)
- Optionally link Google to save progress

---

## Restricting signups to specific email domains

**PRO plan required.**

`allowed_email_domains` limits which email domains can own an account in the
project. Empty (the default) allows any domain.
`allowed_email_domains_mode` decides how far the list reaches: `signup` (the
default) gates account creation only, `signup_and_signin` also refuses to sign
in an existing account outside the list, and `disabled` keeps the list without
enforcing it.

```bash
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {PLATFORM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "allowed_email_domains": ["domain1.com", "domain2.com"],
    "allowed_email_domains_mode": "signup"
  }'
```

Or in `volcano-config.yaml`:

```yaml
auth:
  signup:
    allowed_email_domains:
      - domain1.com
      - domain2.com
    allowed_email_domains_mode: signup
```

Once set, `403 Forbidden` with `email domain is not allowed for this project`
is returned by:

- `POST /auth/signup`
- the OAuth/SSO callback, when it would create or take over an account for that
  address, or attach it to an account that does not own it yet
- `POST /auth/user/convert-anonymous`
- `POST /auth/user/change-email` and `POST /auth/user/confirm-email-change` (so
  an existing user cannot move onto a rejected domain)

Under `signup_and_signin` the same `403` also comes back from `POST /auth/signin`,
`POST /auth/refresh`, the OAuth callback for an already-linked account, and the
device-code token exchange; saving that mode signs out the accounts it excludes.

Matching is exact and case-insensitive on the domain part, so listing
`domain1.com` does **not** allow `mail.domain1.com`. Existing accounts are never
deleted, and `[]` removes the restriction. Enforcement needs PRO too: a
downgrade parks the list, keeping the domains and letting every domain in again
until the project upgrades. See
[Email Domain Allowlist](configuration/email-domain-allowlist.md) for the
matching rules, entry format, and troubleshooting.

---

## API Reference

### Get Authentication Methods

```http
GET /projects/{project_id}/auth/methods
Authorization: Bearer {platform_token}
```

Returns all authentication methods and their configuration.

**Response:**

```json
{
  "email_password": {
    "enabled": true,
    "method": "email_password",
    "name": "Email & Password"
  },
  "anonymous": {
    "enabled": false,
    "method": "anonymous",
    "name": "Anonymous Sign-In"
  },
  "oauth_providers": [
    {
      "enabled": true,
      "method": "oauth",
      "provider": "google",
      "name": "Google",
      "redirect_url": "https://yourapp.com/callback",
      "scopes": ["openid", "email", "profile"]
    },
    {
      "enabled": true,
      "method": "oauth",
      "provider": "github",
      "name": "GitHub",
      "redirect_url": "https://yourapp.com/callback",
      "scopes": ["read:user", "user:email"]
    }
  ],
  "available_methods": [
    "email_password",
    "oauth_google",
    "oauth_github"
  ],
  "recommended_config": {
    "consumer_app": {...},
    "enterprise_app": {...},
    "saas_app": {...},
    "gaming_app": {...}
  }
}
```

---

### Configure Authentication Methods (Unified)

```http
PUT /projects/{project_id}/auth/methods
Authorization: Bearer {platform_token}
Content-Type: application/json

{
  "enable_email_password": false,
  "enable_anonymous": false,
  "oauth_providers": [
    {"provider": "google", "enabled": true},
    {"provider": "github", "enabled": false}
  ]
}
```

Configure all authentication methods in a single request.

**Validation:** At least ONE method must be enabled.

**Response:** Updated configuration (same as GET /auth/methods)

---

## Common Configurations

### Consumer App (Web/Mobile)

```json
{
  "enable_email_password": true,
  "enable_anonymous": true,
  "oauth_providers": [
    {"provider": "google", "enabled": true},
    {"provider": "apple", "enabled": true},
    {"provider": "github", "enabled": true}
  ]
}
```

**Available methods:**
- Email & Password
- Anonymous (guests)
- Google
- Apple
- GitHub

**Best for:** Consumer apps, social networks, content platforms

---

### Enterprise/B2B App

```json
{
  "enable_email_password": false,
  "enable_anonymous": false,
  "oauth_providers": [
    {"provider": "microsoft", "enabled": true}
  ]
}
```

**Available methods:**
- Microsoft/Azure AD ONLY

**Best for:** Corporate tools, internal apps, B2B SaaS

---

### SaaS Product

```json
{
  "enable_email_password": true,
  "enable_anonymous": false,
  "oauth_providers": [
    {"provider": "google", "enabled": true},
    {"provider": "github", "enabled": true},
    {"provider": "microsoft", "enabled": true}
  ]
}
```

**Available methods:**
- Email & Password
- Google
- GitHub
- Microsoft

**Best for:** Professional tools, developer platforms, productivity apps

---

### Gaming/Casual App

```json
{
  "enable_email_password": false,
  "enable_anonymous": true,
  "oauth_providers": [
    {"provider": "google", "enabled": true},
    {"provider": "apple", "enabled": true}
  ]
}
```

**Available methods:**
- Anonymous (quick start)
- Google (save progress)
- Apple (save progress)

**Best for:** Mobile games, casual apps, quick onboarding

---

## Configuration Rules

### Rule 1: At Least One Method Required

You **cannot** disable all authentication methods:

```bash
# This will fail (400 Bad Request)
curl -X PUT .../auth/methods -d '{
  "enable_email_password": false,
  "enable_anonymous": false,
  "oauth_providers": []
}'

# Error: "at least one authentication method must be enabled"
```

---

### Rule 2: OAuth Requires Configuration

To enable an OAuth provider, you must first configure it:

```bash
# 1. First configure OAuth
POST /oauth/configs
{
  "provider": "google",
  "client_id": "...",
  "client_secret": "...",
  "redirect_url": "..."
}

# 2. Then it appears in available methods
GET /auth/methods
# Returns: oauth_providers: [{provider: "google", enabled: true}]
```

---

### Rule 3: Disabled Methods Are Blocked

When a method is disabled, all related endpoints return errors:

```bash
# Email/password disabled
POST /auth/signup
# Response: 403 Forbidden - "signups are disabled for this project"

# Google OAuth disabled
GET /auth/oauth/google/authorize
# Response: 400 Bad Request - "OAuth provider is disabled"

# Anonymous disabled
POST /auth/signup-anonymous
# Response: 403 Forbidden - "anonymous signins are disabled"
```

---

## How to Configure

### Method 1: Individual Settings

```bash
# Disable email/password
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enable_signup": false}'

# Enable anonymous
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/config \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enable_anonymous_signins": true}'

# Disable specific OAuth provider
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/oauth/configs/github \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Method 2: Unified Configuration

```bash
# Configure all methods at once
curl -X PUT https://api.volcano.dev/projects/{PROJECT_ID}/auth/methods \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enable_email_password": false,
    "enable_anonymous": true,
    "oauth_providers": [
      {"provider": "google", "enabled": true},
      {"provider": "github", "enabled": false}
    ]
  }'
```

---

## Frontend Behavior

### Show Only Available Methods

Query available methods and show only enabled options:

```javascript
async function loadAuthMethods() {
  const response = await fetch(
    `${API_URL}/projects/${PROJECT_ID}/auth/methods`,
    {
      headers: { 'Authorization': `Bearer ${PLATFORM_TOKEN}` }
    }
  );

  const data = await response.json();
  const methods = data.available_methods;

  // Show only enabled methods
  if (methods.includes('email_password')) {
    showEmailPasswordForm();
  }

  if (methods.includes('oauth_google')) {
    showGoogleButton();
  }

  if (methods.includes('oauth_github')) {
    showGitHubButton();
  }

  if (methods.includes('anonymous')) {
    showGuestLoginButton();
  }
}
```

---

## Security Considerations

### Disable Unused Methods

**Security benefit:** Reduce attack surface

```bash
# If you don't use email/password, disable it
{
  "enable_email_password": false
}
```

**Benefits:**
- Fewer endpoints to secure
- No password-related attacks
- Simpler security model

---

### Enterprise SSO Requirements

For enterprise apps, you might want ONLY corporate SSO:

```bash
# Only Microsoft (Azure AD)
{
  "enable_email_password": false,
  "enable_anonymous": false,
  "oauth_providers": [
    {"provider": "microsoft", "enabled": true}
  ]
}
```

**Benefits:**
- Centralized access control (via Azure AD)
- Single sign-on across tools
- Enterprise compliance (MFA, conditional access)

---

## Troubleshooting

### "signups are disabled for this project"

**Cause:** `enable_signup` is `false`

**Solution:** Enable email/password signup OR configure OAuth provider

```bash
curl -X PUT .../auth/config -d '{"enable_signup": true}'
```

---

### "OAuth provider is disabled"

**Cause:** Provider exists but `enabled` is `false`

**Solution:** Enable the provider

```bash
curl -X PUT .../oauth/configs/google -d '{"enabled": true}'
```

---

### "anonymous signins are disabled"

**Cause:** `enable_anonymous_signins` is `false`

**Solution:** Enable anonymous authentication

```bash
curl -X PUT .../auth/config -d '{"enable_anonymous_signins": true}'
```

---

### "email domain is not allowed for this project"

**Cause:** the address is outside `allowed_email_domains`. On sign-in rather than
signup, the project is also in `allowed_email_domains_mode: signup_and_signin`

**Solution:** add the domain, clear the list, or move the mode back to `signup`
so existing accounts can still sign in

```bash
curl -X PUT .../auth/config -d '{"allowed_email_domains": ["domain1.com"]}'
curl -X PUT .../auth/config -d '{"allowed_email_domains_mode": "signup"}'
```

---

### "the email domain allowlist is only available on the PRO plan"

**Cause:** the project is on FREE and the update would set, widen, or otherwise
edit the allowlist

**Solution:** upgrade to PRO. A project that configured a list while on PRO
keeps the domains after a downgrade — parked, enforcing nothing — and can still
clear them

```bash
curl -X PUT .../auth/config -d '{"allowed_email_domains": []}'
```

---

### "at least one authentication method must be enabled"

**Cause:** Trying to disable all auth methods

**Solution:** Keep at least one method enabled (email, anonymous, or OAuth)

---

## Best Practices

### 1. Match Your User Base

**Consumer apps:**
- Enable email/password + OAuth (Google, Apple)
- Consider anonymous for guest access

**Enterprise apps:**
- Disable email/password
- Enable only corporate SSO (Microsoft)
- Disable anonymous

**Developer tools:**
- Enable email/password
- Enable GitHub OAuth
- Disable anonymous

### 2. Start Simple, Add Methods Later

```bash
# Start with email/password
# (enabled by default, no configuration needed)

# Add OAuth later when needed
POST /oauth/configs
{
  "provider": "google",
  ...
}
```

You can add OAuth providers without disrupting existing users.

### 3. Communicate Changes to Users

If you disable a method that users are currently using:

```bash
# Before disabling email/password
# Ensure users have linked an OAuth provider

# 1. Email users
# 2. Give them time to link OAuth
# 3. Then disable email/password
```

### 4. Test Before Deploying

```bash
# Get current configuration
GET /auth/methods

# Test each enabled method
# - Try signing up/signing in
# - Verify disabled methods are blocked
```

---

## Migration Scenarios

### Scenario 1: Add OAuth to Existing Email/Password App

```bash
# Current: Email/password only
# Goal: Add Google and GitHub

# 1. Configure OAuth providers
POST /oauth/configs (Google)
POST /oauth/configs (GitHub)

# 2. No other changes needed!
# Email/password still works
# Users can now also use OAuth
```

**Impact:** Zero - existing users unaffected

---

### Scenario 2: Migrate from Email/Password to OAuth Only

```bash
# Current: Email/password only
# Goal: OAuth only

# 1. Configure OAuth providers
POST /oauth/configs (Google, GitHub, etc.)

# 2. Email users: "Link your Google/GitHub account"

# 3. Wait for migration period (e.g., 30 days)

# 4. Disable email/password
PUT /auth/config {"enable_signup": false}

# Note: Existing users with passwords can still sign in
# But new signups must use OAuth
```

**Impact:** Existing users can still use passwords

---

### Scenario 3: Add Anonymous for Guest Access

```bash
# Current: Email/password + OAuth
# Goal: Add anonymous (guest play)

# 1. Enable anonymous
PUT /auth/config {"enable_anonymous_signins": true}

# 2. Update frontend to show "Play as Guest" button

# 3. Users can convert anonymous to authenticated later
POST /auth/user/convert-anonymous
```

**Impact:** Zero - adds new feature

---

## Configuration Matrix

| Use Case | Email/Password | Anonymous | Google | GitHub | Microsoft | Apple |
|----------|----------------|-----------|--------|--------|-----------|-------|
| Consumer App | Yes | Yes | Yes | Yes | No | Yes |
| Enterprise App | No | No | No | No | Yes | No |
| SaaS Product | Yes | No | Yes | Yes | Yes | No |
| Gaming App | No | Yes | Yes | No | No | Yes |
| Developer Tool | Yes | No | Yes | Yes | No | No |
| Content Platform | Yes | Yes | Yes | Yes | No | No |

---

## Testing Your Configuration

### 1. Get Current Configuration

```bash
curl -H "Authorization: Bearer {TOKEN}" \
  https://api.volcano.dev/projects/{PROJECT_ID}/auth/methods
```

### 2. Test Each Enabled Method

**Email/Password:**
```bash
POST /auth/signup {"email": "test@example.com", "password": "test123"}
```

**Google OAuth:**
```bash
GET /auth/oauth/google/authorize
# Should redirect to Google
```

**Anonymous:**
```bash
POST /auth/signup-anonymous
# Should return access token
```

### 3. Verify Disabled Methods Are Blocked

If email/password is disabled:
```bash
POST /auth/signup
# Expected: 403 Forbidden - "signups are disabled"
```

---

## Related Documentation

- [OAuth Providers Setup](./oauth-providers.md)
- [OAuth Integration Guide](./oauth-integration-guide.md)
- [Authentication Overview](./overview.md)
- [Anonymous Users](./anonymous-users.md)

---

## FAQs

### Can I change configuration after users have signed up?

**Yes!** Configuration changes don't affect existing users.

- Existing users keep their authentication methods
- New signups use new configuration
- You can add/remove methods anytime

### What happens if I disable email/password but users have passwords?

**Existing users can still sign in** with their passwords. Only NEW signups are blocked.

To fully migrate, ask users to link an OAuth provider first.

### Can users have multiple authentication methods?

**Yes!** Users can link multiple methods:

- Password + Google
- Password + GitHub + Microsoft
- Anonymous → convert to email/password → link Google

### What if OAuth provider goes down?

If a provider is temporarily unavailable:

- Users can't sign in with that provider
- Users can use alternate methods (if configured)
- This is why hybrid auth is recommended for critical apps

### Can I use different OAuth configs per environment?

**Yes!** Each project has independent configuration:

- Dev project: http://localhost:8080/callback
- Staging project: https://staging.yourapp.com/callback
- Production project: https://yourapp.com/callback

---

## Support

For issues:
- Review troubleshooting guide
- Check security audit
- See [OAuth integration guide](./oauth-integration-guide.md)

