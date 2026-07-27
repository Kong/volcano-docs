---
title: "Functions API"
description: "Deploy and invoke serverless functions."
---

Deploy and invoke serverless functions.

## List Functions

```http
GET /projects/{projectId}/functions
Authorization: Bearer <platform_token>
```

**Query Parameters:**
- `page`, `limit` - Pagination

**Response:**
```json
{
  "data": [
    {
      "id": "func-uuid",
      "name": "my-function",
      "status": "active",
      "is_public": false,
      "invoke_url": "https://func-uuid.functions.staging.volcano.dev/",
      "deployed_regions": ["us-east-1", "us-west-2"],
      "runtime": "nodejs24.x",
      "handler": "index.handler",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Get Function

```http
GET /projects/{projectId}/functions/{functionId}
Authorization: Bearer <platform_token>
```

The response is a `Function` resource and includes `invoke_url`, `created_at`, and `updated_at` when available.

## Create or Update Function Code

```http
POST /projects/{projectId}/functions
Authorization: Bearer <platform_token>
Content-Type: multipart/form-data
```

**Request:**
```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=my-function" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler" \
  -F "code=@function.zip"
```

**Parameters:**
- `name` (required) - DNS-safe function name (max 63 characters, lowercase letters/numbers/hyphens, cannot start or end with hyphen)
- `code` (required) - ZIP or `tar.gz` archive containing function source code plus dependency manifests/lockfiles
- `runtime` (required) - Runtime environment
- `handler` (optional) - Function name to invoke; defaults to `handler`

Cloud deploys install Node.js, Python, and Ruby dependencies during the function compile build. Upload source and manifests such as `package.json`, `requirements.txt`, or `Gemfile`; do not upload installed dependency directories such as `node_modules`, `python_deps`, `.venv`, or `vendor`.

Direct API clients may upload ZIP or `tar.gz`; the API stores a normalized `tar.gz` source archive. Uploaded source archives cannot contain symlink entries. The API enforces `SOURCE_ARCHIVE_SIZE_LIMIT_MB` on uploaded and normalized source archives. The CLI uploads `tar.gz` and does not enforce its own source archive size limit.

After dependencies are installed and the final Lambda image is built, the publish build rejects images larger than `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB`.

For direct API uploads, Volcano generates `.volcano/function-build.json` automatically. It infers `function_root` from the single runtime entry file (`index.js`/`index.mjs`, `main.py`, or `main.rb`), or from the only top-level directory when the archive has one. It infers `install_root` from the closest dependency manifest directory that contains the function root, otherwise it uses the function root.

**Runtimes:**
- `nodejs22.x`, `nodejs24.x`
- `python3.10`, `python3.11`, `python3.12`, `python3.13`, `python3.14`
- `ruby3.3`, `ruby3.4`, `ruby4.0`

**Response:** 201 Created

If a function with the same name already exists, the same endpoint updates that
function's runtime, handler, and source bundle and returns `200 OK`.

Deployment and code update are asynchronous. A deployment that starts
immediately returns `status: provisioning`, then transitions to `active` or
`failed`. If another deployment is running, the function keeps its current
status and exposes the queued deployment as `pending_deployment_id`.

For an existing function, the last known-good runtime continues serving traffic
while the update provisions. A failed update leaves that runtime available and
records the attempted deployment as failed.

Only one deployment runs for a given function. A newer deploy is accepted and
queued; it supersedes any older queued deploy and starts when the running
deployment finishes. Different functions and projects deploy concurrently.
Deployment history reports waiting work as `queued` and replaced work as
`superseded`.

**Limit:** Each project can contain up to 10,000 functions. Creating a new function over this cap returns `403 Forbidden`.

## Deploy Multiple Functions

```http
POST /projects/{projectId}/functions/batch
Authorization: Bearer <platform_token>
Content-Type: multipart/form-data
```

The `functions` multipart field is a JSON array describing each function (`name`, `runtime`, optional `handler`, and `file_field`). Each `file_field` points to a multipart file field containing that function's ZIP or `tar.gz` source bundle. The response includes a shared `batch_id` and the accepted function resources. Each function still runs its own cloud compile/publish workflow concurrently. The Volcano CLI automatically splits `functions deploy --all` into multiple 100-function batch requests when needed.

One batch request can include up to 100 functions. Submit multiple batch requests for larger projects.

If one function fails before its workflow starts, the API keeps already-started function deployments running and returns the failure in a `failed` array. Failed new functions are deleted; failed updates are rolled back to their previous metadata/status where possible.

Batch deploys follow the same source-bundle rules as single-function deploys: upload source and dependency manifests, not installed dependencies.

## Invoke Function

Functions can be invoked in two ways:

- DNS endpoint (recommended, geo-routed): `https://{functionId}.functions.<domain>/`
- API endpoint (direct invocation): `POST http://api.<domain>/functions/{functionId}/invoke`

```http
POST /functions/{functionId}/invoke
Authorization: Bearer <service_key_or_access_token_or_anon_key>
Content-Type: application/json
```

CORS preflight for invocation only allows:

```http
Access-Control-Allow-Methods: POST, OPTIONS
```

DNS equivalent:

```http
POST https://{functionId}.functions.<domain>/
Authorization: Bearer <service_key_or_access_token_or_anon_key>
Content-Type: application/json
```

**Token behavior:**
- Service key: always allowed
- Auth user access token: always allowed
- Anon key: allowed only when both are true:
  - key has `functions.invoke` permission
  - function has `is_public: true`

