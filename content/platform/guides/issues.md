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
      "source": "runtime",
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

Writing an issue rolls out separately: check the `issues.create` entry before
offering it. Where it's not available, writing an issue answers the same `404`,
and the issues already written still read and update.

Issues, and writing them, are always available in local mode.

## What becomes an issue

An issue starts from a runtime log line at `error` or `fatal` level from a
function or frontend. Build output is grouped only into
[build issues](#failed-builds), with LavaFlow on.

Volcano groups errors by:

- **Error type and stack.** An uncaught exception, or an error you log with
  its stack, is grouped by its type and the frames in your own code. Line
  numbers and frames in dependencies and the runtime are ignored, so an edit
  or an upgrade that shifts them does not split an issue. A Python function's
  dependencies deploy beside your code, so their frames count as yours. Stack
  frames come only from the stack: the frames the runtime writes for the
  error, up to the first line that isn't a frame. A chained Python
  traceback groups by the traceback of the exception it reports, apart from
  that traceback printed alone.
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
  `console.error({ err })` did (`stackTrace`). Otherwise the message is the
  first of `message`, `msg`, `error`, `err`, and `errorMessage` that is a
  string, or an object with a `message`, and it groups as the same text
  would. A top-level `stack` or `stack_trace` groups it by its frames. The
  error type is the first of `error_type`, `errorType`, the `error` or `err`
  object's `name` or `type`, `name`, and `type` that ends in `Error` or
  `Exception`, such as `CardError`. Other fields are ignored. An object with
  no message or stack groups by its top-level field names, with each value
  replaced: `{"event":"sync","count":3,"job":{"id":"j_1"}}` is titled
  `{"event":<str>,"count":<n>,"job":{...}}`, and an object with other
  top-level fields is another issue. A line whose own `level` is below
  error, such as pino's `40`, `"warn"`, or winston's `"verbose"`, is not an
  issue. An error you log this way is a separate issue from the same error
  thrown.
- **Printed tracebacks.** A Python traceback you log as text, such as
  `traceback.format_exc()`, groups by its type and frames. Like a structured
  log, it is a separate issue from the same error raised.

`exception` is `true` when an issue holds an exception: one your code threw, or
one it logged with `console.error(err)` or Python's `logger.exception()`. In a
Node.js function, an uncaught exception or an unhandled promise rejection that
crashes the runtime counts as one, grouped with the same error thrown. On
Node.js 24, that needs a handler named `file.export`, where `file` is a `.js`,
`.mjs`, or `.cjs` file; any other handler's crash appears only as the lines
Node prints, and their heading, such as `TypeError: Cannot read properties of
undefined`, is an issue grouped by its message. It is `false` for an issue
grouped only from messages, structured logs, or printed tracebacks, and for
every `code_quality` issue. It is `true` for every `build` issue. Once `true`,
it stays `true`.

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

A function you bundle and minify yourself, as `esbuild --minify` does, also
gets new names for its functions and classes on every build. When a stack runs
through a JavaScript file with a name a minifier writes, one or two characters
such as `k4` or `$9`, Volcano groups that file's frames by the file alone, and
a class with such a name counts as one renamed type, so a redeploy does not
split an issue. The `culprit` names the file. As in a frontend's build, the
message counts only in a shape JavaScript itself writes, so every other message
of a renamed class, or of one built-in type, merges into one issue per
function. To keep them apart and get readable titles, build with esbuild's
`--keep-names` or your bundler's equivalent, which keeps your functions' and
classes' names.

When this grouping first applies, each existing issue of a minified function
moves once to a new issue: it gets a new ID, alerts once as new, and starts a
fresh LavaFlow run budget. After that, redeploys keep it. A function or project
at its open-issue bound records the moved errors only once it has room; resolve
the old issues to make room.

A function written in
[TypeScript](../functions/creating-functions.md#typescript) groups by the
frames of its `.ts` files, which its stack traces name through source maps.
A TypeScript function built before Volcano wrote source maps named its compiled
`index.cjs` or `index.mjs` instead, so its first redeploy since moves each of
its existing issues once to a new issue, as above. The old issues, named by
the compiled module, stay open and count toward the open-issue bounds until
you resolve them, so resolve them after that redeploy. A TypeScript function that
[compiles without a source map](../functions/creating-functions.md#typescript),
or that sets `NODE_OPTIONS=--no-enable-source-maps`, groups by its compiled
module, so a change that switches it between the two moves its issues the same
way.

Issues are kept per function or frontend: the same error in two functions is
two issues.

A project keeps at most 1,000 open issues, and each function or frontend at
most 250 of them. A function or frontend also opens at most 50 new issues an
hour. Past any of these bounds, errors that would start a new issue are not
recorded, while existing issues keep counting, and a resolved issue whose error
returns reopens even past a bound. Resolve or ignore issues to make room under
the open-issue bounds; the hourly bound counts every issue opened in the hour,
resolved or not, and makes room as the hour passes. `code_quality` issues never
count toward these bounds, so they never take the place of an error or a
reported problem.

The `title` is that normalized message, prefixed with the error type. The raw
log line stays in your logs; `sample_event_id` and `sample_event_at` point to
the latest occurrence while your logs retain it. See
[Logs](../functions/logs.md).

`event_count` can overcount: an error that Volcano has to deliver twice is
counted twice, and the count stays that way.

`source` is `runtime` for these issues, and `report` for a problem reported for
the project, such as through Slack. With [Code Quality](lavaflow.md#code-quality)
on, LavaFlow also files the problems it finds in code a deploy changed as
issues with `source: "code_quality"`. Their `error_type` is the finding's rule,
their `culprit` the enclosing function and file, and their `event_count` the
scans that found them. Each carries its `finding`:

```json
{
  "source": "code_quality",
  "finding": {
    "rule": "null-dereference",
    "severity": "major",
    "commit_sha": "4f2c9e1b7d3a5c8e0f6b2d4a9c1e3f5a7b9d0c2e",
    "path": "src/checkout.js",
    "start_line": 42,
    "end_line": 44,
    "explanation": "cart is undefined when the session has expired, so cart.items throws."
  }
}
```

The lines are in `commit_sha`, the deployed commit the scan found the problem
in. When an explanation holds one of your project's secret values or a secret
that gitleaks' default rules detect, `explanation` reads
`Hidden: this field matched a secret.` in place of all of it. A `runtime` issue
has no `finding`.

## Failed builds

With [LavaFlow](lavaflow.md) on, a deploy of a function or frontend that fails
in your own build step files an issue with `source: "build"`: your build
command, the TypeScript compile, or the check for your handler file. Build issues are in preview and are not available in every
environment yet.

```json
{
  "source": "build",
  "resource": { "type": "frontend", "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "name": "storefront" },
  "title": "Type error: Type 'string' is not assignable to type 'number'.",
  "error_type": "Type error",
  "culprit": "app/cart/page.tsx:14",
  "exception": true,
  "event_count": 1,
  "last_deployment_id": "7f2a1d3b-0c4e-4a6f-9b8d-2e3f4a5b6c7d"
}
```

- `title` is the build's first error, and `error_type` the tool's code for it,
  such as `Type error` or `TS2322`. A function's TypeScript
  compile doesn't check types, so a type error fails a function's build only
  when your own build command runs `tsc`. A build log with no error Volcano can read
  is titled `The build failed without an error LavaFlow could read`.
- `culprit` is the error's file and line, relative to the directory the build
  ran in: your repository's root, or the function's or frontend's root directory.
- `last_deployment_id` is the latest failed deployment, whose build log has
  the whole error.
- `event_count` counts the failed deploys. The same error from the same
  function or frontend is one issue, however its line numbers move.
- A later deploy of the function or frontend that builds resolves its open
  build issues. A failure after that reopens the issue.

A deploy that fails for a reason of Volcano's, such as a build that timed out,
was stopped, or never started, files no issue. Neither does a failed dependency
install, since a registry outage and a missing package look alike, nor a
failure to reach your package registry from your build command.

A build issue starts a [LavaFlow run](lavaflow.md#when-runs-start) at once.
Build issues count toward the project's 1,000 open issues, but not toward a
function's or frontend's bounds.

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
| `source`      | `runtime`, `code_quality`, `build`, `report`, or `request`            |
| `limit`       | Issues per page, 1 to 100. Default `10`                               |
| `cursor`      | The previous page's `next_cursor`. Keep the same filters while paging |

Get one issue:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## Write an issue

Describe something to fix in your own words, and Volcano records it as an
issue with `source` `request`, on the project itself. Name the project in
`project_id`:

```bash
curl -X POST "https://api.volcano.dev/issues" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "description": "The cart total ignores coupons.\nApply the coupon before tax."}'
```

```json
{
  "id": "9b1e7c3a-2d4f-4e6a-8c1b-3f5d7e9a0b2c",
  "project_id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
  "resource": {
    "type": "project",
    "id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
    "name": "shop"
  },
  "title": "The cart total ignores coupons.",
  "description": "The cart total ignores coupons.\nApply the coupon before tax.",
  "status": "open",
  "source": "request",
  "exception": false,
  "event_count": 0,
  "first_seen_at": "2026-11-13T15:02:10Z",
  "last_seen_at": "2026-11-13T15:02:10Z",
  "created_at": "2026-11-13T15:02:10Z",
  "updated_at": "2026-11-13T15:02:10Z"
}
```

| Field         | Description                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `project_id`  | Required. The project to write the issue on                                                                                               |
| `description` | Required. What to fix, up to 4,000 characters, across as many lines as you need. Leading and trailing whitespace is trimmed               |
| `title`       | Optional. Up to 200 characters, on one line. Without it, the title is the description's first line, cut to 80 characters with an ellipsis |

The response is `201` with the issue. With [LavaFlow](lavaflow.md) on, LavaFlow
starts a run on it by itself, as it does on a new error: the run follows your
LavaFlow settings, counts toward the run limits, and reads your description in
place of logs. The issue resolves when its LavaFlow fix merges.

Follow the run with `GET /lavaflow/runs?project_id=…&issue_id=…`. Where
none starts, such as while LavaFlow is off for the project, start one yourself
with [`POST /lavaflow/runs`](lavaflow.md#start-a-run); LavaFlow doesn't start
one later on its own.

Only the project's owner can write an issue, signed in with `volcano login` or
with a platform token that expires, as only they can start a run: LavaFlow
starts one on the issue by itself, which sends its description to an AI
service with your source and counts toward your run limits. A project access
token or MCP is refused with `person_required` first, even where writing issues
isn't available. A written issue counts toward the project's 1,000 open issues.

In local mode, LavaFlow never runs, so your local token writes issues as it is.

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
reopens as `open`, and `regressed_at` records when. A reported problem or a
written issue has no errors to watch, so it resolves when its LavaFlow fix
merges. When Volcano
deletes a report before any fix merged, it ignores the report's issue; a fix
that merges later still resolves it. Set `status` back to `open` yourself to
reopen an issue.

When a [LavaFlow](lavaflow.md#after-a-fix-merges) fix merges and goes live,
LavaFlow resolves the issue for you, unless the deployment's
[reported commit](deployment-source.md#commit) has `verification: repository`;
resolve that one yourself. With LavaFlow on, an issue with
`exception: true` that reopens because the error happens again starts a new
LavaFlow run. Reopening an issue yourself doesn't start one;
[start a run](lavaflow.md#start-a-run) on any issue yourself instead.

## Credentials

Platform tokens and project access tokens can list and read issues, including
read-only project tokens. Changing a status needs a token that can write.
Writing an issue needs the project's owner as a person: a `volcano login`
token whose sign-in is live, or a platform token that expires. Project access
tokens and MCP can't write issues.

Agents connected through the [MCP server](../interfaces/mcp.md) can call
`list_issues` and `get_issue`.

## Errors

| Status | Code                       | When                                                                                                                                                        |
| ------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                            | A filter, the `limit`, the `cursor`, or the `status` is invalid                                                                                             |
| `400`  |                            | A written issue's `project_id` isn't a UUID, its `description` is missing, its `description` or `title` is blank or too long, or the body has another field |
| `403`  | `person_required`          | Writing an issue with a full-scope project access token, MCP, a platform token that never expires, or a sign-in that ended                                  |
| `403`  |                            | Writing an issue with a read-only project access token or a read-only account                                                                               |
| `404`  | `feature_unavailable`      | Issues are not available in this environment                                                                                                                |
| `404`  | `feature_unavailable`      | Writing an issue is not available in this environment                                                                                                       |
| `404`  |                            | The project or issue does not exist, or belongs to someone else                                                                                             |
| `409`  | `open_issue_limit_reached` | The project has 1,000 open issues; resolve or ignore some before writing another                                                                            |
| `413`  |                            | A written issue's body is larger than 64 KiB                                                                                                                |
