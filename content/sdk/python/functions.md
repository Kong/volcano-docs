---
title: Functions
description: Invoke deployed Volcano functions from Python and inspect their response status, headers, and data.
order: 5
---

Invoke a deployed function by its name.
This example assumes a public function named `hello` that accepts a JSON object.
Grant the anonymous key the explicit `functions.invoke` permission; the default
authentication-only permissions do not allow invocation. See [anonymous keys](/platform/authentication/security/anon-keys).

```python
import os

from volcano_sdk import VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
)
result = client.functions.invoke("hello", {"name": "Ada"})
print(result.status)
print(result.data)
print(result.version)
```

The SDK resolves the function's invocation endpoint and caches it for the lifetime provided by Volcano. Repeated resolution of a missing name raises a new `NotFoundError` with the original message, status, and error code while the cached miss remains valid.
Allow outbound requests to the resolved function domain as well as the API host.
Deployments without a separate function domain use the API invocation endpoint.

## Choose the invocation identity

The SDK uses the current session's access token, including a supplied `access_token`, before a configured service key or anonymous key.
A rejected or unsupported session token does not fall back to a key. Use an end-user access token when the function requires a user identity.
Use the [quickstart](./README.md) to sign in before invoking a function that requires a user.
An invocation authorized only by the anonymous key has no user identity.

Supply `service_key` to the client constructor for trusted server operations that require it.
Use a separate client for each independent user session.

## Recover a rejected session

Function resolution and invocation recover from a platform HTTP 401 before dispatch:
the SDK refreshes the captured session and retries the rejected request once.
Concurrent calls share successful recovery. Replacing or signing out that session
prevents replay under another identity. The call preserves its original payload values.
A function's own response, HTTP 403, or a network failure never triggers this retry.
Anonymous and service keys do not refresh.

## Read the result

`FunctionResponse` is immutable and exposes `status`, `headers`, `version`, and `data`.
The payload sent to `invoke()` must be a JSON object; omitting it sends an empty object.
Response data can be a JSON object, array, scalar, text, or `None` for an empty body.
JSON arrays become immutable tuples, and invalid JSON is returned as text.

A function's own non-success response is returned as a result when Volcano confirms the function ran.
Check `result.status` to handle those application errors.
Non-success platform HTTP responses before dispatch raise typed SDK exceptions such as `NotFoundError` or `AuthenticationError`.

If a cached function identity no longer exists, the SDK resolves the name again and retries once only when the platform confirms no function was dispatched.
A function's own HTTP 404 does not trigger another invocation.
Network failures do not establish whether a function ran; do not blindly retry operations with side effects.

Invalid invocation arguments and malformed successful resolution responses can raise `ValueError` or `TypeError`.

## Start and follow a durable execution

A durable execution can run for up to 366 days. Starting one returns a handle instead of waiting for its result:

```python
handle = client.durable.start(
    "charge-order",
    {"order_id": "order-9"},
    execution_name="order-9",
)

owner_client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
    access_token=os.environ["VOLCANO_PLATFORM_TOKEN"],
)
execution = owner_client.durable.get(project_id, "charge-order", handle.id)
page = owner_client.durable.list(project_id, "charge-order", status="running")
owner_client.durable.stop(project_id, "charge-order", handle.id)
```

`start()` accepts the same active session, service key, or anonymous key as `functions.invoke()`. It is the only durable operation available to application credentials. An execution name makes a start idempotent.

`get()`, `list()`, and `stop()` are owner-scoped. Call them from a trusted backend with the project owner's platform user token. Auth-user sessions, anonymous keys, service keys, and project access tokens are not accepted. `stop()` returns after the stop request is accepted, so poll `get()` until `is_terminal` is true.

## Write a durable function

Use `volcano_sdk.durable_authoring` in a durable function running on `python3.13` or `python3.14`:

```python
from volcano_sdk.durable_authoring import durable


@durable
def handler(event, ctx):
    charge = ctx.step("charge", lambda scope: charge_card(event["order_id"]))
    ctx.wait("settle", "30s")
    return {"charge_id": charge["id"]}
```

Place the handler and its dependency file under the function name:

```text
volcano/functions/charge-order/
├── main.py
└── requirements.txt
```

```text
# volcano/functions/charge-order/requirements.txt
volcano-sdk-python
```

Declare the same name as durable in `volcano-config.yaml`; the decorator does not register the function with the CLI:

```yaml
version: 1
project:
  name: my-app
functions:
  - name: charge-order
    kind: durable
```

Volcano records each context operation. Resumed executions replay recorded results instead of repeating completed work. Keep changing decisions inside `ctx.step()`. Use `ctx.wait_until()` to poll application state.

## Wait for an approval

