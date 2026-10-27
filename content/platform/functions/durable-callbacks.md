---
title: 'Durable callbacks'
description: 'Hand a callback token from a durable function to another system, and let that system succeed, fail, or heartbeat the waiting step.'
---

A durable function can hand work to a system you do not run code in, such as a payment provider, a job queue, or a partner's API, and wait for it to answer. `ctx.waitForCallback` gives the function a token, the function passes it on, and the execution suspends until the token's holder succeeds or fails the wait. The holder needs no Volcano credential: the token is the credential.

Callbacks need `@volcano.dev/sdk` 2.2 or `volcano-sdk-python` 0.16. Earlier releases have no `ctx.waitForCallback`.

> **Coming soon.** `@volcano.dev/sdk` 2.2 and `volcano-sdk-python` 0.16 are not
> released yet, and Volcano does not serve the `/durable-callbacks` requests
> below yet.

```javascript
const { CallbackFailedError, durable } = require('@volcano.dev/sdk/durable');

exports.handler = durable(async (input, ctx) => {
  let payment;
  try {
    payment = await ctx.waitForCallback(
      'payment',
      (token) => payments.start({ orderId: input.order_id, callbackToken: token }),
      { timeout: '1h', heartbeatTimeout: '10m' },
    );
  } catch (error) {
    if (error instanceof CallbackFailedError) {
      return { status: 'declined', reason: error.type };
    }
    throw error;
  }

  if (payment === null) {
    return { status: 'abandoned' };
  }
  return ctx.step('fulfil', () => fulfil(input.order_id, payment.charge_id));
});
```

When the payment settles, the provider answers with the token:

```bash
curl -X POST "https://api.volcano.dev/durable-callbacks/succeed" \
  -H "Content-Type: application/json" \
  -d '{"token": "vcb_0000000000000000000000000000000000000000000", "result": {"charge_id": "ch_1"}}'
```

```json
{ "status": "succeeded" }
```

The execution resumes from the line after `waitForCallback`, holding the result. It runs no code and costs no compute while it waits.

The same handler in Python:

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
        return {"status": "declined", "reason": error.type}

    if payment is None:
        return {"status": "abandoned"}
    return ctx.step(
        "fulfil", lambda scope: fulfil(event["order_id"], payment["charge_id"])
    )
```

Ruby has no durable authoring API. Anything that can send an HTTP request can answer a callback.

## Callbacks, messages, or approvals

All three suspend an execution until something outside it answers. They differ in who answers and how it finds the execution.

| Use                                           | When                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ctx.waitForApproval`](durable-approvals.md) | A person has to decide. Only a signed-in person can approve or deny.                                                                                                    |
| [`ctx.waitForMessage`](durable-messages.md)   | Your own code answers: a webhook receiver, a backend, a browser, or another function. It sends with a credential it already holds, to an execution it knows by id.      |
| `ctx.waitForCallback`                         | A system that holds no Volcano credential answers, and you can give it a value to return when it is done. It can also fail the wait or report that it is still working. |

A message is addressed to an execution and a name, so any number can be queued, and whoever the function's visibility admits can send one. A callback token is issued for one wait, takes one answer, and stops working when the wait ends. Use a callback when the answer should come from exactly the system you handed the token to.

## Wait for a callback

```javascript
const result = await ctx.waitForCallback('render', (token) => queue.send({ job, token }), {
  timeout: '6h',
  heartbeatTimeout: '15m',
});
```

