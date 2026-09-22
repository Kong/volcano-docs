---
title: "Using the API"
description: "Create a project access token and drive a real workflow with it: deploy a function, set a variable, read logs, handle errors, and rotate the credential."
---

Everything you can do in the dashboard, you can do over HTTP. This guide takes you from no credential to a working deploy pipeline.

```bash
# 1. Mint a token for one project (needs your platform token)
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-deploy", "scope": "full"}'

# 2. Save the "token" value from the response, then use it
export VOLCANO_PROJECT_TOKEN="pt-9f3c1a8b2d47e0c5a1b8f36d92e4c7a05be18f2d6c39a4b7e0d581c2f6a9b34e"

# 3. Call the API
curl "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN"
```

## Get a platform token

Project access tokens are created with a **platform token** (`pk-`), the credential that represents your account. Get one by signing in with the CLI:

```bash
volcano login
```

`volcano login` opens your browser, completes the sign-in, and stores the token for the CLI. You can also create one in the Volcano dashboard when you need the value itself — for example to paste into `volcano login --token` on a machine without a browser.

Keep the platform token on your workstation. It reaches every project you own, so it is the wrong credential to hand to a CI job; that is what the rest of this guide is about.

## Create a project access token

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-deploy",
    "scope": "full",
    "expires_at": "2025-07-01T00:00:00Z"
  }'
```

```json
{
  "id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "project_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "ci-deploy",
  "token_prefix": "pt-9f3c1a8b2",
  "scope": "full",
  "status": "active",
  "token_source": "api",
  "expires_at": "2025-07-01T00:00:00Z",
  "created_at": "2024-07-02T09:14:22Z",
  "all_time_requests": 0,
  "token": "pt-9f3c1a8b2d47e0c5a1b8f36d92e4c7a05be18f2d6c39a4b7e0d581c2f6a9b34e"
}
```

| Field | Notes |
|-------|-------|
| `name` | Required. Held by any token you have not revoked, including one that has expired, so a retried create cannot mint a second token. Revoking frees the name |
| `scope` | Required. `full` for deploys, `read_only` for anything that only reads |
| `expires_at` | Optional RFC 3339 timestamp in the future. Omit for a token that never expires |

> **Warning:** `token` appears in this response and nowhere else. Volcano keeps only a hash of it — there is no endpoint that returns it again. Put it straight into your secret store.

Everything after this point uses that value. Store it the way you store any other deploy secret, and never commit it.

```bash
export VOLCANO_PROJECT_TOKEN="pt-..."
export PROJECT_ID="7c9e6679-7425-40de-944b-e07fc1f90ae7"
```

## Make your first call

Every request goes to `https://api.volcano.dev` with the token in an `Authorization` header:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN"
```

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "checkout",
      "status": "active",
      "runtime": "nodejs24.x",
      "handler": "index.handler",
      "invoke_url": "https://550e8400-e29b-41d4-a716-446655440000.functions.volcano.dev/",
      "deployed_regions": ["us-east-1"],
      "created_at": "2024-06-11T08:02:44Z",
      "updated_at": "2024-07-01T17:20:09Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "has_more": false
}
```

The path always names the project the token belongs to. Point it at a different project and you get `403` rather than a result — the binding is checked on every request, not just at creation.

See [Overview](overview.md) for pagination and status codes. These endpoints send no `X-RateLimit-*` headers, and a request with a valid token is never refused for its rate. Repeatedly presenting credentials that are not recognized is rationed per source and answered with `429`.

## A real workflow

Three calls that make up most deploy pipelines: ship code, configure it, check that it worked.

### 1. Deploy a function

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -F "name=checkout" \
  -F "runtime=nodejs24.x" \
  -F "handler=index.handler" \
  -F "code=@checkout.zip"
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "checkout",
  "status": "provisioning",
  "runtime": "nodejs24.x",
  "handler": "index.handler",
  "deployed_regions": ["us-east-1"],
  "created_at": "2024-07-02T09:20:31Z",
  "updated_at": "2024-07-02T09:20:31Z"
}
```

Deploys are asynchronous. Poll the function until `status` leaves `provisioning`:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNCTION_ID" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN"
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "checkout",
  "status": "active",
  "invoke_url": "https://550e8400-e29b-41d4-a716-446655440000.functions.volcano.dev/",
  "deployed_regions": ["us-east-1"],
  "updated_at": "2024-07-02T09:22:05Z"
}
```

Posting the same `name` again updates that function and returns `200` instead of `201`. See [Functions](functions.md) for archive rules and runtimes.

