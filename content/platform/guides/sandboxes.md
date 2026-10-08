---
title: Sandboxes
description: Run isolated commands and keep temporary sessions alive for files and HTTP services.
---

## Run a command

Run a command in a temporary Sandbox:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-executions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"us-east-1","command":"python -c '\''print(42)'\''","timeout_seconds":30}'
```

```json
{
  "session_id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "region": "us-east-1",
  "duration_ms": 2300,
  "stdout": "42\n",
  "stderr": "",
  "exit_code": 0,
  "stdout_truncated": false,
  "stderr_truncated": false,
  "timed_out": false
}
```

Sandbox access is available only in enabled environments. An unavailable environment
returns `503`. Discover published presets and regions with `GET /sandboxes/presets`.
Use the returned preset IDs when creating templates, sessions, or one-shot executions.
An empty catalog means no verified preset has been published yet.

## Keep a session alive

Create a session, then poll its returned ID until `state` is `running`:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-sessions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"us-east-1","memory_mb":1024,"max_duration_seconds":3600}'
```

```json
{
  "id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "project_id": "8b1ec799-b9dd-4db0-8466-486d57d166f1",
  "sandbox_id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "region": "us-east-1",
  "memory_mb": 1024,
  "state": "starting",
  "desired_state": "running",
  "created_at": "2026-09-23T12:00:00Z",
  "expires_at": "2026-09-23T13:00:00Z"
}
```

Use `GET /sandbox-sessions/{sessionId}` to read state. Creation is asynchronous;
`starting` does not mean commands can run yet. `unknown` requires operator recovery.

Run commands through `POST /sandbox-sessions/{sessionId}/exec`, with a new
`Idempotency-Key` for each intended command:

```bash
curl "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/exec" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"command":"python -m http.server 8080 >/workspace/http.log 2>&1 &","timeout_seconds":10}'
```

The HTTP service remains alive after the command returns. Its lifetime belongs
to the session. The command can return before the service starts listening.
Poll a read-only health endpoint with a timeout before sending application traffic;
a request made before the port is listening can return `502`. Do not restart the
command or retry a write request just to wait for readiness.

Suspending retains the session's state; terminating destroys it.

| Operation | Endpoint |
| --- | --- |
| Suspend | `POST /sandbox-sessions/{sessionId}/suspend` |
| Resume | `POST /sandbox-sessions/{sessionId}/resume` |
| Terminate | `DELETE /sandbox-sessions/{sessionId}` |

These operations return `202`. Poll `state` for completion. `desired_state`
records the requested outcome. Once termination is requested, public reads report
`terminating` until the session is `terminated`, unless its state is `unknown`
and requires operator recovery. Closing new-session admission does not prevent
termination or grant revocation.

## Choose lifetime and memory

Supply exactly one of `preset` or `sandbox_id` when creating or executing.
Presets support `1024` and `2048` MB; omitted memory selects `1024` MB. Named
Sandboxes retain their selected memory for both sessions and one-shot executions
when `memory_mb` is omitted. A conflicting override is rejected.

| Field | Behavior |
| --- | --- |
| `max_duration_seconds` | Inherits the template TTL when omitted (3600 for a new template); 30–28800 seconds, further bounded by environment capacity policy. Absolute expiry also applies while suspended. |
| `idle_timeout_seconds` | Inherits the template idle timeout when omitted, capped at the session duration. Explicit 0 disables idle termination. Explicit values cannot exceed maximum duration. |
| Command `timeout_seconds` | Defaults to 60. Up to 60 for one-shot execution or 3600 within a session. Connection setup, result delivery, and one-shot provisioning and cleanup have separate budgets; set the client timeout to at least 180 seconds. |

Active commands and authenticated proxy connections hold idle activity within
the absolute expiry. Suspend retains reserved capacity. `429` indicates no
capacity is available; an uncertain termination does not free capacity.

One-shot commands have a one-minute execution limit, with separate connection setup, result delivery,
provisioning, and cleanup budgets. A successful response follows confirmed termination. Use a session
for longer work or a service that must remain available.

One-shot execution manages its own lifetime and does not inherit the template
TTL or idle timeout. A one-shot command timeout returns `504`; retrying its key returns `409`
because no completed result was stored. A session command timeout instead
returns execution data with `timed_out: true`.

## Retry without repeating a command

