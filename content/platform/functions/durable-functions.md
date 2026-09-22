---
title: "Durable functions"
description: "Durable functions checkpoint their progress and resume where they left off, so a single execution can run for up to a year across many invocations."
---

A durable function checkpoints its progress as it runs. If it is interrupted — because it suspended on a wait, or because an attempt crashed — it resumes from the last completed step instead of starting over. That lets one execution run for up to a year, far longer than the 300 or 900 seconds a single attempt is allowed.

Reach for a durable function when the work has steps you do not want to repeat, or waits you cannot hold a request open for: a multi-step order pipeline, a nightly reconciliation, an approval that arrives hours later, a batch job that calls a flaky third-party API.

Durable functions are a separate resource from [standard functions](overview.md). They live under `/projects/{id}/durable-functions`, are started asynchronously rather than invoked, and never appear in the standard functions collection. A function cannot change kind after it is created.

## Write one

A durable function is written against the authoring API in the Volcano SDK. Wrap the handler with `durable()` and do the work through the context it hands you:

```javascript
const { durable } = require('@volcano.dev/sdk/durable');

exports.handler = durable(async (input, ctx) => {
  const charge = await ctx.step('charge', () => chargeCard(input.order_id));

  await ctx.wait('settle', '30s');

  const packed = await ctx.map('pack', input.items, (item, itemCtx) =>
    itemCtx.step('pack-item', () => pack(item)),
  );

  return { charged: charge.id, packed: packed.results };
});
```

```bash
npm install @volcano.dev/sdk
```

Python is the same API, with the same operations and the same checkpointing:

```python
from volcano_sdk.durable_authoring import durable


@durable
def handler(event, ctx):
    charge = ctx.step("charge", lambda scope: charge_card(event["order_id"]))

    ctx.wait("settle", "30s")

    packed = ctx.map(
        event["items"],
        lambda item, item_ctx, index: item_ctx.step("pack-item", lambda s: pack(item)),
        "pack",
    )

    return {"charged": charge["id"], "packed": packed.results}
```

```bash
pip install volcano-sdk
```

The SDK is the only dependency a durable function declares. Checkpointing needs a runtime the handler never imports, and Volcano installs it into the function when it builds one deployed as durable.

Python durable operations are synchronous — there is no `await`, and a step's own function is handed a scope rather than called with no arguments.

Every context operation is checkpointed: what finished is recorded, and a resumed execution replays the recorded outcome instead of doing the work again. That is the one rule the handler has to respect — the code between operations runs again on every resume, so it has to reach the same operations in the same order. Keep decisions that must not change inside a `step`, and do not branch on the clock or a random value.

| Operation | What it does |
|---|---|
| `ctx.step(name?, fn, options?)` | Runs work once and records its result. `options.retry` sets the retry policy, `options.atMostOnce` marks work that must not repeat. |
| `ctx.wait(name?, duration)` | Suspends the execution. `'30s'`, `'2h'`, a whole number of seconds, or `{ hours, minutes }`. Anything shorter than a second is rejected. |
| `ctx.waitUntil(name?, check, options)` | Polls your own state until `options.until` holds, suspending between checks. `options.initialState` is required. |
| `ctx.map(name?, items, fn, options?)` | Runs one child context per item, with `options.concurrency`. |
| `ctx.parallel(name?, branches, options?)` | Runs independent branches concurrently. |
| `ctx.child(name?, fn)` | Groups operations under one checkpointed context. |
| `ctx.log` | The execution's logger, with the execution's identifiers attached. |

Waits and polls are held by the platform rather than by your code, so a function suspended for an hour costs nothing while it waits — but the execution timeout still applies. Full reference and worked examples are in the SDK's [durable functions guide](/sdk/js/durable-functions).

## Deploy one

```bash
zip function.zip index.js

curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=order-pipeline" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler" \
  -F "code=@function.zip"
```

```json
{
  "id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "project_id": "b1d3f4a2-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  "name": "order-pipeline",
  "status": "provisioning",
  "is_public": false,
  "durable": {
    "execution_timeout_seconds": 31622400,
    "retention_days": 30
  },
  "deployed_regions": [],
  "runtime": "nodejs24.x",
  "handler": "handler",
  "created_at": "2026-09-04T18:22:41Z",
  "updated_at": "2026-09-04T18:22:41Z"
}
```

