---
title: "Invoking functions"
description: "Call your deployed functions."
---

Call your deployed functions.

## Choose an invocation mode

Every function has an invocation contract:

- `rpc` (default) preserves the existing Volcano contract. The DNS endpoint and
  direct API endpoint accept `POST`, the request body is `{ "payload": ... }`,
  and Volcano authentication is required.
- `http` turns the DNS endpoint into an HTTP handler. It accepts `GET`, `HEAD`,
  `POST`, `PUT`, `PATCH`, and `DELETE` on nested paths and passes the HTTP request
  shape to your function.

HTTP mode has a separate `http_auth_mode`:

- `volcano` (default) requires an auth-user token, service key, or permitted anon key.
- `none` skips Volcano authentication so third-party webhooks can reach the
  function. It is valid only when `is_public` is also `true`; your function must
  verify the provider's signature or application credential.

Configure an existing function with the management API:

```bash
curl -X PATCH "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNC_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_public": true,
    "invocation_mode": "http",
    "http_auth_mode": "none",
    "openapi_spec": {
      "openapi": "3.1.0",
      "info": {"title": "Payment webhook", "version": "1.0.0"},
      "paths": {"/webhooks/payments": {"post": {}}}
    }
  }'
```

`openapi_spec` is optional descriptive metadata. Volcano validates that it is
an OpenAPI 3.0 or 3.1 JSON document and limits it to 256 KiB; it does not use the
document to route or validate runtime requests.

### Roll back HTTP mode

Invocation metadata is control-plane configuration, so switching back does not
redeploy or replace the function runtime. Patch the function back to `rpc`; Volcano
atomically restores `http_auth_mode: volcano` and clears `openapi_spec`. Making
the function private at the same time closes anon-key access as well:

```bash
curl -X PATCH "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNC_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_public":false,"invocation_mode":"rpc"}'
```

After the update, the DNS endpoint again accepts only `POST /` with the
`{"payload": ...}` RPC envelope and Volcano authentication. Existing RPC
functions require no migration action: a missing metadata row resolves to the
same RPC/Volcano defaults.

## Two ways to consume an RPC function

You can invoke a function in either of these ways:

1. **DNS endpoint (recommended):** `https://{functionId}.functions.<domain>/`  
   This path includes built-in geo routing.
2. **Invoke endpoint:** `POST http://api.<domain>/functions/{functionId}/invoke`  
   Useful when you want direct invocation on the API host.

Example DNS call:

```bash
curl -X POST "https://$FUNC_ID.functions.volcano.dev/" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"action":"process","data":"value"}}'
```

## Invocation methods by token type

Functions are **private by default** (`is_public: false`).

### With service key (admin/background)

For admin operations, background jobs, cron, and webhooks:

```bash
curl -X POST "https://$FUNC_ID.functions.volcano.dev/" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"action":"process","data":"value"}}'
```

> **Warning:** Service keys bypass RLS. Use only in backend environments.

Function receives:
```javascript
{
  "action": "process",
  "data": "value"
  // No __volcano_auth (admin operation)
}
```

## HTTP mode request event

HTTP-mode functions receive this event instead of the RPC payload:

```json
{
  "version": "1.0",
  "method": "POST",
  "path": "/webhooks/payments",
  "raw_query_string": "attempt=one&attempt=two",
  "headers": {
    "Content-Type": ["application/json"],
    "Provider-Signature": ["signature"]
  },
  "query": {
    "attempt": ["one", "two"]
  },
  "body": "{\"event\":\"payment.succeeded\"}",
  "is_base64_encoded": false,
  "request_context": {
    "host": "FUNCTION_ID.functions.volcano.dev",
    "source_ip": "203.0.113.10",
    "protocol": "HTTP/1.1"
  }
}
```

Header and query values are arrays so repeated values are preserved. For text
requests, `body` contains the exact UTF-8 request text. Binary requests put the
base64-encoded bytes in `body` and set `is_base64_encoded: true`. HTTP request
bodies are limited to 2 MiB. Volcano
also rejects a request if headers, query parameters, body encoding, and trusted
auth context make the final invocation event exceed 6 MiB.

In `http_auth_mode: volcano`, platform credential headers are removed before
the event reaches the function; authenticated-user context remains available as
`event.__volcano_auth`. In `http_auth_mode: none`, `Authorization` and provider
signature headers are application input and are forwarded. Internal
`X-Volcano-*` headers are never forwarded.
Proxy-derived headers (`Forwarded`, `X-Forwarded-*`, and `X-Real-IP`) are also
removed; use `request_context.source_ip`, `request_context.host`, and
`request_context.protocol` for Volcano's trusted connection metadata.

Webhook example:

```javascript
import crypto from 'node:crypto';

exports.handler = async (event) => {
  const signature = event.headers['Provider-Signature']?.[0] || '';
  const rawBody = Buffer.from(
    event.body || '',
    event.is_base64_encoded ? 'base64' : 'utf8'
  );
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const supplied = Buffer.from(signature);
  const calculated = Buffer.from(expected);

  if (supplied.length !== calculated.length ||
      !crypto.timingSafeEqual(supplied, calculated)) {
    return { statusCode: 401, body: 'invalid signature' };
  }

  return {
    statusCode: 202,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accepted: true })
  };
};
```

