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
Do not combine `template_id` with `initialPrompt`.

If installation fails after acceptance, the project remains available for
inspection or deletion. Delete it before starting over if you do not want to
retain its resources. Closing the page does not cancel an accepted installation.

Templates are cloud-only. An environment without a configured database template
returns HTTP `503` and refuses installation. The Trellini starter's attachment bucket initially permits
only the uploader to read, update or delete their files; team-shared attachments
are not enabled by this default policy.

The Trellini bundle contains one frontend and five functions. Optional Slack
notifications require your own webhook, and its MCP connection UI requires
your project's MCP endpoint configuration. The source's optional automatic
card-staleness execution-start integration is not certified by template
packaging. These integrations are not required for the collaborative board.
