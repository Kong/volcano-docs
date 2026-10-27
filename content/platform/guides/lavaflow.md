---
title: 'LavaFlow'
description: "Have AI diagnose your project's issues and open draft pull requests that fix them."
---

LavaFlow uses AI to diagnose the [issues](issues.md) your functions and
frontends raise, from their logs and deployed source, and, when you allow it,
opens a draft pull request with a fix in the project's connected repository.
Volcano picks and runs the models, so there is no model or API key to set up.

Turn it on, and an issue starts a run that diagnoses it when it happens a
second time, or when it comes back after you resolved it, within
[LavaFlow's run limits](#run-limits). Runs start on their own for exceptions
your code throws or logs with `console.error(err)` or Python's
`logger.exception()`. An error logged another way becomes an issue but doesn't
start a run on its own, such as pino's or winston's error lines, a JSON log line
you write, or a traceback you print; [start one yourself](#diagnose-an-issue).
During the preview, LavaFlow needs the SUPERAGENT plan. A run also opens a draft
pull request with the fix when:

- the project has a connected GitHub repository;
- a push to that repository built the deployment where the issue happened, or
  the deploy client reported a commit that Volcano verified with `dirty: false`
  (see [Commit](deployment-source.md#commit));
- the Volcano GitHub App can write **Contents** and **Pull requests** in that
  repository (see [Grant the GitHub App access](#grant-the-github-app-access)).

Otherwise a run stops at the diagnosis and says why in
[`pull_request_skipped`](#why-a-run-opened-no-pull-request).

```bash
curl -X PATCH "https://api.volcano.dev/projects/$PROJECT_ID/lavaflow" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

```json
{
  "enabled": true,
  "max_stage": "pull_request",
  "auto_trigger": true,
  "plan_allows_lavaflow": true,
  "updated_at": "2026-10-13T12:20:41Z"
}
```

## Check availability

LavaFlow is in preview and is not available in every environment. Check
`GET /capabilities`: while `lavaflow` is `available`, you can turn LavaFlow on and
start runs. Without it, both answer `404` with code `feature_unavailable`.

Where LavaFlow is not available, settings a project already saved and its runs
stay readable, and you can still turn LavaFlow off or change settings that
leave it off. A project that never saved
settings gets `404` with code `feature_unavailable`.

During the preview, LavaFlow needs the SUPERAGENT plan. It is not available in
local mode, where the endpoints answer `501`.

## Settings

| Field          | Values                                                                                                 | Default        |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| `enabled`      | Whether Volcano diagnoses the project's issues                                                         | `false`        |
| `max_stage`    | `diagnose` stops at a root-cause diagnosis. `pull_request` may also open a draft pull request          | `pull_request` |
| `auto_trigger` | Whether a recurring or regressed issue starts a run on its own. Otherwise runs start only when you ask | `true`         |

`PATCH` changes only the fields you send. A field you omit keeps its saved
value, or takes its default when the project never saved settings. Turn LavaFlow
on and off, and set `max_stage` or `auto_trigger` to stop at a diagnosis or
start runs only on request, through this API or [`volcano-config.yaml`](../projects/configuration.md).

Read the settings back:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/lavaflow" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A project that never saved settings returns the defaults.

## Diagnose an issue

Start a run for an issue:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/issues/$ISSUE_ID/lavaflow-runs" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
  "project_id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
  "trigger": {
    "type": "issue",
    "reason": "manual",
    "issue": {
      "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
      "title": "TypeError: Cannot read properties of undefined (reading <str>)"
    }
  },
  "status": "queued",
  "max_stage": "pull_request",
  "created_at": "2026-10-13T12:31:02Z"
}
```

`trigger` says what started the run. Every run today has `type` `issue`, and
`reason` is `manual`, `new_issue`, or `regression`. Other kinds of trigger will
carry their own fields, so treat a `type` you do not recognize as another kind
of run rather than an error.

With `auto_trigger` on, a new issue starts a run on its own when it happens a
second time, and an issue that comes back after you resolved it starts one
right away, or an hour after the issue's last run if that was more recent.
Only an open issue starts one: an issue you ignored or resolved does not, and
a new issue you already ran yourself starts none.
Only exceptions count: one your code threw, or one it logged with
`console.error(err)` or Python's `logger.exception()`. An error logged any
other way does not, even with its stack, such as
`console.error(JSON.stringify(entry))`, an error line from pino, bunyan, or
winston, or a Python traceback you print as text. Neither does a line that
only reads like an error, such as `console.log("request failed")`.

Poll the run until `status` is `succeeded`, `failed`, or `canceled`:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/lavaflow-runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
  "status": "succeeded",
  "stage_reached": "diagnose",
  "commit_sha": "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  "commit_origin": "push",
  "diagnosis": {
    "summary": "Checkout reads the cart total before the cart loads.",
    "root_cause": "getCart in src/cart.js returns undefined for an expired session, and handler in src/checkout.js reads cart.total without a check.",
    "evidence": [
      {
        "kind": "log",
        "detail": "TypeError: Cannot read properties of undefined (reading 'total')",
        "location": "2026-10-13T12:29:14Z"
      },
      { "kind": "code", "detail": "cart.total read without a check", "location": "src/checkout.js:12" }
    ],
    "suggested_fix": "Return 404 from handler when getCart returns undefined.",
    "confidence": "high",
    "fixable": true,
    "files": ["src/checkout.js"]
  }
}
```

List a project's runs, newest first, with `GET /projects/{id}/lavaflow-runs`.
Filter by `issue_id` or `status`, and page with `limit` and `cursor`.

A run reads the issue's runtime logs, within your plan's log retention. When a
push to the project's connected repository built the deployment that was live
when the issue was last seen, or that deployment recorded a
[verified commit](deployment-source.md#commit) with `dirty: false`, it
also reads the source at that commit and reports it as `commit_sha`, even if a
newer deployment is live now. `commit_origin` says which: `push` or
`client_reported`. Otherwise
it diagnoses from the logs alone and reports no `commit_sha`. With
`max_stage: pull_request`, a run can also
[open a fix pull request](#open-a-fix-pull-request).

### Run limits

An issue has at most one queued or running run, and a project runs one at a
time. In any 24 hours, manual and automatic runs together:

- an issue starts at most 5 runs;
- a project starts at most 200, and automatic runs take at most 150 of them,
  so you can still start runs while errors flood a project.

A start past a limit answers `429` with `code` `issue_run_limit` or
`project_run_limit`, and a `Retry-After` header with the seconds until a run
can start:

```json
{
  "error": "LavaFlow ran this issue 5 times in the last 24 hours. Try again later.",
  "code": "issue_run_limit"
}
```

An automatic run past the issue's limit is skipped. One past the project's
limit waits for room, and waiting runs start with the issue that happened most.

A run gets three attempts, and a pause doesn't use one. It retries when LavaFlow cannot reach its AI service
or the run times out, and records why in `failure_code` meanwhile. If a fix was saved
before an interruption, its retry uses the same repository and commit, even
when a newer version has since deployed.

### Why a run did not finish

| `status`   | `failure_code`           | Means                                                                                                                           |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `queued`   | `feature_unavailable`    | LavaFlow is temporarily unavailable. The run resumes automatically without using an attempt while paused                        |
| `queued`   | `feature_paused`         | LavaFlow is paused. The run resumes automatically without using an attempt; a run paused with a fix opens its pull request then |
| `failed`   | `model_request_rejected` | LavaFlow's AI service rejected the request                                                                                      |
| `failed`   | `model_unavailable`      | LavaFlow couldn't reach its AI service on any attempt                                                                           |
| `failed`   | `timed_out`              | The run did not finish in time on its last attempt                                                                              |
| `failed`   | `model_refused`          | LavaFlow declined to diagnose the issue                                                                                         |
| `failed`   | `no_diagnosis`           | LavaFlow finished without a diagnosis                                                                                           |
| `failed`   | `budget_exhausted`       | LavaFlow reached the run's limit before finding a diagnosis                                                                     |
| `failed`   | `attempts_exhausted`     | The run did not finish within its attempts                                                                                      |
| `failed`   | `internal_error`         | LavaFlow could not run the diagnosis                                                                                            |
| `canceled` | `lavaflow_disabled`      | LavaFlow was turned off before the run finished                                                                                 |
| `canceled` | `plan_required`          | The plan no longer allows LavaFlow                                                                                              |
| `canceled` | `issue_not_found`        | The issue no longer exists                                                                                                      |

A run that fails while it opens the pull request keeps its diagnosis and
reports `stage_reached: diagnose`. A run that fails before its diagnosis has no
`stage_reached`.

Older runs may also report codes no new run does: `autofix_disabled` (now
`lavaflow_disabled`), and `api_key_rejected`, `settings_changed`, or
`managed_models_unavailable` from before Volcano picked the models for every
run.

## Open a fix pull request

With `max_stage: pull_request`, a run that finds a fixable cause with medium or
high confidence asks the model for the fix, checks it, and opens a draft pull
request into the project's production branch:

```json
{
  "id": "5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
  "status": "succeeded",
  "max_stage": "pull_request",
  "stage_reached": "pull_request",
  "commit_sha": "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  "commit_origin": "push",
  "patch": {
    "title": "Return 404 when the session's cart is gone",
    "edits": [
      {
        "path": "src/checkout.js",
        "old_text": "  const total = cart.total;",
        "new_text": "  if (!cart) return new Response(\"Cart not found\", { status: 404 });\n  const total = cart.total;"
      }
    ]
  },
  "pull_request": {
    "number": 42,
    "url": "https://github.com/acme/shop/pull/42",
    "branch": "volcano/lavaflow/5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
    "state": "open"
  }
}
```

The pull request:

- Is cut from the deployed commit the run read, so it shows only the fix, even
  when the production branch has moved on.
- Is opened by the Volcano GitHub App, not by you, on a branch named
  `volcano/lavaflow/<run id>`. Repositories whose GitHub plan has no draft pull
  requests get a regular one.
- Has a commit message ending in `[skip ci]`, so GitHub Actions and most CI
  services do not run model-written code before someone reviews it. Push a
  commit to the branch to run CI.
- Describes the fix according to the repository's visibility. On a public
  repository, the description names the resource, prints the run ID, and links
  to the Volcano dashboard. The diagnosis stays with the run there, where only
  the project's members can read it. On a private repository, the description
  explains the diagnosis and evidence after removing credentials, email
  addresses, quoted values, identifiers, addresses, and numbers the model may
  have copied from your runtime logs. The title and commit message have the
  same values removed on every repository. The change is model-written and
  visible to anyone who can read the repository.
- Says so when its base is a commit your deploy client reported rather than one
  a push deployed. See [Commit](deployment-source.md#commit).

Volcano never merges it. A fix never changes CI, Git, editor, or workspace
configuration (`.github/`, `.gitlab-ci.yml`, `.husky/`, `.vscode/`,
`.devcontainer.json`, `.gitpod.yml`, and similar), lockfiles, or `.env` files
in any letter case, and changes at most 10 files. It also never changes, in any directory,
`volcano-config.yaml`, `CODEOWNERS`, `.gitattributes`, `.gitmodules`, or
dependency and merge bot configuration (Dependabot; Renovate's
`renovate.json`, `renovate.jsonc`, `renovate.json5` and `.renovaterc*` files
and the `renovate` key in `package.json`; Mergify, Snyk, PyUp). A change to a
`package.json` must leave it a JSON object. A fix repairs a `package.json` that
isn't valid JSON only when the file doesn't mention `renovate` and has no
backslash escapes. An issue has at most one open fix pull request. A merged fix
counts as open until it deploys, for up to a week.

### When you merge

Merging the pull request does not resolve the issue on its own: the old code is
still live until the merge deploys. Once a deployment that includes the merge
commit goes live, Volcano resolves the issue as of that moment and
sets `pull_request.deployed_at`. Errors from the old code before then do not
count against the fix; an error after that reopens the issue. If the error
already happened again on the new deployment by the time Volcano checks, the
issue stays open.

A deployment includes the merge when it was built from the merge commit or a
later commit that contains it, from the repository the fix merged in. A
redeploy of such a build, after a variable change for example, counts too.
Volcano asks GitHub, so it works with merge commits, squash and rebase merges,
and merge queues alike. If more than 20 deployments went live between the merge
and Volcano's check, it resolves the issue as of the merge instead, so any error
since keeps the issue open, and `deployed_at` is the merge time.

Closing the pull request without merging sets its `state` to `closed`. The
issue stays open, and the next run may propose another fix. Reopening it sets
`state` back to `open`, unless a newer fix for the issue is open. While a run
for the issue is queued or in progress, the reopen is recorded within an hour
after it finishes. Connecting
the project to another repository records its open fix pull requests as
`closed`, and a merged fix stops waiting for its deploy, since neither can
deploy from the new repository.

### Grant the GitHub App access

Opening pull requests needs the Volcano GitHub App's **Contents** and **Pull
requests** write permissions on the connected repository. When GitHub asks the
installation's owner to approve updated permissions, approve them in the
installation settings on GitHub. Until then, runs diagnose and report
`permission_missing`.

The project owner's connected GitHub account must also be able to push to the
repository. The App opens pull requests only where the owner could.

### Why a run opened no pull request

A run whose `max_stage` is `pull_request` still succeeds with its diagnosis when
it opens no pull request, and says why in `pull_request_skipped`:

| `pull_request_skipped` | Means                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_unavailable`   | The project has no connected repository, the deployment came neither from a push to it nor with a verified clean commit, or the source could not be read |
| `pull_request_open`    | A fix pull request for this issue is still open, or merged and not yet deployed                                                                          |
| `not_fixable`          | The cause is not a code change in this repository                                                                                                        |
| `low_confidence`       | The diagnosis is not confident enough to propose a fix                                                                                                   |
| `no_patch`             | The model gave no fix that passed Volcano's checks                                                                                                       |
| `permission_missing`   | The GitHub App installation lacks the permissions above or access to the repository, or the project owner cannot push to it                              |
| `repository_changed`   | The project's connected repository changed during the run                                                                                                |
| `publish_failed`       | GitHub refused the pull request, or was unavailable                                                                                                      |

When a valid fix could not be published, the run keeps it in `patch` so you can
apply it yourself.

## Who can change LavaFlow and start runs

Any project credential can read the settings and runs, including read-only
project access tokens. Only a person changes the settings or starts a run, with
a platform token: LavaFlow opens pull requests in your
repository, so a project access token is refused with
`403`. The same applies to the `lavaflow` section of
[`volcano-config.yaml`](../projects/configuration.md): a project access token
can re-apply it unchanged but cannot change it.

Agents connected through the [MCP server](../interfaces/mcp.md) get the reads:
`get_lavaflow_settings`, `list_lavaflow_runs`, and `get_lavaflow_run`.

## Plans

During the preview, turning LavaFlow on needs the SUPERAGENT plan, and nothing
is charged yet. On HOBBY, saving `"enabled": true`
answers `403`, and `plan_allows_lavaflow` is `false`. Other saves, including
turning LavaFlow off, need no plan. If your plan cannot be
resolved, they still succeed and leave out `plan_allows_lavaflow`.

Settings that are on when an account moves to HOBBY are parked: they stay
stored, and saving them again is not refused, but no run starts. They apply again when you upgrade. See [Plans and
limits](plans-and-limits.md#moving-from-superagent-to-hobby).

## What a run sends to the model

A run sends the model the issue, excerpts of the matching runtime logs, and
source files from the project's connected repository at the commit that was
live when the error happened.
Log excerpts can contain values your code logged.

Log lines can carry text your application's users wrote, and the model reads
them. Review every fix pull request as you would a contributor's: the checks
above limit what a fix can touch, but they cannot tell a correct change from a
wrong one.

## Errors

| Status | Code                  | When                                                                                                                                                                                                                                        |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | A field is invalid or unknown, or a `PATCH` names no field                                                                                                                                                                                  |
| `403`  | `plan_required`       | The plan does not include LavaFlow                                                                                                                                                                                                          |
| `403`  |                       | A project access token tried to change the settings or start a run                                                                                                                                                                          |
| `404`  | `feature_unavailable` | LavaFlow is not available in this environment, and the request saves a change that leaves it on (such as `{"max_stage": "diagnose"}` while it is on), is a project's first save, starts a run, or reads a project that never saved settings |
| `404`  |                       | The project, issue, or run does not exist, or belongs to someone else                                                                                                                                                                       |
| `409`  |                       | Starting a run while LavaFlow is off, or while the issue already has a queued or running run                                                                                                                                                |
| `429`  | `issue_run_limit`     | The issue started 5 runs in the last 24 hours. `Retry-After` says when a run can start                                                                                                                                                      |
| `429`  | `project_run_limit`   | The project started 200 runs in the last 24 hours. `Retry-After` says when a run can start                                                                                                                                                  |
| `501`  |                       | Local mode                                                                                                                                                                                                                                  |
| `503`  |                       | Your plan could not be resolved while reading the settings, saving a change that leaves LavaFlow on, or starting a run. Nothing was saved. Retry later                                                                                      |
