---
title: 'Rate Limiting'
description: 'Prevent brute force and abuse with distributed rate limiting.'
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
{ "rate_limit_signup": 50 }
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
{ "rate_limit_signin": 20 }
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
{ "rate_limit_token_refresh": 500 }
```

## Password Reset Rate Limit

**Setting:** `rate_limit_password_reset`  
**Default:** 10 per hour per IP

Limits `POST /auth/forgot-password`. Unlike the other settings, `0` restores
the default of 10 rather than turning the limit off.

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

### Server-side auth proxies

A server-side proxy can preserve the browser's rate-limit and session audit IP
when it forwards an anonymous-auth request. Send both headers:

```http
Authorization: Bearer ANON_KEY
X-Volcano-Proxy-Authorization: Bearer SERVICE_KEY
X-Volcano-Client-IP: 203.0.113.42
```

The service key must belong to the same project as the anon key and hold the
scope for the endpoint it proxies:

| Endpoint                                                  | Required scope        |
| --------------------------------------------------------- | --------------------- |
| `POST /auth/signup`, `POST /auth/signup-anonymous`        | `auth.signup`         |
| `POST /auth/signin`, `POST /auth/oauth/exchange`          | `auth.signin`         |
| `POST /auth/refresh`                                      | `auth.refresh`        |
| `POST /auth/logout`                                       | `auth.logout`         |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | `auth.password_reset` |
| `GET /auth/password-policy`                               | Any scope             |

These scopes limit only which auth operations the key can proxy. Routes that do
not enforce service-key scopes, such as database queries, still grant the key
full service-role access, so protect it like any other service key.

The proxy must take the IP only from platform-verified request metadata; it must
never copy an IP header supplied by browser code. Volcano rejects the request
with `401 Unauthorized` if either proxy header is missing or repeated, the IP is
invalid, or the service key is invalid, revoked, from another project, or
insufficiently scoped. Never expose the service key to browser code; these
headers are only for a trusted server-side proxy such as an edge function.

Volcano applies its
[embargoed-country refusal](../../guides/unavailable-responses.md#requests-from-embargoed-countries)
to the proxied client IP as well as to the proxy's own address, answering
`451 Unavailable For Legal Reasons` when the browser is in an embargoed country.

If neither proxy header is present, Volcano continues to resolve the client IP
from its trusted ingress chain. Caller-supplied forwarding headers do not opt a
request into this proxy contract.

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

The same limits live under `auth.rate_limits` in
[`volcano-config.yaml`](../../projects/configuration.md):

```yaml
auth:
  rate_limits: # per hour
    signup: 20
    signin: 50
    token_refresh: 200
    password_reset: 10
```

## Local Mode

A project running in local mode does not enforce any of these per-IP limits.
Every client of a local server connects from your machine, so they would only
cap your own test runs. Local responses carry no `X-RateLimit-*` headers.

The configured values are kept as they are: export still renders them, and a
cloud deploy of the same `volcano-config.yaml` enforces them. Test rate-limit
handling against a cloud project.

## See Also

- [Configuration Overview](overview.md)
