---
title: 'Autofix'
description: "Have AI diagnose your project's issues and open draft pull requests that fix them, on Volcano's models or your own API key."
---

Autofix diagnoses the [issues](issues.md) your functions and frontends raise
and, when you allow it, opens a draft pull request with a fix in the project's
connected repository. You choose how far a run may go, whether a new issue
starts one on its own, and which Claude model it uses.

Turn it on with your own Anthropic API key:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/autofix" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "max_stage": "pull_request",
    "auto_trigger": true,
    "provider": "anthropic",
    "model": "claude-opus-5-5",
    "api_key": "'"$ANTHROPIC_API_KEY"'"
  }'
```

```json
{
  "project_id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
  "enabled": true,
  "max_stage": "pull_request",
  "auto_trigger": true,
  "provider": "anthropic",
  "model": "claude-opus-5-5",
  "api_key_configured": true,
  "api_key_provider": "anthropic",
  "api_key_last4": "Qx7a",
  "plan_includes_autofix": true,
  "updated_at": "2026-10-13T12:20:41Z"
}
```

## Check availability

Autofix is in preview and is not available in every environment. Check
`GET /capabilities`:

| Capability               | Means                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `autofix`                | You can turn autofix on and start runs. Without it, both answer `404` with code `feature_unavailable` |
| `autofix.managed_models` | You can turn autofix on with provider `volcano`. Without it, use your own API key                     |

Where autofix is not available, settings a project already saved and its runs
stay readable, and you can still turn autofix off or delete the key. A project that
never saved settings gets `404` with code `feature_unavailable`.

Autofix needs SUPERAGENT. It is not available in local mode, where the
endpoints answer `501`.

## Settings

| Field          | Values                                                                                                                                    | Default                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `enabled`      | Whether Volcano diagnoses the project's issues                                                                                            | `false`                                 |
| `max_stage`    | `diagnose` stops at a root-cause diagnosis. `pull_request` may also open a draft pull request                                             | `diagnose`                              |
| `auto_trigger` | Whether a new or reopened issue starts a run on its own. Otherwise runs start only when you ask                                           | `false`                                 |
| `provider`     | `volcano` runs on Volcano's models. `anthropic` runs on your own Anthropic API key                                                        | The saved provider, else `volcano`      |
| `model`        | `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5`, `claude-sonnet-5`, or `claude-haiku-4-5` | The saved model, else `claude-opus-5-5` |
| `api_key`      | Your own API key for `provider`, such as an Anthropic key for `anthropic`. Write-only                                                     |                                         |

`PUT` replaces the settings: a field you omit takes its default. Three fields
are the exception: an omitted `provider`, `model`, or `api_key` keeps
its saved value. So `{"enabled": false}` turns autofix off and keeps your key.

Read the settings back:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/autofix" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A project that never saved settings returns the defaults.

## Bring your own API key

With provider `anthropic`, runs call Claude with your own Anthropic API key, and
Anthropic bills you for them. Turning autofix on with that provider needs a key
saved for it. Volcano encrypts the key at rest and never returns it: responses
show only `api_key_configured`, the provider the key belongs to in
`api_key_provider`, and its last four characters in `api_key_last4`.

To replace the key, save again with a new `api_key`. Turning autofix off or
switching to provider `volcano` keeps the key, so switching back needs no new
one. To delete it:

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/autofix/api-key" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The response is the settings. Autofix on the key's provider turns off with the
key; on provider `volcano` it keeps running.

## Diagnose an issue

Start a run for an issue:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/issues/$ISSUE_ID/autofix-runs" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
  "project_id": "8d2b5f3e-1a4c-4b6d-9e8f-0c1a2b3c4d5e",
  "issue_id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
  "trigger": "manual",
  "status": "queued",
  "max_stage": "diagnose",
  "provider": "anthropic",
  "model": "claude-opus-5-5",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  },
  "created_at": "2026-10-13T12:31:02Z"
}
```

