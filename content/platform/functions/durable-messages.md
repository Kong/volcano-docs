---
title: 'Durable messages'
description: 'Send named messages to a running durable function from a webhook, a backend, a browser, or another function, and read or subscribe to the messages it publishes.'
---

A durable function can wait for something outside it to happen, and tell the outside world how it is getting on. `ctx.waitForMessage` suspends the execution until a message with that name arrives; `ctx.publish` records a message that applications list or receive live. A webhook receiver, a backend, a browser, or another function sends the message, with the credential it already holds.

```javascript
const { durable } = require('@volcano.dev/sdk/durable');

exports.handler = durable(async (input, ctx) => {
  await ctx.publish('progress', { stage: 'waiting-for-upload' });

  const upload = await ctx.waitForMessage('uploaded', { timeout: '1d' });
  if (upload === null) {
    return { status: 'abandoned' };
  }

  const report = await ctx.step('render', () => render(upload.data.url));
  await ctx.publish('progress', { stage: 'done', report_url: report.url });
  return { status: 'done', report_url: report.url };
});
```

Send the message from wherever the upload finishes:

```bash
curl -X POST "https://api.volcano.dev/durable-functions/report-builder/executions/$EXECUTION_ID/messages" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: upload-7f3a" \
  -d '{"name": "uploaded", "data": {"url": "https://files.example.com/7f3a.csv"}}'
```

```json
{
  "id": "4c8e2d1a-6b7f-4e3a-9d2c-1f5e8a7b6c4d",
  "execution_id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
  "direction": "in",
  "seq": 2,
  "name": "uploaded",
  "data": { "url": "https://files.example.com/7f3a.csv" },
  "sender": { "type": "service_key", "user_id": null },
  "status": "delivered",
  "delivered_at": "2026-10-12T09:14:03Z",
  "sent_at": "2026-10-12T09:14:03Z"
}
```

The execution resumes from the line after `waitForMessage`, holding the message. It runs no code and costs no compute while it waits.

The same handler in Python:

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