### 2. Set a variable

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/variables" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "PAYMENTS_BASE_URL", "value": "https://payments.internal.example.com"}'
```

```json
{
  "id": "a2c4e8d1-5b77-4b0e-9f24-6f1f0e3b7a55",
  "project_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "PAYMENTS_BASE_URL",
  "value": "https://payments.internal.example.com",
  "status": "provisioning",
  "current_sync_id": "f0c1b9a7-2d3e-4a58-8c19-77b0a2e4d611",
  "created_at": "2024-07-02T09:23:12Z",
  "updated_at": "2024-07-02T09:23:12Z"
}
```

Deployed functions pick up the new value once propagation finishes; they do not need a redeploy. See [Environment variables](../functions/environment-variables.md).

### 3. Read the logs

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": {"type": "function", "ids": ["550e8400-e29b-41d4-a716-446655440000"]},
    "q": "level:error",
    "limit": 20
  }'
```

```json
{
  "data": [
    {
      "id": "log/us-east-1/01HKG3W9M0A5V7R2J6Z0Q6Y4S9",
      "timestamp": "2024-07-02T09:24:18Z",
      "level": "error",
      "body": {
        "message": "checkout_failed",
        "order_id": "ord_8821"
      },
      "resource": {
        "type": "function",
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "checkout"
      },
      "region": "us-east-1"
    }
  ],
  "limit": 20,
  "has_more": false
}
```

Log search is a `POST` because the filters travel in the body, but it is a read: a `read_only` token can call it, along with log activity, log streaming, and metrics queries. Give a monitoring or alerting job `read_only` and it can watch the project without being able to change it.

Reads that hand back a credential are the exception. `read_only` is refused on service keys, anon keys, variable values, and database connection strings, because those write to the project's data and keep working after the token that fetched them is revoked — so a token that could read one would not really be read-only. A job that needs those needs `full`.

## Errors you will actually hit

| Status | Body | What to do |
|--------|------|------------|
| `401` | `{"error": "invalid token"}` | The token is expired, revoked, or not a token. Mint a new one |
| `403` | `{"error": "project access token is read-only"}` | The job needs `scope: full` |
| `403` | `{"error": "project access token is read-only; reading this project's credentials needs a full-scope token"}` | Reading a service key, a variable's value, or a database connection string needs `scope: full` |
| `403` | `{"error": "project access token is not valid for this project"}` | The token belongs to a different project |
| `403` | `{"error": "project access tokens cannot be used on account-scoped endpoints; use a platform token"}` | The call acts on your account, not one project |
| `403` | `{"error": "project access tokens cannot manage project access tokens; use a platform token"}` | Token management needs a platform token |
| `404` | `{"error": "project access token not found"}` | Wrong token ID, or it belongs to another project |
| `409` | `{"code": "access_token_name_exists"}` | A token you have not revoked still holds that name — an expired one does too. Revoke it to free the name, so rotation can keep the name your CI config already uses |
| `409` | `{"code": "access_token_limit_reached"}` | Revoke tokens you no longer use |
| `409` | `{"code": "project_deleting"}` | The project is being deleted; its tokens can no longer be changed |
| `500` | `{"error": "failed to validate token"}` | Volcano could not check the credential. Retry; do not mint a new token |

A few of those deserve detail.

**A `500` is not a credential problem.** It means the check itself failed, so the token is probably fine — retry rather than rotating it. Only `401` means the credential was rejected.

**Expired or revoked tokens both return `401` with the same body.** Volcano does not say which, so a leaked secret cannot be probed for whether it still exists. If a pipeline starts failing with `invalid token`, read the token's record — `status` distinguishes the two:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$TOKEN_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "name": "ci-deploy",
  "token_prefix": "pt-9f3c1a8b2",
  "scope": "full",
  "status": "revoked",
  "expires_at": "2025-07-01T00:00:00Z",
  "last_used_at": "2024-07-02T09:24:51Z",
  "created_at": "2024-07-02T09:14:22Z",
  "all_time_requests": 1284
}
```

`status` is one of:

| Value | Meaning |
|-------|---------|
| `active` | Usable |
| `revoked` | Revoked deliberately, by you or by the deletion of its project |
| `expired` | Reached `expires_at`. Nobody revoked it |

A token revoked before its expiry passed stays `revoked`, because that is the fact worth knowing after a leak.

**Revoking twice is not an error.** `DELETE` is idempotent: a retried or duplicated revoke returns `204`, so a pipeline that retries on a timeout does not have to tell "already revoked" apart from "never existed". A `404` means the token is genuinely not in this project.

**A duplicate name is a conflict, not a second token.** Uniqueness stops a retry minting a duplicate; it does not make create retryable. If the first attempt committed and its response was lost, the retry returns `409` and that secret is gone for good — revoke the token holding the name and create it again.

**Retry on `5xx`, never on `4xx`.** A `5xx` is Volcano's problem and the same request may well succeed; every `4xx` above needs you to change something first, so retrying one just burns your pipeline's time:

```bash
deploy() {
  for attempt in 1 2 3; do
    status=$(curl -s -o /tmp/body -w '%{http_code}' \
      -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
      -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
      -F "name=checkout" -F "runtime=nodejs24.x" -F "code=@checkout.zip")
    if [ "$status" -lt 500 ]; then
      cat /tmp/body
      [ "$status" -lt 400 ]
      return
    fi
    sleep $((attempt * 5))
  done
  return 1
}
```

Do not wrap token creation in that loop. It returns a secret once, so a lost response cannot be replayed: list the tokens, revoke the one holding the name, and create it again.

See [Errors](errors.md) for the full catalogue.

## Rotate and revoke

Rotation is create, swap, revoke — in that order, so nothing runs without a working credential:

```bash
# 1. Mint the replacement under a new name
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-deploy-2024-07", "scope": "full"}'

