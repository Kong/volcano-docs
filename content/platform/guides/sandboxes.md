---
title: Sandboxes
description: Run isolated commands and keep temporary sessions alive for files and HTTP services.
---

Cloud Sandbox runtime is included in HOBBY and SUPERAGENT plans, with additional
runtime billed on SUPERAGENT. See [Pricing and usage](#pricing-and-usage) for
allowances, charges, and exemptions. Check whether Sandboxes are available with
[`GET /capabilities`](../api-reference/overview.md#capabilities): the
`sandboxes`, `sandboxes.sessions`, `sandboxes.custom_templates`,
`sandboxes.network_isolation`, and `sandboxes.output_not_kept` entries report each part. Where Sandboxes are not available, every Sandbox endpoint
answers `404` with error code `feature_unavailable`:

```json
{ "error": "sandboxes are not available", "code": "feature_unavailable" }
```

Where they are turned off after use, only creating or starting a session,
template, execution, or deployment, and listing presets, answer that `404`, so
sessions and templates you already have can still be read and deleted.

A `503` means the Sandbox service is temporarily unavailable. For commands, follow
the retry rules below. In local mode it means the local Sandbox service is not running, see
[Run locally](#run-locally).

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
  "timed_out": false,
  "output_kept": true
}
```

`stdout` and `stderr` each hold the first 1 MiB (1,048,576 bytes) the command
wrote. `stdout_truncated` or `stderr_truncated` is `true` when it wrote more.

Discover published presets and regions with `GET /sandboxes/presets`.
Use the returned preset IDs when creating templates, sessions, or one-shot executions.
An empty catalog means no verified preset has been published yet.

If startup fails or times out before the command is sent, one-shot execution returns
code `sandbox_start_failed`. The HTTP status is `422` for a startup hook timeout on a custom deployment,
`429` for exhausted allowance or expired allowance retention, and `503` for other
or unknown startup reasons, including hook timeouts on managed presets. The command did not run. Reusing the same
`Idempotency-Key` replays that failure. The `error` message includes the recorded
reason when known, including on replay:

```json
{
  "error": "sandbox failed to start; command was not executed; reason: sandbox_run_hook_timeout",
  "code": "sandbox_start_failed"
}
```

Investigate the reason before using a new key for another attempt. Confirmed
running time is billed, including when a VM boots late before cleanup stops it. For repeated startup or run-hook timeouts, check the template's
startup configuration and logs; a timeout alone does not establish a template fault.
For `sandbox_allowance_exhausted`, restore the runtime allowance or credits first.
The message is diagnostic text and may change; use the response `code` for stable
programmatic error handling. If no reason was recorded, the message remains generic.
Startup timeout also requests termination; background cleanup continues after the request ends.
Wait or back off before using a fresh key: cleanup can still hold capacity after a
failure response. Every fresh-key refusal is also retained, so an immediate retry
can consume another key without starting a VM.
`sandbox_start_timeout` means the startup wait expired; `sandbox_session_expired`
means the requested session lifetime ended first. Increase the lifetime for the
latter. Caller cancellation or a caller deadline during admission or startup returns `504` if
the connection can still deliver a response. The outcome stays unknown; reuse the
original key.

One-shot admission can also refuse a command before it runs:

| Response code                  | HTTP status | Next step                                                   |
| ------------------------------ | ----------- | ----------------------------------------------------------- |
| `sandbox_capacity_unavailable` | 429         | Wait for capacity or reduce the requested resources.        |
| `sandbox_allowance_exhausted`  | 429         | Restore the runtime allowance or credits.                   |
| `sandbox_plan_limit_exceeded`  | 403         | Reduce the requested resources or free concurrent sessions. |

For these explicit response `code` values, the original key continues to replay
the refusal after the limit is resolved. Use a new key for a new attempt. A
403 or 429 without one of these codes or `sandbox_start_failed` does not establish
that the command was never sent.

A command on an existing session that is not ready, is stopping, or has expired
returns `409` with code `sandbox_session_not_running`. The command was not sent.
Wait for a running session and use a new key for a new attempt. The original key
continues to replay the refusal even after the session resumes.

For other errors or a lost response, reuse the original key. An unknown outcome
returns `409`; do not switch keys to repeat a command with side effects.

`GET /sandbox-sessions/{sessionId}` includes `last_error_code` for the last recorded
lifecycle reason. Observations without a new reason preserve it, including after
termination or recovery. This is historical information, not a current error;
use `state` to determine the session's current state. The field is omitted when
no reason is known.

| Code                                    | Meaning                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `sandbox_run_hook_timeout`              | The startup hook timed out.                           |
| `sandbox_start_rejected`                | The runtime rejected the start.                       |
| `sandbox_authority_or_expiry`           | Session authority ended or its lifetime expired.      |
| `sandbox_allowance_exhausted`           | The runtime allowance was exhausted.                  |
| `sandbox_allowance_retention_expired`   | Retention after allowance exhaustion expired.         |
| `project_deleting`                      | The project is being deleted.                         |
| `sandbox_cleanup_retry_requested`       | Cleanup was explicitly requested again.               |
| `sandbox_session_retries_exhausted`     | Lifecycle reconciliation exhausted its retries.       |
| `sandbox_operator_confirmed_no_live_vm` | Operator recovery confirmed no live runtime remained. |
| `sandbox_network_untrusted`             | A `deny_all` session was observed out of policy.      |
| `sandbox_image_outdated`                | The template's image predates what the session needs. |

Additional codes may be introduced; accept unknown values. A recorded reason alone
does not establish whether a command ran or authorize a retry. Use the execution
response's code and the retry rules above.

Use a region returned for the selected preset and memory size; region availability
can differ between presets. Sandbox availability is independent of where the API
request is served. For a custom template, use a region in its verified deployment.
New regions appear after their deployment is ready and the corresponding images
have passed verification.

### Temporarily unavailable regions

`us-west-2` is temporarily unavailable for Sandboxes. The catalog omits it, and
a new session or one-shot execution there answers `400`:

```json
{
  "error": "this region is temporarily unavailable for Sandboxes; choose another region from GET /sandboxes/presets",
  "code": "sandbox_region_unavailable"
}
```

Choose another region from the catalog. Sessions already in `us-west-2` stay
readable and can be terminated, and templates and deployments are unchanged. A
custom template deployed while the region is unavailable builds no image there;
redeploy it once the region returns to start sessions there.

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
  "sandbox_id": null,
  "region": "us-east-1",
  "memory_mb": 1024,
  "state": "starting",
  "desired_state": "running",
  "created_at": "2026-09-23T12:00:00Z",
  "expires_at": "2026-09-23T13:00:00Z",
  "network": { "egress": "default", "applied": "unknown" },
  "executions": { "keep_output": true }
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

A cloud session runs at most 64 commands at once and has no limit on how many it
runs in total. A command holds its slot until it exits and every background
process it started has exited too, so a service started with `&` keeps its slot
while it runs. With every slot in use, `exec` returns `429` with code
`sandbox_command_capacity` and starts nothing; retry with the same
`Idempotency-Key` once a command finishes. Sessions on a custom template built
before guest version `hosting-4` instead refuse every command after their 64th
with `409`; rebuild the template to lift that limit.

File requests on a terminated session return `404`. On a session that is still
starting or is suspended they return `503`; wait for `running`. An `exec` request
on a session that is not running returns `409 sandbox_session_not_running` and
retains its refusal; after recovery, use a new key for a new command attempt.

Suspending retains the session's state; terminating destroys it.

| Operation | Endpoint                                     |
| --------- | -------------------------------------------- |
| Suspend   | `POST /sandbox-sessions/{sessionId}/suspend` |
| Resume    | `POST /sandbox-sessions/{sessionId}/resume`  |
| Terminate | `DELETE /sandbox-sessions/{sessionId}`       |

These operations return `202`. Poll `state` for completion. `desired_state`
records the requested outcome. Once termination is requested, public reads report
`terminating` until the session is `terminated`, unless its state is `unknown`
and requires operator recovery. Closing new-session admission does not prevent
termination or grant revocation.

## Turn off outbound network

Set `network.egress` to `deny_all` to create a session with no outbound network
for its whole lifetime:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-sessions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"us-east-1","network":{"egress":"deny_all"}}'
```

In a `deny_all` session:

- DNS lookups fail.
- Connections to internet addresses over IPv4 and IPv6 fail, and so do
  link-local addresses such as `169.254.169.254` and `fe80::/10`.
- Nothing can connect back out through the path Volcano uses to reach the
  session.
- Loopback works: a process can serve files on `127.0.0.1` or `::1` to another
  process in the same session.
- Commands, files, suspend, and resume work as usual.
- [Port access](#connect-to-an-http-service) answers `400` with code
  `sandbox_network_isolated`.

Check that `GET /capabilities` lists `sandboxes.network_isolation` as
`available` before you depend on `deny_all`. Where it is unavailable, a request
for `deny_all` answers `400` with code `feature_unavailable`, and sessions you
already created with it keep their policy.

The policy is fixed when the session is created. Suspend and resume keep it, and
no request changes it; create another session for a different policy.
`POST /projects/{id}/sandbox-executions` takes the same `network` field. Omitting
`network` is the same as `{"egress":"default"}`, which keeps the region's
standard outbound internet access. A retry with the same `Idempotency-Key` must
send the same policy; a different one returns `409`.

Every session reads back its policy:

```json
{ "network": { "egress": "deny_all", "applied": "deny_all" } }
```

`egress` is the policy you requested. `applied` is what Volcano last observed on
the session itself, never the request alone:

| `applied`  | Meaning                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `default`  | The session has the region's outbound internet access.                                                                 |
| `deny_all` | The session has no outbound network.                                                                                   |
| `unknown`  | Not observed yet, not observed since a suspend or resume, or what Volcano observed doesn't match the requested policy. |

A session first reports `running` only after its network has been observed. If
you depend on `deny_all`, wait for `state` to be `running`, read
`network.applied`, and terminate the session unless it is `deny_all`. Act on
`applied` only while the session is `running`: a terminated session keeps what
Volcano last observed.

After that, `applied` reads `unknown` in two expected windows: from a suspend or
resume request until Volcano observes the session again, and briefly while
Volcano rolls out an update. Act on a later `unknown` only while the session's
`desired_state` is `running`: then stop sending it work and terminate it.

If Volcano observes a `deny_all` session with outbound network access, or in a
state that doesn't match its policy, it refuses the session's commands and
file calls and terminates it at once: `desired_state` reads `terminated`,
`last_error_code` reads `sandbox_network_untrusted`, and the session doesn't
start again. Its `applied` keeps what Volcano last observed, so it can read
`default`.

Local mode applies the same policy and readback. In a `deny_all` container, only
loopback is up, with no route out. `::1` works where the Docker host's kernel
has IPv6. A local `deny_all` session from a custom template needs a template
deployed on this version of Volcano or later: one deployed earlier ends with
`sandbox_image_outdated` (`409` for one-shot execution) until you redeploy it.

## Choose lifetime and memory

Supply exactly one of `preset` or `sandbox_id` when creating or executing.
A preset starts a session directly without creating a template; the returned
`sandbox_id` is `null`. Sessions created from an explicit template return its ID.
Presets support `1024` and `2048` MB; omitted memory selects `1024` MB. Named
Sandboxes retain their selected memory for both sessions and one-shot executions
when `memory_mb` is omitted. A conflicting override is rejected.

| Field                  | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max_duration_seconds` | VM lifetime, including startup. Inherits the template TTL when omitted. Cloud defaults to 3600 seconds; HOBBY accepts 30–3600 seconds and SUPERAGENT accepts 30–28800 seconds. Template defaults are clamped to the plan limit; an explicitly requested duration above the plan limit is rejected. Local defaults to 0 (unlimited), also accepts positive lifetimes, and has no cloud eight-hour limit. Explicit 0 overrides a finite local template TTL. |
| `timeout_seconds`      | Command execution time, starting when the process runs. Cloud defaults to 60 seconds and accepts 1–28800 seconds. Local defaults to 0 (unlimited) and also accepts positive limits without the cloud limit. A finite VM expiry always takes precedence.                                                                                                                                                                                                   |

Unlimited local sessions return `expires_at: null`. A finite expiry also applies
while suspended. One-shot execution always requests termination after the command
finishes, even when its configured lifetime is unlimited.

Startup and network time do not consume the command timeout, but they do consume
the VM lifetime and can incur usage. Cloud command responses are synchronous.
The public connection closes after 1000 seconds without a response, even with a
longer client timeout. For longer
work, create a session, start a background process, and poll its status or files
with short requests. Local mode has no cloud connection limit. A client disconnect
does not prove that a VM has stopped; one-shot cancellation
records termination intent for the worker. Activity never extends VM expiry.

Suspend retains reserved capacity. `429` indicates no
capacity is available; an uncertain termination does not free capacity.

A successful one-shot response follows confirmed VM termination. Use a session
when several commands should share a workspace or a service must remain available.
Both modes inherit the template TTL when `max_duration_seconds` is omitted.
A one-shot command timeout returns `504`; retrying its key returns `409`
because no completed result was stored. A session command reaching its command
timeout returns execution data with `timed_out: true`. If the VM lifetime expires
first, the command returns `504` instead.

## Retry without repeating a command

Creation and command requests require a UUID `Idempotency-Key`. Keep the same
key and body when retrying. Keys are scoped to the project and operation.

An unknown preset returns `400` before reserving the execution key. Repeating
that invalid request returns `400` again and never runs a command.

A completed command returns its stored result. Changed intent returns `409`.
An in-progress command or lost result returns `409` with
`sandbox execution outcome is unknown; the command will not be repeated`.
A guest capacity refusal (`429 sandbox_command_capacity`) leaves its key
unused, so retrying the same key can run it once capacity frees. This differs
from `sandbox_session_not_running`, which retains the refusal for that key.
Do not use a new key unless you intend to run the command again.

## Keep no command output

By default Volcano stores each command's result, so a retry with the same
`Idempotency-Key` returns its output. When output can hold secrets, set
`keep_output` to `false`. The command's `stdout` and `stderr` are returned once,
in the response to the request that ran it. Volcano's control plane never
stores them in the execution journal, database, logs or traces. Volcano still
records the exit code, timings and a keyed digest of the request, so a retry
with the same key returns the exit code with empty streams and never runs the
command again:

```bash
curl "$VOLCANO_API_URL/sandbox-sessions/$SESSION_ID/exec" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $REQUEST_ID" \
  -H "Content-Type: application/json" \
  -d '{"command":"./print-token.sh","keep_output":false}'
```

```json
{
  "stdout": "tok_example\n",
  "stderr": "",
  "exit_code": 0,
  "stdout_truncated": false,
  "stderr_truncated": false,
  "timed_out": false,
  "output_kept": false
}
```

The same request retried with `$REQUEST_ID` returns:

```json
{
  "stdout": "",
  "stderr": "",
  "exit_code": 0,
  "stdout_truncated": false,
  "stderr_truncated": false,
  "timed_out": false,
  "output_kept": false
}
```

The first response uses the same 1 MiB (1,048,576 bytes) cap per stream and
the same truncation flags as any other command. One-shot executions accept
`keep_output` too.

This does not cover the Sandbox itself: the Sandbox's memory and a suspended
session's snapshot can still hold what the command wrote.

To make every command in a session keep no output, create it with
`executions.keep_output` set to `false`:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/sandbox-sessions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"preset":"python3.12","region":"us-east-1","executions":{"keep_output":false}}'
```

The setting is fixed for the session's lifetime, and session reads return it
as `executions.keep_output`. Commands in the session inherit it. A command that
sets `keep_output` to `true` there is refused before it runs:

```json
{
  "error": "this session keeps no command output; omit keep_output or set it to false",
  "code": "sandbox_session_keeps_no_output"
}
```

Output a command redirects to a file stays in the session's workspace like any
other file. Delete it, or terminate the session, when you are done.

Check the `sandboxes.output_not_kept` entry in
[`GET /capabilities`](../api-reference/overview.md#capabilities) before you
rely on this. While it is `unavailable`, `keep_output: false`,
`executions.keep_output: false`, and commands in a session created with it
answer `400` with code `feature_unavailable`. A retry of a command that already
ran still returns its exit code. Commands that keep output work either way, and
the session can still be read and terminated.

## Read and write files

Files are scoped to the session workspace. Content uses base64 and is limited
to 8 MiB per operation. Use a relative path such as `file.bin` or its
`/workspace/file.bin` equivalent. Parent directories must already exist; create
them first with an exec command such as `mkdir -p nested` before writing
`nested/file.bin`. Paths must be canonical: traversal
components (`..`), repeated separators, and paths outside `/workspace` return
`400` in cloud and local mode.

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

### Upload a directory as a tar archive

Create a file archive to write a whole tree in one request. Send
`multipart/form-data` with `project_id`, `session_id` and `path`, in any order,
then the tar archive as the `archive` part. Volcano extracts it into the
directory `path` names, creating it when missing. `path` must name a directory
below the workspace root: a path that resolves to the root or to `/`, such as
`.`, `./`, `/`, `/workspace` or `/workspace/.`, answers `sandbox_archive_invalid`.
The archive may be gzip-compressed; Volcano detects compression itself.

```bash
tar -C ./repo -czf repo.tgz .
curl "$VOLCANO_API_URL/sandbox-file-archives" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -F "project_id=$PROJECT_ID" \
  -F "session_id=$SESSION_ID" \
  -F "path=repo" \
  -F "archive=@repo.tgz"
```

```json
{
  "project_id": "5b1e…",
  "session_id": "0f6c…",
  "path": "repo",
  "files": 42,
  "bytes": 183020
}
```

Each request accepts at most 32 MiB of archive, 10,000 files and directories,
and 256 MiB uncompressed, and has 2 minutes to send its archive; a slower
request fails and writes nothing. Split a larger tree into several archives and
send them one after another.

The archive may hold only regular files and directories. A symbolic link, hard
link, sparse file, device, absolute name, or `..` component refuses the whole
archive.
Permission bits are kept; setuid, setgid, and sticky bits are dropped. Volcano
checks and stages the whole archive before the workspace changes, so a refused
archive writes nothing, and it undoes one that fails part way. If a session
process moves or removes a directory while the archive is written, the
request answers `409`, a file the archive replaced there is kept in a
`.sandbox-archive-*` directory at the workspace root, and files the archive
already placed can stay. Volcano never follows a symbolic link already in the
workspace. Read-only directories the session user owns still take later
archives and file parts, and keep their modes.

| Code                        | Status | Meaning                                                                                                                 |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `sandbox_archive_invalid`   | 400    | The form or archive is malformed, or holds an entry that is not allowed                                                 |
| `sandbox_archive_too_large` | 413    | The archive exceeds a per-request limit                                                                                 |
| `sandbox_path_conflict`     | 409    | A symbolic link or file is where a directory belongs, the reverse, or the session user cannot write a directory         |
| `sandbox_disk_full`         | 409    | The session's disk has no room; free space and retry                                                                    |
| `sandbox_image_outdated`    | 409    | The session's image predates archive writes; start a new session from a current preset, or redeploy the custom template |

A session outside `project_id` answers `404`, like an unknown session.

### Write a file larger than 8 MiB

Create file parts to write a file of up to 1 GiB, at most 8 MiB per part. Each
part names its `offset`, the whole file's `size`, and its lowercase hex
`sha256`:

```bash
curl "$VOLCANO_API_URL/sandbox-file-parts" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"'"$PROJECT_ID"'","session_id":"'"$SESSION_ID"'","path":"cache/pkg.tgz","offset":0,"size":20971520,"sha256":"<sha256 of the whole file>","data":"<first 8 MiB, base64>"}'
```

```json
{
  "project_id": "5b1e…",
  "session_id": "0f6c…",
  "path": "cache/pkg.tgz",
  "offset": 0,
  "size": 20971520,
  "received": 8388608,
  "complete": false
}
```

Send the next part with `"offset":8388608`, and so on. Nothing appears at
`path` until the part that ends at `size` arrives; that part checks the whole
file's size and SHA-256, then moves it into place in one step, and answers
`"complete": true`. Missing parent directories are created. The finished file
is readable and writable only by the session user.

To recover from a failed request, resend that part: a part may start anywhere
up to the bytes already received. A part at offset 0 starts the file again.
Resending the part that finished the file answers the same completion while the
file at `path` still matches `size` and `sha256`.

| Code                             | Status | Meaning                                                                                                                        |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `sandbox_file_part_out_of_order` | 409    | The part starts past the bytes received; resend from the last successful part                                                  |
| `sandbox_file_part_mismatch`     | 409    | The finished file does not match `size` or `sha256`; start again at offset 0                                                   |
| `sandbox_path_conflict`          | 409    | A directory is at `path`, a file or symbolic link is where a directory belongs, or the session user cannot write the directory |
| `sandbox_disk_full`              | 409    | The session's disk has no room; free space and retry                                                                           |
| `sandbox_image_outdated`         | 409    | The session's image predates parted writes; start a new session from a current preset, or redeploy the custom template         |

Parts collect in a hidden file beside `path` that starts with `.sandbox-part-`.
It stays until the file completes, a part at offset 0 restarts it, or the
session ends.

## List files

List a workspace directory with each entry's type, size, and permission bits,
and optionally a SHA-256 digest of each file. Compare two listings to see what
a command changed.

```bash
curl -G "$VOLCANO_API_URL/sandbox-session-files" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  --data-urlencode "project_id=$PROJECT_ID" \
  --data-urlencode "session_id=$SESSION_ID" \
  --data-urlencode "path=/workspace" \
  --data-urlencode "include_sha256=true"
```

```json
{
  "project_id": "5f0c3a52-8d1e-4b7a-9a43-2f6d1c0e7b19",
  "session_id": "0b8f6a1e-3c2d-4e5f-8a9b-7c6d5e4f3a2b",
  "entries": [
    { "path": "cache", "type": "directory", "size": 0, "mode": 0, "unreadable": true },
    {
      "path": "hello.txt",
      "type": "file",
      "size": 6,
      "mode": 420,
      "sha256": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
    },
    { "path": "latest", "type": "symlink", "size": 0, "mode": 511 },
    { "path": "logs", "type": "directory", "size": 0, "mode": 493 },
    { "path": "logs/app.log", "type": "file", "size": 4096, "mode": 420, "sha256_skipped": "changing" },
    { "path": "src", "type": "directory", "size": 0, "mode": 448 },
    {
      "path": "src/main.py",
      "type": "file",
      "size": 21,
      "mode": 493,
      "sha256": "2d543015627a771436b30ea79fd0ecda8df8bcd77b3d55661caf5a0d6e809886"
    }
  ],
  "next_cursor": "Xww6Uo0eS3qaQy9tHA57GQuPah48LU5fipt8bV5POitzcmMvbWFpbi5weQ"
}
```

| Parameter        | Default        | Meaning                                                                 |
| ---------------- | -------------- | ----------------------------------------------------------------------- |
| `project_id`     | required       | The session's project                                                   |
| `session_id`     | required       | The session to list                                                     |
| `path`           | workspace root | Directory to list: `src`, `/workspace/src`, `.`, or `/workspace`        |
| `recursive`      | `true`         | List everything below `path`; `false` lists only its direct entries     |
| `include_sha256` | `false`        | Add each regular file's SHA-256 digest                                  |
| `limit`          | `10000`        | Most entries per page, from 1 to 10000                                  |
| `cursor`         | none           | The previous page's `next_cursor`; send the same `path` and `recursive` |

Each entry has:

- `path`: relative to the workspace root, ready for the read and write routes.
- `type`: `file`, `directory`, `symlink`, or `other` (a FIFO, socket, or
  device). The listing never follows a symlink, so a symlink's target is never
  listed or hashed.
- `size`: bytes for a regular file, `0` for every other type.
- `mode`: permission bits as a decimal number, including setuid, setgid, and
  sticky. `420` is `0644`, and `493` is `0755`.
- `sha256`: with `include_sha256`, the digest of a regular file's content.
- `sha256_skipped`: with `include_sha256`, why a regular file has no digest.
  Treat that file as unverified.
- `unreadable`: `true` on a directory the session user can't list. The
  listing doesn't enter it and goes on past it.
- `unsupported_names`: in a recursive listing, how many names directly inside
  a directory no entry can carry.

| `sha256_skipped` | Meaning                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `budget`         | The file is over 256 MiB                                                                                       |
| `changing`       | The file changed while it was hashed, or kept changing; list it again later                                    |
| `unreadable`     | The session user doesn't own the file, its owner-read bit (`0400`) is clear, or it has more than one hard link |

A directory is `unreadable` when the session user's permission bits on it lack
read or execute: the owner bits when the user owns it, the group bits when it
belongs to the user's group, and the other bits otherwise.

A name that isn't UTF-8, or whose path would pass 4096 bytes, can't be listed.
The listing skips it and everything below it, and counts it in
`unsupported_names`: on the directory's entry, or at the top of every page for
`path` itself. The field is absent when there are none. A listing with any
`unsupported_names` or `unreadable` directory is incomplete.

A file written in the last 100 milliseconds is hashed once it has gone that
long unchanged, so a listing right after a write can take a moment longer.

The listing detects a change from the file's timestamps. A file that changes
while it is hashed without its timestamps moving can get a digest of neither the
old nor the new content. Two cases cause this: a single write still in progress
100 milliseconds after it began, which a heavily loaded session can cause, and
a process writing through a shared memory mapping (`mmap`). When a digest must
match finished content, list after the processes writing the file have
finished.

Entries are sorted by path, comparing one path element at a time by bytes, so a
directory comes right before its contents. A page ends early when it reaches
the limit, about 8 MiB of entries, or 256 MiB of hashed file content. Keep
requesting with `cursor` until the response has no `next_cursor`. A cursor is
valid only for the project and session it came from. A listing is not a
snapshot: a file that changes while it runs can appear before or after the
change.

A project your credential cannot read answers `404` exactly like one that does
not exist, and a session outside `project_id` answers like an unknown session.
A credential for the project that lacks the `sandboxes.files.read` permission
answers `403`.

| Status | Code                         | Meaning                                                                 |
| ------ | ---------------------------- | ----------------------------------------------------------------------- |
| `400`  | `sandbox_path_not_directory` | `path` is missing, is not a directory, or passes through a symlink      |
| `400`  | `sandbox_path_unreadable`    | The session user can't list `path` or pass through a directory above it |
| `409`  | `sandbox_image_outdated`     | The session's image predates file listing                               |

Sessions started on an image built before file listing shipped cannot list
files. Start a new session; for a custom template, redeploy it first. This
holds in local mode too.

## Grant a signed-in user access

Platform user tokens, project service keys, and full-scope project access tokens
manage Sandboxes. Read-only project access tokens can inspect templates,
deployments, sessions, and session files. Project access tokens are restricted to
their project and cannot manage end-user grants or issue port credentials.
These restrictions also apply through the [MCP server](../interfaces/mcp.md). A project
auth-user JWT can only read, execute commands, access files, or connect to a
session explicitly granted to that user. It cannot create, suspend, resume,
terminate, or grant sessions. Anonymous keys are not accepted by these APIs.

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

Responses keep the application's own headers, such as
`Content-Security-Policy` and `X-Frame-Options`, so a page loads its styles and
images as it would when served directly. Browsers don't run scripts on these
pages or frame other origins in them: Volcano adds
`Content-Security-Policy: script-src 'none'; object-src 'none'; frame-src 'self'`
to every response. Browsers don't store responses either: Volcano replaces the
application's `Cache-Control` with `private, no-store`. Volcano also sets
`Strict-Transport-Security`, makes application cookies host-only and secure,
and removes `Clear-Site-Data` and any attempt to set the reserved cookie.

HTTP, WebSocket, SSE, and gRPC use the same authenticated URL. Revocation closes
active connections; clients must obtain fresh access and reconnect after expiry.

## Save a named Sandbox

`POST /projects/{id}/sandboxes` creates a named reference to a published preset:

```json
{ "name": "analysis", "preset": "python3.12", "memory_mb": 2048 }
```

Include the authorization, content type, and idempotency headers shown above.
Use the returned ID as `sandbox_id` in later session or execution requests.
A named Sandbox keeps the preset image it was created with. To move to a
later preset update, delete it and create it again with a new idempotency key.
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

Cloud Sandbox runtime uses the included allowance and pricing described below.

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

Local sessions and commands default to unlimited time. Set either time field to
a positive value to limit it; the cloud eight-hour limit does not apply. Suspending pauses the container and
retains its memory and files. Stopping or restarting the local server, restarting
the Sandbox service, or running `volcano reset` terminates existing sessions.
Local mode supports up to four sessions per owner and 8 GiB of total reserved
memory. Containers share the local Docker kernel; use hosted Sandboxes when
you need VM isolation.

## Pricing and usage

| Limit                                      | HOBBY       | SUPERAGENT                                   |
| ------------------------------------------ | ----------- | -------------------------------------------- |
| Included runtime per monthly account cycle | 5 GBh       | 20 GBh                                       |
| Additional runtime                         | Unavailable | 25 credits per 5 GBh block                   |
| Configured baseline memory                 | Up to 1 GiB | Up to 2 GiB                                  |
| Maximum session lifetime                   | 1 hour      | 8 hours                                      |
| Concurrent sessions                        | 5           | Unlimited, with a 100-session safety ceiling |

Runtime is configured baseline memory multiplied by confirmed running time.
One GBh is 1 GiB running for one hour. Metering retains millisecond precision;
rounding the displayed number does not round the charged usage. Idle running
time counts; multiple commands in one session do not multiply the runtime.
Automatic resource expansion is allowed and has no additional charge.

Snapshot creation, restoration and retained suspended storage are included.
Suspended time consumes neither runtime allowance nor credits. Local sessions
and platform image-validation sessions are not billed. Existing preview
sessions stay unbilled; sessions admitted after the pricing release are billed.
Preview history is never charged retroactively.

HOBBY exhaustion refuses starts and resumes with `429 sandbox_allowance_exhausted`.
The worker suspends running sessions on its next allowance check. Enforcement is
asynchronous, so observed usage can finish slightly above the allowance without
creating HOBBY overage charges. Allowance-paused sessions are retained for up to
one hour, bounded by their original expiry, then terminated. Resume explicitly
after a new allowance cycle or upgrade; workloads do not restart automatically.
Requests exceeding the plan's memory, lifetime or concurrency limit return
`403 sandbox_plan_limit_exceeded`. Termination remains available.

Platform image-validation sessions do not count toward the plan concurrency limit.
They still reserve physical capacity; suspended customer sessions count until
termination is confirmed.

SUPERAGENT overage uses the shared credits balance and existing arrears policy.
Unused purchased block capacity carries forward; included allowance does not.
Account-wide billing usage appears on the billing page. The project counters
below also expose unbilled preview and uncertain observations for diagnostics.

### Inspect project runtime

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/usage" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The `metrics` array includes these runtime counters. Agents can read the same
response with the `get_project_usage` [MCP tool](../interfaces/mcp.md):

| Metric                            | Meaning                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `Sandbox Running (MiB-Seconds)`   | Configured memory multiplied by observed running time      |
| `Sandbox Suspended (Seconds)`     | Observed time with the session suspended                   |
| `Sandbox Uncertain (MiB-Seconds)` | Configured memory multiplied by time awaiting verification |

These diagnostic counters are not an invoice. Running includes time between commands
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

## Deploy a custom template

Service keys need `sandboxes.deployments.write` to upload a deployment and
`sandboxes.deployments.read` to read its status, history, source, and build logs.
Template-edit permission alone does not grant deployment access. Where custom
templates are not enabled, a deployment request returns `404` with code
`feature_unavailable`.

Place a `Dockerfile` fragment and its files in a directory. Volcano supplies the
base image and supervisor. The base image is Amazon Linux 2023 on arm64 in the
cloud; local mode uses your machine's architecture. Compile binaries in a `RUN`
step so they match either one. A binary built elsewhere and copied in must target
`linux/arm64` for the cloud and your machine's architecture for local mode.
Use `RUN`, `COPY`, `ENV`, `WORKDIR` within `/workspace`,
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

In the cloud, Volcano starts your `CMD` service once while it builds the
template, then starts every session from a saved copy of that running service,
memory included. Anything the service creates at startup is the same in many
sessions: random tokens, keys, IDs, and random generators seeded at startup.
Create those values when a session first needs them, and read randomness from
the operating system at that point, for example with Python `secrets` or Go
`crypto/rand`. Local mode starts `CMD` separately in each session.

When a session starts, Volcano reseeds the operating system's random generator,
so reads from it differ between sessions. A custom template or named Sandbox
keeps the image it was saved with: redeploy the template, or delete and
recreate the named Sandbox, to pick this up. A process that was already running when the copy was saved keeps its
own in-memory generator, such as OpenSSL's or a language's seeded random
module, and can return the same values in many sessions. Start such processes
after the session starts, or reseed them then.

Don't build secrets into a template. Its files, `ENV` values, and startup
memory are shared by every session. Pass a secret after the session starts,
in the `environment` field of an exec request or as a file written with
[the files API](#read-and-write-files).

Read build logs with
`GET /projects/{id}/sandboxes/{sandboxId}/deployments/{deploymentId}/logs?region=aws-us-east-1`.
The response contains `data` entries with `timestamp` and `message`. Supply the
returned `next_cursor` as `cursor` to continue; `limit` defaults to 100 and accepts
up to 1,000 entries. Read each deployment region separately.

Download the retained source with
`GET /projects/{id}/sandboxes/{sandboxId}/deployments/{deploymentId}/source`.
A successfully activated custom deployment returns the original tar.gz bytes,
without injected platform files. Its source remains available after a newer
deployment activates and after its old runtime images are reclaimed, while the
template remains available to your project. Project source export includes only
each custom template’s active deployment under `volcano/sandboxes/<name>/`, using
the same immutable source version.
