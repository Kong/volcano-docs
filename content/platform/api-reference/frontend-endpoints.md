---
title: "Frontend Endpoints"
description: "Frontend hosting APIs are project-scoped and require a platform user token."
---

Frontend hosting APIs are project-scoped and require a platform user token.

## Create Frontend Deployment

`POST /projects/{project_id}/frontends`

Multipart form fields:
- `name` (required): DNS-safe frontend name.
- `framework` (optional): currently `nextjs`.
- `app_root` (optional): relative POSIX path from the uploaded archive root to the Next.js app to build, such as `apps/web` for a monorepo. Omit it for single-app archives. The directory normally holds the app's `package.json`. If it has none, the nearest `package.json` above it must build it with `next build <dir>`, as the `volcano init nextjs` layout does with `next build web`; the build then runs from that `package.json`.
- `variable_scope` (optional): `scoped` or `all`. New frontends default to `scoped`; omitting it for an existing frontend preserves the stored selection.
- `variables` (optional, repeated): project variable names selected when `variable_scope=scoped`. Submit one multipart field per name. An empty scoped selection exposes no project variables.
- `archive` (required): ZIP or `tar.gz` bundle of the frontend project or monorepo workspace root. The API stores a normalized `tar.gz` archive.

Size limits:
- Uploaded and normalized source archives are limited to 256 MB, enforced by the API.
- Each final frontend image is limited to 4096 MB, enforced by the build.
- The CLI uploads `tar.gz` and does not enforce its own source archive size limit.
- The server runtime environment is limited to 4096 bytes: the selected variables other than `NEXT_PUBLIC_*`, plus about 900 bytes Volcano sets itself. An oversized environment returns `400` with the byte count. See [Environment size](../frontends/deploy.md#environment-size).

Example monorepo upload:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=web" \
  -F "framework=nextjs" \
  -F "app_root=apps/web" \
  -F "variable_scope=scoped" \
  -F "variables=NEXT_PUBLIC_API_URL" \
  -F "archive=@repo.tar.gz"
```

Responses:
- `201 Created`: new frontend created with a `Frontend` resource in `provisioning` state.
- `200 OK`: existing frontend with the same name was updated and its deployment was started or queued (frontend ID and site URL are preserved). A queued response keeps the frontend's current status and sets `pending_deployment_id`.
- `409 Conflict`: deletion is already queued or running for that frontend.
- `403 Forbidden`: the project has reached a frontend limit.

Deployment availability and concurrency:
- Existing traffic remains on an available runtime while a redeploy builds and provisions.
- Each deployment publishes its own static assets before the runtimes switch to its build, and the live build's assets keep serving until the new deployment goes live, so a page loaded mid-deployment resolves its hashed chunks whichever of the two builds served it. The previous build's assets are retained briefly after cutover, then removed.
- A failed redeploy keeps the previous deployment serving: the runtimes are put back on the build they were running, the frontend stays `active` on it, and only the attempted deployment is recorded as failed.
- Only one deployment runs for a given frontend. New deploys supersede older queued deploys and start after the running deployment finishes.
- Delete supersedes queued deploys and runs after the current deployment. Later deploys return `409 Conflict` until deletion finishes.
- Independent frontends, including frontends in different projects, can deploy concurrently.
- `degraded` means the runtime remains available but edge synchronization did not complete. Volcano runs bounded edge-only recovery without rebuilding the frontend.
- Edge recovery stands down as soon as a new deployment is queued, so a redeploy is never overtaken by the older build it would have republished.
- If edge recovery exhausts its retries, the frontend stays `degraded` and keeps serving; another redeploy retries recovery while preserving availability.

Build environment:
- Project variables stored through the variables API are resolved before the frontend build according to the frontend's selection. New frontends default to `scoped` with no selected names; existing frontends keep their stored selection when a deploy omits `variable_scope` and `variables`.
- A scoped deploy selects the repeated `variables` names. `variable_scope=all` explicitly selects every project variable. Selected variables are available to the build, except names the build itself reserves, which it drops with a warning in the build log. See [Environment Variables](../functions/environment-variables.md#names-reserved-during-builds).
- Selected variables other than `NEXT_PUBLIC_*` are also available to the deployed frontend runtime.
- Next.js inlines `NEXT_PUBLIC_*` values into the client bundle, so those values are excluded from the server runtime. Changing one requires a redeploy.
- For monorepos, `app_root` selects the Next.js app inside the uploaded archive. Redeploys reuse the frontend's stored `app_root`.

Supported frontend environments:
- Next.js `15.x` and `16.x`.
- Node.js `22.x` and `24.x`, inferred from `package.json` `engines.node`.

If `engines.node` is omitted, Volcano builds with Node.js `22.x`.
Volcano runs the `build` script from `package.json`, or `next build` when it is missing. For Next.js `16.x` it adds `--webpack` to `next build`.
Your selected Node.js family must satisfy the installed Next.js package's `engines.node` constraint. The runtime matrix is tested against the pinned Next versions' npm metadata: Next `15.5.27` requires `^18.18.0 || ^19.8.0 || >=20.0.0`, and Next `16.4.0` requires `>=20.9.0`.

Plan limits:
- HOBBY users can create one frontend per project.
- SUPERAGENT users can create frontends up to the project hard limit.
- When exceeded, the API returns `403` with an error like `frontend deployment limit exceeded for your plan`.

Hard limit:
- Each project can contain up to 10,000 frontends, regardless of plan.

## List Frontends

`GET /projects/{project_id}/frontends?page=1&limit=10`

Response: paginated `Frontend` list.

## Get Frontend

`GET /projects/{project_id}/frontends/{frontend_id}`

Response includes:
- `status`
- `app_root` (when configured)
- `site_url` (when active)
- `custom_domain` (when configured)
- `custom_domain_status` (when configured)
- `current_deployment_id` (latest deployment operation ID for logs/status)
- `function_routes` (the frontend's [Function routes](#function-routes), most specific first; also in each item of the list response)

Frontend status values:
- `provisioning`: a deployment is building or provisioning.
- `active`: the deployment and edge are ready.
- `degraded`: the runtime remains available while edge-only recovery retries, and after those retries are spent.
- `failed`: no deployment is serving; deployment history contains the failure. A redeploy that fails over a serving frontend stays `active` instead.
- `deleting`: asynchronous cleanup is running.

Frontend deployment history also uses:
- `queued`: accepted and waiting for the running deployment.
- `superseded`: replaced by a newer queued deployment and will not run.

## Redeploy Frontend

`POST /projects/{project_id}/frontends/{frontend_id}/redeploy`

Triggers a new deployment using the latest uploaded artifact. If `app_root` is configured on the frontend, redeploy uses the stored value. A deployment that starts immediately returns `status: "provisioning"`, then transitions to `active`, `degraded`, or `failed`. If another deployment is running, the frontend keeps its current status, sets `pending_deployment_id`, and supersedes any older queued redeploy. The previous runtime and its published static assets remain available while provisioning, and a failed redeploy keeps them serving.

## Delete Frontend

`DELETE /projects/{project_id}/frontends/{frontend_id}`

Returns `202 Accepted` and schedules asynchronous deprovisioning. If another deployment is running, list/get responses keep the frontend's current status and expose the queued deletion as `pending_deployment_id`. The status changes to `deleting` when cleanup starts. When cleanup finishes, the frontend no longer appears in lists and `GET /projects/{project_id}/frontends/{frontend_id}` returns `404`.

## Create Frontend Custom Domain

`POST /projects/{project_id}/frontends/{frontend_id}/domain`

Ask Volcano to issue and renew the certificate:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$FRONTEND_ID/domain" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "app.example.com",
    "tls": {
      "mode": "managed"
    }
  }'
```

The create response starts in `pending_verification` and names the record to
publish in `verification_records`. When your account already owns the
hostname's domain, that is the certificate validation CNAME, shown after the
polling example below. Otherwise it is a tenant-specific TXT ownership
challenge for the hostname's registrable domain:

```json
{
  "domain": "app.example.com",
  "tls_mode": "managed",
  "domain_status": "pending_verification",
  "verification_status": "pending",
  "verification_records": [
    {
      "name": "_volcano.example.com",
      "type": "TXT",
      "value": "volcano-domain-verification=0123456789abcdef0123456789abcdef"
    }
  ],
  "routing_target_hostname": "my-frontend.frontends.volcano.run",
  "effective_urls": [
    "https://my-frontend.frontends.volcano.run/"
  ],
  "created_at": "2026-09-02T12:00:00Z",
  "updated_at": "2026-09-02T12:00:00Z"
}
```

When the response includes a TXT record, add it within 72 hours. Until Volcano
sees the exact value, the hostname is only reserved. If the proof does not appear
in that window, Volcano removes the reservation so the hostname can be requested
again.

A reservation does not lock out the hostname's real owner. The TXT value is
derived from your account and the hostname, so each account has its own. If
another account holds an unverified reservation, a managed TLS create returns
`409` with the record your account must publish:

```json
{
  "error": "custom domain is reserved by another account until its ownership is verified",
  "code": "ownership_verification_required",
  "required_record": {
    "name": "_volcano.example.com",
    "type": "TXT",
    "value": "volcano-domain-verification=fedcba9876543210fedcba9876543210"
  }
}
```

Publish that record and send the same request again. Once Volcano can see the
record, the retry replaces the other account's reservation and returns `201`,
and the other account's domain is removed. A BYOC request whose certificate and
key are publicly trusted for the hostname replaces such a reservation the same
way. Self-signed and private-CA certificates are accepted only for hostnames no
other account has claimed, and they never replace a reservation.

Once the TXT proof succeeds, your account owns the registrable domain and every
hostname below it, including after the custom domain is deleted. The same
account can attach those hostnames in any project without another record, and
other accounts receive `409` for both managed TLS and BYOC requests. Keep the
`_volcano` TXT record published: the domain moves to another account only once
DNS serves that account's record and stops serving yours. See
[Move a domain to another account](../frontends/domain-verification.md#move-a-domain-to-another-account).
Custom domains already attached keep serving after a move. BYOC domains are
never taken over, including ones created with a self-signed certificate before
any account claimed the hostname.

After adding the TXT record, poll the domain endpoint for the certificate
validation CNAME. Stop early if provisioning fails:

```bash
deadline=$((SECONDS + 300))
while (( SECONDS < deadline )); do
  DOMAIN_RESPONSE="$(curl --fail-with-body -sS \
    -H "Authorization: Bearer $PLATFORM_TOKEN" \
    "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$FRONTEND_ID/domain")"
  if jq -e '.verification_records[]? | select(.type == "CNAME")' >/dev/null <<<"$DOMAIN_RESPONSE"; then
    break
  fi
  if jq -e '.domain_status == "failed" or .verification_status == "failed"' >/dev/null <<<"$DOMAIN_RESPONSE"; then
    jq . <<<"$DOMAIN_RESPONSE" >&2
    exit 1
  fi
  sleep 2
done

if ! jq -e '.verification_records[]? | select(.type == "CNAME")' >/dev/null <<<"$DOMAIN_RESPONSE"; then
  echo "timed out waiting for certificate validation record" >&2
  exit 1
fi

jq . <<<"$DOMAIN_RESPONSE"
```

Once Volcano verifies ownership, `verification_records` changes to the
certificate validation CNAME. A create for a hostname your account already owns
returns it right away:

```json
{
  "domain": "app.example.com",
  "tls_mode": "managed",
  "domain_status": "pending_verification",
  "verification_status": "pending",
  "verification_records": [
    {
      "name": "_acme-challenge.app.example.com",
      "type": "CNAME",
      "value": "7d7b8a4e-7418-4a86-8e16-670870f00fa0.acme.frontends.volcano.run"
    }
  ],
  "routing_target_hostname": "my-frontend.frontends.volcano.run",
  "effective_urls": [
    "https://my-frontend.frontends.volcano.run/"
  ],
  "created_at": "2026-09-02T12:00:00Z",
  "updated_at": "2026-09-02T12:00:00Z"
}
```

Create the CNAME and keep it in DNS so Volcano can issue and renew the
certificate. Issuance can wait in a queue when many domains are added together.
Keep the `_volcano` TXT record too. Point your hostname at
`routing_target_hostname` separately to send traffic to the frontend.

Behavior:
- Configures one custom domain per frontend on every plan.
- Managed TLS issues and renews the certificate without accepting or returning certificate material.
- Managed TLS accepts hostnames up to 219 characters; BYOC accepts up to 253.
- Route traffic with a `CNAME` to `routing_target_hostname` only if your DNS provider confirms the hostname is not a zone apex. At any zone apex, including a delegated subdomain apex, use a provider-supported ALIAS, ANAME, or CNAME-flattening record.
- Both the custom domain and default Volcano frontend URL continue to work.
- The default `*.frontends.<env>.volcano.run` URL keeps strict valid TLS and is not replaced by BYOC certificates from other domains.
- Returns `201` when a new custom domain is queued, and `200` when the same domain is already configured.
- Returns `403` when a managed TLS request would exceed the account's [managed TLS certificate limit](../guides/plans-and-limits.md#frontends).
- Returns `409` when the frontend already has a different domain, the requested domain is attached elsewhere or claimed by another account, or a previous attachment is still detaching. When another account only holds an unverified managed TLS reservation, a managed TLS request gets a `409` with `code: ownership_verification_required` and the `required_record` to publish before retrying. A BYOC request gets a plain `409` unless its certificate is publicly trusted for the hostname, which replaces the reservation.
- Returns `503` when custom domain provisioning is temporarily unavailable.
- Changing between managed TLS and BYOC requires deleting the existing domain and creating it again. Moving a hostname from BYOC to managed TLS this way leaves it without HTTPS until the managed certificate is issued.
- Hostnames under `volcano.dev` cannot be registered as custom domains.
- Local mode does not provide managed certificate issuance. Use BYOC when running locally.

Provisioning lifecycle:
- `pending_verification`: waiting for the ownership TXT record or the later certificate validation CNAME.
- An ownership reservation expires after 72 hours and the domain moves to `detaching`. Once it is removed, submit the domain again to receive a new TXT challenge.
- `provisioning`: validation succeeded and activation is in progress.
- `active`: domain is live and serving traffic.
- `detaching`: domain removal has been requested and is being processed.
- `failed`: setup or removal failed. For managed TLS, check `failure_reason`, correct the problem, then delete and recreate the domain.

To use your own certificate instead, set `tls.mode` to `byoc` and provide
`certificate_pem`, `private_key_pem`, and optionally `certificate_chain_pem`.
A request that omits `tls.mode` is treated as `byoc`.
Volcano validates the key pair and hostname before accepting it.

## Get Frontend Custom Domain

`GET /projects/{project_id}/frontends/{frontend_id}/domain`

Response fields:
- `domain`
- `domain_status`
- `tls_mode`
- `verification_status`:
  - `verified`: the domain is served by a validated certificate.
  - `pending`: the domain is not served yet, is being re-validated after its certificate material was withdrawn, or Volcano is retrying after a failure.
  - `failed`: a failure left the domain unserved, alongside `domain_status: failed`. Managed domains report the cause in `failure_reason`.
- `failure_reason` when managed TLS provisioning fails
- `verification_records[]`
- `required_routing_record` (deprecated; no longer returned)
- `routing_target_hostname`
- `effective_urls[]`
- `created_at`
- `updated_at`

Notes:
- When the frontend has no custom domain configured, returns `200` with a JSON `null` body (the empty state), not `404`.
- Returns `404` only when the frontend itself does not exist.
- `verification_records[]` is usually empty for BYOC because certificate ownership/validation comes from the uploaded cert.
- `failure_reason` reports `provider`, `certificate`, `ownership`, or `internal`; treat any other value as `internal`. An `ownership` failure means another account has already claimed the hostname. Volcano omits provider details and never returns stored BYOC errors.
- `verification_records[]` entries have `name`, `type`, and `value`. Managed TLS may return a tenant-specific ownership TXT record before the certificate validation CNAME, so follow the records in the current response. Keep the CNAME in DNS for renewal.
- `required_routing_record` is deprecated and no longer returned because Volcano cannot determine whether your domain is a DNS zone apex, including a delegated subdomain apex. Use `routing_target_hostname` as the DNS routing target. Configure a CNAME only if your DNS provider confirms the domain is not a zone apex; for any zone apex, use a provider-supported ALIAS, ANAME, or CNAME-flattening record.
- `effective_urls[]` always includes the default Volcano frontend URL; it also includes the custom domain URL once active.

## Delete Frontend Custom Domain

`DELETE /projects/{project_id}/frontends/{frontend_id}/domain`

Removes custom-domain configuration from the frontend and frees shard capacity.
Returns `204` when the detach request is queued successfully.

## Function routes

Send every request under a path of the frontend to a `public` HTTP-mode
function. See [Frontend Function routes](../frontends/function-routes.md) for
how matching works and how to keep sessions in cookies.

### Create a route

`POST /projects/{project_id}/frontends/{frontend_id}/function-routes`

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$FRONTEND_ID/function-routes" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"function_id":"9a3e5c71-0b2d-4f6e-8c1a-7d4b2e9f0a13","path_prefix":"/api/session","strip_prefix":true}'
```

JSON body:
- `function_id` (required): a standard function in the same project with `visibility: public` and `invocation_mode: http`.
- `path_prefix` (required): starts with `/`, isn't `/` alone, doesn't end with `/`, and is at most 512 bytes.
- `strip_prefix` (optional, default `false`): remove the prefix from the path the function sees.

Returns `201` with the route:

```json
{
  "id": "6f1c2a9e-3b0d-4a51-9a39-0c6f2f1e8d42",
  "project_id": "c4e8a1f2-7d3b-4e9a-b6c0-1f2e3d4c5b6a",
  "frontend_id": "2d6b1c0e-8f4a-4b7e-9d3a-5e1f0c2b7a64",
  "function_id": "9a3e5c71-0b2d-4f6e-8c1a-7d4b2e9f0a13",
  "path_prefix": "/api/session",
  "strip_prefix": true,
  "created_at": "2026-10-01T12:00:00Z",
  "updated_at": "2026-10-01T12:00:00Z"
}
```

Errors:
- `400`: the path prefix is invalid, or the function is durable or not in HTTP mode.
- `404`: the frontend or function isn't in the project.
- `409`: the path is already routed, the frontend has 64 routes, or the function isn't `public`.

### List routes

`GET /projects/{project_id}/frontends/{frontend_id}/function-routes`

Returns `{"data": [...]}` with the routes ordered from most to least specific.

### Replace a route

`PUT /projects/{project_id}/frontends/{frontend_id}/function-routes/{route_id}`

Takes the same body as create and replaces the route's target, path, and prefix
handling. The new target must meet the same rules. Returns `200` with the route.

### Delete a route

`DELETE /projects/{project_id}/frontends/{frontend_id}/function-routes/{route_id}`

Returns `204`.

## List Frontend Deployments

`GET /projects/{project_id}/frontends/{frontend_id}/deployments?page=1&limit=10`

Response: paginated `FrontendDeployment` records for deploy/redeploy/delete operations.

## Deployment Build Logs

Frontend runtime and deployment logs are available through
`POST /projects/{project_id}/logs/search` with `resource.type=frontend`.
For deployment build logs, include `resource.ids=[frontend_id]` and
`resource.deployments.ids=[deployment_id]`.
