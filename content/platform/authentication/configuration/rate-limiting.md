---
title: "Rate Limiting"
description: "Prevent brute force and abuse with distributed rate limiting."
---

Prevent brute force and abuse with distributed rate limiting.

## How It Works

Every API instance shares one count, so a client can't get around a limit by
reaching a different instance. Once the count passes the limit, requests get
`429 Too Many Requests` until the window resets.

Limits are per:
- IP address
- Project
- Endpoint (signup/signin/refresh separate)
- Clock hour (counts reset at the top of each hour)

## Signup Rate Limit

**Setting:** `rate_limit_signup`  
**Default:** 100 per hour per IP

Prevent mass account creation.

```json
{"rate_limit_signup": 50}
```

**When exceeded:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704128400

{"error": "rate limit exceeded, try again later"}
```

## Signin Rate Limit

**Setting:** `rate_limit_signin`  
**Default:** 100 per hour per IP

Prevent brute force password attacks.

```json
{"rate_limit_signin": 20}
```

**Effect:** After 20 failed login attempts from same IP, further attempts blocked for remainder of hour.

OAuth sign-ins use the same limit. Each provider's callback,
`/auth/oauth/{provider}/callback`, keeps its own count, so GitHub callbacks
don't use up Google's allowance.

## Refresh Rate Limit

**Setting:** `rate_limit_token_refresh`  
**Default:** 1000 per hour per IP

Usually higher than signup/signin (legitimate users refresh frequently).

```json
{"rate_limit_token_refresh": 500}
```

## Response Headers

Signup, signin, refresh, and OAuth callback responses carry the remaining quota:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
```

Use these to show users their remaining quota.

Signup, password reset, and email change add `X-RateLimit-Reset` to their `429`
responses — the Unix timestamp the hour window rolls over. Signin and refresh
do not send it.

## Per-IP, Per-Project

Rate limits are isolated:

```text
IP 192.168.1.1, Project A → Count: 5
IP 192.168.1.1, Project B → Count: 2  (independent)
IP 192.168.1.2, Project A → Count: 1  (independent)
```

Attack on Project A doesn't affect Project B.

## Configuration

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "rate_limit_signup": 20,
    "rate_limit_signin": 50,
    "rate_limit_token_refresh": 200
  }'
```

Setting `rate_limit_signup`, `rate_limit_signin`, or `rate_limit_token_refresh`
to `0` turns that limit off. For `rate_limit_signin`, that includes OAuth
callbacks.

## See Also

- [Configuration Overview](overview.md)




