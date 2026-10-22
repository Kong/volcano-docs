---
title: Project health
description: Review project health, operation failures, and blocked storage use.
---

## Check a project

```sh
curl "https://api.volcano.dev/projects/$PROJECT_ID/health" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Request `GET /projects?include=health` to include the same status in project lists.

| Status            | Meaning                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`           | No functions, frontends, databases, storage, Volcano Auth users, or Sandbox resources are listed. A Sandbox template that is not being deleted, or a session that still holds capacity, counts, as long as the Sandbox API still lists it for the project. |
| `healthy`         | No issues were reported by the available checks.                                                                                                                                                                                                           |
| `needs_attention` | A failed or stalled operation needs review, or a frontend that serves needs a redeploy because edge recovery gave up. These records do not confirm an outage.                                                                                              |
| `degraded`        | A resource is only partly available, or is unavailable for an expected, temporary reason. See [Degraded resources](#degraded-resources).                                                                                                                   |
| `critical`        | Use is blocked, such as invocation of a failed function, connections to a failed database, a failed frontend with no deployment serving, or uploads above an enforced storage allowance.                                                                   |
| `unknown`         | The check cannot determine the status.                                                                                                                                                                                                                     |

## Frontends while a deployment builds

While a deployment builds, a frontend is `provisioning`, and the site keeps being served from the previous deployment. Health reports that deployment's state, not the build:

| Before the deployment                                     | While it builds                                              |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| Serving normally                                          | `healthy`                                                    |
| Serving with incomplete edge synchronization (`degraded`) | `degraded`, until a deployment completes or the build stalls |
| Nothing serving after a failed deployment                 | `critical` (`frontend_not_serving`)                          |
| First deployment of a new frontend                        | `healthy`, because there is nothing to lose                  |

A deployment that fails over a site that is still served does not change the status, because the status follows what serves the site: `healthy` when a healthy deployment still serves it, `degraded` when the serving deployment is degraded, and `critical` when nothing serves it. The failed attempt is only a deployment record.

A build that runs for 45 minutes or more is `needs_attention` (`resource_provisioning_stalled`), unless nothing is serving, which stays `critical`.

A frontend marked `failed` is `critical` (`frontend_not_serving`), whatever an earlier deployment's record says. A failed workflow leaves a frontend `active` while its site is live, so a failed frontend has no site up. Local mode marks a frontend `failed` when it abandons a deployment and does not restart its site until the next deployment.

While a deployment builds, a frontend serves a site only while it has a live edge URL and a deployed region. Volcano uses the same test to decide that a failed deployment, or a failed delete that rolled back, leaves a frontend `active`. A frontend without a live site is not serving, so it reads `critical` even when an older deployment's record is still `active`. A delete that has already torn the site down clears the URL, so a frontend whose cleanup failed and that is then redeployed is not read as serving a site that is gone.

## Degraded resources

Two cases report `degraded`. In both, a resource is not in its normal state and Volcano is handling it.

- **A frontend whose edge synchronization did not complete** (`resource_degraded`). The frontend keeps serving while Volcano retries edge recovery a limited number of times, and it stays `degraded` while an attempt is running. If those retries are spent, nothing retries it any more and it keeps serving until you redeploy it. It is then reported as `needs_attention` with `frontend_edge_recovery_exhausted`. The record of the exhausted retries is kept for 15 days, after which the frontend reads `degraded` again.
- **A database being restored** (`resource_restoring`). The database does not accept connections until the restore finishes. It returns to `active` when the restore completes. If the restore cannot complete, the database becomes `failed` and the project is `critical`.

## Review findings

The response includes `checks` and the highest-priority `findings`. Each finding contains a `reason_code` and the affected resource in `scope.resource`. Check `data_status` before treating a result as complete. A `partial` or `stale` result may be incomplete, so do not read `healthy` in it as a confirmation of current availability. `observed_at` identifies when the check ran. It is not when a failed operation happened, and a finding does not carry that time. The `evidence.value` of a lifecycle check is an identifier of its status (`0` healthy, `1` degraded, `2` critical, `3` unknown, `4` needs attention) and not a severity order, so rank checks by `status`.

On a plan that stops at its allowance (HOBBY), the `storage.capacity` check judges the file storage of your whole account against the allowance, because the allowance is metered across every project you own. When the account has reached it, every project in it reports `storage_usage_over_plan_limit`, because uploads are refused from that point. On a plan that bills overage (SUPERAGENT), uploads are never refused, so the check compares only this project's bytes with the allowance and reports `storage_usage_over_allowance` or `storage_usage_within_plan_limit` for it alone. Its `evidence` describes only this project: `value` is the bytes this project stores and `sample_count` is its object count, so a project can report a small value while its account is over the allowance.

The status summarizes the findings and does not describe the whole project. A `critical` finding names the resource and the reason, for example `function_invocation_blocked` for calls to one function or `storage_usage_over_plan_limit` for uploads. It does not mean other parts of the project are unavailable.

```json
{
  "project_id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
  "status": "needs_attention",
  "observed_at": "2026-10-13T13:30:00Z",
  "fresh_through": "2026-10-13T13:30:00Z",
  "data_status": "complete",
  "checks": [
    {
      "id": "lifecycle.project.7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
      "category": "lifecycle",
      "status": "healthy",
      "reason_code": "resource_active",
      "scope": {
        "resource": {
          "type": "project",
          "id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
          "name": "my-app"
        }
      },
      "evidence": { "metric": "resource.lifecycle.status", "value": 0, "unit": "1", "sample_count": 1 }
    },
    {
      "id": "lifecycle.function.3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
      "category": "lifecycle",
      "status": "healthy",
      "reason_code": "resource_active",
      "scope": {
        "resource": {
          "type": "function",
          "id": "3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
          "name": "api",
          "kind": "standard"
        }
      },
      "evidence": { "metric": "resource.lifecycle.status", "value": 0, "unit": "1", "sample_count": 1 }
    },
    {
      "id": "workflow.status-refresh.function.3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
      "category": "lifecycle",
      "status": "needs_attention",
      "reason_code": "status_refresh_failed",
      "scope": {
        "resource": {
          "type": "function",
          "id": "3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
          "name": "api",
          "kind": "standard"
        }
      },
      "evidence": { "metric": "workflow.job.failure", "value": 1, "unit": "1", "sample_count": 1 }
    },
    {
      "id": "storage.capacity",
      "category": "storage",
      "status": "healthy",
      "reason_code": "storage_usage_within_plan_limit",
      "scope": {
        "resource": {
          "type": "project",
          "id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
          "name": "my-app"
        }
      },
      "evidence": { "metric": "storage.total_bytes", "value": 0, "unit": "By", "sample_count": 0 }
    }
  ],
  "findings": [
    {
      "id": "workflow.status-refresh.function.3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
      "category": "lifecycle",
      "status": "needs_attention",
      "reason_code": "status_refresh_failed",
      "scope": {
        "resource": {
          "type": "function",
          "id": "3b9e5d27-6c1a-4f08-8d2b-91a4c7e0f5a6",
          "name": "api",
          "kind": "standard"
        }
      },
      "evidence": { "metric": "workflow.job.failure", "value": 1, "unit": "1", "sample_count": 1 }
    }
  ]
}
```

`checks` lists every check, including the healthy ones. `findings` lists up to five of the `critical`, `degraded`, and `needs_attention` checks, most severe first. A resource being deleted is `healthy` with `resource_deleting`, because the removal was requested. If the deletion fails, the resource becomes `failed` and is classified like any failed resource, and its failed cleanup task is `needs_attention`. A check with status `unknown` appears in `checks` but not in `findings`. If the plan cannot be looked up, the `storage.capacity` check reports `unknown` with `plan_unavailable` and `data_status` is `partial`. That check does not change the project status, which comes from the remaining checks. On a plan that stops at its allowance, the check also reports `unknown` with `storage_unavailable` when your account's total storage cannot be read.

An empty project can retain a failed project record or an unfinished cleanup task. Its label remains `empty`; its findings still identify operations that need review. `empty` describes what the project contains and does not mean there is nothing to review, so show the findings beside it. A failed project record alone does not identify which operation failed.

## How long a finding lasts

A finding describes an unresolved operation or state, and it ends when the evidence does:

- **A failed status refresh** counts only while its workflow is the resource's current one. A newer deployment ends it.
- **A failed cleanup task** stays until the cleanup succeeds. A successful cleanup removes the record.
- **Edge recovery that gave up** stays until the next deployment. The record of it is kept for 15 days, after which the frontend reads `degraded` again.
- **A provisioning function or database** is a finding only when it has no start time or has run for 45 minutes or more. A frontend reads by the deployment it is served from instead (see above).

Health describes recorded lifecycle and storage state. It is not a live availability probe. A failed deployment does not establish whether the published version is available. A function whose current state is `failed` is critical because Volcano refuses invocation in that state; its finding uses `function_invocation_blocked`. A failed workflow alone remains `needs_attention`. Use deployment history to inspect its result. A failed cleanup task can require review even after the resource is no longer listed.
