---
title: 'LavaFlow'
description: "Have AI diagnose your project's issues and open pull requests that fix them."
---

LavaFlow diagnoses the [issues](issues.md) your functions and frontends raise,
and, when you allow it, opens a pull request with a fix in the project's
connected repository. Where merging is available, you can also let it merge a
fix once its reviewers and required checks pass and nothing holds it. Volcano
picks and runs the models, so there is no model or API key to set up.

LavaFlow sends this project's logs and source code to an AI service that Volcano operates.

LavaFlow's commit on a fix branch can carry a CI-skip directive, so your CI
doesn't run code a model wrote before a person looks at it. To keep the
directive out of your base branch, squash the fix with a message of your own.
Rebased, the commit becomes the head of the push to the base branch; squashed
with its commit messages, as GitHub does by default, the directive is copied
into the squash commit. Most CI services, GitHub Actions included, then skip
that push. Merged with a merge commit, or rebased with a commit on top, the
commit still lands in the base branch's history, where a CI service that skips
a push when any of its commits carries the directive, such as Azure Pipelines,
won't run.

Turn it on as the project's owner:

```bash
curl -X PUT "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "enabled": true, "autonomy": "diagnose_only"}'
```

```json
{
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "enabled": true,
  "autonomy": "diagnose_only",
  "merge_policy": {
    "human_review_paths": []
  },
  "custom_context": "",
  "system_prompt": "",
  "updated_at": "2026-11-02T14:05:11Z",
  "updated_by": "6b1f0c52-3e4d-4a8b-9f2c-7d5e1a0b3c4d",
  "can_update": true
}
```

## Name the project

Every LavaFlow endpoint names one project with `project_id`: a query parameter
on reads, a body field on `PUT`. Write it as a hyphenated UUID, in either case.
Reading one run is the exception: the run's own project authorizes it, so
`project_id` is optional there. Every item in a response carries the
`project_id` it belongs to.

A project you can't read answers `404` without a code, exactly like a project
that doesn't exist, and so does one being deleted. A run in such a project
answers like a run that doesn't exist. A project access token reads only its
own project.

## Check availability

LavaFlow is in preview and needs the SUPERAGENT plan. LavaFlow fixes never
count toward the project's Sandbox usage. Check the project's
capabilities before you offer it; `lavaflow` accounts for the owner's plan:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/capabilities" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

While `lavaflow` is `available`, every LavaFlow route answers. Where it is not:

- A project that never used LavaFlow lists it `unavailable` and is refused by
  every route: `404` with code `feature_unavailable` while LavaFlow is not
  offered to the project, and `403` with code `plan_required` when it is but
  the owner's plan does not include it. The list then gives `lavaflow` the
  `code` `plan_required`.
- A project with saved settings or runs lists it `read_only`. It keeps its
  reads, and its owner can still turn LavaFlow off with `{"enabled": false}`.
  Every other change is refused the same way.

While the owner's account is read-only or inactive, LavaFlow starts no runs and
cancels queued and running runs with failure code `account_held`. Nothing needs
turning off.

LavaFlow is not available in local mode.

## Settings

