---
title: "Token Lifetimes"
description: "Control how long tokens remain valid."
---

Control how long tokens remain valid.

## Access Token Lifetime

**Setting:** `access_token_lifetime`  
**Type:** Integer (seconds)  
**Default:** 3600 (1 hour)  
**Range:** 60-86400

Controls how long an access token stays valid before requiring refresh.

**When to shorten (15-30 min):**
- Banking/financial apps
- Healthcare systems
- Admin dashboards

**When to lengthen (2-4 hours):**
- Internal tools
- Low-risk applications

**Configuration:**
```json
{"access_token_lifetime": 1800}  // 30 minutes
```

**Frontend impact:**
```javascript
// Auto-refresh before expiry
const refreshTime = (expires_in - 300) * 1000;  // 5 min buffer
setTimeout(() => volcano.auth.refreshSession(), refreshTime);
```

## Refresh Token Lifetime

**Setting:** `refresh_token_lifetime`  
**Type:** Integer (seconds)  
**Default:** 2592000 (30 days)  
**Range:** 3600-7776000

How long users stay logged in without re-entering password.

**Common values:**
- 7 days: `604800`
- 30 days: `2592000` (default)
- 90 days: `7776000`

**Configuration:**
```json
{"refresh_token_lifetime": 604800}  // 7 days
```

## Refresh Token Reuse Interval

**Setting:** `refresh_token_reuse_interval`  
**Type:** Integer (seconds)  
**Default:** 10  
**Recommended:** Keep at 10

Prevents race conditions when multiple tabs refresh simultaneously.

Within this window, the same refresh token can be used multiple times.

**Why it exists:**
```text
User has 2 tabs open
Both tabs refresh at same time
Without reuse interval: One succeeds, one fails
With reuse interval: Both succeed
```

**Keep at default:** 10 seconds is optimal.

## Configuration Example

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "access_token_lifetime": 1800,
    "refresh_token_lifetime": 604800,
    "refresh_token_reuse_interval": 10
  }'
```

## See Also

- [Session Management](session-management.md)




