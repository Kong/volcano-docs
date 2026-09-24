---
title: "Error Handling"
description: "How the Volcano API reports errors, with status codes and JSON error bodies."
---

## Error Response Format

All errors return JSON:

```json
{
  "error": "descriptive error message"
}
```

## HTTP Status Codes

**2xx Success:**
- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `204 No Content` - Success (no response body)

**4xx Client Errors:**
- `400 Bad Request` - Invalid input or validation failed
- `401 Unauthorized` - Missing, invalid, or expired token
- `403 Forbidden` - Valid token but no permission
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource state conflicts with the request (for example, a duplicate resource or deletion already in progress)
- `429 Too Many Requests` - Rate limit exceeded

**5xx Server Errors:**
- `500 Internal Server Error` - Server-side error
- `503 Service Unavailable` - Function still provisioning

## Common Errors

### Authentication Errors

**401 - Missing Token:**
```json
{"error": "authorization header required"}
```

**401 - Invalid Token:**
```json
{"error": "invalid token"}
```

**401 - Expired Token:**
```json
{"error": "invalid or expired token"}
```

**403 - Wrong Project:**
```json
{"error": "token does not have access to this project"}
```

**403 - Account Banned:**
```json
{"error": "account is banned"}
```

### Project Access Token Errors

**401 - Expired, Revoked, or Unrecognized:**
```json
{"error": "invalid token"}
```

All three return the same body. The response does not say which, so a leaked
secret cannot be probed for whether it still exists. Read the token's record
with a platform token to see whether `status` is `revoked` or `expires_at` has
passed.

**403 - Read-only Scope:**
```json
{"error": "project access token is read-only"}
```

Returned for mutations. Reads that happen to be `POST` — log search, log
activity, log streaming, metrics query — are allowed.

**403 - Wrong Project:**
```json
{"error": "project access token is not valid for this project"}
```

**403 - Account-scoped Endpoint:**
```json
{"error": "project access tokens cannot be used on account-scoped endpoints; use a platform token"}
```

**403 - Token Management:**
```json
{"error": "project access tokens cannot manage project access tokens; use a platform token"}
```

**404 - Token Not Found:**
```json
{"error": "project access token not found"}
```

**409 - Duplicate Name:**
```json
{"error": "a project access token with that name already exists"}
```

Names are unique per project, so a retried create cannot mint a second token.
It cannot recover the first one's secret either. Getting this `409` on a retry
means the original create committed: list the tokens, revoke the one holding
the name, and create it again.

**409 - Token Limit Reached:**
```json
{"error": "a project may hold at most 100 active access tokens"}
```

**400 - Invalid Create Request:**
```json
{"error": "project access token expiry must be in the future"}
```

The same shape covers a missing name, a name over 100 characters, and a scope
other than `full` or `read_only`.

### Anon Key Errors

**401 - Missing Anon Key:**
```json
{"error": "anon key required"}
```

**401 - Invalid Authorization Header:**
```json
{"error": "invalid authorization header"}
```

**401 - Invalid/Tampered Anon Key:**
```json
{"error": "invalid anon key"}
```

**401 - Wrong Project:**
```json
{"error": "anon key does not match project"}
```

**401 - Revoked (old key after regeneration):**
```json
{"error": "anon key has been revoked"}
```

This occurs when using an old anon key JWT after the key has been regenerated. The key ID still exists but the JWT value no longer matches.

**401 - Not Found in Database:**
```json
{"error": "anon key not found"}
```

**403 - Missing Permission:**
```json
{"error": "anon key does not have auth.signup permission"}
```

**403 - CORS Blocked:**
```json
{"error": "origin not allowed by CORS policy"}
```

### Rate Limiting

Only the user authentication endpoints are rate limited per project and client
IP, and only they send `X-RateLimit-*` headers.