| Field            | Values                                                                                                                                                                        | Default   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `enabled`        | Whether LavaFlow diagnoses the project's issues                                                                                                                               | `false`   |
| `autonomy`       | `diagnose_only` stops at a diagnosis. `open_pr` may also open a pull request with a fix, and never merges it. `merge` may also merge the fix; see [Merge fixes](#merge-fixes) | `open_pr` |
| `merge_policy`   | Fixes LavaFlow never merges with `autonomy: merge`; see [Merge fixes](#merge-fixes)                                                                                           |           |
| `custom_context` | What LavaFlow should know about the project, such as its architecture. Up to 4000 characters                                                                                  | `""`      |
| `system_prompt`  | Instructions for LavaFlow's runs. Up to 4000 characters                                                                                                                       | `""`      |

LavaFlow saves `custom_context` and `system_prompt`, but runs do not use them
yet.

`PUT` changes only the settings you send; send `project_id` and at least one
setting. A setting you omit
keeps its saved value, or its default when the project never saved settings.
`updated_at` and `updated_by` are `null` until the first save.

Only the project's owner changes the settings, signed in with a platform token,
while their account is active. `can_update` says whether your credential can.

| Status | Code                  | Why                                                                                                                                                                                                                   |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | `project_id` is missing or not a UUID, a field is unknown, `autonomy` is not one of its values, a `merge_policy` field is invalid, or a text field is over 4000 characters                                            |
| `400`  | `feature_unavailable` | The save sets `autonomy: merge` or changes `merge_policy` while the project's `lavaflow.merge` capability is unavailable                                                                                              |
| `401`  |                       | The request has no valid credential                                                                                                                                                                                   |
| `403`  | `person_required`     | A full-scope project access token or MCP tried to change the settings                                                                                                                                                 |
| `403`  | `person_required`     | The save changes a setting [Turn merging on](#turn-merging-on) lists without the platform token `volcano login` stores, or the owner's GitHub account can't push to the project's repository, or the project has none |
| `403`  | `plan_required`       | The owner's plan does not include LavaFlow                                                                                                                                                                            |
| `403`  |                       | A read-only project access token tried to change the settings, or the owner's account is read-only                                                                                                                    |
| `403`  |                       | The owner's plan could not be read. Nothing was saved; retry                                                                                                                                                          |
| `404`  |                       | The project doesn't exist, you can't read it, or it is being deleted                                                                                                                                                  |
| `404`  | `feature_unavailable` | LavaFlow is not available to the project; see [Check availability](#check-availability)                                                                                                                               |
| `409`  |                       | The settings, or the project's repository, kept changing while the save checked them. Nothing was saved; send it again                                                                                                |
| `413`  |                       | The body is over 128 KiB                                                                                                                                                                                              |
| `429`  |                       | The owner's GitHub push access was checked too often this hour. Nothing was saved; retry after `Retry-After`                                                                                                          |
| `503`  |                       | The owner's GitHub push access couldn't be checked now. Nothing was saved; retry after `Retry-After`                                                                                                                  |

`volcano-config.yaml` does not configure LavaFlow; see
[Leave out `lavaflow`](../projects/configuration.md#leave-out-lavaflow).

## Merge fixes

With `autonomy: merge`, LavaFlow merges a fix's pull request once its
reviewers pass it, its required checks pass, and nothing holds it. With
`open_pr`, LavaFlow never merges: you review and merge its pull requests like
any other. Merging needs the project's `lavaflow.merge` capability. While it
is unavailable, a new fix opens its pull request as under `open_pr`, and
LavaFlow never merges it. A merge that was already waiting pauses, shows
`paused`, and resumes when the capability is back.

Turning on merge lets LavaFlow's fixes, including those from runs it starts on
its own, run your CI with the secrets your pull request workflows get. Under
`open_pr`, a fix's commits skip CI.

```bash
curl -X PUT "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "autonomy": "merge", "merge_policy": {"human_review_paths": ["db/migrations/**"]}}'
```

| Field                             | Values                                                                                                                                          | Default |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `merge_policy.human_review_paths` | Up to 50 globs, relative to the repository root, such as `db/migrations/**`. LavaFlow never merges a fix that changes one, matched without case | `[]`    |

`PUT` changes `human_review_paths` only when you send it; send `[]` to clear
it. List anything LavaFlow must never merge there.

### Turn merging on

Merging lets LavaFlow change your repository with no one else looking. Only
the project's owner can change `autonomy` to `merge`, turn `enabled` on while
`autonomy` stays `merge`, or change `merge_policy`, `custom_context` or
`system_prompt`, to any value, while `autonomy` is or becomes `merge`. Under
`merge`, sending `enabled: true` again needs the check too when it lets
LavaFlow start runs on its own again. Anyone who can save can turn LavaFlow
off.

The owner makes these changes with the platform token `volcano login` stores,
while that sign-in lasts. Your GitHub account must also be able to push to the
project's repository;
[checking the owner's access](../projects/git-deploy.md#check-that-the-owner-can-push)
says why it can't. These get `403` with code `person_required`, and nothing is
saved:

- A project access token, or a request through MCP
- A platform token created in the dashboard or through the API
- A `volcano login` token whose sign-in ended
- An owner whose GitHub account can't push to the project's repository
- A project with no repository; connect one first

Anyone other than the owner can't save the settings at all. Otherwise, sending
the saved values again changes nothing and needs no check.

`merge` belongs to the repository the project points at when you turn it on.
When the project points at another repository, or at none, `autonomy` changes
to `open_pr`. Pointing it back doesn't turn merging on again: turn it on again
yourself.

### Waiting and held

A fix that only waits, for its checks or a merge queue slot, keeps moving, and
LavaFlow merges it when the wait ends. A held fix is yours for good. LavaFlow
comments on the pull request once with the reason, then never merges, pushes
to, rebases or dequeues it again. Review it and merge it on GitHub if you want
it, or close it.

LavaFlow holds a fix for these reasons:

| Code                           | Why                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`                         | It changes a path in `human_review_paths`                                                                                                         |
| `sensitive_path`               | It changes a path Volcano always holds: deploy configuration, authentication, secret or configuration files, or a dependency manifest or lockfile |
| `label`                        | The pull request has the `needs-human-review` label                                                                                               |
| `client_reported_commit`       | The fix is built on a commit Volcano can't tie to a push                                                                                          |
| `no_checks`                    | No CI ran on it                                                                                                                                   |
| `required_check_skipped`       | A required check was skipped                                                                                                                      |
| `no_required_checks`           | The base branch requires no check, so passing checks alone don't vouch for the fix                                                                |
| `changes_requested`            | A reviewer requested changes on GitHub                                                                                                            |
| `repository_requires_approval` | The repository requires an approving review                                                                                                       |
| `person_commits`               | Someone other than LavaFlow pushed to the fix's branch                                                                                            |
| `rules_bypass`                 | The Volcano GitHub App can bypass a ruleset on the base branch                                                                                    |
| `unchecked_rules`              | The base branch has a rule LavaFlow doesn't check, such as required signatures                                                                    |
| Any other code                 | One of LavaFlow's reviewers raised a concern, or its review was cut short; the code names it                                                      |

A required check passes only when it succeeds: `neutral` and `skipped` don't
count, a check pinned to an app counts only as that app's check run, and
Volcano's own checks never count. An approving review on GitHub doesn't
release a hold.

A run that may merge carries `merge`:

```json
"merge": {
  "status": "held",
  "reason": null,
  "hold_reasons": [
    {
      "code": "path",
      "question": "Changes db/migrations/0042_orders.sql, which always needs a person.",
      "paths": ["db/migrations/0042_orders.sql"]
    }
  ]
}
```

| `status`             | Meaning                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `waiting_for_checks` | Waits for the checks on the fix's commit                                                      |
| `queued`             | In the repository's merge queue                                                               |
| `merged`             | Merged; the run's `pull_request.state` is `merged`                                            |
| `held`               | Handed to you for good, for `hold_reasons`; each `question` is what you decide before merging |
| `stopped`            | LavaFlow left the pull request open for you, for `reason`                                     |

`reason` says why a merge stopped, such as `checks_failed`, `blocked_by_rules`
or `not_mergeable`. While merging is paused, a waiting merge shows `paused` and
resumes when merging does; one paused for more than 7 days stops with
`paused_too_long`. A merge LavaFlow stops waiting on because the project is
being deleted stops with `cancelled`.

`branch_behind` means the base branch requires pull requests to be up to date
with it and has no merge queue. LavaFlow doesn't update fix branches, so update
and merge it yourself.

These reasons stop the merge for good, and the fix goes to you:

| `reason`                   | Meaning                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `request_rejected`         | GitHub refused LavaFlow's request to start the checks on the fix                                          |
| `ci_start_commit_mismatch` | GitHub reports a different commit from the one LavaFlow made to start the checks                          |
| `queue_carries_ci_skip`    | The repository's merge queue could carry the fix commit's instruction to skip checks into the base branch |
| `merge_carries_ci_skip`    | The repository allows no squash merge, so merging would carry that instruction into the base branch       |

LavaFlow doesn't bill merges.

## Follow runs

List the project's runs, newest first. Filter with `status` and `resource_id`,
and page with `limit` (default 25, at most 100) and `cursor`, set to the
previous page's `next_cursor`. A cursor continues only the list it came from:
the same project, read with the same credential.

```bash
curl "https://api.volcano.dev/lavaflow/runs?project_id=$PROJECT_ID&status=pr_open" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "0d6e9b1a-2f4c-4e8d-9a7b-3c5d1e2f4a6b",
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "issue_id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
      "status": "pr_open",
      "resource": {
        "type": "function",
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "checkout"
      },
      "title": "Guard against an empty cart in chargeCustomer",
      "created_at": "2026-11-02T14:10:02Z",
      "finished_at": "2026-11-02T14:13:47Z",
      "pull_request": {
        "number": 42,
        "url": "https://github.com/acme/shop/pull/42",
        "state": "open",
        "opened_at": "2026-11-02T14:13:44Z"
      },
      "merge": null
    }
  ],
  "limit": 25,
  "has_more": false
}
```

| `status`     | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `queued`     | Waiting to start                                     |
| `diagnosing` | Running: finding the root cause                      |
| `fixing`     | Running: writing the fix                             |
| `reviewing`  | Running: reviewing the fix                           |
| `pr_open`    | Finished, and its pull request is open               |
| `completed`  | Finished, with no open pull request                  |
| `failed`     | Stopped before it finished; `failure` says why       |
| `cancelled`  | Stopped, for example because LavaFlow was turned off |

A pull request's `opened_at` is `null` when the run opened it before LavaFlow
recorded the time.

A run's `title` is the title of the fix it proposed, else the diagnosis summary,
else `null`. The list carries no log lines or diffs. Get them from one run:

```bash
curl "https://api.volcano.dev/lavaflow/runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A run adds `diagnosis` (its `summary`, `root_cause`, `evidence`, and the
`log_lines` behind it), `diff` (`null` for now; a run that opened a pull request
links to the change in `pull_request`),
its `review` (`verdict` is
`passed`, `changes_requested`, `blocked`, or `error`, with the number of
`rounds`), and `failure` with a `code` and a fixed `message`. Any credential
that can read the project's logs can read a run, including a read-only project
access token.

### Failure codes

A `failed` or `cancelled` run says why in `failure.code`, and a `queued` run
that waits says what for. Match on the code, not the message.

| Code                     | Why the run stopped or waits                                 |
| ------------------------ | ------------------------------------------------------------ |
| `feature_unavailable`    | Waits: LavaFlow isn't available. The run starts when it is   |
| `feature_paused`         | Waits: LavaFlow is paused. The run continues when it resumes |
| `lavaflow_disabled`      | LavaFlow was turned off, or the project is being deleted     |
| `plan_required`          | The owner's plan no longer includes LavaFlow                 |
| `account_held`           | The owner's account is read-only or inactive                 |
| `issue_not_found`        | The issue no longer exists                                   |
| `no_diagnosis`           | LavaFlow couldn't find a root cause                          |
| `budget_exhausted`       | The run reached its usage limit                              |
| `timed_out`              | The run didn't finish in time                                |
| `attempts_exhausted`     | LavaFlow retried the run as many times as it can             |
| `model_unavailable`      | LavaFlow couldn't reach its AI service                       |
| `model_refused`          | LavaFlow's AI service declined to diagnose the issue         |
| `model_request_rejected` | LavaFlow's AI service rejected the request                   |
| `internal_error`         | Something else went wrong                                    |

## See what LavaFlow found

Count the issues LavaFlow took on and the pull requests it opened per UTC day.
`days` is 30 by default and at most 90, ending today:

```bash
curl "https://api.volcano.dev/lavaflow/stats?project_id=$PROJECT_ID&days=7" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "window_start": "2026-10-27",
  "window_end": "2026-11-02",
  "days": [
    { "date": "2026-10-27", "issues_opened": 0, "pull_requests_opened": 0 },
    { "date": "2026-11-02", "issues_opened": 4, "pull_requests_opened": 1 }
  ],
  "totals": { "issues_opened": 4, "pull_requests_opened": 1 }
}
```

The response is shortened here; `days` has every day in the window.

List the same counts per function, durable function, and frontend:

```bash
curl "https://api.volcano.dev/lavaflow/resources?project_id=$PROJECT_ID&days=7" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "resource": {
        "type": "function",
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "checkout"
      },
      "last_analyzed_at": "2026-11-02T14:10:03Z",
      "issues_opened": 4,
      "pull_requests_opened": 1,
      "anomaly": {
        "flagged": true,
        "reason": "4 issues in the last 24 hours, 4x its daily average"
      }
    }
  ]
}
```

Every resource in the project is listed, with zeros where LavaFlow found
nothing. A deleted resource with activity in the window is listed under its last
name, so the counts add up to the stats' totals.

A resource is flagged as an anomaly when the last 24 hours brought at least 3
issues and at least 3 times its daily average over the 29 days before. The
average counts as at least one issue a day.

## Agents

The [MCP endpoint](../interfaces/mcp.md) offers every LavaFlow read as a tool,
for the project the agent's token is bound to. Changing the settings is the
owner's decision, so no tool changes them.
