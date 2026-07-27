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

`regions` is optional. If omitted, Volcano randomly chooses one deployed region and invokes the function in that region according to the cron schedule. The chosen region remains stable while it is still deployed; if geofencing removes it, Volcano randomly chooses one of the remaining deployed regions. Explicit regions must contain exactly one deployed region. Function schedulers do not fan out to every deployed region; internal frontend warmers are the separate fanout use case.

`schedule.cron_expression` must be a standard 5-field cron expression evaluated in UTC. Seconds fields, descriptors such as `@daily`, and Quartz-only syntax such as `?`, `L`, `W`, or `#` are not supported. Volcano validates that the schedule runs no more frequently than once per minute and at least once every 31 days.

At runtime, the function receives the configured `payload` as its event. Volcano adds `__volcano_schedule` metadata to the event with scheduler/run identifiers and the region that performed the invocation.
