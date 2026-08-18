---
title: "Scheduled Function Invocations"
description: "Scheduled invocations let a function run automatically on a cron schedule without creating per-function infrastructure."
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

## Explicit Regions

```json
{
  "name": "regional-refresh",
  "schedule": { "kind": "cron", "cron_expression": "0 * * * *" },
  "regions": ["us-east-1"],
  "payload": { "source": "scheduled" }
}
```

Every requested region must already have the function deployed. Function schedulers accept at most one explicit region. Requests for non-deployed regions or multiple regions are rejected. Platform frontend warmers are the exception: they create internal warmer jobs in every deployed frontend region.

## Manage Schedulers

```bash
volcano functions schedulers list my-function
volcano functions schedulers create my-function --cron "*/5 * * * *" --payload payload.json
volcano functions schedulers disable my-function <scheduler-id>
volcano functions schedulers delete my-function <scheduler-id>
```

Schedulers are disabled or removed when their target function is deleted. When project region policy shrinks, scheduler rows for removed regions are disabled so stale regional workers cannot keep invoking removed functions.

Scheduled invocations deliver your configured payload as the function event. Volcano also injects `__volcano_schedule` with `scheduler_id`, `run_id`, `job_id`, `project_id`, `target_id`, `job_type`, and `region` so functions can distinguish manual and scheduled invocations.
