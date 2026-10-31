---
title: 'Frontend previews'
description: 'Deploy a build of a frontend to its own URL, check it, promote it to be what the frontend serves, and roll back.'
---

A preview is a copy of a frontend that you deploy to its own URL before it
replaces what the frontend serves. Use it to check a change against your real
project variables, then promote it without rebuilding.

A preview is created from a local directory, as a deploy is. It is served at its
own host, not at the frontend's, so the frontend keeps serving its own build.

Previews work on the local development server too. Use `volcano frontends
preview …` there, and `volcano cloud frontends preview …` for the cloud. The
local server builds and serves a preview on your machine at its own
`*.frontends.localhost` host, and promotion and rollback route the frontend's
local host the same way. The commands below show the cloud form.

## Deploy a preview

```bash
volcano cloud frontends preview create web --name redesign --path ./apps/web
```

`--name` is required and unique within the frontend, and a frontend can have at
most 20 live previews. `--ttl` deletes the preview
after that long, up to 720 hours; without it the preview lives until you delete
it. The first deployment starts at once. Read the URL when it is ready:

```bash
volcano cloud frontends preview get web redesign
volcano cloud frontends preview list web
```

Deploy a new build to the same preview with `preview deploy web redesign
--path ./apps/web`.

## What a preview runs with

A preview builds with the frontend's project variables as they are when you
deploy it, and keeps them: changing a variable afterwards does not reach a
running preview. `preview get` reports `Variables: changed` once the frontend's
selection no longer matches what the preview was built with.

On the local development server, restarting the server restarts each preview
with the frontend's current variables, and `preview get` then reports
`Variables: changed` if a variable changed since the preview was deployed.

A preview runs in one region: the first region the frontend deploys to, or the
project's first region by name if the frontend has not deployed yet. A redeploy
of the preview stays in the region it is in. Its URL is not indexed by search engines and sends no
referrer, but anyone who holds the URL can open it. Do not rely on a preview to
keep a build private.

A preview is not a sandbox. Its build gets the frontend's production variables,
secrets included, and requests to its function routes reach the frontend's
production functions and the data they use. Anyone with the URL runs the
preview's code against production without signing in. Deploy only code you
would deploy to the frontend itself, and delete a preview you no longer need.

## Promote a preview

```bash
volcano cloud frontends preview promote web redesign
```

Promotion points the frontend's own host at the preview. Nothing is rebuilt or
copied, and the frontend's custom domains, request counts and rate limits stay
the frontend's. The preview must be ready, and must have been built with the
variables the frontend selects now; otherwise the promotion is refused with
`409`. The frontend itself must have deployed successfully at least once, so
`--to-production` always has a build to return to; until then promotion is
refused with `409` and `code: frontend_not_deployed`. Promotion names the revision of what the frontend serves that the CLI just
read, so if someone else promoted, rolled back, or deleted the preview kept for a
rollback in the meantime it fails instead of overwriting them. Read the serving
state again and retry.

A preview runs in one region, so while it is promoted the frontend is served from
that region alone, even if the frontend deploys to several. Rolling back returns
it to all of its own regions. If the project's regions change while a preview is
promoted, the frontend moves to them after a rollback to its own build.

See what a frontend serves:

```bash
volcano cloud frontends serving web
```

A frontend read through the API also carries `serving_candidate_id`: the ID of
the promoted preview, or `null` while the frontend serves its own build. While it
is set, the frontend's `current_deployment_id` and `status` describe a build that
receives no traffic.

While a preview is promoted, deploying the frontend itself is refused with `409`
and `code: frontend_served_by_candidate`, and a Git push does not deploy it.
Run `volcano cloud frontends rollback --to-production` first; a plain rollback
may return to another preview. A preview the frontend serves cannot be deleted or deployed to. After a
promotion, the preview the frontend served before is kept for a rollback and
cannot be deployed to either; deleting it gives up that rollback, and
`volcano cloud frontends rollback --to-production` still returns to the frontend's own build.

## Roll back

```bash
volcano cloud frontends rollback web
volcano cloud frontends rollback web --to-production
```

A rollback swaps what the frontend serves with what it served before the last
promotion or rollback, so a second rollback undoes the first; it does not step
further back. With `--to-production` it returns the frontend to its own build.

A rollback that returns to a preview promotes it again, and is refused with `409`
whenever promoting it would be. Rolling back to the frontend's own build is not
refused for those reasons.

## Delete a preview

```bash
volcano cloud frontends preview delete web redesign
```

This removes the preview's runtime, assets and source. Deleting the frontend
deletes its previews first.

## Availability

Creating, deploying to and promoting a preview are behind a release gate and
answer `404` with code `feature_unavailable` while the gate is off for your
environment. A rollback that would make a preview serve again is promoting it,
and is refused the same way. `GET /capabilities` lists `frontends.candidates` as
`available` when it is on. Listing, reading and deleting existing previews, and
rolling back to the Frontend's own build, work whether or not the gate is on.

The API calls a preview a Candidate. See [Frontend endpoints](../api-reference/frontend-endpoints.md#previews).