**429 - Rate Limited:**
```json
{"error": "rate limit exceeded, try again later"}
```

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704128400
```

`X-RateLimit-Reset` is a Unix timestamp for the end of the window. Signup,
password reset, and email change send it on a `429`; signin and refresh do not.

### Validation Errors

**400 - Invalid Email:**
```json
{"error": "invalid email format"}
```

**400 - Weak Password:**
```json
{"error": "password must be at least 15 characters"}
```

**400 - Missing Field:**
```json
{"error": "name is required"}
```

### Resource Errors

**404 - Not Found:**
```json
{"error": "project not found"}
```

**409 - Duplicate:**
```json
{"error": "user with this email already exists"}
```

**409 - Deletion in progress:**
```json
{"error": "frontend deletion already pending"}
```

Deployments are serialized per resource and coalesced using latest-wins
queueing. A deploy returns `409` only after deletion has been requested; wait
for deletion to finish before creating the resource again.

**503 - Still Provisioning:**
```json
{"error": "function is still provisioning, please try again in a few seconds"}
```

### Durable execution errors

Starting a [durable execution](../functions/durable-functions.md) has seven
refusals that are worth handling separately, because some of them clear on their
own and some do not.

**429 - Execution allowance spent:**
```json
{"error": "billing-cycle durable invocation allowance exceeded"}
```

**429 - Operation allowance spent:**
```json
{"error": "billing-cycle durable operations allowance of 100000 exceeded"}
```

**429 - Compute allowance spent:**
```json
{"error": "billing-cycle durable compute allowance of 10000 GB-seconds exceeded"}
```

All three messages carry a link to your usage page appended to them. They are the
plan's monthly [durable
allowances](../functions/durable-functions.md#limits-and-billing), and only a
HOBBY project is stopped at them; a SUPERAGENT project is served and billed for the
excess. None of them spends an execution, and none interrupts an execution
already running — the operation and compute allowances in particular are applied
to the next start, since neither is known until an execution has finished.
Nothing clears these until the billing cycle turns over or the plan changes, so
retrying is pointless.

**429 - Concurrency cap reached:**
```json
{"error": "durable execution concurrency limit reached: 10 of 10 in flight"}
```

The message names how many executions were in flight and the plan's cap. This is
the project's cap on executions in flight, not the rate limit above, so it
carries no `X-RateLimit-*` headers and no reset time. Retry once an execution
finishes, or raise the cap by upgrading the plan.

**409 - Not deployed yet:**
```json
{"error": "durable function is not deployed yet"}
```

The function exists but its first deployment has not finished, so there is
nothing to start. Wait for its `status` to reach `active` and retry. This is the
most common refusal immediately after a deploy.

**409 - Name contended:**
```json
{"error": "durable execution name was released while claiming it: \"order-4417\""}
```

Two starts raced for the same execution name and both released it. Nothing is
wrong with the request: retry it as-is.

**503 - Durable executions unavailable:**
```json
{"error": "durable executions are not available in this environment"}
```

Durable execution is not available here. The capability is paused, or this
deployment cannot serve it — either way the request is not one to retry in a
loop.

### Project lock errors

Project lock errors include stable codes:

```json
{"error":"Lock is held","code":"lock_held"}
```

- `lock_held` (`409`) — another live lease owns the key.
- `lock_ownership_lost` (`409`) — the lease expired or another token owns it.
- `lock_rate_limited` (`429`) — the project exceeded its lock operation limit.
- `lock_service_unavailable` (`503`) — ownership could not be decided. Fail
  closed and retry; do not continue as leader.

Project access token errors do too. A `409` on those endpoints means one of
three different things, so branch on `code` rather than the message text:

- `access_token_name_exists` (`409`) — that project already has a token with
  this name. Revoked tokens keep their names, so the clash may be with one that
  is not in the default listing.
- `access_token_limit_reached` (`409`) — the project is at its token cap.
  Revoke one you no longer use.
- `project_deleting` (`409`) — the project is being deleted, so its tokens can
  no longer be changed. Raised on any project write, not only these endpoints.

## Error Handling

### JavaScript/TypeScript

```javascript
try {
  const response = await fetch('https://api.volcano.dev/projects', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error
}
```

### With Volcano SDK

```javascript
try {
  await volcano.auth.signIn({...});
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Show rate limit message
  } else if (error.message.includes('invalid')) {
    // Show invalid credentials
  }
}
```

### Retry Logic

```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited. Only some auth endpoints report a reset timestamp.
        const resetTime = response.headers.get('X-RateLimit-Reset');
        await sleep(resetTime ? calculateWaitTime(resetTime) : 60000);
        continue;
      }
      
      if (response.status === 503) {
        // Still provisioning - wait and retry
        await sleep(2000);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}
```

## See Also

- [Authentication](authentication.md) - Auth headers and tokens
- [Using the API](using-the-api.md) - Working through these errors in a real workflow
- [Project access tokens](../authentication/security/project-access-tokens.md) - Scopes, revocation, and limits

