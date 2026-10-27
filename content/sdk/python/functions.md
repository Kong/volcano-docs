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

`start()` accepts the same active session, service key, or anonymous key as `functions.invoke()`. Besides [sending and following messages](#send-and-follow-messages), it is the only durable operation available to application credentials. An execution name makes a start idempotent.

`get()`, `list()`, and `stop()` are owner-scoped. Call them from a trusted backend with the project owner's platform user token or a project access token; a `read_only` token can read and list but not stop. Auth-user sessions, anonymous keys, and service keys are not accepted. `stop()` returns after the stop request is accepted, so poll `get()` until `is_terminal` is true.

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

## Wait for a message and publish progress

`ctx.wait_for_message()` pauses the execution until something outside it sends a message with that name: a webhook receiver, a backend, a browser, or another function, through [`client.durable.messages`](#send-and-follow-messages). `ctx.publish()` records a message that applications list or receive live:

```python
from volcano_sdk.durable_authoring import durable


@durable
def handler(event, ctx):
    ctx.publish("progress", {"stage": "waiting-for-upload"})

    upload = ctx.wait_for_message("uploaded", timeout="1d")
    if upload is None:
        return {"status": "abandoned"}

    report = ctx.step("render", lambda scope: render(upload.data["url"]))
    ctx.publish("progress", {"stage": "done", "report_url": report["url"]})
    return {"status": "done", "report_url": report["url"]}
```

`wait_for_message(name, timeout=None)` returns a `ReceivedMessage` with `id`, `name`, `data`, `sender` (a `DurableMessageSender` with `type` and `user_id`), and `sent_at` as an RFC 3339 string, or `None` once the timeout passes. Messages sent before anything waits for their name are kept, and each wait takes the oldest one. A message never decides an approval, so use `wait_for_approval()` wherever only a person may answer.

`publish(name, data=None)` returns a `PublishedMessage` with `id` and `seq`. `data` is any JSON value up to 64 KiB. Publishing is checkpointed, so a replay never publishes twice. The first publish in each context, and in each `ctx.child()`, `ctx.parallel()` branch, or `ctx.map()` item that publishes, opens a messages session, which appears in the execution's history as `volcano:messages-session` and costs three durable operations once.

Names follow the approval rules: up to 237 printable ASCII characters, checked before anything is recorded, as is the timeout. Both need `VOLCANO_PLATFORM_API_URL`. A wait Volcano does not answer, cannot see yet, throttles, or fails on is retried for the same 30 seconds an approval gets, then raises `CallbackSubmitterError`. A wait Volcano refuses, for example with `too_many_message_waits` when 100 are already open, raises it at once. A refused publish fails its step without a retry, which fails the execution unless the handler catches it.

## Wait for another system with a callback token

`ctx.wait_for_callback()` hands a token to another system and pauses the execution until that system answers with it. Use it when the work happens somewhere you do not run code, such as a payment provider, a job queue, or a partner's API, and that system can call back once it is done:

```python
from volcano_sdk.durable_authoring import CallbackFailedError, durable


@durable
def handler(event, ctx):
    try:
        payment = ctx.wait_for_callback(
            "payment",
            lambda token: payments.start(
                order_id=event["order_id"], callback_token=token
            ),
            timeout="1h",
            heartbeat_timeout="10m",
        )
    except CallbackFailedError as error:
        return {"status": "declined", "reason": error.type, "message": error.message}

    if payment is None:
        return {"status": "abandoned"}
    return ctx.step(
        "fulfil", lambda scope: fulfil(event["order_id"], payment["charge_id"])
    )
```

The submitter receives a `vcb_` token. The system holding it answers with the token alone and needs no Volcano credential:

```bash
curl -X POST "https://api.volcano.dev/durable-callbacks/succeed" \
  -H 'Content-Type: application/json' \
  -d '{"token":"vcb_...","result":{"charge_id":"ch_1"}}'

curl -X POST "https://api.volcano.dev/durable-callbacks/fail" \
  -H 'Content-Type: application/json' \
  -d '{"token":"vcb_...","error":{"type":"CardDeclined","message":"Insufficient funds"}}'

curl -X POST "https://api.volcano.dev/durable-callbacks/heartbeat" \
  -H 'Content-Type: application/json' \
  -d '{"token":"vcb_..."}'
```

`wait_for_callback(name, submitter, timeout=None, heartbeat_timeout=None)` returns the JSON value the token was succeeded with, or `None` once `timeout` passes, or `heartbeat_timeout` passes without a heartbeat. A result is never `None`, so the two cannot be confused. A failure raises `CallbackFailedError` with the `type` and `message` it was failed with. A token takes one answer: a second gets `409 callback_completed`, and one after the wait timed out or the execution ended gets `410`. It works only for this wait, so treat it as a secret.

The submitter runs inside a checkpointed step that is not retried, so a replay does not run it again. An attempt interrupted before the step is recorded can run it twice, with the same token both times, so make the hand-off idempotent; if the token was answered or the wait timed out in between, it is not run again. When it raises, `wait_for_callback()` raises the runtime's `CallbackSubmitterError`. It must be synchronous: an `async def` submitter raises `TypeError` before the callback opens, and one that returns an awaitable fails the wait instead of handing off. Getting the token needs `VOLCANO_PLATFORM_API_URL` and is retried for the same 30 seconds an approval gets. See [Durable callbacks](/platform/functions/durable-callbacks) for every request, response, and limit.

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

## Send and follow messages

`client.durable.messages` sends messages to an execution, lists its messages in both directions, and subscribes to what it publishes. It uses the application route with the client's credential, as `durable.start()` does. Pass the execution's `client_token` from the start response when an anon key, or a signed-in user who did not start the execution, should reach it:

```python
import os

from volcano_sdk import ConflictError, VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    service_key=os.environ["VOLCANO_SERVICE_KEY"],
)
execution = client.durable.start("report-builder", {"report_id": "7f3a"})

try:
    message = client.durable.messages.send(
        "report-builder",
        execution.id,
        "uploaded",
        {"url": "https://files.example.com/7f3a.csv"},
        idempotency_key="upload-7f3a",
    )
except ConflictError as error:
    print(error.code)  # execution_not_running

page = client.durable.messages.list("report-builder", execution.id, direction="out")
for published in page.messages:
    print(published.seq, published.name, published.data)
```

| Method | Returns |
|---|---|
| `send(function_name, execution_id, name, data=None, idempotency_key=..., client_token=..., project_id=...)` | The stored `DurableMessage`: `queued`, `delivered`, or `delivering` while its handover to a wait is still being confirmed. |
| `list(function_name, execution_id, direction=..., name=..., after=..., limit=..., client_token=..., project_id=...)` | `DurableMessagePage` with `messages`, oldest first, and `has_more`. |
| `await subscribe(function_name, execution_id, handler, client_token=..., project_id=...)` | A `DurableMessageSubscription` with `await unsubscribe()`. |

A `DurableMessage` has `id`, `execution_id`, `direction` (`"in"` or `"out"`), `seq`, `name`, `data`, `sender`, `status`, `sent_at`, and `delivered_at`. `seq` orders both directions and can skip numbers; read the next page with `after` set to the last `seq`. A send repeating an `idempotency_key` the same sender has used on the execution returns the first message and sends nothing; another sender's keys never collide with it. The key is up to 255 characters. The key and `client_token` travel as headers, so each must be printable ASCII without leading or trailing whitespace, or the call raises `ValueError`.

`subscribe()` calls the handler, which may be a coroutine function, with each message the execution publishes, in `seq` order, once each, and one call at a time. The messages published before the call are delivered before it returns. A handler that raises during that first read ends the subscription before anything more is delivered, and `subscribe()` raises its error, even when leaving the channel then fails, which is reported to the event loop's exception handler; later, what a handler raises is reported to the event loop's exception handler and delivery goes on. After a reconnect, a live message that shows an earlier one was lost, or a burst the handler falls too far behind on, the missing ones are read back before live delivery resumes; a read that fails is reported to the event loop's exception handler and retried, backing off to every 30 seconds, while the live messages after the gap wait. `client.realtime.remove_all_channels()` and `client.realtime.disconnect()` end the subscription, and a read still in flight delivers nothing; call `unsubscribe()` before subscribing to that execution again. Ended during its first read, the subscription makes `subscribe()` raise `RuntimeError`. The subscription belongs to the session that opened it: once the client signs out, signs in again, or sets another session, it delivers and reads nothing more, and the next read or delivery leaves the execution's channel and raises `RuntimeError`, reported to the event loop's exception handler, or from `subscribe()` while its first read is running. A token refresh keeps it. When the server ends the subscription, or refuses to restore it after a reconnect, as when the execution is no longer visible to the session, the subscription delivers nothing more and leaves the execution's channel, then reports `RuntimeError` with the server's reason to the event loop's exception handler once; the execution can be subscribed to again. If leaving the channel fails, that error is reported too, and the next `subscribe()` to the execution leaves it first. An end or refusal before `subscribe()` returns makes it raise that `RuntimeError` instead, and nothing is reported. It follows the execution on the client's realtime connection, which needs a signed-in session: a client holding only an anonymous or service key gets `RuntimeError`, even with the `client_token`, and can poll `list()` with `after` instead. One client subscribes to an execution once at a time:

```python
async def follow(client, execution):
    subscription = await client.durable.messages.subscribe(
        "report-builder",
        execution.id,
        lambda message: print(message.name, message.data),
        client_token=execution.client_token,
    )
    ...
    await subscription.unsubscribe()
```

Pass `project_id` to use the owner's project route with the session's platform token or a project access token instead; a `read_only` project access token can list but not send. A send to an execution that has ended raises `ConflictError` with `code` set to `execution_not_running`, and one to an execution already holding 100 messages nothing has taken raises it with `too_many_queued_messages`. An execution the caller may not reach raises `NotFoundError`, as an unknown one does.

## Run durable functions locally

Deploy and start the same handler through the local durable engine:

```bash
volcano start
volcano durable deploy --all
volcano durable start charge-order --input '{"order_id":"order-9"}'
```

Local waits resolve immediately by default while preserving checkpoint and replay behavior. Set `LOCAL_DURABLE_REAL_TIME=true` before `volcano start` when wait timing must match the deployed function. Local executions persist across `volcano stop` and `volcano start`.

Approvals work the same locally. Decide one with `volcano durable approvals approve` or `volcano durable approvals deny`, or point the owner client at the local server. Approval timeouts run in real time.

Messages work the same locally too. Send one with `volcano durable messages send`, or point the client at the local server. Message wait timeouts run in real time.

Callback tokens work locally as well: send the same requests to the local server. A callback's timeout and heartbeat timeout run in real time.

Running a decorated handler directly in a Python process still needs the optional test runtime: `python -m pip install 'volcano-sdk-python[durable]'`.
