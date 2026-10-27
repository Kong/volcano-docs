---
title: 'Developing durable functions locally'
description: 'Write a durable function, watch it suspend and resume locally, then deploy it unchanged.'
---

A durable function runs on your machine the same way it runs deployed. The handler is the same code, the manifest is the same file, and the suspend-and-resume you see locally is the suspend-and-resume you get in production — so there is nothing to change when you deploy.

This guide builds one, runs it locally through a suspend and a resume, and deploys it unchanged.

## Write the function

Durable functions live under `volcano/functions/` like any other. This one charges a card, waits a day, then emails a receipt:

```javascript
// volcano/functions/orders/index.js
const { durable } = require('@volcano.dev/sdk/durable');

exports.handler = durable(async (input, ctx) => {
  const charge = await ctx.step('charge', () => chargeCard(input.card_token, input.amount));

  await ctx.wait('settle', '24h');

  await ctx.step('send-receipt', () => emailReceipt(input.email, charge.id));

  return { charged: charge.id };
});
```

The SDK is the only dependency you declare. Checkpointing needs a runtime your handler never imports, and Volcano installs it when it builds the function — locally and in the cloud, at the same version.

Declare it in your manifest as a durable function:

```yaml
# volcano-config.yaml
functions:
  orders:
    kind: durable
    runtime: nodejs24.x
    handler: index.handler
    durable:
      execution_timeout_seconds: 172800
      retention_days: 30
```

## Run it

```bash
volcano start
volcano durable deploy --all
```

`volcano deploy` deploys it too, along with the rest of the project.

Start an execution and watch it:

```bash
volcano durable start orders --input '{"card_token":"tok_1","amount":4200,"email":"a@example.com"}'
```

A start answers with a handle, not a result. The execution can outlive any request you could hold open, so you poll it:

```text
ID: 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
Name: 1095b0f8-7efa-45c6-a25b-af013981ab6e
Status: running
Region: us-east-1
Started: 2026-03-04T10:26:31-07:00
```

```bash
volcano durable executions get orders 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
```

```text
ID: 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
Name: 1095b0f8-7efa-45c6-a25b-af013981ab6e
Status: succeeded
Region: us-east-1
Started: 2026-03-04T10:26:31-07:00
Completed: 2026-03-04T10:26:33-07:00
Duration: 2s
Result: {
  "charged": "ch_1"
}
```

It finished in seconds despite the day-long wait, because **a wait resolves immediately in local mode**. Your function cannot tell the difference: it suspended, and it resumed with the charge already done rather than charging again. That is the property worth checking, and it is the one that breaks silently if a step is not really idempotent.

To make waits take their real time — worth doing once before you rely on a long one — set it in your environment and restart:

```bash
LOCAL_DURABLE_REAL_TIME=true volcano start
```

## Prove the replay

The point of a step is that its result is recorded and not recomputed. Log inside one and start an execution that suspends:

```javascript
const charge = await ctx.step('charge', () => {
  console.log('charging'); // once, ever
  return chargeCard(input.card_token, input.amount);
});
```

```bash
volcano durable logs orders --type runtime --follow
```

You will see `charging` once, not once per invocation, however many times the function suspends and resumes afterwards. If you see it twice, the work is inside the replay rather than inside the step.

## Suspend across a restart

An execution outlives the local server. Start one that is waiting on something slow, stop the server, and start it again:

```bash
volcano start          # in another terminal: volcano durable start orders ...
volcano stop
volcano start
volcano durable executions get orders 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
```

The execution resumes where it stopped. Local executions are stored in the same database your project uses, so restarting loses nothing — which is what makes a local run a fair test of a long-lived one.

## Approve locally

A function that calls [`ctx.waitForApproval`](../functions/durable-approvals.md) waits for a decision locally too. Add one before the charge:

```javascript
const decision = await ctx.waitForApproval('approve-charge', {
  title: `Charge ${input.amount} to ${input.email}?`,
  timeout: '10m',
});
if (!decision.approved) {
  return { charged: false, status: decision.status };
}
```

Redeploy, start an execution, and decide it from another terminal:

```bash
volcano durable deploy --all
volcano durable start orders --input '{"card_token":"tok_1","amount":4200,"email":"a@example.com"}'
volcano durable approvals list
volcano durable approvals approve 0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20 --comment "Looks right"
```

```text
ID                                    Title                     Workflow            Execution             Status      Requested   Expires
--------------------------------------------------------------------------------------------------------------------------------------------
0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20  Charge 4200 to a@exam...  orders              1095b0f8-7efa-45c...  pending     5s ago      in 9m
Showing 1 of 1 approval(s) (page 1, limit 100)
```

The local CLI decides as the local user, so `approve` and `deny` work without `volcano login`. The execution resumes with the decision and finishes; `volcano durable executions get` shows its result.