**Request:**
```json
{
  "payload": {
    "action": "process",
    "data": "value"
  }
}
```

**With service key:**
```json
// Function receives
{
  "action": "process",
  "data": "value"
}
```

**With Auth User Token:**
```json
// Function receives
{
  "action": "process",
  "data": "value",
  "__volcano_auth": {
    "user_id": "uuid",
    "email": "user@example.com",
    "role": "authenticated"
  }
}
```

**Response:**
```json
{
  // Raw function response body
}
```

The HTTP status code and headers are forwarded from the function response.  
All successful function invocations include `X-Volcano-Version` (`<version>` in production, `<env>-<version>` in non-production environments).

## Resolve Function Name

Resolves a function name to function ID in the caller's project.  
Used by SDKs before DNS invocation (`<function-id>.functions.<env-domain>`).

```http
GET /functions/resolve?name={functionName}
Authorization: Bearer <service_key_or_access_token_or_anon_key>
```

**Token behavior:**
- Service key: allowed
- Auth user access token: allowed
- Anon key: allowed only when:
  - key has `functions.invoke` permission
  - function is public (`is_public: true`)

**Response:**
```json
{
  "name": "my-function",
  "function_id": "3cd3e058-e3ff-42a5-ae4d-650ef9b45746",
  "cache_ttl_seconds": 300
}
```

## Get Function Logs

```http
POST /projects/{projectId}/logs/search
Authorization: Bearer <platform_token>
Content-Type: application/json
```

These are runtime invocation logs. Set `resource.type` to `function`; omit
`resource.ids` to list logs across all functions or include one or more function
IDs for selected functions. The optional `q` field runs a free-text search. When
`q` is omitted or blank, the endpoint returns stored logs using structured
filters only. Use `invocation_id` to select one exact function invocation; it can
be combined with `q` and the other structured filters. Deployment build logs are
exposed through the deployment log endpoints below. The platform token must
belong to the owner of `{projectId}`.

**Request Body Fields:**
- `resource.type` - Required. Use `function`
- `resource.ids` - Optional function IDs
- `q` - Optional free-text query
- `invocation_id` - Optional exact function invocation ID
- `limit` - Max events (default: 100, max: 1000)
- `cursor` - Opaque pagination cursor
- `start_time` - Inclusive lower bound as an RFC3339 timestamp
- `end_time` - Inclusive upper bound as an RFC3339 timestamp
- `levels` - Array of `trace`, `debug`, `info`, `warn`, `error`, or `fatal`
- `regions` - Region filters

**Example:**
```json
{
  "resource": {
    "type": "function",
    "ids": ["550e8400-e29b-41d4-a716-446655440000"]
  },
  "q": "checkout_failed",
  "invocation_id": "01JZ8QK9V6X3P5T7N2M4R8C0AB",
  "levels": ["warn", "error"],
  "regions": ["us-east-1"],
  "limit": 50
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "log/us-east-1/01HKG3W9M0A5V7R2J6Z0Q6Y4S9",
      "timestamp": "2024-01-01T12:00:00Z",
      "level": "info",
      "message": "Log message",
      "resource": {
        "type": "function",
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "my-function"
      },
      "region": "us-east-1"
    }
  ],
  "limit": 100,
  "has_more": true,
  "next_cursor": "eyJwayI6..."
}
```

## Function Deployment Build Logs

```http
POST /projects/{projectId}/logs/search
Authorization: Bearer <platform_token>
```

Returns runtime and deployment logs through the common project log search API.
For deployment build logs, send `resource.type=function`,
`resource.ids=[functionId]`, and
`resource.deployments.ids=[deploymentId]`. The platform token must belong to
the owner of `{projectId}`.

## List Function Deployments

```http
GET /projects/{projectId}/functions/{functionId}/deployments
Authorization: Bearer <platform_token>
```

Returns deployment history for a function, including workflow status and build log metadata.

## Delete Function

```http
DELETE /projects/{projectId}/functions/{functionId}
Authorization: Bearer <platform_token>
```

**Response:** 202 Accepted

Function deletion is asynchronous. If another deployment is running, list/get
responses keep the function's current status and expose the queued deletion as
`pending_deployment_id`. The status changes to `deleting` when cleanup starts.
When cleanup finishes, the function no longer appears in lists and
`GET /projects/{projectId}/functions/{functionId}` returns `404`.

Deletion is queued behind a running deployment and supersedes queued deploys.
After deletion is requested, later deploys return `409 Conflict` until deletion
finishes.

## Update Function Visibility

```http
PATCH /projects/{projectId}/functions/{functionId}
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "is_public": true
}
```

- `is_public: false` (default): private function, anon keys cannot invoke
- `is_public: true`: public function, anon keys with `functions.invoke` can invoke

> **Security note:** `is_public: true` does not mean "no token required" - it means invocation is allowed with an anon key.  
> Since anon keys are commonly shipped in frontend code, public functions should be treated as publicly reachable.

## Function Status

- `provisioning` - Being deployed
- `active` - Ready to invoke
- `failed` - Deployment failed

Useful deployment fields in responses:

- `invoke_url` - canonical DNS invoke URL for this function
- `deployed_regions` - regions where the function is currently deployed

## See Also

- [Creating Functions](../functions/creating-functions.md)
- [Invoking Functions](../functions/invoking-functions.md)
- [Function Logs](../functions/logs.md)
