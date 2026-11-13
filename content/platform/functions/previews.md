---
title: 'Function previews'
description: "Deploy a build of a function to its own runtime and URL, check it with production's variables, point the function's traffic at it, and roll back."
---

A preview is a copy of an ordinary function that you deploy to its own URL
before it replaces what the function runs. Use it to check a change against
your real project variables, then point the function's traffic at the build
you checked, without rebuilding or redeploying anything.

## Deploy a preview

```bash
volcano cloud functions preview create api --name checkout-v2 --path ./functions/api
```

`--name` is required and unique within the function, and a function can have
at most 20 live previews. `--ttl` deletes the preview after that long, up to 720
hours; without it the preview lives until you delete it. The build uses the
function's runtime and handler and spends the project's build minutes, as a
deploy of the function does: every build is charged by the time it ran, whether
it succeeds or fails, and a create or redeploy is refused with `429` once the
project's build minutes are used up. Read the URL when the first deployment is
ready:

```bash
volcano cloud functions preview get api checkout-v2
volcano cloud functions preview list api
```

Deploy a new build to the same preview with `preview deploy api checkout-v2
--path ./functions/api`. The preview keeps serving its previous build until the
new one succeeds.

## Invoke a preview

A preview runs on a runtime of its own in every region the function deploys to,
and is invoked at `https://<preview id>.<functions domain>`, as a function is at
its own ID. A preview is always private, whatever the function's own
visibility: only the project's service key, with the `functions.invoke`
permission, can invoke it. Signed-in users, anon keys and access tokens are
refused, the project owner's included. The function's invocation mode (RPC or
HTTP) carries over; its unauthenticated HTTP setting does not.

A preview gets none of the function's [schedules](scheduled-invocations.md) or
warmers, and calls to `/functions/{id}/invoke` and the schedule API do not reach
it: only its own host does. Frontend function routes keep pointing at the
function.

## What a preview runs with

A preview builds with the function's variables as they are when you deploy it:
its variable scope and declared names, the names its source reads, and the
project's values, secrets included. It keeps them: changing a variable
afterwards does not reach a running preview. `preview get` reports
`Variables: changed` once the function would give that source different values.

A preview is not a sandbox. It runs with production's values, so it reaches
production databases and services. Deploy only code you would deploy to the
function itself, and delete a preview you no longer need.

## Promote a preview

```bash
volcano cloud functions preview promote api checkout-v2
```

Promotion points the function's traffic at the preview's runtime. Nothing is
deployed or rebuilt, so it takes effect at once: every call to the function,
through its own URL, `/functions/{id}/invoke`, a schedule or a frontend route,
runs the preview's code, and the function's warmer warms the preview's runtime.
The function keeps its ID, URL, visibility, schedules, rate limits, usage and
invocation records. Its own build is left running as it is, so rolling back is just as
quick.

Promotion is refused with `409` when the preview is not serving a successful
deployment built with the function's current variables, runtime and handler in
every region, while a deployment of the function or a synchronization of its
variables runs, and once the project's repository is the source of truth. See
[Error codes](#error-codes) for each refusal.

Once the project's repository is the source of truth, promotion is refused
(`source_managed_by_git`) because the repository does not have the preview's
code and its next deploy would replace it. Previews can still be created,
deployed and deleted.

`volcano cloud functions serving api` shows what the function runs.

### While a preview serves

- The function's logs (`volcano cloud functions logs api`, and project log
  search and streams for the function) include the code's output from the
  preview for as long as it serves, under the function's ID, in one
  timeline with the function's own lines. After a rollback, the preview's
  lines stay in that timeline for up to 15 minutes, so calls still running at
  the switch are not lost. The log activity chart counts the function's own
  build only.
- Search with the preview's ID to read the preview's own logs. They include
  every line it wrote, those written while it served the function too.
- The preview keeps the variables it was built with. Setting or deleting a
  single variable that would change the function's environment is refused with
  `409` and `code: function_served_by_candidate` before anything is stored,
  because it would reach only the function's own build, which receives no
  traffic. Roll back or deploy first, then write it again.
- `volcano config deploy` and replacing the shared variable list store the
  change for the whole project at once, so they are not refused: every other
  function and frontend gets the change, and the served function is reported as
  skipped (`code: function_served_by_candidate`). The report is a notice, not an
  error: `config deploy` exits successfully, and the shared list replacement
  answers `200` naming each skipped function. `volcano cloud functions serving
  api` then reports its own build's environment as out of date. A rollback to
  its own build starts synchronizing it with the current values as it returns
  the traffic, and the synchronization is retried in the background if it
  cannot start; `serving` reports the environment out of date until that
  synchronization completes or a deploy of the function activates.
- Deploying the function itself is allowed: once the deployment succeeds, the
  function's traffic returns to its own, new build, and the preview is no
  longer held for a rollback.
- The preview cannot be deleted, redeployed or expired.
- If the project's regions change, the function is not redeployed to them:
  that deployment would return its traffic to its own build and undo the
  promotion. Every other function and frontend moves. The function moves to the
  new regions after a rollback to its own build, or when you deploy it.
