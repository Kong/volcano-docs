---
title: "Configuration"
description: "Customize authentication settings per project."
---

Customize authentication settings per project.

## Settings

**Token Lifetimes:**
- [access_token_lifetime](token-lifetimes.md#access-token) - How long access tokens last
- [refresh_token_lifetime](token-lifetimes.md#refresh-token) - How long refresh tokens last  
- [refresh_token_reuse_interval](token-lifetimes.md#reuse-interval) - Token reuse window

**Session Management:**
- [inactivity_timeout](session-management.md#inactivity) - Force re-login after inactivity
- [max_session_duration](session-management.md#max-duration) - Force re-login after duration

**Password Requirements:**
- [min_password_length](password-requirements.md#minimum-length) - Minimum characters
- [require_uppercase](password-requirements.md#uppercase) - Require A-Z
- [require_lowercase](password-requirements.md#lowercase) - Require a-z
- [require_numbers](password-requirements.md#numbers) - Require 0-9
- [require_special_chars](password-requirements.md#special) - Require !@#$%
- [max_password_history](password-history.md) - Prevent password reuse

**Rate Limiting:**
- [rate_limit_signup](rate-limiting.md#signup) - Signups per hour per IP
- [rate_limit_signin](rate-limiting.md#signin) - Signins per hour per IP
- [rate_limit_token_refresh](rate-limiting.md#refresh) - Refreshes per hour per IP

**CORS:**
- [cors_enabled](cors.md#enable) - Enable origin validation
- [cors_allowed_origins](cors.md#origins) - Whitelist domains

**Access Control:**
- [enable_signup](provider-separation.md#layer-2-master-signup-toggle) - Allow/block public signups
- [allowed_email_domains](email-domain-allowlist.md) - Restrict signups, and optionally sign-ins, to specific email domains (PRO)

## Get Configuration

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

## Update Configuration

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_token_lifetime": 7200,
    "min_password_length": 20,
    "require_numbers": true,
    "cors_enabled": true,
    "cors_allowed_origins": ["https://myapp.com"]
  }'
```

## Common Configurations

**High Security (Banking):**
```json
{
  "access_token_lifetime": 900,
  "inactivity_timeout": 300,
  "min_password_length": 20,
  "require_uppercase": true,
  "require_lowercase": true,
  "require_numbers": true,
  "require_special_chars": true
}
```

**Balanced (SaaS):**
```json
{
  "access_token_lifetime": 3600,
  "min_password_length": 15
}
```

**Low Friction (Social App):**
```json
{
  "access_token_lifetime": 7200,
  "refresh_token_lifetime": 7776000,
  "min_password_length": 15
}
```

## See Individual Settings

Each setting has its own documentation page with:
- What it does
- When to use it
- Examples
- Tradeoffs

Click the links above for detailed guides.
