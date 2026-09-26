---
title: Sandboxes
description: Run isolated commands and keep temporary sessions alive for files and HTTP services.
---

Run a command in a temporary Sandbox:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-executions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"aws-us-east-1","command":"python -c '\''print(42)'\''","timeout_seconds":30}'
```

```json
{
  "session_id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "region": "aws-us-east-1",
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
An empty catalog means no verified preset has been published yet.

## Keep a session alive

Create a session, then poll its returned ID until `state` is `running`:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-sessions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"aws-us-east-1","memory_mb":1024,"max_duration_seconds":3600}'
```

```json
{
  "id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "project_id": "8b1ec799-b9dd-4db0-8466-486d57d166f1",
  "sandbox_id": "7cdbb4e3-0419-574e-8017-705734ae8d76",
  "region": "aws-us-east-1",
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
records the requested outcome. Closing new-session admission does not prevent
termination or grant revocation.

## Choose lifetime and memory

Supply exactly one of `preset` or `sandbox_id` when creating or executing.
Presets support `1024` and `2048` MB; omitted memory selects `1024` MB. Named
Sandboxes retain their selected memory for both sessions and one-shot executions
when `memory_mb` is omitted. A conflicting override is rejected.

| Field | Behavior |
| --- | --- |
| `max_duration_seconds` | Defaults to 3600; 30–28800 seconds, further bounded by environment capacity policy. Absolute expiry also applies while suspended. |
| `idle_timeout_seconds` | Defaults to 0, disabling idle termination. Cannot exceed maximum duration. |
| Command `timeout_seconds` | Defaults to 60. Up to 60 for one-shot execution or 3600 within a session. One-shot provisioning and cleanup have separate budgets; set the client timeout to at least 180 seconds. |

Active commands and authenticated proxy connections hold idle activity within
the absolute expiry. Suspend retains reserved capacity. `429` indicates no
capacity is available; an uncertain termination does not free capacity.

One-shot commands have a one-minute execution limit, with separate provisioning
and cleanup budgets. A successful response follows confirmed termination. Use a session
for longer work or a service that must remain available.

## Retry without repeating a command

Creation and command requests require a UUID `Idempotency-Key`. Keep the same
key and body when retrying. Keys are scoped to the project and operation.

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
receives the access header or reserved cookie. Application authorization headers
and cookies remain available to the application.

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
request returns `409 Conflict`.

List named Sandboxes, sessions, and deployment history with:

- `GET /projects/{id}/sandboxes`
- `GET /projects/{id}/sandbox-sessions`
- `GET /projects/{id}/sandboxes/{sandboxId}/deployments`

Lists return `data` and `pagination`. Pass `pagination.next_cursor` as `cursor`
and keep `limit` unchanged; the default is 10, with a maximum of 100.

Custom images, manifest configuration, and client
workflows are not included in this API release. This release does not enable
Sandbox metering or billing.

Renaming a sandbox to an existing name in the same project returns `409 Conflict`.

## Run locally

Start your local environment with `volcano start`, then use the same Sandbox
API at `http://localhost:8000`. Authenticate with the local service key from
`volcano status`. Anonymous credentials remain rejected; signed-in users still
need an explicit session grant.

Local mode includes `python3.12` and `node22` presets with 1024 or 2048 MB of
memory. Use `aws-us-east-1` as the region. Docker Engine API 1.41 or newer is required. Sessions run in separate Docker
containers with private workspaces. HTTP URLs use
`http://<session-id>--<port>.sandboxes.localhost:8000` and require Sandbox access
credentials in the `X-Volcano-Sandbox-Token` request header. Browser cookie
redemption requires HTTPS and is unavailable on local HTTP URLs.

Local sessions last at most one hour. Suspending pauses the container and
retains its memory and files. Stopping or restarting the local server, restarting
the Sandbox service, or running `volcano reset` terminates existing sessions.
Local mode supports up to four sessions per owner and 8 GiB of total reserved
memory. Containers share the local Docker kernel; use hosted Sandboxes when
you need VM isolation.
