---
title: "Function Logs"
description: "View historical and live execution logs for your functions."
---

View historical and live execution logs for your functions.

Function runtime and deployment build log endpoints require a platform token
for the project owner. Tokens from other users cannot read logs for the project.

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
selected functions. The `q` field is optional; leave it blank or omit it to list
stored logs using structured filters only.

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"]}}'
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
| `q` | Optional query. Unqualified terms search the body. Supports quoted text, implicit `AND`, `AND`/`OR`/`NOT`, parentheses, and the fields `body`, `level`, `region`, `invocation.id`, `resource.id`, and `resource.name`. The resource-name aliases `function`, `frontend`, and `database` are also supported. |
| `limit` | Max records to return. Default `100`, max `1000`. |
| `cursor` | Opaque cursor from the previous response. |
| `start_time` | Inclusive lower bound as an RFC3339 timestamp. |
| `end_time` | Inclusive upper bound as an RFC3339 timestamp. |

```bash
# Find "checkout_failed" in warn and error logs in one region
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function","ids":["FUNC_ID"]},"q":"level:(warn OR error) region:us-east-1 body:checkout_failed","start_time":"2024-01-01T12:00:00Z","end_time":"2024-01-01T13:00:00Z"}'
```

## Pagination

When `has_more` is true, pass the response `next_cursor` back as the `cursor`
field on the next request with the same filters.

```bash
curl -X POST ".../logs/search" \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function"},"limit":100}'

curl -X POST ".../logs/search" \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":{"type":"function"},"limit":100,"cursor":"eyJwayI6..."}'
```

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
  -H "Authorization: Bearer PLATFORM_TOKEN" \
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
selected function resources. Frontend logs include customer build output and
stable platform errors with a support ID. They exclude platform commands,
paths, and stack traces.

```http
POST /projects/{id}/logs/search
Authorization: Bearer PLATFORM_TOKEN
```

```bash
curl -X POST "https://api.volcano.dev/projects/PROJECT_ID/logs/search" \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
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
