---
title: 'Issues'
description: 'See the runtime errors your functions and frontends raise, grouped into issues you can resolve or ignore.'
---

Volcano groups the errors your functions and frontends log at runtime into
issues. Each issue is one problem: every occurrence of the same error type
thrown from the same place in your code, or of the same message when there is
no stack trace. You see how often it happened, when it started, and whether
it came back after you fixed it.

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/issues?status=open" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
      "project_id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
      "resource": {
        "type": "function",
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "checkout"
      },
      "title": "TypeError: Cannot read properties of undefined (reading <str>)",
      "error_type": "TypeError",
      "culprit": "chargeCustomer (src/payments.js)",
      "status": "open",
      "exception": true,
      "event_count": 42,
      "first_seen_at": "2026-10-13T09:12:04Z",
      "last_seen_at": "2026-10-13T11:47:31Z",
      "last_region": "us-east-1",
      "sample_event_id": "01JA7Q9X5V2M8K3N4P6R7S8T9U",
      "sample_event_at": "2026-10-13T11:47:31Z",
      "created_at": "2026-10-13T09:12:05Z",
      "updated_at": "2026-10-13T11:47:33Z"
    }
  ],
  "limit": 10,
  "has_more": false
}
```

## Check availability

Issues are in preview and are not available in every environment. Check
`GET /capabilities` for the `issues` entry before offering them. Where they
are not available, every issues endpoint answers `404`:

```json
{ "error": "issues are not available", "code": "feature_unavailable" }
```

Issues are always available in local mode.

## What becomes an issue

An issue starts from a runtime log line at `error` or `fatal` level from a
function or frontend. Build output is never grouped.

Volcano groups errors by:

- **Error type and stack.** An uncaught exception, or an error you log with
  its stack, is grouped by its type and the frames in your own code. Line
  numbers and frames in dependencies and the runtime are ignored, so an edit
  or an upgrade that shifts them does not split an issue. A Python function's
  dependencies deploy beside your code, so their frames count as yours.
- **Message.** Without a stack, the message is the key. Values that change on
  every occurrence, such as quoted values, IDs, numbers, timestamps, emails,
  IP addresses, and URLs, are replaced with placeholders like `<str>`,
  `<id>`, and `<n>`, so `user 'alice' not found` and `user 'bob' not found`
  are one issue. Short IDs such as `u20001` and `user_42` count as values,
  while numbered names such as `sha256`, `utf8`, and `http2` stay as written.
- **Structured logs.** A JSON object logged at `error` level, such as
  `console.error(JSON.stringify(entry))`, is read for its error. An `err` or
  `error` object with a stack groups by it and is named by its type and
  message, whether pino and bunyan serialized the `Error` (`stack`) or
  `console.error({ err })` did (`stackTrace`). Otherwise the `message`,
  `msg`, `error`, or `err` string, or that object's `message`, is the message,
  and a top-level `stack` groups it. Other fields are ignored. An object with
  none of these groups by its JSON text, with its quoted strings, keys
  included, and its numbers replaced, so objects of the same shape are one
  issue. A line whose own `level` is below error, such as pino's `40`,
  `"warn"`, or winston's `"verbose"`, is not an issue. An error you log this
  way is a separate issue from the same error thrown.
- **Printed tracebacks.** A Python traceback you log as text, such as
  `traceback.format_exc()`, groups by its type and frames. Like a structured
  log, it is a separate issue from the same error raised.

`exception` is `true` when an issue holds an exception: one your code threw, or
one it logged with `console.error(err)` or Python's `logger.exception()`. It is
`false` for an issue grouped only from messages, structured logs, or printed
tracebacks, and once `true`, it stays `true`.

In local mode, output a function writes to stderr without a level of its own is
at `error` level, so only an exception becomes an issue: one your code threw or
passed to the logger. A message, a structured log, or a printed traceback does
not.

A frontend's server code runs from the build Next.js generates, where every
build renames functions and moves code between files. Volcano groups its errors
by type and the outermost route or page file of the build in their stack, such
as `.next/server/app/checkout/route.js`, so a redeploy does not split an issue.
The `culprit` names that file. A message can carry a request's values, so it
counts only in a shape JavaScript itself writes, with those values removed:
`x.map is not a function` (and `is not a constructor` or `is not iterable`),
`Cannot read properties of undefined`, and `Class constructor X cannot be
invoked without 'new'`. Without source maps, Volcano can't tell more errors in
one file apart, so these merge into one issue:

- in one route, the same error on different properties, such as
  `(reading 'id')` and `(reading 'total')`;
- in one route, every other message of one type, such as every `Error` your
  code throws; custom classes the build renames count as one type;
- in a chunk the build shares between routes, such as a server action's
  `.next/server/chunks/918.js`, the same errors across every route that runs
  it.

Code your routes share, such as an auth wrapper, can build into one route's
file; when it wraps other routes' handlers, their errors group under that file.
A stack whose route lies past the 10 frames Node.js records groups by its
outermost chunk. A Turbopack build, such as `next build --turbopack`, runs your
routes from chunks too, so its errors group by chunk the same way. webpack and
Turbopack chunks keep their names across deploys, so they keep routes in
different chunks apart. A deploy that regroups chunks, as one that adds a route
can, renames some of them, and their errors start a new issue.

Issues are kept per function or frontend: the same error in two functions is
two issues.

A project keeps at most 1,000 open issues. Past that, errors that would start
a new issue are not recorded, while existing issues keep counting. Resolve or
ignore issues to make room.

The `title` is that normalized message, prefixed with the error type. The raw
log line stays in your logs; `sample_event_id` and `sample_event_at` point to
the latest occurrence while your logs retain it. See [Logs](../functions/logs.md).

`event_count` can overcount: an error that Volcano has to deliver twice is
counted twice, and the count stays that way.

## Find issues

List a project's issues, most recently seen first:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/issues?limit=20" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

| Parameter     | Description                                                           |
| ------------- | --------------------------------------------------------------------- |
| `status`      | `open`, `resolved`, or `ignored`                                      |
| `resource_id` | Only issues from this function or frontend                            |
| `limit`       | Issues per page, 1 to 100. Default `10`                               |
| `cursor`      | The previous page's `next_cursor`. Keep the same filters while paging |

Get one issue:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## Resolve or ignore an issue

Set `status` to `resolved` once you have shipped a fix, or to `ignored` for an
error you do not plan to fix:

```bash
curl -X PATCH "https://api.volcano.dev/projects/$PROJECT_ID/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

```json
{
  "id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
  "status": "resolved",
  "resolved_at": "2026-10-13T12:02:10Z",
  "event_count": 42
}
```

The response is the whole issue; it is shortened here.

| Status     | Meaning                                         |
| ---------- | ----------------------------------------------- |
| `open`     | New, or seen again after it was resolved        |
| `resolved` | Fixed. Reopens if the error happens again       |
| `ignored`  | Not worth fixing. Keeps counting, never reopens |

An issue resolved at `resolved_at` that is seen again after that moment
reopens as `open`, and `regressed_at` records when. Set `status` back to
`open` yourself to reopen it.

## Credentials

Platform tokens and project access tokens can list and read issues, including
read-only project tokens. Changing a status needs a token that can write.

Agents connected through the [MCP server](../interfaces/mcp.md) can call
`list_issues` and `get_issue`.

## Errors

| Status | Code                  | When                                                            |
| ------ | --------------------- | --------------------------------------------------------------- |
| `400`  |                       | A filter, the `limit`, the `cursor`, or the `status` is invalid |
| `404`  | `feature_unavailable` | Issues are not available in this environment                    |
| `404`  |                       | The project or issue does not exist, or belongs to someone else |