- Reading the function returns the preview's ID as `serving_candidate_id`.
  While it is set, the function's `status` and `current_deployment_id` describe
  its own build, which receives no traffic.

## Roll back

```bash
volcano cloud functions rollback api
volcano cloud functions rollback api --to-production
```

A rollback points the function back at what served it before its last
promotion or rollback, so a second rollback undoes the first. With
`--to-production` it returns to the function's own build. It takes effect at
once. A rollback that would make a preview serve again is a promotion, and is
refused like one. A rollback to the function's own build is not: it works
while previews are unavailable to the project, while a deployment of the function runs, and
once the project's repository is the source of truth.

Every promotion and rollback names the serving `revision` it read, and is
refused with `stale_revision` if someone promoted or rolled back since. The CLI
reads it for you, so retrying a rollback that already applied is refused rather
than undoing it.

Rollback restores code and configuration only. Database changes and other side
effects of the promoted code are not undone.

## Delete a preview

```bash
volcano cloud functions preview delete api checkout-v2
```

This removes the preview's runtime, its URL, its builds and its stored source. A
preview the function runs cannot be deleted (`409`, `candidate_in_use`): roll
back first. Deleting a preview kept for a rollback gives that rollback up.
Deleting the function deletes its previews first.

The lines a preview wrote while it served the function stay in the function's
logs after the preview is deleted, until your plan's log retention ends.

## Git-managed projects

Once a project's repository is the source of truth, its functions deploy from
pushes to the production branch, and a preview, built from an uploaded source,
cannot replace what a function runs: promoting one, and rolling back to one,
are refused with `409` and `code: source_managed_by_git`. Rolling back to the
function's own build still works, so a preview that serves when the handover
starts can always be taken out of traffic.

## Error codes

The API answers these codes. `409` is a conflict with the state of the
function, the preview or the project; read it again before retrying.

| Status | Code                           | Answered by                       | Why                                                                                                                   |
| ------ | ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `400`  | -                              | create, deploy, promote, rollback | An invalid name, expiry, identifier, source archive or body, or a variable the source reads has no value.             |
| `404`  | `feature_unavailable`          | create, deploy, promote, rollback | Previews are not available to the project. A rollback answers it only when it would make a preview serve again.       |
| `409`  | `durable_function_unsupported` | create, deploy, promote, rollback | The function is durable. Durable functions have no previews; reading them answers none.                               |
| `409`  | `candidate_name_taken`         | create                            | The function has a preview with this name.                                                                            |
| `409`  | `candidate_limit_reached`      | create                            | The function has 20 live previews.                                                                                    |
| `409`  | `function_deleting`            | create, deploy, promote, rollback | The function is being deleted.                                                                                        |
| `409`  | `project_deleting`             | create                            | The project is being deleted.                                                                                         |
| `409`  | `deployment_in_progress`       | deploy, promote, rollback         | A deployment of the preview, or of the function, or a synchronization of the function's variables, is running.        |
| `409`  | `candidate_not_deployable`     | deploy                            | The preview is being deleted.                                                                                         |
| `409`  | `candidate_in_use`             | deploy, delete                    | The function runs the preview, or keeps it for a rollback (deploy only). Roll back first.                             |
| `409`  | `candidate_not_ready`          | promote, rollback                 | The preview is not serving a successful deployment, or its latest redeploy failed; redeploy it successfully first.    |
| `409`  | `configuration_changed`        | promote, rollback                 | The function's variables, runtime or handler changed since the preview was built. Redeploy it.                        |
| `409`  | `candidate_regions_changed`    | promote, rollback                 | The function deploys to a region the preview was not built in. Redeploy it.                                           |
| `409`  | `function_not_deployed`        | promote, rollback                 | The function has no successful deployment of its own to roll back to.                                                 |
| `409`  | `stale_revision`               | promote, rollback                 | Someone promoted or rolled back since the revision the request named.                                                 |
| `409`  | `already_serving`              | promote                           | The function already runs this preview.                                                                               |
| `409`  | `source_managed_by_git`        | promote, rollback                 | The project's repository is the source of truth. A rollback answers it only when it would make a preview serve again. |
| `409`  | `nothing_to_roll_back`         | rollback                          | The function runs its own build and keeps no preview to return to.                                                    |
| `409`  | `rollback_unavailable`         | rollback                          | The preview a rollback would return to is gone or no longer serves a successful deployment.                           |
| `409`  | `function_served_by_candidate` | variable writes                   | A promoted preview serves a function the write would change. Roll back or deploy the function first.                  |
| `429`  | `build_minutes_exceeded`       | create, deploy                    | The project's build minutes for the billing cycle are used up.                                                        |

## Availability

Creating, deploying to and promoting a preview are behind a release gate and
answer `404` with code `feature_unavailable` while it is off for your
environment. `GET /capabilities` lists `functions.candidates` as `available`
when it is on. Listing, reading and deleting previews, and rolling back to the
function's own build, work either way.

A deployment reports the image it published by its `sha256` digest, per region,
never by its registry path. The local development server does not
run function previews yet and answers `feature_unavailable`.

The API calls a preview a Candidate. See
[Function endpoints](../api-reference/functions.md#previews).
