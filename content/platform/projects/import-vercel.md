---
title: "Import a Vercel project"
description: "Connect Vercel, preflight a production project, and start a Volcano migration."
---

Move an importable Vercel production project into a new Volcano project. Start
with a preflight, then create an asynchronous import run from its fingerprint.
The migration copies eligible configuration and deploys a new Volcano frontend;
it does not modify Vercel or cut over traffic.

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
  --data @- <<JSON | tee preflight.json
{
  "connection_id": "$CONNECTION_ID",
  "source_id": "$SOURCE_ID",
  "project_name": "example-store-import",
  "target": "production",
  "confirm_environment_variable_read": true
}
JSON
```

A report can contain all four disposition classes. The migration performs
automatic actions. Manual findings need input, deferred findings describe later
Volcano capabilities, and unsupported findings block a correct import.

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

Save that response as `preflight.json`. You can start only when `readiness` is
`importable` and `blocking` is `0`.

## Start the migration

Use a new idempotency key for each distinct import request. Reuse the same key
only when retrying the same request after a network failure.

```bash
export IMPORT_KEY="$(uuidgen | tr '[:upper:]' '[:lower:]')"

curl --include --request POST "$VOLCANO_API_URL/imports/vercel/runs" \
  --header "Authorization: Bearer $PLATFORM_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: $IMPORT_KEY" \
  --data @- <<JSON
{
  "connection_id": "$CONNECTION_ID",
  "source_id": "$SOURCE_ID",
  "project_name": "example-store-import",
  "target": "production",
  "confirm_environment_variable_read": true,
  "preflight_fingerprint": "$(jq -r '.fingerprint' preflight.json)"
}
JSON
```

The request returns `202 Accepted` and a status URL in `Location`:

```http
HTTP/1.1 202 Accepted
Location: /imports/vercel/runs/10000000-0000-0000-0000-000000000001
Content-Type: application/json

{
  "id": "10000000-0000-0000-0000-000000000001",
  "provider": "vercel",
  "source_id": "prj_example",
  "destination_project_name": "example-store-import",
  "resource": {
    "type": "project",
    "id": "20000000-0000-0000-0000-000000000002",
    "name": "example-store-import"
  },
  "deployment": {
    "id": "30000000-0000-0000-0000-000000000003"
  },
  "status": "pending",
  "created_at": "2026-08-06T12:05:00Z",
  "updated_at": "2026-08-06T12:05:00Z"
}
```

## Check migration status

Poll the `Location` path until the run reaches a terminal state:

```bash
curl "$VOLCANO_API_URL/imports/vercel/runs/10000000-0000-0000-0000-000000000001" \
  --header "Authorization: Bearer $PLATFORM_TOKEN"
```

`pending` means the project configuration committed and the Git deployment is
waiting. `running` means the Git deployment worker or one of its child
deployments is running. `succeeded` means every recorded child deployment
succeeded. `superseded` means the import configured the project, but a newer Git
deployment replaced the import deployment. Check the destination project's
latest deployment. `failed` means the Git deployment or a child deployment
reached a terminal failure and includes `error_code` and `error_message`. Use
`resource` for the destination project and `deployment` to correlate the Git
deployment run. A successful import leaves the Vercel project, deployment,
domains, DNS, and traffic unchanged.

If the source changes between preflight and start, Volcano returns `409` with
`import_preflight_stale`:

```json
{
  "error": "the preflight report is stale",
  "code": "import_preflight_stale"
}
```

Run preflight again, use its new fingerprint, and start with a fresh
`Idempotency-Key`.

Other start errors identify the next action:

| Status | Code | Action |
| --- | --- | --- |
| `403` | `provider_permission_required` | Grant the requested Vercel or GitHub permission. |
| `403` | `project_admission_denied` | Resolve the account plan, region, or project-cap restriction. |
| `409` | `provider_reconnect_required` | Reconnect the provider, then run preflight again. |
| `409` | `import_destination_conflict` | Choose a different `project_name`. |
| `409` | `idempotency_key_reused` | Retry with a fresh `Idempotency-Key`. |
| `422` | `import_source_not_importable` | Resolve the blocking preflight findings, then run preflight again. |
| `429` | `provider_rate_limited` | Wait for the active request or provider limit to clear, then retry with the same idempotency key. |
| `503` | `provider_unavailable` | Retry with the same idempotency key after the provider or integration recovers. |

## What migrates

Volcano copies readable production variables and the linked production GitHub
source. It does not copy secrets or integration-managed variables. Preview
deployments and variables, custom domains, and DNS remain deferred or blocking
until their respective migration and cutover steps are available.

Volcano proposes the same GitHub repository recorded by Vercel. It does not let
preflight substitute an unrelated repository. The GitHub action is automatic
only when the current production deployment came from that repository and
branch, and the Volcano GitHub App can access it. Preflight blocks while Vercel
has conflicting production aliases or a production rollout is still changing.
Volcano inspects the exact commit and root used by the promoted production
deployment. An exact Next.js 15 or 16 dependency verifies without a lockfile;
a version range requires supported lockfile evidence. Missing, malformed, or
unsupported dependency or lockfile evidence blocks the import.

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
