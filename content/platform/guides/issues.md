---
title: "Issues"
description: "See the runtime errors your functions and frontends raise, grouped into issues you can resolve or ignore."
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
  are one issue.

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

| Parameter | Description |
|-----------|-------------|
| `status` | `open`, `resolved`, or `ignored` |
| `resource_id` | Only issues from this function or frontend |
| `limit` | Issues per page, 1 to 100. Default `10` |
| `cursor` | The previous page's `next_cursor`. Keep the same filters while paging |

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

| Status | Meaning |
|--------|---------|
| `open` | New, or seen again after it was resolved |
| `resolved` | Fixed. Reopens if the error happens again |
| `ignored` | Not worth fixing. Keeps counting, never reopens |

An issue resolved at `resolved_at` that is seen again after that moment
reopens as `open`, and `regressed_at` records when. Set `status` back to
`open` yourself to reopen it.

When you merge an [autofix](autofix.md) pull request, the issue resolves once a
deployment that includes the fix goes live, with `resolved_at` set to that
moment. Errors from the previous deployment while the fix rolls out do not
reopen it.

## Credentials

Platform tokens and project access tokens can list and read issues, including
read-only project tokens. Changing a status needs a token that can write.

Agents connected through the [MCP server](../interfaces/mcp.md) can call
`list_issues`.

## Errors

| Status | Code | When |
|--------|------|------|
| `400` | | A filter, the `limit`, the `cursor`, or the `status` is invalid |
| `404` | `feature_unavailable` | Issues are not available in this environment |
| `404` | | The project or issue does not exist, or belongs to someone else |