`waitForMessage` and `publish` need `@volcano.dev/sdk` 2.1 or later in JavaScript, or `volcano-sdk-python` 0.15 or later in Python. Ruby has no durable authoring API, so a Ruby application can [send, list, and subscribe](#from-an-sdk) but not wait or publish.

## Messages, approvals, or callbacks

All three suspend an execution until something outside it answers. They differ in who may answer.

| Use                                           | When                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ctx.waitForApproval`](durable-approvals.md) | A person has to decide. Only a signed-in person can approve or deny; a project access token, a service key, or the workflow itself cannot.                                                     |
| `ctx.waitForMessage`                          | Your own code answers: a webhook receiver, a user clicking a button in your app, another function finishing. Whoever the function's [visibility](#who-can-send-and-read) admits can send.      |
| [`ctx.waitForCallback`](durable-callbacks.md) | A system without a Volcano credential answers, such as a payment provider or a job queue. The function hands it a token, and it succeeds, fails, or heartbeats the wait with that token alone. |

A message never decides an approval, whatever it carries, so moving a step from an approval to a message changes who may answer it. Keep an approval wherever an answer from code would defeat the point.

## Wait for a message

```javascript
const message = await ctx.waitForMessage('payment-confirmed', { timeout: '30m' });
```

| Argument  | Description                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`    | Required. The message name to wait for, and the operation's name in the execution's history. Up to 237 printable ASCII characters.                                       |
| `timeout` | How long to wait, in the format `ctx.wait` takes (`'30m'`, `'3d'`, a number of seconds), from 1 second to 366 days. Without it, the wait lasts as long as the execution. |

It resolves with the message, or with `null` (`None` in Python) when the timeout passes first. A timeout is an outcome to branch on, not an error.

| JavaScript      | Python           | Value                                              |
| --------------- | ---------------- | -------------------------------------------------- |
| `id`            | `id`             | The message's id                                   |
| `name`          | `name`           | The name it was sent with                          |
| `data`          | `data`           | The JSON value sent, or `null`                     |
| `sender.type`   | `sender.type`    | `service_key`, `user`, `anon`, or `project`        |
| `sender.userId` | `sender.user_id` | The user who sent it, when `sender.type` is `user` |
| `sentAt`        | `sent_at`        | ISO 8601 timestamp                                 |

Each wait takes one message. Messages that arrive before anything waits for their name are kept, and each wait takes the oldest one with its name, so a burst of sends is consumed first in, first out by a loop:

```javascript
const items = [];
for (;;) {
  const message = await ctx.waitForMessage('item', { timeout: '10m' });
  if (message === null || message.data.last) break;
  items.push(message.data);
}
```

The wait is checkpointed like any other operation. A resumed execution replays the message it received instead of waiting again. Waits inside `ctx.parallel`, `ctx.map`, or `ctx.child` work the same way, so one execution can wait for several names at once.

`waitForMessage` throws, failing the execution unless you catch it, when its arguments are invalid or Volcano refuses the wait — for example when the execution already has 100 waits open. Brief refusals are retried for about 30 seconds before they surface. See [Errors](#errors).

## Publish a message

```javascript
const published = await ctx.publish('progress', { pct: 40 });
console.log(published.seq);
```

```python
published = ctx.publish("progress", {"pct": 40})
print(published.seq)
```

`publish` stores the message, adds it to the execution's message list, and delivers it to every client [subscribed](#subscribe-to-an-execution) to the execution. It resolves with the message's `id` and `seq`. `data` is any JSON value up to 64 KiB, or omitted for `null`.

Publishing is checkpointed, so a replay never publishes twice, and a publish that runs again after a crash returns the message it already published and sends it to subscribers again, in case the crash came before they got it.

The first `publish` in an execution, and in each `ctx.child`, `ctx.parallel` branch, or `ctx.map` item that publishes, opens a messages session first: Volcano hands the execution a credential to publish with, which only that execution can use. The session costs three durable operations and one resume, once. It appears in the operations trace as a `child` named `volcano:messages-session`.

A `ctx.map` over 500 items that publishes from every item opens 500 sessions. To report progress across a map, publish from the parent instead, after each batch or once the map returns:

```javascript
const resized = await ctx.map('resize', input.images, (image, imageCtx) =>
  imageCtx.step('resize-image', () => resize(image)),
);
await ctx.publish('progress', { done: resized.succeeded, failed: resized.failed });
```

## Send a message

Send to `POST /durable-functions/{functionId}/executions/{executionId}/messages`, where `functionId` is the durable function's id or name.

```bash
curl -X POST "https://api.volcano.dev/durable-functions/checkout/executions/$EXECUTION_ID/messages" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "X-Volcano-Client-Token: $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "address-confirmed", "data": {"address_id": "addr_19"}}'
```

| Field  | Description                                                                  |
| ------ | ---------------------------------------------------------------------------- |
| `name` | Required. The name a wait takes it by. Up to 237 printable ASCII characters. |
| `data` | Any JSON value up to 64 KiB. Omitted means `null`.                           |

The response is the message, with `201`. `status` is `delivered` when a wait took it at once, `delivering` when a wait took it but the handover is still being confirmed, and `queued` when nothing is waiting for its name yet. A send answers within a few seconds even when the handover takes longer; [list the messages](#list-an-executions-messages) to see it land:

| Status       | Meaning                                       |
| ------------ | --------------------------------------------- |
| `queued`     | Kept until a wait for its name takes it       |
| `delivering` | A wait took it and Volcano is handing it over |
| `delivered`  | The execution has it                          |
| `dropped`    | The execution ended before any wait took it   |
| `published`  | Every message the execution published itself  |

A message the execution cannot take right then — because its wait timed out at that moment, or the execution was stopped — goes back to `queued` rather than being lost.

### Retry safely

Send `Idempotency-Key` with any string of up to 255 printable ASCII characters. A retry with a key the same sender has already used on the execution returns the original message with `200` and sends nothing, even once the sender is past its [send limit](#limits-and-billing). Each sender has its own keys: the service key, each signed-in user, the client token's holders, and the project's own credentials. One sender can never take a key another uses:

```bash
curl -X POST "https://api.volcano.dev/durable-functions/report-builder/executions/$EXECUTION_ID/messages" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $WEBHOOK_EVENT_ID" \
  -d '{"name": "uploaded", "data": {"url": "https://files.example.com/7f3a.csv"}}'
```

Webhook providers retry deliveries they did not see acknowledged, so pass their event id as the key.

### Find the execution by name

Messages are addressed by execution id. A sender that only knows the [execution name](durable-functions.md#start-an-execution) starts the function again under that name: the start returns the existing execution's id without beginning another one, and is not charged.

```bash
curl -X POST "https://api.volcano.dev/durable-functions/report-builder/executions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "X-Volcano-Execution-Name: report-7f3a"
```

A start creates the execution when no execution has that name: after a typo, or once the execution is past retention, it begins new work. On a `public` or `authenticated` function, whoever can start it can also claim a name before you do, and your messages then go to their execution. Store the id from your own start, or use names nobody else can guess.

### Sending to a finished execution

A send to an execution Volcano knows has ended is refused with `409`:

```json
{ "error": "durable execution is not running", "code": "execution_not_running" }
```

A send that arrives in the moments before Volcano has seen the execution end is queued, then marked `dropped`.

## Who can send and read

The same rule covers sending, listing, and subscribing on the application endpoint. First the function's [visibility](durable-functions.md#who-can-start-executions) has to admit the caller. Sends and lists check it on every request, so a function made private stops answering them at once; a [subscription](#subscribe-to-an-execution) is checked when it is made and about once a minute while it is open, and ends when the check fails. Then the caller has to be allowed to reach the execution:

| Credential                    | Reaches                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Service key                   | Any execution of the project, unless the key is scoped without `functions.invoke` |
| Signed-in user's access token | Executions that user started, and any execution whose client token they send      |
| Anon key                      | Only executions whose client token it sends                                       |

While an execution is still `pending`, only the service key reaches it, because a retried start can still hand it to another caller; send and read once it is `running`.

Everything else answers `404`, the same as an execution that does not exist, so an execution id cannot be probed. On an `authenticated` function, an anon key gets `403`; a `private` function answers everyone but the service key with `404`.

### Client tokens

Every start whose input an execution runs returns a `client_token` with it, whatever credential started it:

```json
{
  "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
  "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "name": "checkout-1182",
  "status": "running",
  "region": "us-east-1",
  "created_at": "2026-10-12T09:10:00Z",
  "client_token": "vdct_..."
}
```

Send it as `X-Volcano-Client-Token` to reach that execution with an anon key, or as a signed-in user who did not start it. A backend that starts the execution with the service key can hand the token to the browser that should talk to it.

Volcano stores only a hash of the token, and a repeated start under the same execution name never returns it, because execution names are guessable. If the start response is lost, the token is lost too: the service key and the user who started the execution can still reach it. If the start fails with a `5xx`, retry it under the same name. A retry that begins the execution returns a token, and its caller becomes the one who started it. A retry that finds the first start did begin returns the execution without one. An anon-key client that then needs the token can start under a new execution name, which may run the work twice.

The service key can retry any start that failed before it began. A signed-in user can retry only their own, and an anon key only one an anon key made. Any other retry under that name answers `409`, so pick a name of your own.

### The project endpoint

Tooling working against a project uses `/projects/{id}/durable-functions/{functionId}/executions/{executionId}/messages`, with the same body and responses:

| Credential                                | List | Send      |
| ----------------------------------------- | ---- | --------- |
| Project owner's token                     | Yes  | Yes       |
| Project access token (`pt-`), `full`      | Yes  | Yes       |
| Project access token (`pt-`), `read_only` | Yes  | No, `403` |

Unlike approvals, sending does not need a person, because a message never decides an approval. The [dashboard](../interfaces/dashboard.md), the [CLI](#from-the-cli), and the [MCP server](../interfaces/mcp.md) use this endpoint.

## List an execution's messages

```bash
curl "https://api.volcano.dev/durable-functions/report-builder/executions/$EXECUTION_ID/messages?direction=out&after=3" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

```json
{
  "data": [
    {
      "id": "7d2a9c4e-1b3f-4e6a-8c5d-9f0e1a2b3c4d",
      "execution_id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
      "direction": "out",
      "seq": 4,
      "name": "progress",
      "data": { "stage": "done", "report_url": "https://files.example.com/7f3a.pdf" },
      "sender": { "type": "execution", "user_id": null },
      "status": "published",
      "delivered_at": null,
      "sent_at": "2026-10-12T09:15:41Z"
    }
  ],
  "has_more": false
}
```

Messages in both directions are listed oldest first, ordered by `seq`. `seq` increases with every message but can skip numbers.

| Parameter   | Description                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direction` | `in` for messages sent to the execution, `out` for what it published. Both by default.                                                                                      |
| `name`      | Only messages with this name                                                                                                                                                |
| `after`     | Only messages with a greater `seq`. Pass the last `seq` you read to read what came next.                                                                                    |
| `limit`     | 1 to 500, 100 by default. A page whose messages carry over 1 MiB of data between them stops early, so read on while `has_more` is `true` rather than until a page is short. |

Open waits are listed, for the project endpoint only, at `GET .../executions/{executionId}/message-waits`. Each has a `name`, its `expires_at`, and a `status`: `waiting`, or `matched` while the message it took is handed over.

Messages are kept as long as their execution is: they are deleted with it when its [retention](durable-functions.md#wait-for-the-result) lapses.

## Subscribe to an execution

Clients receive published messages live on the execution's realtime channel. Subscribing needs a [realtime connection](../realtime/overview.md), which a signed-in user, anonymous sign-ins included, or the service key opens; an anon key alone does not. Over it, the subscriber needs what listing needs: the service key, the user who started the execution, or the execution's client token, once the execution is [running](#who-can-send-and-read). The SDKs catch up from the list so that nothing published before or during the subscribe is missed:

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

const realtime = new VolcanoRealtime({ apiUrl, anonKey, accessToken: volcano.accessToken });
await realtime.connect();

const { data: subscription, error } = await volcano.durable.messages.subscribe(
  { functionName: 'report-builder', executionId: execution.id, clientToken: execution.client_token },
  (message) => {
    if (message.name === 'progress') showProgress(message.data);
  },
  { realtime },
);

// Later
await subscription.unsubscribe();
```

The handler receives `out` messages in `seq` order, once each. Each live message carries the `seq` of the message published before it, so when one is lost on the way the SDK notices at the next and reads the gap from the list before calling the handler. A subscription stays open until it is closed, its connection drops, or a check finds the subscriber no longer reaches the execution, as when the function is made private. A reconnect is checked again. A publish with subscribers counts against the project's [Realtime message allowance](../realtime/overview.md) as one message plus one for each subscriber it reaches. A publish that runs again after a crash is sent again and counts again, though the handler still receives it once. A publish nobody is subscribed to costs nothing, so neither does publishing on a project with Realtime off. Subscribing needs Realtime enabled for the project; listing works either way. Clients cannot publish on the channel.

A visitor who is not signed in can poll `list` with `after` instead of subscribing, or sign in anonymously first.

## From an SDK

Each SDK sends, lists, and subscribes with the credential its client holds. Name the execution with the durable function and execution id, and add the client token when the caller did not start it:

```javascript
const target = {
  functionName: 'checkout',
  executionId: execution.id,
  clientToken: execution.client_token,
};

const { data: message, error } = await volcano.durable.messages.send(
  target,
  'address-confirmed',
  { address_id: 'addr_19' },
  { idempotencyKey: 'confirm-addr_19' },
);

const { data: page } = await volcano.durable.messages.list(target, { direction: 'out' });
```

```python
message = client.durable.messages.send(
    "checkout",
    execution.id,
    "address-confirmed",
    {"address_id": "addr_19"},
    idempotency_key="confirm-addr_19",
    client_token=execution.client_token,
)

page = client.durable.messages.list(
    "checkout", execution.id, direction="out", client_token=execution.client_token
)
for message in page.messages:
    print(message.seq, message.name, message.data)


async def follow(client, execution):
    subscription = await client.durable.messages.subscribe(
        "checkout",
        execution.id,
        lambda message: print(message.name, message.data),
        client_token=execution.client_token,
    )
    ...
    await subscription.unsubscribe()
```

Python's `subscribe` is a coroutine, and Ruby's runs inside an `Async` reactor. In Python and Ruby, `subscribe` follows the execution on the client's realtime connection, which opens only for a signed-in user: a client holding just the client token or a service key gets an error. Such a client can poll `list` with `after` instead.

```ruby
require "async"

message = client.durable.messages.send_message(
  "checkout", execution.id, "address-confirmed", { address_id: "addr_19" },
  client_token: execution.client_token, idempotency_key: "confirm-addr_19"
)

page = client.durable.messages.list("checkout", execution.id, direction: "out",
                                                              client_token: execution.client_token)
page.messages.each { |m| puts [m.seq, m.name, m.data].inspect }

Async do
  subscription = client.durable.messages.subscribe("checkout", execution.id,
                                                   client_token: execution.client_token) do |m|
    puts m.name
  end
  # ...
  subscription.unsubscribe
ensure
  client.realtime.disconnect
end.wait
```

Pass `projectId` (`project_id`) to use the [project endpoint](#the-project-endpoint) with an owner's or project access token instead. JavaScript returns its usual `{ data, status, error }` envelope; Python and Ruby raise a not-found error for `404` and a conflict error for `409`, whose `code` says which.

## From the CLI

```bash
volcano cloud durable messages send report-builder 9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d uploaded \
  --data '{"url": "https://files.example.com/7f3a.csv"}' --idempotency-key upload-7f3a
volcano cloud durable messages list report-builder 9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d --direction out
volcano cloud durable messages waits report-builder 9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d
```

Every command takes `--json`. Against `volcano start`, drop `cloud`. See [Developing durable functions locally](../guides/durable-functions-locally.md#send-messages-locally).

## Limits and billing

| Limit                            | Value                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message data                     | 64 KiB, counting each number written out in full, so `1e300` takes about 300 bytes                                                                                                        |
| Message name                     | 237 printable ASCII characters                                                                                                                                                            |
| `Idempotency-Key`                | 255 printable ASCII characters                                                                                                                                                            |
| Queued messages per execution    | 100                                                                                                                                                                                       |
| Published messages per execution | 1,000 over the execution's life                                                                                                                                                           |
| Open waits per execution         | 100                                                                                                                                                                                       |
| Messages sessions per execution  | 1,000 over the execution's life                                                                                                                                                           |
| Sends                            | 3,600 per hour per execution for each kind of sender on the application endpoint (the service key, signed-in users, and anon key callers), and 3,600 through the project-scoped endpoints |
| Waits and sessions               | 3,600 per hour per execution                                                                                                                                                              |
| Wait timeout                     | 1 second to 366 days                                                                                                                                                                      |

These are the same on both plans. The per-execution counts stop runaway loops rather than meter use: requests that race at a count can each be accepted, so an execution can briefly hold a few more. Sends and lists through the application endpoint also share the function's [rate limit](../guides/plans-and-limits.md) with its invocations and starts: on HOBBY, 100 requests per 10 seconds for one function and 600 across the project. Poll `list` no faster than you need to. The project-scoped endpoints do not share the function's rate limit; their sends count only toward their own send limit.

Messages are not a separate allowance: each `waitForMessage` is three durable operations, each `publish` one, and each messages session three, counted against your [operation allowance](durable-functions.md#limits-and-billing). Waiting costs no compute. Sending costs nothing beyond the request. A publish with subscribers counts as one Realtime message, plus one for each subscriber it reaches; one with none costs nothing.

## Errors

Errors on the send and list endpoints:

| Status | `code`                     | When                                                                                                                                                                                                 |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                            | The name, data, filters, or `Idempotency-Key` are invalid                                                                                                                                            |
| `401`  |                            | The credential is missing or not valid                                                                                                                                                               |
| `403`  |                            | An anon key or scoped service key without `functions.invoke`, an anon key on an `authenticated` function, an origin the project's CORS policy refuses, or a `read_only` project access token sending |
| `404`  |                            | No such function or execution, or the caller may not reach it                                                                                                                                        |
| `409`  | `execution_not_running`    | The execution has ended                                                                                                                                                                              |
| `409`  | `too_many_queued_messages` | The execution already holds 100 messages nothing has taken                                                                                                                                           |
| `413`  |                            | The request body is larger than 72 KiB                                                                                                                                                               |
| `429`  |                            | Too many messages sent to this execution, the application endpoint's rate limit for the function or the project, or the project is over its bandwidth cap                                            |
| `503`  |                            | The application endpoint could not read the project's plan terms. Retry with backoff                                                                                                                 |

Errors `waitForMessage` and `publish` can raise inside the workflow. Those marked retried are retried for about 30 seconds and raised only if they persist:

| Status | `code`                        | When                                                                                                            |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `400`  |                               | The name or data is invalid                                                                                     |
| `401`  |                               | `publish` sent a session token Volcano does not accept. Only a modified SDK sends this                          |
| `404`  |                               | No running durable execution Volcano started matches the request. Retried                                       |
| `409`  | `callback_not_ready`          | Volcano cannot see the execution waiting yet. Retried                                                           |
| `409`  | `callback_taken`              | The callback is already registered as an approval or as another wait or session. Only a modified SDK sends this |
| `409`  | `execution_ended`             | `waitForMessage`, or the session `publish` opens, after the execution finished                                  |
| `409`  | `execution_not_running`       | `publish` after the execution finished                                                                          |
| `409`  | `too_many_message_waits`      | The execution already has 100 waits open                                                                        |
| `409`  | `too_many_message_sessions`   | The execution already opened 1,000 sessions                                                                     |
| `409`  | `too_many_published_messages` | The execution already published 1,000 messages                                                                  |
| `429`  |                               | Too many requests from this execution. Retried                                                                  |
| `5xx`  |                               | The request could not be confirmed right now. Retried                                                           |

A `409` with `callback_closed` is not raised: the wait's timeout already passed, so `waitForMessage` resolves with `null`. Like approvals, both need the `VOLCANO_PLATFORM_API_URL` variable Volcano sets on durable functions; a function last deployed before approvals were available has to be redeployed once.

## What's next

| Guide                                                                          | Description                         |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| [Durable functions](durable-functions.md)                                      | Operations, executions, and billing |
| [Durable approvals](durable-approvals.md)                                      | Wait for a person's decision        |
| [Developing durable functions locally](../guides/durable-functions-locally.md) | Send messages on your machine       |
| [Errors](../api-reference/errors.md)                                           | Every API error body                |
