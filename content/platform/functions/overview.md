---
title: "Functions"
description: "Functions are serverless code that runs on demand. You write the code, deploy it to Volcano, and invoke it via HTTP."
---

Functions are serverless code that runs on demand. You write the code, deploy it to Volcano, and invoke it via HTTP. Volcano handles provisioning, scaling, and execution.

## How functions work

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Write your code (Node.js, Python, or Ruby)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Package a source ZIP or tar.gz and upload via API          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Volcano builds and deploys the function                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Invoke via DNS endpoint or API endpoint                   │
└─────────────────────────────────────────────────────────────┘
```

Functions:
- Scale automatically based on demand
- Run only when invoked (no idle costs)
- Can access databases with user context
- Receive authenticated user identity when invoked with user tokens
- Can be invoked automatically on a cron schedule with [scheduled invocations](scheduled-invocations.md)

## CLI folder layout

When using the Volcano CLI, place functions under:

```text
volcano/functions/
```

Supported layouts:
- single-file functions such as `volcano/functions/hello.js`
- directory-based functions such as `volcano/functions/api/index.js`

The CLI derives the function name from:
- the filename for single-file functions
- the directory name for directory-based functions

The CLI packages cloud function sources as `tar.gz` archives and also automatically packages:
- shared files/directories whose names start with `_`
- dependency manifests such as `package.json`, `requirements.txt`, and `Gemfile`

Cloud deploys install dependencies during the function compile build. Do not upload `node_modules`, `python_deps`, or `vendor` to the cloud API. Local mode installs them too, from the same manifests, so you deploy the same sources either way.

Function and frontend source archives are limited by `SOURCE_ARCHIVE_SIZE_LIMIT_MB`, which is enforced by the API. The CLI does not apply its own source archive size limit. Final container images are limited by `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB`, which is enforced in the cloud publish build before images are pushed.

See [Creating functions](creating-functions.md) for concrete layout examples.

## Deployment regions

Functions deploy according to the owning project's region policy:

- Project `all_regions=true`: function deploys to all configured regions.
- Project `all_regions=false`: function deploys only to `selected_regions`.

Function API responses include `deployed_regions` so you can see where the function is active.

## Deployment lifecycle

Deploying a new function or updating an existing function's code starts an
asynchronous workflow. Function reads return `status: "provisioning"` while the
workflow is running, then transition to `active` when deployment succeeds or
`failed` if deployment fails. Deleting a function returns `status: "deleting"`
while cleanup runs, then the function disappears from `get` and `list` results.

## Supported runtimes

| Language | Runtimes | Default handler |
|----------|----------|-----------------|
| Node.js | nodejs24.x, nodejs22.x | `index.handler` |
| Python | python3.14, python3.13, python3.12, python3.11, python3.10 | `main.handler` |
| Ruby | ruby4.0, ruby3.4, ruby3.3 | `main.handler` |

The handler is the entry point Volcano calls when your code runs. For Node.js, `index.handler` means the `handler` export in `index.js`. You can customize this when deploying.

## Quick example

### 1. Write your function

```javascript
// index.js
exports.handler = async (event) => {
  const name = event.payload?.name || 'World';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Hello, ${name}!`
    })
  };
};
```

### 2. Package and deploy

```bash
# Create source ZIP or tar.gz file
zip function.zip index.js

# Deploy to Volcano
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=hello" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler" \
  -F "code=@function.zip"
```

### 3. Invoke

```bash
# Option A (recommended): DNS endpoint with geo routing
curl -X POST "https://$FUNCTION_ID.functions.volcano.dev/" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"name": "Volcano"}}'
```

```bash
# Option B: Invoke endpoint on API host (direct invocation)
curl -X POST "http://api.volcano.dev/functions/$FUNCTION_ID/invoke" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"name": "Volcano"}}'
```

Response:

```json
{
  "message": "Hello, Volcano!"
}
```

The invocation HTTP status code and headers come directly from your function response, and Volcano adds `X-Volcano-Version` (`production`: `VERSION`, non-production: `ENV-VERSION`) and `X-Volcano-Region`. See [Invoking functions](invoking-functions.md#response-format) for the headers Volcano owns and does not forward.

## Environment variables

Volcano doesn't set any environment variables automatically — add them through the API, including `DATABASE_URL` for your project's database connection string. See [Environment variables](environment-variables.md).

```javascript
// Access environment variables in your function
const apiKey = process.env.MY_API_KEY;
const dbUrl = process.env.DATABASE_URL;
```

## User context

When a function is invoked with a user's access token, it receives the user's identity in `event.__volcano_auth`:

```javascript
exports.handler = async (event) => {
  // Check if user is authenticated
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const { user_id, email, role, project_id } = event.__volcano_auth;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${email}!`,
      userId: user_id,
      role: role  // 'authenticated' or 'anonymous'
    })
  };
};
```

> **Note:** When invoked with a service key instead of a user token, `event.__volcano_auth` is not present. Service key invocations are for admin operations that don't have a user context.

See [User context](user-context.md) for details.

## Resource limits

Functions have configurable resource limits based on your plan:

| Resource | Free plan | Pro plan |
|----------|-----------|----------|
| Timeout | 180 seconds | 180 seconds |
| Memory | 256 MB | 256 MB |
| Disk | 1024 MB | 1024 MB |
| Rate limit (per function) | 10 RPS | Unlimited |
| Rate limit (project-wide) | 60 RPS | Unlimited |

## What's next

| Guide | Description |
|-------|-------------|
| [Creating functions](creating-functions.md) | Detailed deployment guide with examples |
| [Invoking functions](invoking-functions.md) | Call functions from your app |
| [User context](user-context.md) | Access authenticated user data |
| [Environment variables](environment-variables.md) | Configure secrets and settings |
| [Logs](logs.md) | View and filter function logs |
| [Deployment guide](deployment-guide.md) | Optimize package size and dependencies |