A bundle holding nothing but the entry file works. Volcano installs what a durable function needs to checkpoint, so the runtime is not something the bundle has to carry. Include `package.json` and its lockfile, or `requirements.txt`, when your handler has dependencies of its own; they are installed during the build as they are for a standard function.

Deployment is asynchronous, exactly as it is for a standard function: `status` is `provisioning` until the build and rollout finish, then `active` or `failed`. Poll `GET /projects/{id}/durable-functions/{functionId}` to follow it.

Posting to the same name again redeploys that function and returns `200` instead of `201`. Executions already running continue on the runtime they started on.

The `durable` block is derived from your plan rather than supplied in the request, and is fixed for the life of the function. Changing those limits means creating a new function.

Durable execution runs on `nodejs22.x`, `nodejs24.x`, `python3.13` and `python3.14`, because checkpointing a function needs the durable authoring API and that ships for JavaScript, TypeScript and Python. Any other runtime is rejected with `400`, and the response names the ones that work. Ruby stays available for [standard functions](overview.md).

Note that a durable Python function needs a newer runtime than a standard one defaults to: `python3.12` is the default for Python and cannot host a durable function, so name `python3.14` explicitly when you deploy through the API.

Rather than hardcoding that list, read it from `GET /functions/runtimes` and keep the runtimes whose `durable_capable` is `true`:

```json
{
  "runtimes": [
    {
      "name": "nodejs24.x",
      "language": "nodejs",
      "default": true,
      "durable_capable": true,
      "deployment": {
        "file_extensions": [".js", ".mjs"],
        "entrypoint": "index.js",
        "handler": "handler",
        "dependency_manifests": ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", ".yarnrc.yml"]
      }
    },
    {
      "name": "python3.12",
      "language": "python",
      "default": true,
      "durable_capable": false,
      "deployment": {
        "file_extensions": [".py"],
        "entrypoint": "main.py",
        "handler": "handler",
        "dependency_manifests": ["requirements.txt"]
      }
    },
    {
      "name": "python3.14",
      "language": "python",
      "durable_capable": true,
      "deployment": {
        "file_extensions": [".py"],
        "entrypoint": "main.py",
        "handler": "handler",
        "dependency_manifests": ["requirements.txt"]
      }
    }
  ]
}
```

A durable function deploys to every region its project deploys to, and every one of those regions has to offer durable execution. Selecting a region that does not is rejected with `400`, on the deploy and on the project's own region change, and the message names the region.

Volcano can also pause durable deploys platform-wide, which answers `503` on any deploy carrying a durable function. Executions already running are unaffected, and the same request succeeds once deploys are re-enabled, so treat it as temporary rather than as a rejected request.

### From a repository

Set `kind: durable` on the function in `volcano-config.yaml` and deploy the project as usual:

```yaml
functions:
  - name: order-pipeline
    kind: durable
```

`kind` is asserted, never rewritten: a manifest that changes the kind of an existing function is rejected. Omitting it means `standard`, so a durable function has to name it. The invocation settings in that section — `invocation_mode`, `http_auth_mode`, `openapi_spec` — do not apply to a durable function and are rejected on one. See [Project configuration](../projects/configuration.md) and [Git deploy](../projects/git-deploy.md).

A repository has no runtime to declare, so the runtime comes from the source file's extension. A durable function gets the durable runtime for its language — `nodejs24.x` for `.js`, `python3.14` for `.py` — rather than the one standard functions default to, so declaring `kind: durable` is all a Python durable function needs.

## From the CLI

The [Volcano CLI](/cli) covers the whole lifecycle under `volcano cloud durable`, reading the same `volcano-config.yaml` and the same `volcano/functions/` layout standard functions use:

```bash
volcano cloud durable deploy --all
volcano cloud durable start order-pipeline --input '{"order_id":4417}' --name order-4417
volcano cloud durable executions list order-pipeline --status running
volcano cloud durable executions get order-pipeline $EXECUTION_ID
volcano cloud durable executions stop order-pipeline $EXECUTION_ID
volcano cloud durable schedulers create order-pipeline --cron "0 * * * *"
```

Logs come from the same command in both shapes a durable function has them: `volcano cloud durable logs order-pipeline --type build` is the deploy's own output, which is where a deploy that ended in `failed` says why, and `--type runtime` is what the function logged while its executions ran. Add `--follow` to tail either one.

The two collections refuse each other's names, so a function declared `kind: durable` is skipped by `volcano cloud functions deploy` and picked up by `volcano cloud durable deploy` — a wrong kind fails before anything is uploaded rather than creating a function that can never change.

