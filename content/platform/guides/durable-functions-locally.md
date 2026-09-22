---
title: "Developing durable functions locally"
description: "Write a durable function, watch it suspend and resume locally, then deploy it unchanged."
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
  console.log('charging');            // once, ever
  return chargeCard(input.card_token, input.amount);
});
```

```bash
volcano durable logs orders --follow
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

## Deploy it

Nothing changes:

```bash
volcano cloud durable deploy --all
```

The same manifest, the same handler, the same runtime version. What differs in production is time — waits take as long as you asked for — and that you can choose regions.

## What to check before you rely on it

- **Every step is idempotent.** Local mode resolves waits at once and so resumes far more often per wall-clock minute than production will; a step that is not safe to run twice tends to show up here first.
- **Your retry budget is reachable.** `maxAttempts` counts across suspensions, so watch an execution actually exhaust one locally rather than assuming it does.
- **Long waits work at their real length.** Run once with `LOCAL_DURABLE_REAL_TIME=true` before shipping a function whose timing matters.
- **Your costs are what you expect.** Local executions are metered on the same three counters as deployed ones, so the project's usage is a fair estimate of what a workload will cost before you ship it. Read it from `GET /projects/{id}/usage` and check it against [the allowances for your plan](plans-and-limits.md).

Callbacks are the one thing you cannot try locally: nothing here can deliver one, so an execution that waits on a callback fails saying so. Deploy the function to exercise that path.

## Related

- [Durable functions](../functions/durable-functions.md) — the full reference, including operations, retention and billing
- [Project configuration](../projects/configuration.md) — the manifest fields a durable function accepts
