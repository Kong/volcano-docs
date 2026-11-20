---
title: Create a project from a template
description: Install a starter application with its own database and project credentials.
---

When enabled in your environment, create a starter project through the project
API:

```http
POST /projects
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{"name":"my-pixels","template_id":"pixel-board"}
```

Available template IDs are `pixel-board`, `trellini`, and `collab-pad`.
New installations use database names `pixel_board`, `trellini`, and `collab_pad`
for the corresponding templates. The frontend and server database variables point
to that database. Existing installations keep their original database name.
The legacy `official-starter` ID has
environment-specific availability; use a named template for new integrations.

The `name` field sets the project name; `template_id` selects the application.
Volcano adds a suffix if the name conflicts with another project you own.
The template installs into a new project with an independent database and fresh credentials. Its code and database initialization
are delivered together as one template version. No Git repository connection is
required. The installer deploys the frontends declared by the template source.
Normal plan limits apply to the created resources, including the frontend
allowance.

A template function that declares no
[visibility](../functions/creating-functions.md#choose-who-can-invoke-it)
installs as `authenticated` in the current template versions, because their
pages call it as a signed-in user. In any other version it installs as
`private`, like any new function.

Template source reads one [configuration manifest](configuration.md), either
`volcano-config.yaml` or `volcano/volcano-config.yaml`, relative to its build root.
The build-root file takes precedence when both exist; an invalid selected file
fails installation without falling back to the other location.

## Wait for installation

A successful creation response means installation was accepted, not that the
application is ready. Poll `GET /projects/{id}` and inspect the additional field:

```json
{
  "template_installation": {
    "status": "pending",
    "phase": "database"
  }
}
```

Statuses are `pending`, `running`, `ready`, and `failed`. Phases are `database`,
`restore`, `configure`, `deploy`, `verify`, and `ready`. Ordinary projects omit
this field. Wait for `ready` before using or editing the installed application.

If installation fails after acceptance, the project remains available for
inspection or deletion. Delete it before starting over if you do not want to
retain its resources. Closing the page does not cancel an accepted installation.

### Failed installs

A failed installation has `status` `failed` and a `failure_code` that says why:

```json
{
  "template_installation": {
    "status": "failed",
    "phase": "deploy",
    "failure_code": "frontend_quota_exceeded"
  }
}
```

| `failure_code`                    | Meaning                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_withdrawn`                | The share was switched off or deleted, its project is being deleted, its owner's account no longer allows traffic, or it is a copy that may no longer be shared. |
| `source_invalid`                  | The source failed Volcano's checks, such as a release archive whose digest is wrong.                                                                             |
| `source_access_lost`              | Volcano can no longer read the source repository.                                                                                                                |
| `invalid_source_configuration`    | The source's `volcano-config.yaml` is invalid, or a required variable had no value.                                                                              |
| `nothing_to_deploy`               | The source has no function or frontend.                                                                                                                          |
| `database_not_supported`          | The source ships database SQL, which installs do not run yet.                                                                                                    |
| `function_deploy_refused`         | A function in the source cannot be deployed as defined.                                                                                                          |
| `function_quota_exceeded`         | The plan allows no more functions.                                                                                                                               |
| `durable_function_quota_exceeded` | The plan allows no more durable functions.                                                                                                                       |
| `frontend_quota_exceeded`         | The plan allows no more frontends.                                                                                                                               |
| `frontend_deploy_limit`           | The plan allows no more frontend deploys for now.                                                                                                                |
| `build_minutes_exceeded`          | The plan's build minutes are used up.                                                                                                                            |
| `build_failed`                    | A function or frontend from the source failed to build or deploy. Its deployment's build logs say why.                                                           |
| `retry_budget_exhausted`          | The installation kept failing and Volcano stopped retrying.                                                                                                      |
| `internal_error`                  | Volcano failed for a reason of its own.                                                                                                                          |

New codes can be added, so treat an unknown one as a generic failure. An
installation that failed before Volcano recorded reasons has no `failure_code`.

Templates are cloud-only. An environment without a configured database template
returns HTTP `503` and refuses installation. The Trellini starter's attachment bucket initially permits
only the uploader to read, update or delete their files; team-shared attachments
are not enabled by this default policy.

The Trellini bundle contains one frontend and five functions. Optional Slack
notifications require your own webhook, and its MCP connection UI requires
your project's MCP endpoint configuration. The source's optional automatic
card-staleness execution-start integration is not certified by template
packaging. These integrations are not required for the collaborative board.