Creation and command requests require a UUID `Idempotency-Key`. Keep the same
key and body when retrying. Keys are scoped to the project and operation.

An unknown preset returns `400` before reserving the execution key. Repeating
that invalid request returns `400` again and never runs a command.

A completed command returns its stored result. Changed intent returns `409`.
An in-progress command or lost result returns `409` with
`sandbox execution outcome is unknown; the command will not be repeated`.
Do not use a new key unless you intend to run the command again.

## Read and write files

Files are scoped to the session workspace. Content uses base64 and is limited
to 8 MiB per operation.

```bash
curl "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/files/write" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path":"hello.txt","data":"aGVsbG8K"}'

curl "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/files/read" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path":"hello.txt"}'
```

Writing returns `204`; reading returns `{"data":"aGVsbG8K"}`. Files survive
suspend/resume and are removed with the session.

## Grant a signed-in user access

Platform user tokens and project service keys manage Sandboxes. A project
auth-user JWT can only read, execute commands, access files, or connect to a
session explicitly granted to that user. It cannot create, suspend, resume,
terminate, or grant sessions. Anonymous keys and project access tokens are not
accepted by these APIs.

An invalid or expired auth-user JWT returns `401`; refresh the user's login and
retry with the same execution key. A valid user without a matching grant or
project scope receives `403`, which token refresh does not resolve.

```bash
curl -X PUT "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/grants/$AUTH_USER_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expires_at":"2026-09-23T13:00:00Z"}'
```

Use `DELETE` on the same endpoint to revoke the grant. Expiry is bounded by the
session lifetime. The user's login must remain active. Scoped service keys also
need the corresponding `sandboxes.*` permission; grant creation requires
`sandboxes.templates.write`, and revocation requires `sandboxes.terminate`.

A plan-limit hold still allows platform users and service keys to suspend or
terminate sessions and revoke grants. Creating or resuming sessions and adding
grants remain blocked.

## Connect to an HTTP service

Request a credential for one session and one application port:

```bash
curl "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/access" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"port":8080,"expires_in_seconds":300}'
```

The response contains `url`, `token`, and `expires_at`. Send the token as
`X-Volcano-Sandbox-Token` when requesting that URL. Credentials expire within
five minutes, and earlier if the parent login, grant, or session expires.
Ports 65533 and above are reserved.

For browser navigation, submit the token in a form POST to
`{url}_volcano/access`. The response sets a secure, HTTP-only, host-only cookie
and redirects to `/`. Keep credentials out of query strings. The guest never
receives the access header or reserved cookie. Volcano also removes
client-sent `X-Volcano-*`, `Forwarded`, and `X-Forwarded-*` headers, and
lookalikes that put `_` or `.` in place of `-`, such as `X_Forwarded_For`.
Application authorization headers, other headers such as `X_Api_Key`, and
cookies remain available to the application.

HTTP, WebSocket, SSE, and gRPC use the same authenticated URL. Revocation closes
active connections; clients must obtain fresh access and reconnect after expiry.

## Save a named Sandbox

`POST /projects/{id}/sandboxes` creates a named reference to a published preset:

```json
{"name":"analysis","preset":"python3.12","memory_mb":2048}
```

Include the authorization, content type, and idempotency headers shown above.
Use the returned ID as `sandbox_id` in later session or execution requests.
`PATCH /projects/{id}/sandboxes/{sandboxId}` changes its name. `DELETE` stops
new sessions and requests termination of its existing sessions. You can reuse
the name with a new idempotency key. Replaying the deleted Sandbox’s creation
request returns `409 Conflict`. Deleting a named Sandbox keeps the shared preset
available to other Sandboxes.

List named Sandboxes, sessions, and deployment history with:

- `GET /projects/{id}/sandboxes`
- `GET /projects/{id}/sandbox-sessions`
- `GET /projects/{id}/sandboxes/{sandboxId}/deployments`

Lists return `data` and `pagination`. Pass `pagination.next_cursor` as `cursor`
and keep `limit` unchanged; the default is 10, with a maximum of 100.

Sandbox usage is available as preview counters; it does not debit credits or
enable billing.

Renaming a sandbox to an existing name in the same project returns `409 Conflict`.

## Run locally

Start your local environment with `volcano start`, then use the same Sandbox
API at `http://localhost:8000`. Authenticate with the local service key from
`volcano status`. Anonymous credentials remain rejected; signed-in users still
need an explicit session grant.

