---
title: "Rate Limiting"
description: "Prevent brute force and abuse with distributed rate limiting."
---

Prevent brute force and abuse with distributed rate limiting.

## How It Works

Rate limits are enforced **across all API instances** using the database as shared state.

```text
API Instance 1 ─┐
API Instance 2 ─┼─→ PostgreSQL (shared rate limit state)
API Instance 3 ─┘

Each request increments counter atomically.
When limit reached, returns 429.
```

Limits are per:
- IP address
- Project
- Endpoint (signup/signin/refresh separate)
- Hour (sliding window)

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

## Refresh Rate Limit

**Setting:** `rate_limit_token_refresh`  
**Default:** 1000 per hour per IP

Usually higher than signup/signin (legitimate users refresh frequently).

```json
{"rate_limit_token_refresh": 500}
```

## Response Headers

Every request includes rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1704128400
```

Use these to show users their remaining quota.

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

## Monitoring

Check current rate limit usage:

```sql
SELECT identifier, endpoint, request_count
FROM auth_rate_limits
WHERE project_id = 'YOUR_PROJECT_ID'
  AND window_start = date_trunc('hour', NOW())
ORDER BY request_count DESC;
```

## See Also

- [Configuration Overview](overview.md)




