---
title: "Function Logs"
description: "View historical and live execution logs for your functions."
---

View historical and live execution logs for your functions.

Read runtime and deployment logs with a platform token belonging to the project
owner or a project access token. A `read_only` project token is sufficient.
Project end-user sessions, anon keys, and service keys do not grant log access.
Keep project tokens on your server and rotate them through project token management.

For SDK examples, see [JavaScript](/sdk/js/logs), [Python](/sdk/python/logs),
and [Ruby](/sdk/ruby/logs).

## Runtime Logs

Use this endpoint for paginated historical runtime logs and text or
structured-field search:

```http
POST /projects/{id}/logs/search
Authorization: Bearer PLATFORM_TOKEN
Content-Type: application/json
```

Set `resource.type` to `function`. Omit `resource.ids` to return logs across all
functions in the project, or include one or more function IDs to return logs for
selected functions. A [durable function](durable-functions.md) is read the same
way, by its own ID; its runtime logs cover every execution, including what each
resume logged again. The `q` field is optional; leave it blank or omit it to list
stored logs using structured filters only.

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"]}}'
```

Set `resource.kind` to `durable` or `standard` to read one kind of function,
however many the project has:

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","kind":"durable"}}'
```

**Response:**

```json
{
  "data": [
    {
      "id": "log/us-east-1/01HKG3W9M0A5V7R2J6Z0Q6Y4S9",
      "timestamp": "2024-01-01T12:00:00Z",
      "level": "info",
      "body": {
        "message": "User logged in",
        "user_id": "usr_123"
      },
      "resource": {
        "type": "function",
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "login"
      },
      "region": "us-east-1"
    }
  ],
  "limit": 100,
  "has_more": true,
  "next_cursor": "eyJwayI6..."
}
```

Internal platform runtime logs are filtered out; only application logs emitted
by deployed functions are returned.

Historical log rows identify the owning function or frontend with a required
`resource` object. Deployment log rows include a `deployment` object when
available.

## Filtering

Supported request body fields:

| Field | Description |
| --- | --- |
| `resource.type` | Required. Use `function`. |
| `resource.ids` | Optional function IDs. Omit or pass an empty array to search all functions in the project. |
| `resource.kind` | Optional. `standard` or `durable` reads only functions of that kind; omit it for both. With `resource.ids`, IDs of the other kind return no logs. A cursor is bound to the kind. |
| `q` | Optional query. Unqualified terms search the body. Supports quoted text, implicit `AND`, `AND`/`OR`/`NOT`, parentheses, and the fields `body`, `level`, `region`, `invocation.id`, `resource.id`, and `resource.name`. The resource-name aliases `function`, `frontend`, and `database` are also supported. `level` accepts `trace`, `debug`, `info`, `warn`, `error`, and `fatal`, plus the aliases `log`, `information`, `warning`, `err`, and `critical`. |
| `limit` | Max records to return. Default `100`, max `1000`. |
| `cursor` | Opaque cursor from the previous response. |
| `start_time` | Inclusive lower bound as an RFC3339 timestamp. |
| `end_time` | Inclusive upper bound as an RFC3339 timestamp. |

```bash
# Find "checkout_failed" in warn and error logs in one region
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"]},"q":"level:(warn OR error) region:us-east-1 body:checkout_failed","start_time":"2024-01-01T12:00:00Z","end_time":"2024-01-01T13:00:00Z"}'
```

## Pagination

When `has_more` is true, pass the response `next_cursor` back as the `cursor`
field on the next request with the same filters. Keep paging until `has_more`
is false.

A search reads for a bounded time per request, so a page can hold fewer than
`limit` events, or none, while `has_more` is true. This happens most with
selective queries over a wide time range. Continue from `next_cursor` rather
than treating a short or empty page as the end of the results.

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function"},"limit":100}'

curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function"},"limit":100,"cursor":"eyJwayI6..."}'
```

## Activity

Count logs over time to draw a histogram. The request takes the same
`resource` and `q` fields as search:

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/activity" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function"},"q":"level:error","start_time":"2024-01-01T12:03:10Z","end_time":"2024-01-01T13:03:10Z","bucket_count":4}'
```

**Response:**

```json
{
  "data": [
    {
      "start_time": "2024-01-01T12:00:00Z",
      "end_time": "2024-01-01T12:30:00Z",
      "counts": {
        "levels": {"debug": 0, "error": 3, "fatal": 0, "info": 0, "trace": 0, "warn": 0},
        "regions": {"us-east-1": 3},
        "resource_ids": {"550e8400-e29b-41d4-a716-446655440000": 3}
      },
      "total": 3
    },
    {
      "start_time": "2024-01-01T12:30:00Z",
      "end_time": "2024-01-01T13:00:00Z",
      "counts": {
        "levels": {"debug": 0, "error": 1, "fatal": 0, "info": 0, "trace": 0, "warn": 0},
        "regions": {"us-east-1": 1},
        "resource_ids": {"550e8400-e29b-41d4-a716-446655440000": 1}
      },
      "total": 1
    },
    {
      "start_time": "2024-01-01T13:00:00Z",
      "end_time": "2024-01-01T13:30:00Z",
      "counts": {
        "levels": {"debug": 0, "error": 0, "fatal": 0, "info": 0, "trace": 0, "warn": 0},
        "regions": {},
        "resource_ids": {}
      },
      "total": 0
    }
  ],
  "total": 4
}
```

