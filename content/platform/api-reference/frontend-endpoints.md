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
- `app_root` (optional): relative POSIX path from the uploaded archive root to the Next.js app to build, such as `apps/web` for a monorepo. Omit it for single-app archives.
- `archive` (required): ZIP or `tar.gz` bundle of the frontend project or monorepo workspace root. The API stores a normalized `tar.gz` archive.

Size limits:
- `SOURCE_ARCHIVE_SIZE_LIMIT_MB` is enforced by the API for uploaded and normalized source archives.
- `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB` is enforced by the publish build for the final Lambda container images.
- The CLI uploads `tar.gz` and does not enforce its own source archive size limit.

Example monorepo upload:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=web" \
  -F "framework=nextjs" \
  -F "app_root=apps/web" \
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
- Project variables stored through the variables API are resolved before the frontend build.
- Project variables are available to the build, except names the build itself reserves, which it drops with a warning in the build log. See [Environment Variables](../functions/environment-variables.md#names-reserved-during-builds).
- Variables other than `NEXT_PUBLIC_*` are also available to the deployed frontend runtime.
- Next.js inlines `NEXT_PUBLIC_*` values into the client bundle, so those values are excluded from the server runtime. Changing one requires a redeploy.
- For monorepos, `app_root` selects the Next.js app inside the uploaded archive. Redeploys reuse the frontend's stored `app_root`.

Supported frontend environments:
- Next.js `15.x` and `16.x`.
- Node.js `22.x` and `24.x`, inferred from `package.json` `engines.node`.
- OpenNext `4.x`.

If `engines.node` is omitted, Volcano builds with Node.js `20.x`.
Your selected Node.js family must satisfy the installed Next.js package's `engines.node` constraint. The runtime matrix is tested against the pinned Next versions' npm metadata: Next `15.5.22` requires `^18.18.0 || ^19.8.0 || >=20.0.0`, and Next `16.3.0` requires `>=20.9.0`.

Plan limits:
- FREE users can create up to `FREE_FRONTEND_DEPLOYMENTS` frontends per project.
- PRO users can create up to `PRO_FRONTEND_DEPLOYMENTS` frontends per project.
- A value of `0` means unlimited.
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

## Create Frontend Custom Domain (PRO)

`POST /projects/{project_id}/frontends/{frontend_id}/domain`

JSON body:
- `domain` (required): fully-qualified hostname like `mydomain.com`.
- `tls.mode` (required): must be `byoc`.
- `tls.certificate_pem` (required): PEM-encoded certificate.
- `tls.private_key_pem` (required): PEM-encoded private key.
- `tls.certificate_chain_pem` (optional): PEM-encoded chain.

Behavior:
- FREE plan: returns `403` (custom domains are PRO-only).
- PRO plan: configures one custom domain per frontend.
- BYOC is mandatory for custom-domain creation.
- Your uploaded certificate is used to secure the custom domain.
- Both the custom domain and default Volcano frontend URL continue to work.
- The default `*.frontends.<env>.volcano.dev` URL keeps strict valid TLS and is not replaced by BYOC certificates from other domains.
- Returns `201` when a new custom domain is queued, and `200` when the same domain is already configured.
- Returns `409` when the frontend already has a different domain or the requested domain is already attached elsewhere.
- Returns `503` when custom domain provisioning is temporarily unavailable.

Provisioning lifecycle:
- `pending_verification`: waiting for required domain checks to complete.
- `provisioning`: verification done; domain activation is in progress.
- `active`: domain is live and serving traffic.
- `detaching`: domain removal has been requested and is being processed.
- `failed`: provisioning or detach operation failed and requires retry/user action.

## Get Frontend Custom Domain

`GET /projects/{project_id}/frontends/{frontend_id}/domain`

Response fields:
- `domain`
- `domain_status`
- `tls_mode`
- `verification_status`
- `verification_records[]`
- `required_routing_record`
- `effective_urls[]`
- `created_at`
- `updated_at`

Notes:
- When the frontend has no custom domain configured, returns `200` with a JSON `null` body (the empty state), not `404`.
- Returns `404` only when the frontend itself does not exist.
- `verification_records[]` is usually empty for BYOC because certificate ownership/validation comes from the uploaded cert.
- `required_routing_record` contains the DNS record that should route traffic to Volcano (currently `CNAME`).
- `effective_urls[]` always includes the default Volcano frontend URL; it also includes the custom domain URL once active.

## Delete Frontend Custom Domain

`DELETE /projects/{project_id}/frontends/{frontend_id}/domain`

Removes custom-domain configuration from the frontend and frees shard capacity.
Returns `204` when the detach request is queued successfully.

## List Frontend Deployments

`GET /projects/{project_id}/frontends/{frontend_id}/deployments?page=1&limit=10`

Response: paginated `FrontendDeployment` records for deploy/redeploy/delete operations.

## Deployment Build Logs

Frontend runtime and deployment logs are available through
`POST /projects/{project_id}/logs/search` with `resource.type=frontend`.
For deployment build logs, include `resource.ids=[frontend_id]` and
`resource.deployments.ids=[deployment_id]`.
