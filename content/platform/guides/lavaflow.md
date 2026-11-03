---
title: 'LavaFlow'
description: "Have AI diagnose your project's issues and open pull requests that fix them."
---

LavaFlow diagnoses the [issues](issues.md) your functions and frontends raise,
and, when you allow it, opens a pull request with a fix in the project's
connected repository. A person merges it; LavaFlow never does. Volcano picks and
runs the models, so there is no model or API key to set up.

LavaFlow sends this project's logs and source code to an AI service that Volcano operates.

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

LavaFlow is in preview and needs the SUPERAGENT plan. Check the project's
capabilities before you offer it; `lavaflow` accounts for the owner's plan:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/capabilities" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

While `lavaflow` is `available`, every LavaFlow route answers. Where it is not:

- A project that never used LavaFlow is refused by every route: `404` with
  code `feature_unavailable` while LavaFlow is not offered to the project, and
  `403` with code `plan_required` when it is but the owner's plan does not
  include it.
- A project with saved settings or runs keeps its reads, and its owner can
  still turn LavaFlow off with `{"enabled": false}`. Every other change is
  refused the same way.

While the owner's account is read-only or inactive, LavaFlow starts no runs and
cancels queued and running runs with failure code `account_held`. Nothing needs
turning off.

LavaFlow is not available in local mode.

## Settings

| Field            | Values                                                                                       | Default   |
| ---------------- | -------------------------------------------------------------------------------------------- | --------- |
| `enabled`        | Whether LavaFlow diagnoses the project's issues                                              | `false`   |
| `autonomy`       | `diagnose_only` stops at a diagnosis. `open_pr` may also open a pull request with a fix      | `open_pr` |
| `custom_context` | What LavaFlow should know about the project, such as its architecture. Up to 4000 characters | `""`      |
| `system_prompt`  | Instructions for LavaFlow's runs. Up to 4000 characters                                      | `""`      |

LavaFlow saves `custom_context` and `system_prompt`, but runs do not use them
yet.

`PUT` changes only the settings you send; send `project_id` and at least one
setting. A setting you omit
keeps its saved value, or its default when the project never saved settings.
`updated_at` and `updated_by` are `null` until the first save.

Only the project's owner changes the settings, signed in with a platform token,
while their account is active. `can_update` says whether your credential can.

| Status | Code                  | Why                                                                                                                                     |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | `project_id` is missing or not a UUID, a field is unknown, `autonomy` is not one of its values, or a text field is over 4000 characters |
| `401`  |                       | The request has no valid credential                                                                                                     |
| `403`  | `person_required`     | A full-scope project access token tried to change the settings                                                                          |
| `403`  | `plan_required`       | The owner's plan does not include LavaFlow                                                                                              |
| `403`  |                       | A read-only project access token tried to change the settings, or the owner's account is read-only                                      |
| `403`  |                       | The owner's plan could not be read. Nothing was saved; retry                                                                            |
| `404`  |                       | The project doesn't exist, you can't read it, or it is being deleted                                                                    |
| `404`  | `feature_unavailable` | LavaFlow is not available to the project; see [Check availability](#check-availability)                                                 |
| `413`  |                       | The body is over 128 KiB                                                                                                                |

`volcano-config.yaml` does not configure LavaFlow; see
[Leave out `lavaflow`](../projects/configuration.md#leave-out-lavaflow).

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
        "opened_at": null
      }
    }
  ],
  "limit": 25,
  "has_more": false
}
```

| `status`     | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `queued`     | Waiting to start                                     |
| `diagnosing` | Running                                              |
| `pr_open`    | Finished, and its pull request is open               |
| `completed`  | Finished, with no open pull request                  |
| `failed`     | Stopped before it finished; `failure` says why       |
| `cancelled`  | Stopped, for example because LavaFlow was turned off |

Runs do not report their stages yet, so a running run is `diagnosing` until it
finishes, and a pull request's `opened_at` is `null`.

`title` is the title of the fix the run proposed, else the diagnosis summary,
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