With `auto_trigger` on, a new issue or one that comes back after you resolved
it starts a run on its own. Only errors your code threw start one: a line that
only reads like an error, such as `console.log("request failed")`, does not.

Poll the run until `status` is `succeeded`, `failed`, or `canceled`:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/autofix-runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
  "issue_id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
  "status": "succeeded",
  "stage_reached": "diagnose",
  "commit_sha": "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
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
  },
  "usage": {
    "input_tokens": 18420,
    "output_tokens": 2210,
    "cache_read_input_tokens": 41300,
    "cache_creation_input_tokens": 3900
  }
}
```

List a project's runs, newest first, with `GET /projects/{id}/autofix-runs`.
Filter by `issue_id` or `status`, and page with `limit` and `cursor`.

A run reads the issue's runtime logs, within your plan's log retention. When a
push to the project's connected repository built the deployment that was live
when the issue was last seen, it also reads the source at that commit and
reports it as `commit_sha`, even if a newer deployment is live now. Otherwise
it diagnoses from the logs alone and reports no `commit_sha`. With
`max_stage: pull_request`, a run can also
[open a fix pull request](#open-a-fix-pull-request).

### Run limits

An issue has at most one queued or running run, and a project runs one at a
time. A project starts at most 25 runs in any 24 hours, manual and automatic
together. An automatic run that would pass the limit is skipped.

A run gets three attempts. It retries when the model is unavailable or the run
times out, and records why in `failure_code` meanwhile. If a fix was saved
before an interruption, its retry uses the same repository and commit, even
when a newer version has since deployed.

### Why a run did not finish

| `status`   | `failure_code`               | Means                                                                                                   |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `queued`   | `feature_unavailable`        | Autofix is temporarily unavailable. The run resumes automatically without using an attempt while paused |
| `failed`   | `api_key_rejected`           | The provider refused your API key. Save a new one                                                       |
| `failed`   | `model_request_rejected`     | The model provider refused the request                                                                  |
| `failed`   | `model_unavailable`          | The model was unavailable on every attempt                                                              |
| `failed`   | `timed_out`                  | The run did not finish in time on its last attempt                                                      |
| `failed`   | `model_refused`              | The model declined to diagnose the issue                                                                |
| `failed`   | `no_diagnosis`               | The model finished without a diagnosis                                                                  |
| `failed`   | `budget_exhausted`           | The run used its token budget before reaching a diagnosis                                               |
| `failed`   | `attempts_exhausted`         | The run did not finish within its attempts                                                              |
| `failed`   | `internal_error`             | Volcano could not run the diagnosis                                                                     |
| `canceled` | `autofix_disabled`           | Autofix was turned off before the run started                                                           |
| `canceled` | `plan_required`              | The plan no longer includes autofix                                                                     |
| `canceled` | `settings_changed`           | The provider changed after the run was queued                                                           |
| `canceled` | `managed_models_unavailable` | Volcano-managed models are not available                                                                |
| `canceled` | `issue_not_found`            | The issue no longer exists                                                                              |

A run reports the model tokens it used in `usage`, across every attempt. With
provider `anthropic`, Anthropic bills you for them.

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
    "branch": "volcano/autofix/5f0e7c1a-3b9d-4e2f-8a6c-1d2e3f4a5b6c",
    "state": "open"
  }
}
```

The pull request:

- Is cut from the deployed commit the run read, so it shows only the fix, even
  when the production branch has moved on.
- Is opened by the Volcano GitHub App, not by you, on a branch named
  `volcano/autofix/<run id>`. Repositories whose GitHub plan has no draft pull
  requests get a regular one.
- Has a commit message ending in `[skip ci]`, so GitHub Actions and most CI
  services do not run model-written code before someone reviews it. Push a
  commit to the branch to run CI.
- Explains the diagnosis and evidence in its description. The evidence quotes
  your runtime logs, and anyone who can read the repository can read it,
  including everyone when the repository is public.

