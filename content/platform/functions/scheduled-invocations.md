---
title: 'Scheduled Function Invocations'
description: 'Scheduled invocations let a function run automatically on a cron schedule without creating per-function infrastructure.'
---

Scheduled invocations let a function run automatically on a cron schedule without creating per-function infrastructure. Volcano stores schedules centrally and regional workers invoke the deployed function in each allowed region.

## Create A Scheduler

```bash
curl -X POST "$VOLCANO_API_URL/projects/$PROJECT_ID/functions/$FUNCTION_ID/schedulers" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "refresh-cache",
    "schedule": { "kind": "cron", "cron_expression": "*/5 * * * *" },
    "payload": { "reason": "scheduled-refresh" }
  }'
```

If `regions` is omitted, the scheduler randomly chooses one deployed region when the scheduler is created. It keeps using that region as long as the function remains deployed there. If geofencing later removes that region, Volcano randomly chooses one of the remaining deployed regions. Function schedulers are intentionally not fanout schedulers; they do not invoke the same function simultaneously in every deployed region.

Cron expressions use standard 5-field syntax and are evaluated in UTC. Seconds fields, descriptors such as `@daily`, and Quartz-only syntax are not supported. Schedules must run no more frequently than once per minute and at least once every 31 days.

[Durable functions](durable-functions.md) take schedulers too, on their own `durable-functions` collection and with the same request shape. Each tick starts an execution instead of invoking the function; the two collections do not accept each other's function ids.

## Explicit Regions

```json
{
  "name": "regional-refresh",
  "schedule": { "kind": "cron", "cron_expression": "0 * * * *" },
  "regions": ["us-east-1"],
  "payload": { "source": "scheduled" }
}
```

Every requested region must already have the function deployed. Function schedulers accept at most one explicit region. Requests for non-deployed regions or multiple regions are rejected. [Keeping runtimes ready](overview.md#response-time-on-the-first-invocation) is not a scheduler and does not follow this rule: Volcano runs it itself, in every deployed region, and it never calls your handler.

## Manage Schedulers

```bash
volcano cloud functions schedulers list my-function
volcano cloud functions schedulers create my-function --cron "*/5 * * * *" --payload payload.json
volcano cloud functions schedulers disable my-function <scheduler-id>
volcano cloud functions schedulers delete my-function <scheduler-id>
```

Schedulers are disabled or removed when their target function is deleted. When project region policy shrinks, scheduler rows for removed regions are disabled so stale regional workers cannot keep invoking removed functions.

Scheduled invocations are a **SUPERAGENT** feature. On the HOBBY plan a scheduler is kept
but stops firing — no runs are recorded, and its next run time keeps advancing —
so an upgrade resumes it on its own cadence. See
[moving from SUPERAGENT to HOBBY](../guides/plans-and-limits.md#moving-from-superagent-to-hobby).
Creating one on HOBBY answers `403`. SUPERAGENT allows 100 per project, counted across
standard and [durable](durable-functions.md) functions together, and a create
past the cap answers `403` as well.

Scheduled invocations deliver your configured payload as the function event. Volcano also injects `__volcano_schedule` with `scheduler_id`, `run_id`, `job_id`, `project_id`, `target_id`, `job_type`, and `region` so functions can distinguish manual and scheduled invocations.

The top-level `__volcano_auth` and `__volcano_http` keys are reserved. Volcano removes them from your configured payload, so a schedule can never present a caller identity or HTTP-ingress context to the function.

## Scheduler health

Each scheduler reports whether its runs are working. Here `sync-orders` is a
durable function whose executions keep throwing:

```bash
volcano cloud durable schedulers list sync-orders
```

```text
ID                                    Name                      State      Health    Fails  Cron             Next Run              Last Run
---------------------------------------------------------------------------------------------------------------------------------------------------
2c9d1e0f-3a4b-4c5d-8e9f-0a1b2c3d4e5f  hourly-sync               enabled    failing   49     0 * * * *        2026-10-19T16:00:00Z  12m ago
  last error: TypeError: Cannot read properties of undefined (reading 'rows')
```

The API returns the same state in `health`, `consecutive_failures`,
`last_run_status`, `last_success_at`, and `last_failure_at`. See
[Function Schedulers API](../api-reference/function-schedulers.md#health).

A standard function's run fails when Volcano cannot invoke it, for example
because it is not deployed in the scheduler's region. Volcano retries that
tick every minute, and each attempt is a failed run. An error the handler
returns or throws does not count. When Volcano cannot deliver a tick, such as
during an outage, it retries the tick every minute, and its attempts count
against the scheduler once 15 minutes have passed since its first attempt. A durable function's run fails when the
execution it started fails, times out, or is stopped, so schedule a
[durable function](durable-functions.md#run-one-on-a-schedule) when an error in
the job itself must mark the run failed.

By default the project owner gets an email after 3 failed runs in a row, and
another when the scheduler recovers. To turn email off, add a webhook, or
alert on the first failure, see [Notifications](../projects/notifications.md).

## Account access holds

Scheduled invocations and automatic runtime warming stop while the owner is
inactive, pending account deletion, or restricted to read-only access by Billing.
Missed occurrences are skipped and are not replayed when access is restored;
the schedule resumes at its next occurrence. A plan-limit hold follows the
plan’s existing traffic allowance rules.