Buckets follow these rules:

- Counts cover the half-open window `[start_time, end_time)`. An event exactly
  at `end_time` is not counted.
- `bucket_count` is a maximum, `24` by default and at most `96`. Volcano picks
  the smallest width that covers the window in that many buckets, so a response
  can hold fewer buckets than requested.
- Widths come from a fixed set: 1s, 2s, 5s, 10s, 15s, 30s, 1m, 2m, 5m, 10m, 15m,
  30m, 1h, 2h, 3h, 6h, 12h, 1d, then whole days.
- Bucket edges fall on UTC multiples of the width, so they stay put as the
  window moves. The first and last buckets can extend past the window; they
  count only events inside it.
- `bucket_count: 1` returns one bucket that spans exactly the window.
- The window is limited to the plan's log retention (HOBBY: 1 day, SUPERAGENT: 30
  days). An older `start_time` is moved up to the retention limit.
- Counts across several resources or deployments come from Volcano's
  activity index. Logs from before a region's index began are not counted;
  search still returns them.

## Live Streaming

Use the stream endpoint to live-tail runtime or deployment logs:

```http
POST /projects/{id}/logs/stream
Authorization: Bearer PLATFORM_TOKEN
Content-Type: application/json
Accept: text/event-stream
```

The request body supports `resource`, `q`, `start_time`, and `limit`. The `q`
field uses the same syntax as search requests. Do not send `cursor` or
`end_time`; use `/logs/search` for range backfills.

```bash
curl -N -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/stream" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"]},"q":"level:error"}'
```

Each log event is sent as Server-Sent Events:

```text
id: STREAM_CURSOR
event: log
data: {"id":"LOG_EVENT_ID","timestamp":"2024-01-01T12:00:00Z","level":"info","body":"User logged in","resource":{"type":"function","id":"FUNC_ID","name":"login"},"region":"us-east-1"}
```

The SSE `id` field is an opaque stream cursor. To reconnect without replaying
recent events, send the most recent `id` as the `Last-Event-ID` header or
`last_event_id` query parameter. The log event's stable ID remains in
`data.id`.

The cursor is bound to the request body: `resource`, `q`, `start_time`, and
`limit` must match the original request when reconnecting. Resuming with a
changed body returns
`400` — open a new stream (without a cursor) for the new selector instead.

This is a live tail, not a gap-free backfill. On connect (or reconnect) the
server delivers at most `limit` of the most recent matching events from the
cursor position and then follows new events. If a stream stays disconnected
long enough for more than `limit` events to accumulate, the older events in
that gap are not replayed — use `/logs/search` to backfill a specific time
range.

The stream sends `: keepalive` comments while idle. If a transient read fails
after the stream is open, the server emits an `event: warning` payload and
continues retrying. The warning's `error` field carries a safe message;
internal failures are reported generically and logged server-side.

## Deployment Logs

Deployment build logs use the same project log search endpoint. Add a
`resource.deployments.ids` selector to read one or more deployments for the
selected function resources. New function and frontend builds show dependency
installation, project build and syntax-check output, concise progress, and
actionable errors. Platform setup, packaging, and publishing diagnostics stay
in internal operator logs. Existing historical logs are unchanged.

```http
POST /projects/{id}/logs/search
Authorization: Bearer PLATFORM_TOKEN
```

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"],"deployments":{"ids":["DEPLOYMENT_ID"]}},"limit":100}'
```

Use the same selector with `/logs/stream` to live-tail deployment logs.

Deployment log rows include deployment context:

```json
{
  "resource": {
    "type": "function",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "login"
  },
  "deployment": {
    "id": "8c6c7c2e-e3ff-42a5-ae4d-650ef9b45746"
  }
}
```

## Logging Best Practices

Use structured logging so important fields can be indexed:

```javascript
console.log(JSON.stringify({
  level: 'info',
  action: 'user_login',
  user_id: user.id,
  timestamp: new Date().toISOString()
}));
```

Use consistent log levels:

```javascript
console.log('INFO:', ...);
console.error('ERROR:', ...);
console.warn('WARN:', ...);
```

## See Also

- [Creating Functions](creating-functions.md)
- [Invoking Functions](invoking-functions.md)