| Argument                                           | Description                                                                                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                             | Required. The wait's name in the execution's history. Up to 237 printable ASCII characters.                                                                                            |
| `submitter`                                        | Required. A function that receives the token and passes it to the system doing the work.                                                                                               |
| `timeout`                                          | How long to wait for an answer, in the format `ctx.wait` takes (`'30m'`, `'3d'`, a number of seconds), from 1 second to 366 days. Without it, the wait lasts as long as the execution. |
| `heartbeatTimeout` (`heartbeat_timeout` in Python) | How long the wait may go without a [heartbeat](#heartbeat-a-long-job), with the same format and range. Each heartbeat restarts it. Without it, no heartbeats are needed.               |

It resolves with the `result` the token was succeeded with, or with `null` (`None` in Python) once `timeout` or `heartbeatTimeout` passes first. A result is never `null`, so the two cannot be confused. A timeout is an outcome to branch on, not an error, as it is for `waitForMessage`.

A failure raises `CallbackFailedError`, exported from `@volcano.dev/sdk/durable` and `volcano_sdk.durable_authoring`, with the `type` and `message` the holder sent. Catch it to branch on `type`; left uncaught, it fails the execution.

The wait is checkpointed like any other operation. A resumed execution replays the result or failure it received instead of waiting again. Waits inside `ctx.parallel`, `ctx.map`, or `ctx.child` work the same way, so one execution can hand out many tokens at once.

### Hand off the token

The submitter runs inside a checkpointed step that is not retried, after the wait has opened, so its timeouts are already running. A replay does not run it again. An attempt interrupted before the step is recorded can run it a second time, and it receives the same token both times, so make the hand-off idempotent: pass the token as the job's idempotency key, or as part of it. If the token was answered, or the wait timed out or ended, in between, the submitter is not run again.

In JavaScript the submitter may return a promise, and the wait begins once it settles. In Python the submitter must be synchronous: an `async def` submitter raises `TypeError` before the wait opens, and one that returns an awaitable raises `CallbackSubmitterError`. Whatever the submitter returns is ignored.

When the submitter throws, `waitForCallback` raises the durable runtime's `CallbackSubmitterError`, which fails the execution unless you catch it.

A token is `vcb_` followed by 43 URL-safe characters. Volcano looks it up by a hash and keeps an encrypted copy only so a retried registration gets the same token back. It works only for the wait it was issued for. Treat it as a secret: whoever holds it can answer the wait. Do not log it, and do not put it in a URL that other systems record.

## Answer a callback

Each route takes the token in the body and no other authentication.

### Succeed it

```bash
curl -X POST "https://api.volcano.dev/durable-callbacks/succeed" \
  -H "Content-Type: application/json" \
  -d '{"token": "vcb_0000000000000000000000000000000000000000000", "result": {"url": "https://files.example.com/7f3a.pdf"}}'
```

| Field    | Description                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`  | Required. The token the function handed out.                                                                                                            |
| `result` | Required. Any JSON value other than `null`, up to 64 KiB. The wait resolves with it. `null` is refused because a timeout resolves the wait with `null`. |

### Fail it

```bash
curl -X POST "https://api.volcano.dev/durable-callbacks/fail" \
  -H "Content-Type: application/json" \
  -d '{"token": "vcb_0000000000000000000000000000000000000000000", "error": {"type": "CardDeclined", "message": "Insufficient funds"}}'
```

| Field           | Description                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`         | Required. The token the function handed out.                                                                                                               |
| `error.type`    | Required. A name the function can branch on, such as `CardDeclined`. Up to 256 characters, without control characters.                                     |
| `error.message` | A human-readable explanation, up to 32 KiB of UTF-8 (32,768 bytes, not characters), with tab and newline as its only control characters. Empty by default. |

### What the answer returns

Both routes answer once the execution has the outcome:

| Status | Body                                                | Meaning                                                                                                                                                              |
| ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | `{"status": "succeeded"}` or `{"status": "failed"}` | The execution has the outcome.                                                                                                                                       |
| `202`  | `{"status": "delivering"}`                          | Volcano recorded the outcome but is still handing it over, which took longer than the request waits. Volcano finishes the delivery on its own; do not send it again. |

A token takes one answer. Once it has succeeded or failed, every later request is refused with `409` and `callback_completed`, including a retry of the request that answered it. A holder that retries after a lost response can treat `callback_completed` as done:

```json
{ "error": "callback already has an outcome", "code": "callback_completed" }
```

After the wait times out, or its execution finishes or is stopped, the token answers `410`, with `callback_expired` or `execution_ended`. Nothing will take the outcome, so do not retry.

### Heartbeat a long job

A job that runs for hours can report that it is still going. Give the wait a `heartbeatTimeout`, and have the holder heartbeat more often than that:

```bash
curl -X POST "https://api.volcano.dev/durable-callbacks/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{"token": "vcb_0000000000000000000000000000000000000000000"}'
```

```json
{ "status": "waiting" }
```

Each heartbeat restarts the heartbeat timeout. When the job dies and the heartbeats stop, the wait resolves with `null` once the heartbeat timeout passes, rather than at its full `timeout`. A heartbeat never extends `timeout`. A wait without a heartbeat timeout accepts heartbeats and ignores them.

A heartbeat after the wait ended answers like a late answer: `409 callback_completed` once it was answered, and `410` once it timed out or its execution ended. A holder can stop working on a `410`.

## Local development

Callbacks work the same against `volcano start`. Send the same requests to the local server's API URL instead of `https://api.volcano.dev`. A callback's `timeout` and `heartbeatTimeout` run in real time even when plain waits resolve at once, because something outside the function answers against them. See [Developing durable functions locally](../guides/durable-functions-locally.md#answer-callbacks-locally).

## Limits and billing

| Limit                         | Value                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Result                        | 64 KiB of JSON, not `null`                                                   |
| Error type                    | 256 characters, without control characters                                   |
| Error message                 | 32 KiB, with tab and newline as its only control characters                  |
| Request body                  | 72 KiB to succeed, 200 KiB to fail, 8 KiB to heartbeat                       |
| Callback name                 | 237 printable ASCII characters                                               |
| Open tokens per execution     | 1,000                                                                        |
| Tokens issued                 | 3,600 per hour per execution, retries included                               |
| Retried token requests        | 10 per minute per project in each region that can't confirm the wait is open |
| Answers and heartbeats        | 3,600 per hour per token, and 36,000 per hour per project, together          |
| Timeout and heartbeat timeout | 1 second to 366 days                                                         |

These are the same on both plans. A replayed workflow asks again for the tokens it was already issued, and Volcano checks each wait is still open. A check that finds it open is free. One that finds the wait closed, or can't find it in a long history, counts toward the retried-request limit, and fewer fit in a minute when the history is long. Past that limit, every retried token request in the project answers `503` until the minute ends, including those for waits still open, and `waitForCallback` raises `CallbackSubmitterError` if that lasts beyond its 30 seconds of retries. The per-execution counts stop runaway loops rather than meter use: requests that race at a count can each be accepted. A wait that timed out on its heartbeat timeout stays open for the count until a request with its token gets `callback_expired`, or the execution ends. A request with a token that Volcano has already seen answered, timed out, or ended counts against neither limit; the first request after a heartbeat timeout is still counted. 36,000 an hour is ten requests a second across the project, enough for about 600 tokens heartbeating once a minute. Heartbeat only as often as the heartbeat timeout needs, such as every few minutes for a `heartbeatTimeout` of `15m`.

Callbacks are not a separate allowance: each `waitForCallback` is three durable operations, counted against your [operation allowance](durable-functions.md#limits-and-billing). Waiting costs no compute, and answering costs nothing beyond the request.

## Errors

Errors on the answer and heartbeat routes:

| Status | `code`               | When                                                                                           |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------- |
| `400`  |                      | The token is missing or malformed, or the result or error is invalid                           |
| `404`  | `callback_not_found` | No wait has this token, including one whose execution is past its retention                    |
| `409`  | `callback_completed` | The token was already succeeded or failed                                                      |
| `410`  | `callback_expired`   | The wait timed out, on its timeout or its heartbeat timeout                                    |
| `410`  | `execution_ended`    | The execution finished or was stopped                                                          |
| `413`  |                      | The request body is larger than 72 KiB to succeed, 200 KiB to fail, or 8 KiB to heartbeat      |
| `429`  |                      | Too many answers and heartbeats for the token, or for its project. Retry later                 |
| `503`  |                      | A heartbeat could not reach the execution right now. The wait is unchanged; retry with backoff |

Errors `waitForCallback` can raise inside the workflow while it gets its token. Those marked retried are retried for about 30 seconds and raised only if they persist; the rest are raised as `CallbackSubmitterError` at once:

| Status | `code`                     | When                                                                                                                                                          |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                            | The name is invalid                                                                                                                                           |
| `404`  |                            | No running durable execution Volcano started matches the request. Retried                                                                                     |
| `409`  | `callback_not_ready`       | Volcano cannot see the execution waiting yet. Retried                                                                                                         |
| `409`  | `callback_taken`           | The callback is already registered as an approval or a message wait. Only a modified SDK sends this                                                           |
| `409`  | `execution_ended`          | The execution finished first                                                                                                                                  |
| `409`  | `too_many_callback_tokens` | The execution already holds 1,000 open tokens                                                                                                                 |
| `429`  |                            | Too many tokens issued to this execution. Retried                                                                                                             |
| `5xx`  |                            | The request could not be confirmed right now, including when a retried token request is past the project's 10 a minute that can't confirm their wait. Retried |

A `409` with `callback_closed` is not raised: the wait already timed out, or a retried submitter's token was already answered, so the submitter is not called and `waitForCallback` resolves as the wait did, with `null` after a timeout. Like approvals and messages, `waitForCallback` needs the `VOLCANO_PLATFORM_API_URL` variable Volcano sets on durable functions; a function last deployed before approvals were available has to be redeployed once.

## What's next

| Guide                                                                          | Description                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [Durable functions](durable-functions.md)                                      | Operations, executions, and billing                            |
| [Durable messages](durable-messages.md)                                        | Send messages to a running workflow and read what it publishes |
| [Durable approvals](durable-approvals.md)                                      | Wait for a person's decision                                   |
| [Developing durable functions locally](../guides/durable-functions-locally.md) | Answer callbacks on your machine                               |
| [Errors](../api-reference/errors.md)                                           | Every API error body                                           |