`ctx.wait_for_approval()` pauses the execution until a person approves or denies it from the dashboard, the CLI, or the [owner client](#decide-approvals-from-a-backend):

```python
from volcano_sdk.durable_authoring import durable


@durable
def handler(event, ctx):
    order = ctx.step("load-order", lambda scope: load_order(event["order_id"]))

    decision = ctx.wait_for_approval(
        "ship-order",
        title=f"Ship order {order['id']}?",
        description="Orders over $500 need a second look.",
        details={"order_id": order["id"], "total": order["total"]},
        timeout="24h",
    )

    if not decision.approved:
        ctx.step("release-stock", lambda scope: release_stock(order["id"]))
        return {"shipped": False, "status": decision.status}

    ctx.step("ship", lambda scope: ship_order(order["id"]))
    return {"shipped": True, "comment": decision.comment}
```

| Argument | Description |
|---|---|
| `name` | Required. Operation name in the execution's history, up to 237 printable ASCII characters. Keep it short. |
| `title` | Required. What the approver is asked, up to 200 characters. |
| `description` | Optional context, up to 4000 characters. |
| `details` | Optional JSON value shown with the approval. The whole approval, `details` included, must encode to at most 64 KiB of JSON. |
| `timeout` | Optional duration in the `ctx.wait()` format, from one second to 366 days. Without it, the approval stays open as long as the execution runs. |

Limits count Unicode characters. A blank `name` or `title` raises `ValueError`, as does a value over its limit, a `name` outside printable ASCII, a NUL character anywhere in the text or `details`, or an approval over 64 KiB. A value that is not a string, or that cannot be encoded as JSON, raises `TypeError`. A timeout out of range raises `TypeError`, as it does for `ctx.wait()`. These checks run before anything is recorded.

The call returns an immutable `ApprovalDecision`:

| Field | Approved | Denied | Timed out |
|---|---|---|---|
| `approved` | `True` | `False` | `False` |
| `status` | `"approved"` | `"denied"` | `"expired"` |
| `comment` | The approver's comment, or `""` | The approver's comment, or `""` | `""` |
| `decided_by` | `DurableApprovalDecider` with `id` and `email`, or `None` if the account was deleted before the decision reached the execution | Same as approved | `None` |
| `decided_at` | RFC 3339 timestamp | RFC 3339 timestamp | `None` |

A denial or a timeout is a value to branch on, not an exception. The execution costs nothing while it waits, and a resumed execution replays the recorded decision without asking again.

Volcano sets `VOLCANO_PLATFORM_API_URL` on deployed and local durable functions. The function sends the approval there without a credential. Volcano accepts it only from the execution that is waiting. When Volcano does not answer, has not seen the execution or its approval yet, throttles the request, or fails, the function retries for up to 30 seconds. An approval whose timeout passes before Volcano records it returns the `expired` decision. If Volcano refuses the approval, or keeps failing for 30 seconds, `wait_for_approval()` raises the durable runtime's `CallbackSubmitterError`, carrying the SDK error's message. Unless the handler catches it, the execution fails. Calling `wait_for_approval()` without `VOLCANO_PLATFORM_API_URL` raises `RuntimeError`.

## Decide approvals from a backend

`client.durable.approvals` lists, reads, and decides a project's approvals:

```python
import os
from datetime import UTC, datetime, timedelta

from volcano_sdk import ConflictError, VolcanoClient

owner_client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
    access_token=os.environ["VOLCANO_PLATFORM_TOKEN"],
)
approvals = owner_client.durable.approvals

page = approvals.list(project_id, status="pending", function="charge-order")
for approval in page.approvals:
    print(approval.id, approval.title, approval.details, approval.expires_at)

try:
    approval = approvals.approve(project_id, approval_id, comment="Address checked")
except ConflictError as error:
    print(error.code)  # approval_decided, approval_expired, or approval_cancelled

stats = approvals.stats(project_id, from_=datetime.now(UTC) - timedelta(days=7))
print(stats.counts.pending, stats.approval_rate, stats.median_seconds_to_decision)
```

| Method | Returns |
|---|---|
| `list(project_id, status=..., function=..., execution_id=..., from_=..., to=..., page=..., limit=...)` | `DurableApprovalPage` with `approvals`, `page`, `limit`, `total`, and `has_more`. |
| `get(project_id, approval_id)` | `DurableApproval`. |
| `stats(project_id, function=..., from_=..., to=...)` | `DurableApprovalStats` with counts by status, decision times, and per-function and daily counts. |
| `approve(project_id, approval_id, comment=None)` | The decided `DurableApproval`. |
| `deny(project_id, approval_id, comment=None)` | The decided `DurableApproval`. |

`status` is one of `pending`, `approved`, `denied`, `expired`, or `cancelled`. An approval is `cancelled` when its execution ends first. `function` takes a durable function's id or name. `from_` and `to` must be timezone-aware datetimes. Stats default to the last 30 days and cover at most 366 days. A comment is up to 2000 characters.

Read approvals with the project owner's platform user token or a project access token. Only a person decides: `approve()` and `deny()` need a platform user token, and a project access token raises `PermissionDeniedError`. Repeating the same decision returns the approval unchanged. A conflicting decision, or deciding an expired or cancelled approval, raises `ConflictError`. An unknown approval raises `NotFoundError`. `PermissionDeniedError` subclasses `AuthenticationError`, so existing handlers still catch it.

## Run durable functions locally

Deploy and start the same handler through the local durable engine:

```bash
volcano start
volcano durable deploy --all
volcano durable start charge-order --input '{"order_id":"order-9"}'
```

Local waits resolve immediately by default while preserving checkpoint and replay behavior. Set `LOCAL_DURABLE_REAL_TIME=true` before `volcano start` when wait timing must match the deployed function. Local executions persist across `volcano stop` and `volcano start`.

Approvals work the same locally. Decide one with `volcano durable approvals approve` or `volcano durable approvals deny`, or point the owner client at the local server. Approval timeouts run in real time.

Running a decorated handler directly in a Python process still needs the optional test runtime: `python -m pip install 'volcano-sdk-python[durable]'`.
