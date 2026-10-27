---
title: 'Error Handling'
description: 'How the Volcano API reports errors, with status codes and JSON error bodies.'
---

## Error Response Format

All errors return JSON:

```json
{
  "error": "descriptive error message"
}
```

Some errors also carry a stable `code` naming a specific recovery path. Match on
`code`, never on the message text, which can change.

## HTTP Status Codes

**2xx Success:**

- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `204 No Content` - Success (no response body)

**4xx Client Errors:**

- `400 Bad Request` - Invalid input or validation failed
- `401 Unauthorized` - Missing, invalid, or expired token
- `403 Forbidden` - Valid token but the request is refused: no permission, a reached limit, or a feature the plan does not include (code `plan_required`)
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource state conflicts with the request (for example, a duplicate resource or deletion already in progress)
- `410 Gone` - The resource existed but no longer takes the request (for example, a durable callback token whose wait timed out)
- `429 Too Many Requests` - Rate limit exceeded

**5xx Server Errors:**

- `500 Internal Server Error` - Server-side error
- `503 Service Unavailable` - Function still provisioning

## Common Errors

### Paginated List Errors

Some cursor and offset lists return `500` with these fixed messages when a
read fails, instead of exposing database connection details:

| Operation                                 | `error`                     |
| ----------------------------------------- | --------------------------- |
| Load a page or its included total         | `failed to list resources`  |
| Count results after loading a cursor page | `failed to count resources` |

`GET /projects` counts its total while loading the page, so its count failures
return `failed to list resources`.

The following offset and non-cursor lists return these fixed messages:

| Resource                             | Read failure                            | Count failure                            |
| ------------------------------------ | --------------------------------------- | ---------------------------------------- |
| Anonymous keys                       | `failed to list resources`              | `failed to list resources`               |
| Frontends                            | `failed to list resources`              | `failed to list resources`               |
| Auth sessions                        | `failed to list resources`              | `failed to list resources`               |
| Projects                             | `failed to list resources`              | `failed to list resources`               |
| Service keys                         | `failed to list service keys`           | `failed to count service keys`           |
| Functions                            | `failed to list functions`              | `failed to count functions`              |
| Variables                            | `failed to list variables`              | `failed to count variables`              |
| Databases                            | `failed to list databases`              | `failed to count databases`              |
| Project custom domains               | `failed to list project custom domains` | `failed to count project custom domains` |
| Project schedulers                   | `failed to list project schedulers`     | `failed to count project schedulers`     |
| Storage buckets                      | `failed to list buckets`                | No separate count                        |
| Storage objects (project admin list) | `failed to list storage objects`        | `failed to list storage objects`         |

For service keys, `page` or no pagination parameters selects offset pagination.
A `limit` without `page` selects cursor pagination.

In either pagination mode, frontend lists return `failed to list resources` if
function routes cannot be loaded. Function lists return
`failed to list function invocation metadata` if invocation metadata cannot be loaded.

Invalid or mismatched cursors still return `400` with the cursor diagnostic.
Keep the response's `X-Request-Id` when reporting a failure.

### Authentication Errors

**401 - Missing Token:**

```json
{ "error": "authorization header required" }
```

**401 - Invalid Token:**

```json
{ "error": "invalid token" }
```

**401 - Expired Token:**

```json
{ "error": "invalid or expired token" }
```

**403 - Wrong Project:**

```json
{ "error": "token does not have access to this project" }
```

**403 - Account Banned:**

```json
{ "error": "account is banned" }
```

### Project Access Token Errors

**401 - Expired, Revoked, or Unrecognized:**

```json
{ "error": "invalid token" }
```

All three return the same body. The response does not say which, so a leaked
secret cannot be probed for whether it still exists. Read the token's record
with a platform token to see whether `status` is `revoked` or `expires_at` has
passed.

**403 - Read-only Scope:**

```json
{ "error": "project access token is read-only" }
```

Returned for mutations. Reads that happen to be `POST` — log search, log
activity, log streaming, metrics query — are allowed.

**403 - Wrong Project:**

```json
{ "error": "project access token is not valid for this project" }
```

**403 - Account-scoped Endpoint:**

```json
{ "error": "project access tokens cannot be used on account-scoped endpoints; use a platform token" }
```

**403 - Token Management:**

```json
{ "error": "project access tokens cannot manage project access tokens; use a platform token" }
```