# 2. Update the secret wherever it is stored, and let a job run with it

# 3. Revoke the old one
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$OLD_TOKEN_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```text
HTTP/1.1 204 No Content
```

Revoking takes effect immediately in the region handling the call and within seconds everywhere else. Revoking twice succeeds, so a rotation script does not need to check first.

Before you retire the old token, confirm nothing still uses it:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$OLD_TOKEN_ID/usage?days=7" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "token_id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "name": "ci-deploy",
  "days": 7,
  "daily": [
    { "day": "2024-06-26", "requests": 118 },
    { "day": "2024-06-27", "requests": 96 },
    { "day": "2024-06-28", "requests": 0 },
    { "day": "2024-06-29", "requests": 0 },
    { "day": "2024-06-30", "requests": 74 },
    { "day": "2024-07-01", "requests": 131 },
    { "day": "2024-07-02", "requests": 0 }
  ],
  "total_requests": 419
}
```

Revoking is not a rollback. Whatever the token already did stands, so if you are revoking because a secret leaked, treat everything in the project as exposed and rotate its other credentials too. [Project access tokens](../authentication/security/project-access-tokens.md) walks through that.

## Move CI off an account-wide platform token

If your pipeline authenticates with a `pk-` token, one leaked CI secret exposes every project on the account. Swapping it for a project token takes one pass over the workflow.

**1. Mint a token per project and per job.** Separate tokens for staging and production, and a separate one for jobs that only read, so you can revoke a single pipeline without stopping the others:

```bash
curl -X POST "https://api.volcano.dev/projects/$STAGING_PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "github-actions-staging", "scope": "full"}'

curl -X POST "https://api.volcano.dev/projects/$STAGING_PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "github-actions-smoke-tests", "scope": "read_only"}'
```

**2. Store each secret in your CI provider** and stop passing the platform token to jobs.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      PROJECT_ID: ${{ vars.VOLCANO_PROJECT_ID }}
      VOLCANO_PROJECT_TOKEN: ${{ secrets.VOLCANO_PROJECT_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - name: Deploy checkout function
        run: |
          zip -qr checkout.zip .
          curl -sf -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
            -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
            -F "name=checkout" \
            -F "runtime=nodejs24.x" \
            -F "handler=index.handler" \
            -F "code=@checkout.zip"
```

**3. Fix the calls that no longer work.** A project token is refused on anything account-scoped, which usually means one of these:

| Pipeline step | Replacement |
|---------------|-------------|
| `GET /projects` to find the project ID | Store the ID as a CI variable |
| `POST /projects` to create an environment per branch | Keep that step on a platform token in a separate, tightly restricted job |
| Anything under `/projects/{id}/access-tokens` | Manage tokens outside CI; a deploy job should not be able to mint credentials |

**4. Revoke the platform token's role in CI.** Delete the CI secret, and rotate the platform token itself if it was ever exposed to a job.

**5. Confirm the switch.** Run the pipeline, then read the new token's record. `last_used_at` and its daily counts should have moved; if they are still empty, something is authenticating with the old credential.

## What's next

| Reference | Description |
|-----------|-------------|
| [Project access tokens](../authentication/security/project-access-tokens.md) | Scopes, revocation timing, and the security model |
| [Overview](overview.md) | Base URL, pagination, status codes |
| [Authentication](authentication.md) | Every token type and where it comes from |
| [Errors](errors.md) | Error codes and handling |
| [Functions](functions.md) | Deployment and invocation reference |
| [OpenAPI specification](openapi.md) | Generate a client instead of writing these calls by hand |