Local app services still start if the Sandbox service cannot start. Sandbox
APIs return `503` until that service is ready. Initialization retries in the
background when the Sandbox service becomes available. If the service failed
to start, fix local Docker access and run `volcano start` again. A local reset
still requires successful Sandbox cleanup so running containers are not left
behind.

Local mode includes `python3.12` and `node22` presets with 1024 or 2048 MB of
memory. Use `us-east-1` as the region. Docker Engine API 1.41 or newer is required. Sessions run in separate Docker
containers with private workspaces. HTTP URLs use
`http://<session-id>--<port>.sandboxes.localhost:8000` and require Sandbox access
credentials in the `X-Volcano-Sandbox-Token` request header. Browser cookie
redemption requires HTTPS and is unavailable on local HTTP URLs.

Custom templates use the same deployment API and Dockerfile contract in local mode.
Volcano builds a local image, validates startup, commands, and suspend/resume,
then activates it. A service that exits or fails to become ready within 30 seconds
fails validation; the deployment logs include the reason. Build logs and original
source downloads remain available through the deployment endpoints. Builds and
sessions use your local machine;
custom images are removed after replacement or deletion once their sessions end.
A local reset also removes custom images. Local mode does not support Git source
handover or project source export. Even with `LOCAL_MODE_GIT_DEPLOY_WORKER=true`,
the local Git worker deploys Functions and frontends only; it does not discover
or deploy Sandbox directories. Deploy local custom Sandboxes through the API or CLI.

Local sessions last at most one hour. Suspending pauses the container and
retains its memory and files. Stopping or restarting the local server, restarting
the Sandbox service, or running `volcano reset` terminates existing sessions.
Local mode supports up to four sessions per owner and 8 GiB of total reserved
memory. Containers share the local Docker kernel; use hosted Sandboxes when
you need VM isolation.

## Inspect preview usage

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/usage" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The `metrics` array includes these preview counters. Agents can read the same
response with the `get_project_usage` [MCP tool](../interfaces/mcp.md):

| Metric | Meaning |
| --- | --- |
| `Sandbox Running (MiB-Seconds)` | Configured memory multiplied by observed running time |
| `Sandbox Suspended (Seconds)` | Observed time with the session suspended |
| `Sandbox Uncertain (MiB-Seconds)` | Configured memory multiplied by time awaiting verification |

**Preview usage does not debit credits and will not be charged retroactively.**
These counters are not a price estimate. Running includes time between commands
and idle HTTP requests. Several commands in one session do not multiply its
runtime. Paused sessions do not accumulate running usage. Local sessions do not
contribute cloud usage.

Totals cover the current UTC calendar month; `all_time` is cumulative. Hourly
and daily series use the same units. Measurements retain milliseconds and round
down after aggregation for display. State changes and observation gaps are
estimates: unconfirmed transitions and gaps longer than 30 seconds appear as
uncertain usage. Usage stops accumulating at the session's expiry, even if
cleanup or confirmation takes longer. Elastic CPU/memory consumption, snapshot
bytes, build costs, and outbound transfer are not included in these counters.

### Preview budget limits

If your account has a preview test budget, it is shared across your projects
and uses the monthly account anniversary recorded when cloud usage metering
first starts for your account. Subscription changes do not reset this preview
budget. It does not reserve or spend real credits.

New sessions and resumes reserve up to one minute of configured-memory runtime.
An exhausted budget returns `429` with `sandbox_shadow_budget_exhausted`.
Running sessions are asked to pause before their next reservation would exceed
the budget. Uncertain usage also consumes the test budget. A budget-paused
session is retained for at most one hour, or until its existing expiry if
sooner, then terminated. Increasing the test budget permits an explicit resume;
it does not automatically resume paused workloads. Termination stays available.

Budget enforcement is asynchronous. Provider delays and worker outages can
exceed the reservation; the existing maximum session lifetime remains the hard
backstop. Session concurrency, regional capacity, and lifetime limits continue
to apply when test budgets are disabled.

## Use the CLI and SDKs

The CLI exposes the same commands locally and in the cloud:

```bash
volcano sandboxes exec --preset python3.12 -- python -c 'print(42)'
volcano cloud sandboxes exec --preset python3.12 -- python -c 'print(42)'
```