## Start an execution

A durable execution can outlive any request you could hold open, so starting one never returns a result. It returns a handle:

```bash
curl -X POST "https://api.volcano.dev/durable-functions/$FUNCTION_ID/executions" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Volcano-Execution-Name: order-4417" \
  -d '{"order_id": 4417}'
```

```json
{
  "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
  "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "name": "order-4417",
  "status": "running",
  "region": "us-east-1",
  "created_at": "2026-09-04T18:31:02Z"
}
```

The request body is the function's input and must be valid JSON if present, up to 256 KiB. An empty body starts the execution with no input.

From an application, the SDKs do the same thing with the credential the client already holds:

```javascript
const { data, error } = await volcano.durable.start(
  'order-pipeline',
  { order_id: 4417 },
  { executionName: 'order-4417' },
);

console.log(data.id, data.status); // 'running'
```

```python
execution = client.durable.start(
    "order-pipeline", {"order_id": 4417}, execution_name="order-4417"
)

print(execution.id, execution.status)  # 'running'
```

```ruby
execution = client.durable.start(
  "order-pipeline", { order_id: 4417 }, execution_name: "order-4417"
)

puts [execution.id, execution.status] # 'running'
```

Every SDK can start an execution and follow it. Writing the handler takes a durable authoring API, which the JavaScript and Python SDKs have and Ruby does not, so a Ruby application starts and reads executions of functions written in JavaScript or Python.

`X-Volcano-Execution-Name` is the idempotency key. Repeating a start with the same name returns the execution that already exists instead of beginning a second one, which makes a retried client request safe, and the retry is not charged again. Omit it and Volcano generates one.

A name is made of letters, digits, `-`, `_` and `.`, up to 255 characters. Anything else is rejected with `400`, because the name is used as sent rather than rewritten.

It names one execution, not a process made of several. A name is taken for as long as its execution is readable, so work that continues past one execution — anything past the execution ceiling, or picked up again after it — starts a new execution under a new name, and whatever ties them together is your own identifier carried in the payload.

