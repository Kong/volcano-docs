---
title: "Function Schedulers API"
description: "Manage scheduled invocations that run a function on a recurring cron schedule."
---

Function schedulers are managed below a function:

- `GET /projects/:id/functions/:functionId/schedulers`
- `POST /projects/:id/functions/:functionId/schedulers`
- `GET /projects/:id/functions/:functionId/schedulers/:schedulerId`
- `PATCH /projects/:id/functions/:functionId/schedulers/:schedulerId`
- `DELETE /projects/:id/functions/:functionId/schedulers/:schedulerId`

[Durable functions](../functions/durable-functions.md) take schedulers on the same
routes below `/projects/:id/durable-functions/:functionId`, and a tick starts an
execution instead of invoking the function.

`GET /projects/:id/schedulers` lists every scheduler in the project, both kinds
together. Each one carries `function_kind`, which is `standard` or `durable`, and
tells you which collection to read the function back from.

Pass `function_kind` to list one kind only. Pagination totals and cursors follow
the filter, and a cursor from one kind is rejected for the other:

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/schedulers?function_kind=durable&limit=20" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "2c9d1e0f-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
      "function_id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b",
      "function_kind": "durable",
      "name": "nightly-reconcile",
      "enabled": true,
      "cron_expression": "0 3 * * *"
    }
  ],
  "limit": 20,
  "total": 1,
  "has_more": false
}
```

Any value other than `standard` or `durable` answers `400`.

Create request:

```json
{
  "name": "refresh-cache",
  "enabled": true,
  "schedule": {
    "kind": "cron",
    "cron_expression": "*/5 * * * *"
  },
  "payload": {
    "source": "scheduled"
  },
  "regions": ["us-east-1"]
}
```

`regions` is optional. If omitted, Volcano randomly chooses one deployed region and invokes the function in that region according to the cron schedule. The chosen region remains stable while it is still deployed; if geofencing removes it, Volcano randomly chooses one of the remaining deployed regions. Explicit regions must contain exactly one deployed region. Function schedulers never fan out to every deployed region; the per-region coverage Volcano runs to [keep runtimes ready](../functions/overview.md#response-time-on-the-first-invocation) is its own and is not a scheduler.

`schedule.cron_expression` must be a standard 5-field cron expression evaluated in UTC. Seconds fields, descriptors such as `@daily`, and Quartz-only syntax such as `?`, `L`, `W`, or `#` are not supported. Volcano validates that the schedule runs no more frequently than once per minute and at least once every 31 days.

At runtime, the function receives the configured `payload` as its event. Volcano adds `__volcano_schedule` metadata to the event with scheduler/run identifiers and the region that performed the invocation.