Volcano never merges it. A fix never changes CI, Git, editor, or workspace
configuration (`.github/`, `.gitlab-ci.yml`, `.husky/`, `.vscode/`,
`.devcontainer.json`, `.gitpod.yml`, and similar), lockfiles,
or `.env` files, and changes at most 10 files. An issue has at most one open fix
pull request. A merged fix counts as open until it deploys, for up to a week.

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

| `pull_request_skipped` | Means                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `source_unavailable`   | The resource was not deployed from the connected repository, or the source could not be read                                |
| `pull_request_open`    | A fix pull request for this issue is still open, or merged and not yet deployed                                             |
| `not_fixable`          | The cause is not a code change in this repository                                                                           |
| `low_confidence`       | The diagnosis is not confident enough to propose a fix                                                                      |
| `no_patch`             | The model gave no fix that passed Volcano's checks                                                                          |
| `permission_missing`   | The GitHub App installation lacks the permissions above or access to the repository, or the project owner cannot push to it |
| `repository_changed`   | The project's connected repository changed during the run                                                                   |
| `publish_failed`       | GitHub refused the pull request, or was unavailable                                                                         |

When a valid fix could not be published, the run keeps it in `patch` so you can
apply it yourself.

## Who can change autofix and start runs

Any project credential can read the settings and runs, including read-only
project access tokens. Only a person changes the settings, deletes the key, or starts a run, with
a platform token or in the dashboard: autofix opens pull requests in your
repository and spends model tokens, so a project access token is refused with
`403`. The same applies to the `autofix` section of
[`volcano-config.yaml`](../projects/configuration.md): a project access token
can re-apply it unchanged but cannot change it.

## Plans

Turning autofix on needs SUPERAGENT. On HOBBY, saving `"enabled": true`
answers `403`, and `plan_includes_autofix` is `false`. Other saves, including
turning autofix off and deleting the key, need no plan. If your plan cannot be
resolved, they still succeed and leave out `plan_includes_autofix`.

Settings that are on when an account moves to HOBBY are parked: they stay
stored, including the API key, and saving them again is not refused, but no run
starts. They apply again when you upgrade. See [Plans and
limits](plans-and-limits.md#moving-from-superagent-to-hobby).

## What a run sends to the model

A run sends the model the issue, excerpts of the matching runtime logs, and
source files from the project's connected repository at the commit that was
live when the error happened.
Log excerpts can contain values your code logged. With provider `anthropic`,
that data goes to Anthropic under your own account's terms.

Log lines can carry text your application's users wrote, and the model reads
them. Review every fix pull request as you would a contributor's: the checks
above limit what a fix can touch, but they cannot tell a correct change from a
wrong one.

## Errors

| Status | Code                  | When                                                                                                                                                            |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | A field is invalid, the key does not fit the provider, turning autofix on with provider `anthropic` has no key for it, or a key is sent with provider `volcano` |
| `400`  | `feature_unavailable` | Turning autofix on with provider `volcano` where `autofix.managed_models` is unavailable                                                                        |
| `400`  | `feature_unavailable` | Starting a run with provider `volcano` where `autofix.managed_models` is unavailable                                                                            |
| `403`  |                       | The plan does not include autofix, or a project access token tried to change the settings, delete the key, or start a run                                       |
| `404`  | `feature_unavailable` | Autofix is not available in this environment, and the request turns it on, starts a run, or reads a project that never saved settings                           |
| `404`  |                       | The project, issue, or run does not exist, or belongs to someone else                                                                                           |
| `409`  |                       | Starting a run while autofix is off, or while the issue already has a queued or running run                                                                     |
| `429`  |                       | The project started 25 runs in the last 24 hours                                                                                                                |
| `501`  |                       | Local mode                                                                                                                                                      |
| `503`  |                       | Your plan could not be resolved while reading the settings, turning autofix on, or starting a run. Nothing was saved. Retry later                               |