Reject stale provider timestamps before comparing the signature, and persist the
provider event ID before applying side effects so retries are idempotent. Compare
signatures with `timingSafeEqual` as above. Convert `event.body` according to
`event.is_base64_encoded` for the exact signed bytes; do not parse and
reserialize it first.

### With auth user token (user context)

For user-facing operations:

```bash
curl -X POST "https://$FUNC_ID.functions.volcano.dev/" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"action":"get_profile"}}'
```

Function receives:
```javascript
{
  "action": "get_profile",
  "__volcano_auth": {
    "user_id": "uuid",
    "email": "user@example.com",
    "project_id": "project-uuid",
    "role": "authenticated",  // or "anonymous" for anonymous users
    "access_token": "eyJhbGci..."  // the caller's access token, e.g. to forward to the Volcano SDK/API
  }
}
```

### With anon key (public functions only)

Use this only for explicitly public functions:

```bash
curl -X POST "https://$FUNC_ID.functions.volcano.dev/" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"action":"public_ping"}}'
```

Requirements:
- Function must be public (`is_public: true`)
- Anon key must include `functions.invoke` permission

> **Security note:** Public functions still require a valid anon key, but anon keys are usually embedded in frontend apps.  
> If your frontend exposes the anon key, treat `is_public: true` functions as internet-facing endpoints.

Function receives:
```javascript
{
  "action": "public_ping"
  // No __volcano_auth for anon key invocation
}
```

## Payload format

Send any JSON:

```json
{
  "action": "create_post",
  "title": "My Post",
  "content": "Content here",
  "tags": ["tech", "coding"],
  "metadata": {
    "source": "web"
  }
}
```

Function receives exactly this (plus `__volcano_auth` if using auth token).

## Response format

```json
// Volcano now forwards your function response directly.
// HTTP status code, headers, and body come from the function return value.
```

Every invocation response says which build and region answered:

- `X-Volcano-Version`: `<version>` in `production`, `<env>-<version>` elsewhere (example: `staging-xyz`)
- `X-Volcano-Region`: the region your function ran in (example: `us-east-1`)

Those two and `X-Volcano-Health` are set by the platform: a response header your
function returns under one of those names is dropped rather than forwarded, as
are Volcano's own internal headers. Every other header you return is forwarded
as written.

## Handling responses

### Successful response

```javascript
// In function
return {
  statusCode: 200,
  body: JSON.stringify({ result: 'success' })
};
```

For a binary response, base64 encode `body` and return
`isBase64Encoded: true`. `HEAD` executes the function with `method: "HEAD"` but
Volcano suppresses the response body.

```json
{
  "result": "success"
}
```

### Error response

```javascript
// In function
return {
  statusCode: 404,
  body: JSON.stringify({ error: 'Not found' })
};
```

```json
{
  "error": "Not found"
}
```

### Function errors

If your function throws an error:

```json
{
  "errorMessage": "Something went wrong"
}
```

## Accessing user context in functions

### Check if user is authenticated

```javascript
exports.handler = async (event) => {
  // Check if any user (anonymous or authenticated)
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const { user_id, email, role } = event.__volcano_auth;
  
  // Proceed with authenticated operation
  // All users have a user_id for data tracking
};
```

### Differentiate between user types

```javascript
exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    // No authentication - reject or handle as public
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (auth.role === 'anonymous') {
    // Guest user - maybe prompt to create account
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: result,
        message: 'Create an account to save your data permanently'
      })
    };
  }

  if (auth.role === 'authenticated') {
    // Full registered user
    return {
      statusCode: 200,
      body: JSON.stringify({ data: result })
    };
  }
};
```

### Available user context fields

When invoked with an auth user token, functions receive:

```javascript
event.__volcano_auth = {
  user_id: "uuid",           // Unique user ID (same for anonymous → authenticated conversion)
  email: "user@example.com", // User's email (or internal format for anonymous)
  project_id: "uuid",        // Project the user belongs to
  role: "authenticated",     // "authenticated" or "anonymous"
  access_token: "eyJhbGci..." // The caller's access token
}
```

**Role values:**
- `"authenticated"` - User signed up with email/password or OAuth
- `"anonymous"` - Guest user (signed up without credentials)

**Important:** Both user types have a `user_id` - use this to track user data. When an anonymous user converts to authenticated, their `user_id` stays the same, preserving all their data.

## Using frontend SDK

```javascript
const volcano = new VolcanoAuth({...});

// Sign in first
await volcano.auth.signIn({...});

// Invoke function (access token sent automatically)
const result = await volcano.functions.invoke('get-data', {
  action: 'get_data'
});

console.log(result.status);   // HTTP status returned by function
console.log(result.version);  // X-Volcano-Version
console.log(result.data);     // Parsed response body
```

## Error handling

| Status | Description |
|--------|-------------|
| 401 Unauthorized | Missing Authorization header, invalid token, or token for wrong project |
| 404 Not Found | Function doesn't exist in your project |
| 503 Service Unavailable | Function still provisioning; check status and retry |

## What's next

| Guide | Description |
|-------|-------------|
| [User context in functions](user-context.md) | Complete guide to accessing user information |
| [Creating functions](creating-functions.md) | Deploy new functions |
| [Function logs](logs.md) | View execution logs |
| [Anonymous users](../authentication/anonymous-users.md) | Guest user authentication |