Starting before the function has finished provisioning answers `409` with `durable function is not deployed yet`. Wait for its `status` to reach `active` rather than retrying straight away. Two starts racing for the same name can both give it up, which answers `409` as well; that one is fine to retry unchanged. A start refused because the project is already at its concurrency cap answers `429` instead — see [Limits and billing](#limits-and-billing).

An execution is pinned to one region for its whole life, because its checkpoints live there.

### Which endpoint to use

Starting has two endpoints, because starting and managing are done by different callers with different credentials.

| Endpoint | Credentials | Use it for |
|---|---|---|
| `POST /durable-functions/{functionId}/executions` | Service key, auth user token, anon key | Applications starting work |
| `POST /projects/{id}/durable-functions/{functionId}/executions` | Project owner token | Scripts and tooling already working against a project |

They behave identically otherwise: the same body, the same idempotency header, the same `202` and handle. `volcano.durable.start` calls the first one.

Everything else about an execution — reading it, listing, stopping — is on the project-scoped collection and takes the owner's token only. The SDK has `volcano.durable.get`, `.list` and `.stop` for those, but they carry the owner's token, so call them from a backend rather than a browser.

### Public durable functions

Set `is_public` when you create a durable function to let an anon key start executions of it:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=checkout" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler" \
  -F "is_public=true" \
  -F "code=@function.zip"
```

```json
{
  "id": "3d2e1f0a-9b8c-4d7e-8f6a-5b4c3d2e1f0a",
  "project_id": "b1d3f4a2-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  "name": "checkout",
  "status": "provisioning",
  "is_public": true,
  "durable": {
    "execution_timeout_seconds": 31622400,
    "retention_days": 30
  },
  "deployed_regions": [],
  "runtime": "nodejs24.x",
  "handler": "handler",
  "created_at": "2026-09-04T18:52:07Z",
  "updated_at": "2026-09-04T18:52:07Z"
}
```

The anon key also needs the `functions.invoke` permission. Without `is_public` an anon key gets `403`; without the permission it gets `403` whatever the visibility.

Durable functions have no update endpoint, so visibility travels with a deploy. Redeploy with `is_public` to change it, or omit the field to keep what the function already has.

Three things are worth being precise about:

- **Public means startable, not readable.** An anon key ships inside your pages, so everyone who loads one holds it. Reading a result or stopping an execution stays with the owner's token — otherwise any visitor could poll or cancel work started by another, since an execution is addressed by its id alone. Return results to the browser through a function or endpoint of your own that decides who may see them.
- **Public means startable, not invocable.** A durable function is never reachable through `POST /functions/{functionId}/invoke` or a function URL, whatever its visibility; both answer `404`. A synchronous call would run it with no execution record, no idempotency, no concurrency accounting and no pinned version, which is not a durable execution however much it looks like one.
- **Anyone can start it.** A public durable function is startable by anyone who reads your anon key out of a page, and every start counts against your [execution and operation allowances](#limits-and-billing) and your concurrency cap — a caller who cannot see the result can still spend both. Validate the input inside the function and keep the payload small.

## Wait for the result

Poll the execution. Reading is owner-scoped, so this takes your platform token rather than the credential that started it:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions/$FUNCTION_ID/executions/$EXECUTION_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
  "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "name": "order-4417",
  "status": "succeeded",
  "region": "us-east-1",
  "result": { "charged": true, "shipment_id": "shp_88213" },
  "created_at": "2026-09-04T18:31:02Z",
  "completed_at": "2026-09-04T18:47:55Z"
}
```

| Status | Meaning |
|---|---|
| `pending` | Accepted, not yet under way |
| `running` | Executing, or suspended on a wait |
| `succeeded` | Finished; `result` holds what the function returned |
| `failed` | Ended with an error; `error` holds its type and message |
| `timed_out` | Exceeded the execution timeout |
| `stopped` | Cancelled through the stop endpoint |
| `unknown` | The platform lost track of the outcome; no result or error is available |

The last five are terminal. `result` is whatever the function returned, verbatim. It is absent while the execution is still running, absent when the result was too large to return and was checkpointed instead, and absent once the function's retention period lapses. Only the last of those sets `result_expired` to `true`, which distinguishes a discarded result from an empty one; a checkpointed result reads exactly like a function that returned nothing, so keep what you need to read back small. A finished execution is dropped entirely a day or so after its retention lapses, and reads and listings stop returning it — record anything you need to keep for longer while the execution is still readable.

`unknown` is rare and means what it says: the outcome cannot be established, so there is no outcome to report and no later poll will produce one. It is terminal for that reason, and it releases the concurrency slot the execution held. Its `completed_at` is when the platform gave up, not when the work ended. Treat it the way you would a lost response — check whatever the function was supposed to write, and start again under a new name if it did not.

Two things reach it. An execution that was under way and was never seen to finish, and a start that failed with a `500` without the platform establishing whether the execution began — the second is why a name whose start returned an error can later read as `unknown` rather than not being found. Retrying that start under the same name is still the safe move while it is the error you are holding: the retry converges on the original execution instead of running the work twice, and only settles as `unknown` if nothing ever retries it.

Retrying is worth doing even after the status reads `unknown`. A retry under the same name picks the same execution back up rather than starting a second one, and if the work was in fact running it becomes readable again. That retry needs a free concurrency slot, since an `unknown` execution gave its own up, and is refused with `429` if the project has none.

A start whose outcome could not be established is charged one durable execution. The work may be running, and the platform cannot ask — so the charge follows the claim the platform keeps rather than the response you received. Retrying it is not charged again, however many attempts it takes: the execution is charged once.

A `running` execution that is suspended on a wait costs nothing while it waits, so polling on a long interval is fine.

The SDK reads the same execution from a backend holding the platform token:

```javascript
const { data } = await volcano.durable.get(projectId, 'order-pipeline', executionId);

if (data.status === 'succeeded') {
  console.log(data.result);
}
```

### List executions

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions/$FUNCTION_ID/executions?status=running" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
      "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
      "name": "order-4417",
      "status": "running",
      "region": "us-east-1",
      "created_at": "2026-09-04T18:31:02Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "has_more": false
}
```

A listing returns the last status Volcano observed for each execution rather than polling every one, so fetch a single execution when you need its live state.

### Stop an execution

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions/$FUNCTION_ID/executions/$EXECUTION_ID/stop" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d",
  "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "name": "order-4417",
  "status": "running",
  "region": "us-east-1",
  "created_at": "2026-09-04T18:31:02Z"
}
```

The call is accepted rather than awaited. Cancellation happens behind it, so the response reports the execution as it was read back and often still says `running`; do not branch on that status. The execution settles into `stopped` shortly after, and polling is how you see it get there.

Stopping does not undo completed steps. Stopping one that already finished is not an error: the response carries the state it settled in, so a stop racing a `succeeded` reads back `succeeded`.

