---
title: "Unavailable Responses"
description: "What visitors to your app see when Volcano stops serving your project's traffic, and how to detect it from a client."
---

When Volcano stops serving traffic for a project, every data-plane path answers
with the same status and copy: HTTP `503 Service Unavailable`, and no caching.
Frontends, function invocations, storage, the database REST API, realtime, and
pgproxy all behave identically.

The response is written for **your app's end users**, not for you. It never
mentions your account, plan, billing state, or project — a visitor cannot tell
why traffic stopped. The branded HTML page does link back to Volcano's status
page, but withholds every detail about your account.

## Detecting it from a client

API, function, and storage callers get JSON:

```json
{
  "error": "This site is temporarily unavailable.",
  "code": "service_unavailable"
}
```

Match on `code`, not on the human-readable text:

```javascript
const res = await fetch("https://your-project.volcano.dev/api/items");

if (res.status === 503) {
  const body = await res.json().catch(() => null);
  if (body?.code === "service_unavailable") {
    // Traffic is paused. Back off and retry.
  }
}
```

Every unavailable response carries these headers:

| Header | Value | Meaning |
| ------ | ----- | ------- |
| `Cache-Control` | `no-store` | Never cached, so service resumes immediately once traffic is restored |
| `Retry-After` | `60` | Suggested retry delay, in seconds |
| `X-Robots-Tag` | `noindex` | Keeps the page out of search results |

### Cross-origin callers

The unavailable response always carries CORS headers, so an in-page `fetch()`
can read the JSON body instead of failing with an opaque cross-origin error.
The request `Origin` is echoed (with credentials allowed) when one is present,
and `*` is used otherwise.

These headers are set on the unavailable response itself rather than resolved
from your project's CORS configuration, so a request from an origin your config
does not normally allow can still read this particular `503`. The body contains
no information about your account, so there is nothing to disclose. A response
that already carries CORS headers — because a path resolved your project's real
policy first — keeps those headers; this only fills the gap for paths that
never resolve a policy at all. Your CORS policy continues to apply to every
other response.

## Browser navigations

A top-level browser navigation receives a self-contained branded HTML page
instead of JSON. This is standard HTTP content negotiation on the `Accept`
header: a browser's default navigation `Accept` prefers `text/html`, while
`fetch()`/`XMLHttpRequest` and non-browser clients default to `*/*` or
`application/json` and get the JSON body.

If your own page explicitly sets `Accept: text/html` on an in-page `fetch()`
call, it will receive the HTML page too — pass an explicit `Accept:
application/json` on any request whose response your code parses as JSON.

## Per-protocol behavior

| Surface | Response |
| ------- | -------- |
| Frontends | HTML page for navigations, JSON otherwise |
| Function invocation | `503` with the JSON body, regardless of `Accept` |
| Storage | `503` with the JSON body, regardless of `Accept` |
| Database REST API | `503` with the JSON body, regardless of `Accept` |
| Auth-user endpoints (signup, signin, refresh, profile, etc.) | `503` with the JSON body, regardless of `Accept` |
| Realtime | WebSocket close code `4503` |
| pgproxy | Postgres `ErrorResponse`, SQLSTATE `57P03` (`cannot_connect_now`) |

Function invocation, storage, the database REST API, and auth-user endpoints
never turn a browser-issued `Accept` header into HTML: a script or SDK calling
these must always be able to parse the response as JSON.

Postgres drivers treat `57P03` as a retryable "server not accepting connections"
condition, so existing reconnect logic works without changes:

```text
ERROR:  This site is temporarily unavailable.
SQLSTATE: 57P03
```

## Recovery

Traffic resumes automatically once the underlying condition clears — nothing
needs to be purged or redeployed. The `no-store` response is never cached, but
the allow/deny decision itself is cached for up to a couple of seconds at the
traffic gate, so a request made immediately after recovery can still see one
more unavailable response before the next one succeeds.

If you see this on your own project, check your account and project status in the
Volcano dashboard — it reports the specific reason, which the response
deliberately withholds from your visitors. See
[plans and limits](plans-and-limits.md) for the limits that apply to your
project.
