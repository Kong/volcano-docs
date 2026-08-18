---
title: "Invoking functions"
description: "Call your deployed functions."
---

Call your deployed functions.

## Two ways to consume a function

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