## Run one on a schedule

Durable functions take schedulers, on their own collection:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions/$FUNCTION_ID/schedulers" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nightly-reconcile",
    "schedule": { "kind": "cron", "cron_expression": "0 3 * * *" },
    "payload": { "reason": "nightly" }
  }'
```

```json
{
  "id": "2c9d1e0f-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
  "project_id": "b1d3f4a2-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
  "function_kind": "durable",
  "name": "nightly-reconcile",
  "enabled": true,
  "schedule_kind": "cron",
  "cron_expression": "0 3 * * *",
  "payload": { "reason": "nightly" },
  "regions": ["us-east-1"],
  "regions_explicit": false,
  "next_run_at": "2026-09-05T03:00:00Z",
  "run_count": 0,
  "created_at": "2026-09-04T19:02:18Z",
  "updated_at": "2026-09-04T19:02:18Z"
}
```

Each tick starts an execution rather than invoking the function, and gives it an execution name derived from the run, so a retried tick resolves to the execution it already started instead of doing the work twice. Everything else matches [Scheduled invocations](scheduled-invocations.md).

A schedule whose tick is still running when the next one is due starts a second execution; the concurrency cap is what bounds that. Give a long-running schedule an interval comfortably longer than the work.

Schedulers are a Pro capability: on Free the create answers `403`. Pro allows 5 per project, counted across durable and standard functions together, and the sixth answers `403` as well.

## Delete a durable function

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/durable-functions/$FUNCTION_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Returns `202` with an empty body; teardown continues after the response. Deleting takes the function's executions with it: they stop being readable and listable, and they stop counting against the concurrency cap.

The delete stops the executions still in flight, but not at a point you choose: stopping does not interrupt a step already running, so that step continues to its next checkpoint and the execution ends there. If you need to observe an execution ending, [stop](#stop-an-execution) it yourself and delete once it is terminal. History does not outlive the function either: its execution records go with it, whatever `retention_days` still had left, so export anything you need to keep before you delete.

## Local development

Durable functions run on your machine the same way they run deployed. Your handler and your `volcano-config.yaml` are identical in both places, so a function you get working locally deploys unchanged.

```bash
volcano start
volcano durable deploy --all
volcano durable start orders --input '{"order_id":"ord_123"}'
```

Three things differ locally, all deliberately:

- **A wait resolves immediately.** A function that waits a day is normal to write and unusable to sit through. Your function cannot tell — it still suspends, and still resumes with everything it had finished — but you get the answer in seconds. Set `LOCAL_DURABLE_REAL_TIME=true` to make waits take their real time.
- **There is one region.** Everything runs on the one local engine, so there is nothing to choose between.
- **Callbacks are not delivered.** Nothing local can call one back, so an execution that waits on one fails saying so rather than waiting for good. Deploy the function to run it.

Everything else behaves as it does deployed: steps checkpoint and replay, a failed step retries on its backoff, `ctx.map` and `ctx.parallel` fan out, `ctx.waitUntil` polls, usage is metered on the same three counters, and an execution suspended when you stop the local server resumes when you start it again.

See [Developing durable functions locally](../guides/durable-functions-locally.md) for a worked example.

## Project scope

Durable functions and their executions are reachable only through the project that owns them. An id belonging to another project answers `404`, the same as an id that does not exist — the response never reveals that the id is real elsewhere. That holds for the application start endpoint too: it resolves the function inside the project its credential belongs to, so another project's function id is `404` there as well.

The two function collections are separate in the same way. A standard function's id is `404` under `/durable-functions/...` and a durable function's id is `404` under `/functions/...`, including their deployments and schedulers.

Treat `404` on an execution as "not yours or not here" rather than "finished and cleaned up": a completed execution stays readable for its `retention_days` as long as its function does, so a `404` inside that window means the id is wrong, belongs to another project, or its function has been deleted. An execution id is only ever valid under the durable function that started it, so keep the pair together.

## Limits and billing

Durable executions are metered on three allowances of their own and spend nothing from the request allowance that function invocations and frontend requests share. An execution that ran for six hours and checkpointed a hundred times costs what it did, rather than one invocation.

**Executions** are counted per start. A start repeated under the same execution name is the same execution, so a client that retries is charged once.

**Operations** are what the execution did. One for the execution itself, and one more for everything it begins:

| Charged as an operation | Notes |
|---|---|
| The execution | One per execution, whatever it goes on to do |
| Each `ctx.step` attempt | A retried step is another attempt, so another operation |
| Each `ctx.wait` | One per wait, however long it lasts |
| Each `ctx.waitUntil` check | Size `maxAttempts` with this in mind: 200 checks is 200 operations |
| Each `ctx.child` context | Plus whatever the child itself does |
| Each `ctx.map` item and `ctx.parallel` branch | Each runs in a child context of its own |
| Each callback the execution waits on | One per callback, however long it stays outstanding |
| Each function an execution invokes from inside itself | One for making the call, on top of whatever the call costs |

Only beginning something is charged. How it turned out — a step that succeeded, a wait that elapsed, an execution that failed — is a record of work already counted, not a second operation.

**Compute** is the time your code is actually running, times the memory it runs at, in gigabyte-seconds. Your plan sets the memory, and every resume adds the time it held the runtime:

```text
compute = memory × (time running, summed over every resume)
```

Waiting is not running. An execution suspended in a `wait`, a `waitUntil` between checks, or a callback that has not arrived holds no runtime and adds nothing, which is why a `waitUntil` on a long interval is cheaper than a short one for the same reason it is kinder to whatever it polls. Wall-clock life is not charged either: an execution that spends a day parked and a second working is charged for the second. A resume replays what it already recorded rather than doing it again, and replay is fast, but it does run — the time it takes is part of the resume that carries it.

Operations and compute are both counted once an execution has finished, so a long execution's usage appears when it ends rather than as it runs.

| Limit | Free | Pro |
|---|---|---|
| Execution allowance | 5,000 / month | 10,000 / month |
| Operation allowance | 100,000 / month | 200,000 / month |
| Compute allowance | 10,000 GB-s / month | 100,000 GB-s / month |
| Memory | 128 MB | 1 GB |
| Operations per execution | 3,000 | 3,000 |
| Step timeout | 300 s | 900 s |
| Execution timeout | 366 days | 366 days |
| Result retention | 30 days | 30 days |
| Concurrent executions per project | 10 | 100 |
| Durable functions per project | 10,000 | 10,000 |

All three allowances are combined across your projects. Past any of them Free stops starting new executions and Pro bills the excess.

Memory comes from your plan rather than from the function, and a function picks up a plan change on its next deploy. More memory means proportionally more CPU, so a Pro execution both has more room and runs faster — and its compute is charged at the larger size, so the same work costs 8× the compute of Free's 128 MB against an allowance 10× larger.

The step timeout bounds one attempt between checkpoints, not the execution: a durable function outlives it by checkpointing and being resumed. The execution timeout bounds the whole execution, including time suspended in a wait.

In practice operations run out before the clock does. An execution gets 3,000 of them, and every step, wait and poll is one — so a workflow that polls hourly exhausts its operations after about four months, and one that waits a few times can sit for the best part of a year. An execution that needs more than 3,000 operations fails, so spread long work over fewer, larger steps and longer waits, or split it across executions.

The other thing a long execution holds is one of your concurrent execution slots, for as long as it runs. That cap, not the timeout, is what limits how much long-lived work a project can have in flight at once; `stop` is how you get a slot back early.

Because operations and compute are only known once an execution has finished, those allowances are applied to the next start rather than to work already under way. An execution running when one runs out is never interrupted: it finishes, and it is charged for what it did. The start that follows answers `429` with which allowance it hit, and spends no execution.

The number of executions in flight at once is capped per project, and a start beyond that cap answers `429` as well. An execution stops counting against the cap once it finishes, whether or not you ever read it. Fire-and-forget starts are safe: you do not have to poll an execution to release its slot.

Starting through the application endpoint goes through the same rate limit and the same CORS policy as a function invocation: on Free that is 100 starts per 10 seconds for one function and 600 across the project, and a browser start is refused when the project enforces CORS and the page's origin is not allowed. Both refuse before an execution begins — `429` for the rate limit, `403` for the origin — so neither spends an execution. The project-scoped owner endpoint is not rate limited.

Durable functions are counted against their own per-project cap, so they cannot exhaust the standard function cap or the other way round. See [Plans and limits](../guides/plans-and-limits.md).

## What's next

| Guide | Description |
|-------|-------------|
| [Functions overview](overview.md) | Standard functions, runtimes, and packaging |
| [Environment variables](environment-variables.md) | Configure secrets and settings |
| [Logs](logs.md) | View and filter function logs |
| [Plans and limits](../guides/plans-and-limits.md) | Free and Pro limits in full |