**An approval's timeout runs in real time,** even though plain waits resolve immediately. A person is deciding against it, and an approval that expired the moment it was asked could never be answered. Use a short `timeout` to watch the `expired` branch run.

## Send messages locally

A function that calls [`ctx.waitForMessage`](../functions/durable-messages.md) waits for one locally too. Wait for the card network's confirmation instead of the fixed day, and report progress:

```javascript
await ctx.publish('progress', { stage: 'charged', charge_id: charge.id });

const settled = await ctx.waitForMessage('settled', { timeout: '10m' });
if (settled === null) {
  return { charged: charge.id, settled: false };
}
```

Redeploy, start an execution, and send the message from another terminal, as your webhook receiver would:

```bash
volcano durable deploy --all
volcano durable start orders --input '{"card_token":"tok_1","amount":4200,"email":"a@example.com"}'
volcano durable messages waits orders 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
volcano durable messages send orders 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b settled --data '{"batch":"b_31"}'
volcano durable messages list orders 9f2c1d84-4b77-4a1e-9f0a-2c3d4e5f6a7b
```

The list shows the `progress` message the function published and the `settled` message you sent, in order. A message sent before the function reaches its wait is kept until it does, so the order of the two commands does not matter.

**A message wait's timeout runs in real time** too, like an approval's. Let one pass to watch the `null` branch run.

## Answer callbacks locally

A function that calls [`ctx.waitForCallback`](../functions/durable-callbacks.md), which needs `@volcano.dev/sdk` 2.2 or `volcano-sdk-python` 0.16, gets a token the local server answers to. To play the external system yourself, print the token instead of sending it anywhere:

```javascript
const { CallbackFailedError } = require('@volcano.dev/sdk/durable');

let settled;
try {
  settled = await ctx.waitForCallback(
    'settled',
    (token) => console.log(`settle with ${token}`), // locally only; a token is a secret
    { timeout: '10m', heartbeatTimeout: '2m' },
  );
} catch (error) {
  if (error instanceof CallbackFailedError) {
    return { charged: charge.id, settled: false, reason: error.type };
  }
  throw error;
}
if (settled === null) {
  return { charged: charge.id, settled: false };
}
```

Redeploy, start an execution, read the token from its logs, and answer it against the local API:

```bash
volcano durable deploy --all
volcano durable start orders --input '{"card_token":"tok_1","amount":4200,"email":"a@example.com"}'
volcano durable logs orders --type runtime
curl -X POST http://localhost:8000/durable-callbacks/heartbeat \
  -H "Content-Type: application/json" -d '{"token": "vcb_..."}'
curl -X POST http://localhost:8000/durable-callbacks/succeed \
  -H "Content-Type: application/json" -d '{"token": "vcb_...", "result": {"batch": "b_31"}}'
```

Send `/durable-callbacks/fail` with `{"token": "vcb_...", "error": {"type": "Declined"}}` instead to watch the `catch` branch return the failure's `type`.

**A callback's timeout and heartbeat timeout run in real time** as well. Stop heartbeating for two minutes to watch the `null` branch run.

## Deploy it

Nothing changes:

```bash
volcano cloud durable deploy --all
# or the whole project, with the cloud project's variables
volcano cloud deploy --env-file volcano/cloud.env
```

The same manifest, the same handler, the same runtime version. What differs in production is time — waits take as long as you asked for — and that you can choose regions.

## What to check before you rely on it

- **Every step is idempotent.** Local mode resolves waits at once and so resumes far more often per wall-clock minute than production will; a step that is not safe to run twice tends to show up here first.
- **Your retry budget is reachable.** `maxAttempts` counts across suspensions, so watch an execution actually exhaust one locally rather than assuming it does.
- **Long waits work at their real length.** Run once with `LOCAL_DURABLE_REAL_TIME=true` before shipping a function whose timing matters.
- **Your costs are what you expect.** Local executions are metered on the same three counters as deployed ones, so the project's usage is a fair estimate of what a workload will cost before you ship it. Read it from `GET /projects/{id}/usage` and check it against [the allowances for your plan](plans-and-limits.md).
- **Every approval branch works.** Approve one, deny one, and let one expire, so each path through the handler has run before a person depends on it.
- **A message wait handles both outcomes.** Send the message once, and let its timeout pass once.
- **A callback handles every outcome.** Succeed one, fail one, and let one time out, so the function's `CallbackFailedError` and `null` branches have run.

## Related

- [Durable functions](../functions/durable-functions.md) — the full reference, including operations, retention and billing
- [Durable approvals](../functions/durable-approvals.md) — requesting and deciding approvals
- [Durable messages](../functions/durable-messages.md) — sending to and publishing from a running function
- [Durable callbacks](../functions/durable-callbacks.md) — letting another system complete a waiting step
- [Project configuration](../projects/configuration.md) — the manifest fields a durable function accepts