**403 - Durable Approval Decision:**

```json
{
  "error": "project access tokens cannot decide durable approvals; a person decides in the dashboard or with a platform token"
}
```

Returned when a `full` token approves or denies a [durable
approval](../functions/durable-approvals.md#who-can-decide). A `read_only` token
gets the read-only message instead. Both can still list and read approvals.

**403 - Repository Change:**

```json
{
  "error": "project access tokens cannot change a project's repository; a person changes it in the dashboard or with a platform token"
}
```

Returned when a `full` token calls `PUT /projects/{id}/git-connection`. A
`read_only` token gets the read-only message instead. A `full` token can still
change the [root
directory](../projects/git-deploy.md#change-the-root-directory) and [production
branch](../projects/git-deploy.md#deploy-from-a-different-branch).

**404 - Token Not Found:**

```json
{ "error": "project access token not found" }
```

**409 - Duplicate Name:**

```json
{ "error": "a project access token with that name already exists" }
```

Names are unique per project, so a retried create cannot mint a second token.
It cannot recover the first one's secret either. Getting this `409` on a retry
means the original create committed: list the tokens, revoke the one holding
the name, and create it again.

**409 - Token Limit Reached:**

```json
{ "error": "a project may hold at most 100 active access tokens" }
```

**400 - Invalid Create Request:**

```json
{ "error": "project access token expiry must be in the future" }
```

The same shape covers a missing name, a name over 100 characters, and a scope
other than `full` or `read_only`.

### Anon Key Errors

**401 - Missing Anon Key:**

```json
{ "error": "anon key required" }
```

**401 - Invalid Authorization Header:**

```json
{ "error": "invalid authorization header" }
```

**401 - Invalid/Tampered Anon Key:**

```json
{ "error": "invalid anon key" }
```

**401 - Wrong Project:**

```json
{ "error": "anon key does not match project" }
```

**401 - Revoked (old key after regeneration):**

```json
{ "error": "anon key has been revoked" }
```

This occurs when using an old anon key JWT after the key has been regenerated. The key ID still exists but the JWT value no longer matches.

**401 - Not Found in Database:**

```json
{ "error": "anon key not found" }
```

**403 - Missing Permission:**

```json
{ "error": "anon key does not have auth.signup permission" }
```

**403 - CORS Blocked:**

```json
{ "error": "origin not allowed by CORS policy" }
```

### Rate Limiting

The user authentication endpoints are rate limited per project and client IP,
and only they send `X-RateLimit-*` headers. Durable starts, project locks, and
durable approval requests have limits of their own, described in their sections.

**429 - Rate Limited:**

```json
{ "error": "rate limit exceeded, try again later" }
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
{ "error": "invalid email format" }
```

**400 - Weak Password:**

```json
{ "error": "password must be at least 15 characters" }
```

**400 - Missing Field:**

```json
{ "error": "name is required" }
```

**400 - Request does not match the API reference:**

When a request's body, query, or path breaks the
[API reference](openapi.md), the error names the field and the rule where it
can:

```json
{
  "error": "invalid request: time_range.window: value is not one of the allowed values [\"30m\",\"1h\",\"24h\",\"7d\"]"
}
```

The message always starts with `invalid request`. Some failures carry no
detail, such as a path ID that is not a UUID, and then the message is just
`invalid request`. Read the rest to fix the request; don't parse it.

### Resource Errors

**404 - Not Found:**

```json
{ "error": "project not found" }
```

**409 - Duplicate:**

```json
{ "error": "user with this email already exists" }
```

**409 - Deletion in progress:**

```json
{ "error": "frontend deletion already pending" }
```

Deployments are serialized per resource and coalesced using latest-wins
queueing. A deploy returns `409` only after deletion has been requested; wait
for deletion to finish before creating the resource again.

**503 - Still Provisioning:**

```json
{ "error": "function is still provisioning, please try again in a few seconds" }
```

### Unavailable capabilities

A request that starts new work with a capability switched off in this
environment answers `404`, or `400` for a single field or option, with code
`feature_unavailable`:

```json
{ "error": "sandboxes are not available", "code": "feature_unavailable" }
```

Retrying does not help. Check [`GET /capabilities`](overview.md#capabilities)
for what this environment offers.

### Plan-gated features

A request for a feature or option the project owner's plan does not include
returns `403` with code `plan_required`. Upgrading the plan unlocks it:

```json
{ "error": "database logs are only available on the PRO plan", "code": "plan_required" }
```

A `403` without a code leaves the reason unspecified: it can be an access
refusal, a reached limit, or a plan check that could not read the owner's plan.
Only `plan_required` means upgrading is the fix.

A point-in-time restore on a plan that includes restore history, before the
database has any restore history yet (for example right after an upgrade), also answers
`403` without a code, with `restore history is not available yet for the
requested time`. Waiting fixes it, not upgrading. A time outside history that
has accrued answers `400`.

### Durable execution errors

Starting a [durable execution](../functions/durable-functions.md) has eight
refusals that are worth handling separately, because some of them clear on their
own and some do not.

**429 - Execution allowance spent:**

```json
{ "error": "billing-cycle durable invocation allowance exceeded" }
```

**429 - Operation allowance spent:**

```json
{ "error": "billing-cycle durable operations allowance of 100000 exceeded" }
```

**429 - Compute allowance spent:**

```json
{ "error": "billing-cycle durable compute allowance of 10000 GB-seconds exceeded" }
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
{ "error": "durable execution concurrency limit reached: 10 of 10 in flight" }
```

The message names how many executions were in flight and the plan's cap. This is
the project's cap on executions in flight, not the rate limit above, so it
carries no `X-RateLimit-*` headers and no reset time. Retry once an execution
finishes, or raise the cap by upgrading the plan.

**409 - Not deployed yet:**

```json
{ "error": "durable function is not deployed yet" }
```

The function exists but its first deployment has not finished, so there is
nothing to start. Wait for its `status` to reach `active` and retry. This is the
most common refusal immediately after a deploy.

**409 - Name contended:**

```json
{ "error": "durable execution name was released while claiming it: \"order-4417\"" }
```

Two starts raced for the same execution name and both released it. Nothing is
wrong with the request: retry it as-is.

**409 - Name held:**

```json
{ "error": "durable execution name is held by another caller's start", "code": "execution_name_held" }
```

A start under this name failed before it began, and this caller may not finish
it: only the service key, the signed-in user who made it, or an anon key for one
an anon key made can. Retrying does not clear it. Start under a name of your own,
or finish it with the service key. See [Durable
messages](../functions/durable-messages.md#client-tokens).

**503 - Durable executions unavailable:**

```json
{ "error": "durable executions are not available in this environment" }
```

Durable execution is not available here. The capability is paused, or this
deployment cannot serve it — either way the request is not one to retry in a
loop.

### Durable approval errors

Approving or denying a [durable approval](../functions/durable-approvals.md)
that can no longer take that decision returns `409` with a `code`:

```json
{ "error": "approval already decided", "code": "approval_decided" }
```

- `approval_decided` — it was already decided the other way. Repeating the
  same decision is not an error; it returns the approval with `200`.
- `approval_expired` — its timeout passed first, and the workflow resumed with
  an `expired` decision.
- `approval_cancelled` — its execution ended before anyone decided.

None of them clears on retry. An approval id that does not exist in the project
answers `404` with `durable approval not found`.

A workflow's own request for an approval, sent by `ctx.waitForApproval`, has
refusals of its own. The SDK retries `404`, `429`, every `5xx`, and
`approval_not_ready` for about 30 seconds, and fails the call on the rest:

**409 - Request refused:**

```json
{ "error": "too many pending approvals for this execution", "code": "too_many_pending_approvals" }
```

- `approval_not_ready` — the request reached Volcano before the workflow
  finished opening it. Retried.
- `approval_closed` — the approval's deadline already passed. Not an error:
  `waitForApproval` resolves with an `expired` decision.
- `callback_taken` — the callback is already registered as a message wait or
  a messages session. The SDKs never send this.
- `execution_ended` — the execution has finished.
- `too_many_pending_approvals` — the execution already has 100 approvals
  pending.

**429 - Too many approval requests:**

```json
{ "error": "too many approval requests, try again later" }
```

The limit is 600 requests an hour per execution. A sending address is also
refused for the rest of the hour after 6,000 requests that registered nothing. It carries no `X-RateLimit-*` headers.

**503 - Not confirmed:**

```json
{ "error": "the approval could not be confirmed with the workflow; retry with backoff" }
```

### Durable message errors

Sending a [durable message](../functions/durable-messages.md) to an execution
that cannot take it returns `409` with a `code`:

```json
{ "error": "durable execution is not running", "code": "execution_not_running" }
```

- `execution_not_running` — the execution has ended. Nothing will take the
  message, so do not retry.
- `too_many_queued_messages` — the execution already holds 100 messages no wait
  has taken. Retry once it has consumed some.

An execution the caller may not reach answers `404` with `durable execution not
found`, the same as one that does not exist. Too many sends to one execution
answer `429` with `too many messages sent to this execution, try again later`;
the limit is 3,600 an hour. Sends and lists through the application endpoint
answer `429` with `rate limit exceeded` past the function's rate limit, the same
as an invocation.

A workflow's own waits and publishes, sent by `ctx.waitForMessage` and
`ctx.publish`, have refusals of their own. The SDK retries `404`, `429`, every
`5xx`, and `callback_not_ready` for about 30 seconds, and fails the call on the
rest:

- `callback_not_ready` — the wait reached Volcano before the workflow finished
  opening it. Retried.
- `callback_closed` — the wait's timeout already passed. Not an error:
  `waitForMessage` resolves with `null`.
- `callback_taken` — the callback is already registered as an approval, or as
  another wait or session. The SDKs never send this; it means a modified SDK
  reused a callback.
- `execution_ended` — the execution finished before a wait or a messages
  session was registered.
- `execution_not_running` — the execution finished before a publish.
- `too_many_message_waits` — the execution already has 100 waits open.
- `too_many_message_sessions` — the execution already opened 1,000 messages
  sessions.
- `too_many_published_messages` — the execution already published 1,000
  messages.

A publish with a session token Volcano does not accept answers `401`. The SDKs
never send one.

### Durable callback errors

Succeeding, failing, or heartbeating a [durable
callback](../functions/durable-callbacks.md) with a token that no longer takes
the request returns a `code`:

```json
{ "error": "callback already has an outcome", "code": "callback_completed" }
```

- `callback_not_found` (`404`) — no wait has this token, or its execution is
  past retention.
- `callback_completed` (`409`) — the token was already succeeded or failed,
  including by the request you are retrying. Treat it as done.
- `callback_expired` (`410`) — the wait timed out, on its timeout or its
  heartbeat timeout.
- `execution_ended` (`410`) — the execution finished or was stopped.

None of them clears on retry. Too many answers and heartbeats answer `429`
with `too many callback requests, try again later`; the limits are 3,600 an
hour for one token and 36,000 an hour for its project. A heartbeat that cannot
reach the execution right now answers `503`; retry it with backoff.

A workflow's own request for a token, sent by `ctx.waitForCallback`, has
refusals of its own. The SDK retries `404`, `429`, every `5xx`, and
`callback_not_ready` for about 30 seconds, and fails the call on the rest:

- `callback_not_ready` — the request reached Volcano before the workflow
  finished opening the wait. Retried.
- `callback_closed` — the wait already timed out, or a retried submitter's
  token was already answered. Not an error: `waitForCallback` resolves as the
  wait did, with `null` after a timeout, without calling the submitter.
- `callback_taken` — the callback is already registered as an approval or a
  message wait. The SDKs never send this.
- `execution_ended` — the execution has finished.
- `too_many_callback_tokens` — the execution already holds 1,000 open tokens.

### Project lock errors

Project lock errors include stable codes:

```json
{ "error": "Lock is held", "code": "lock_held" }
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

Variable Environment errors also include stable codes. Branch on `code` when
the same status can describe more than one condition:

- `invalid_variable_environment` (`400`) — the name is the reserved `Global`
  name. Other schema-invalid names return the generic invalid-request `400`
  without a stable code.
- `variable_environment_conflict` (`409`) — another Environment in the Project
  already has that name, compared case-insensitively.
- `variable_environment_limit_reached` (`409`) — the Project already has 100
  custom Environments; Global does not count toward the cap.
- `variable_environment_immutable` (`409`) — the request tried to rename or
  delete Global.
- `project_deleting` (`409`) — the Project is being deleted, so its
  Environments can no longer be changed.

## Error Handling

### JavaScript/TypeScript

```javascript
try {
  const response = await fetch('https://api.volcano.dev/projects', {
    headers: { Authorization: `Bearer ${token}` },
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
