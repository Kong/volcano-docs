---
title: "Import a Vercel project"
description: "Connect Vercel and run a read-only production preflight for a new Volcano project."
---

Run a preflight before moving a Vercel-hosted Next.js application to Volcano.
Preflight inventories the source and reports what Volcano can reproduce. It does
not create a project or change either platform.

This preview is currently available in staging. Set the API base URL before
running the examples:

```bash
export VOLCANO_API_URL="https://api.staging.volcano.dev"
```

## Connect Vercel

The Volcano dashboard starts the connection in a browser so the HttpOnly
callback cookie remains available when Vercel redirects back. This command is a
runnable example of the start request, but its cookie jar is separate from your
browser:

```bash
curl --request POST \
  --cookie-jar volcano-import-cookies.txt \
  "$VOLCANO_API_URL/user/imports/connect?provider=vercel" \
  --header "Authorization: Bearer $PLATFORM_TOKEN"
```

The response contains the Vercel installation URL:

```json
{
  "authorization_url": "https://vercel.com/integrations/volcano-import/new?state=..."
}
```

To complete the interactive flow, make the start request and open the returned
URL from the same browser client, then choose one Vercel account or team. After
the callback completes, get the connection ID:

```bash
curl "$VOLCANO_API_URL/user/imports/connections" \
  --header "Authorization: Bearer $PLATFORM_TOKEN"
```

Set `CONNECTION_ID` to the returned connection `id`.

## List Vercel sources

List the projects visible through the selected connection, then choose a source
ID:

```bash
curl --get "$VOLCANO_API_URL/imports/vercel/sources" \
  --header "Authorization: Bearer $PLATFORM_TOKEN" \
  --data-urlencode "connection_id=$CONNECTION_ID"
```

Set `SOURCE_ID` to one of the returned source `id` values.

## Run production preflight

The first release supports a proposed new Volcano project and the `production`
target only. Existing-project imports and overwrite behavior are not supported.

Immediately before preflight, tell the user that the Vercel Integration grant
permits reads and writes even though Volcano performs reads only. Set
`confirm_environment_variable_read` to `true` only after the user confirms.
Without confirmation, Volcano reads variable metadata but leaves readable
production values as manual input.

```bash
curl --request POST "$VOLCANO_API_URL/imports/vercel/preflight" \
  --header "Authorization: Bearer $PLATFORM_TOKEN" \
  --header "Content-Type: application/json" \
  --data @- <<JSON
{
  "connection_id": "$CONNECTION_ID",
  "source_id": "$SOURCE_ID",
  "project_name": "example-store-import",
  "target": "production",
  "confirm_environment_variable_read": true
}
JSON
```

A report can contain all four disposition classes. Automatic actions are ready
for a future importer. Manual findings need input, deferred findings describe
later Volcano capabilities, and unsupported findings block a correct import.

```json
{
  "schema_version": "1",
  "provider": "vercel",
  "source": {
    "id": "prj_example",
    "name": "example-store",
    "account_id": "team_example",
    "framework": "nextjs"
  },
  "destination": {
    "mode": "create",
    "project_name": "example-store-import",
    "target": "production"
  },
  "actions": [
    {
      "code": "git.connect",
      "resource": {
        "kind": "git_repository",
        "name": "example/example-store"
      },
      "disposition": "automatic"
    },
    {
      "code": "project.create",
      "resource": {
        "kind": "project",
        "name": "example-store-import"
      },
      "disposition": "automatic"
    },
    {
      "code": "variable.set",
      "resource": {
        "kind": "variable",
        "name": "PUBLIC_API_URL"
      },
      "disposition": "automatic"
    }
  ],
  "findings": [
    {
      "code": "volcano.nextjs_version_unverified",
      "resource": {
        "kind": "frontend",
        "name": "example-store"
      },
      "disposition": "manual",
      "impact": "blocking",
      "message": "Volcano cannot verify the installed Next.js major from Vercel project metadata.",
      "remediation": "Verify that the production source uses Next.js 15 or 16 before importing."
    },
    {
      "code": "vercel.domain_cutover_deferred",
      "resource": {
        "kind": "domain",
        "name": "www.example.com"
      },
      "disposition": "deferred",
      "impact": "warning",
      "message": "The project domain is not changed during discovery.",
      "remediation": "Complete domain and TLS cutover after the frontend is deployed."
    },
    {
      "code": "vercel.preview_environment_deferred",
      "resource": {
        "kind": "frontend",
        "name": "feature-example.vercel.app"
      },
      "disposition": "deferred",
      "impact": "warning",
      "message": "The preview environment is not imported.",
      "remediation": "Recreate it after Volcano preview environments are available."
    },
    {
      "code": "vercel.production_value_required",
      "resource": {
        "kind": "variable",
        "name": "DATABASE_URL"
      },
      "disposition": "manual",
      "impact": "blocking",
      "message": "The production variable value is unavailable to the import.",
      "remediation": "Provide the production value before importing."
    },
    {
      "code": "vercel.scoped_variable_deferred",
      "resource": {
        "kind": "variable",
        "name": "PREVIEW_API_URL",
        "source_id": "env_preview_api_url",
        "scope": "git_branch=feature%2Fcheckout&target=preview"
      },
      "disposition": "deferred",
      "impact": "warning",
      "message": "The scoped variable is not imported into production.",
      "remediation": "Recreate it after Volcano supports the source scope."
    },
    {
      "code": "volcano.write_only_secret_required",
      "resource": {
        "kind": "variable",
        "name": "SESSION_SECRET"
      },
      "disposition": "unsupported",
      "impact": "blocking",
      "message": "The sensitive production variable cannot be read from Vercel.",
      "remediation": "Rotate or enter the value in an approved Volcano secret destination."
    }
  ],
  "summary": {
    "automatic": 3,
    "manual": 2,
    "deferred": 3,
    "unsupported": 1,
    "warnings": 3,
    "blocking": 3
  },
  "readiness": "blocked",
  "source_fingerprint": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "capability_fingerprint": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "fingerprint": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "generated_at": "2026-08-06T12:00:00Z"
}
```

Volcano proposes the same GitHub repository recorded by Vercel. It does not let
preflight substitute an unrelated repository. The GitHub action is automatic
only when the current production deployment came from that repository and
branch, and the Volcano GitHub App can access it. Preflight blocks while Vercel
has conflicting production aliases or a production rollout is still changing.
Until Volcano can inspect the repository manifest, preflight also requires you
to verify that the production source uses Next.js 15 or 16.

## Review permissions and limits

The Vercel Integration requests these permissions for discovery:

| Vercel scope | Access | Use |
| --- | --- | --- |
| `team` | Read | Identify the account or team selected during installation. |
| `project` | Read | Read project, Git, build, variable metadata, and project-domain settings. |
| `deployment` | Read | Read production and preview deployment settings. |
| `domain` | Read | Read domain inventory needed for a later cutover. |
| `global-project-env-vars` | Read/Write | Read existing account-owned project variables. Vercel does not offer a read-only grant for this access. |

Volcano performs reads only during source listing and preflight, including when
Vercel grants `global-project-env-vars` as Read/Write. Preflight does not create
or update Vercel projects, deployments, variables, integrations, or domains.

Vercel does not return sensitive variable values after creation. Each sensitive
production variable is therefore unsupported and blocking until Volcano has an
approved write-only secret destination. Preview variables, preview deployments,
and domains appear in the report for planning but are not transferred.