See [CLI Sandboxes](/cli/sandboxes) for sessions, files, saved templates, and
request IDs. See [JavaScript Sandboxes](/sdk/js/sandboxes),
[Python Sandboxes](/sdk/python/sandboxes), and [Ruby Sandboxes](/sdk/ruby/sandboxes) for the
`client.sandboxes` facade, binary files, scoped HTTP credentials, and automatic
session cleanup in each language.

## Manage sessions in the Dashboard

Select a project and open **Sandboxes**. The **Sessions** view lists each
session's state, region, and expiry. Choose a preset, memory size, and region to
start a session. Suspend a running session to retain its processes and files;
resume it before running another command. Termination requires confirmation
and permanently removes the session's files.

The **Templates** view saves named preset and memory combinations. Deleting a
template terminates its sessions and permanently removes their files. Lists support pagination and refresh.
The Dashboard reports a platform refusal while Sandbox access is unavailable;
it does not bypass the rollout gate.

## Deploy a custom template

Service keys need `sandboxes.deployments.write` to upload a deployment and
`sandboxes.deployments.read` to read its status, history, source, and build logs.
Template-edit permission alone does not grant deployment access.

Place a `Dockerfile` fragment and its files in a directory. Volcano supplies the
base image and supervisor. Use `RUN`, `COPY`, `ENV`, `WORKDIR` within `/workspace`,
and `CMD`; omit `FROM`, `ENTRYPOINT`, and `USER`.
Use JSON-array `CMD` to pass arguments literally, without shell expansion.
Shell-form `CMD` explicitly runs a shell and supports expansion and pipelines.
Local builds resolve the startup executable using the template's `PATH` and
pin it in the image; startup runs with the declared arguments and working directory.

```dockerfile
RUN dnf install -y python3.12 && dnf clean all
COPY app.py /workspace/app.py
CMD ["python3.12", "/workspace/app.py"]
```

```bash
SANDBOX_ID=$(uuidgen)
REQUEST_ID=$(uuidgen)
tar -czf source.tar.gz Dockerfile app.py
curl -X POST "$VOLCANO_API_URL/projects/$PROJECT_ID/sandboxes/$SANDBOX_ID/deployments" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $REQUEST_ID" \
  -F name=my-service -F code=@source.tar.gz \
  -F memory_mb=1024 -F 'ports=[8080]'
```

The archive must be at most 32 MiB compressed and expanded, with at most 4,096
entries. Symlinks, traversal paths, and reserved managed files are rejected.
Declared ports must accept connections before the deployment activates. Ports
65533 and 65534 are reserved.

The response is `202` with the deployment's `id`, `status`, `created_at`, and
`updated_at`. Poll `GET /projects/{id}/sandboxes/{sandboxId}/deployments/{deploymentId}`
until `status` is `active`. A new template remains `unavailable` until its first
successful activation. Updates preserve the active template and existing sessions
while the replacement builds. Reuse the same template ID for updates, with a new
idempotency key. Reusing a key for different content returns `409`.
If an upload is interrupted or returns a temporary error, retry the same key
and content. An incomplete upload reserves the template for 30 minutes from the
first attempt; a different key returns `409` during that window. After it expires,
start a new upload with a new key. The expired upload cannot finish later and
replace the new deployment. Exporting the project to Git also releases an
incomplete platform upload. Once accepted, retries keep returning the same
deployment, even after a platform update.

Git deployments wait for an earlier build to finish, checking less frequently as
the wait grows, for up to two hours. An earlier deployment in `unknown` requires
operator recovery, so a new Git deployment fails immediately instead of waiting.

Create sessions with `sandbox_id` after activation. Sessions retain the exact
image they started with even when a later deployment activates.

Read build logs with
`GET /projects/{id}/sandboxes/{sandboxId}/deployments/{deploymentId}/logs?region=aws-us-east-1`.
The response contains `data` entries with `timestamp` and `message`. Supply the
returned `next_cursor` as `cursor` to continue; `limit` defaults to 100 and accepts
up to 1,000 entries. Read each deployment region separately.

Download the retained source with
`GET /projects/{id}/sandboxes/{sandboxId}/deployments/{deploymentId}/source`.
An active custom deployment returns the original tar.gz bytes, without injected
platform files. Project source export includes custom templates under
`volcano/sandboxes/<name>/` using the same immutable source version.
