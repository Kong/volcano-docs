---
title: 'Frontend routes'
description: 'Serve another frontend of your project under a path of your site, so one hostname runs several apps.'
---

A Frontend route mounts another frontend of your project at a path of your
site. With `docs` mounted at `/docs`, `https://example.com/` keeps serving your
main site while `https://example.com/docs/...` is served by the `docs` frontend,
on the same hostname, certificate, and cookies.

```yaml
# volcano-config.yaml (excerpt)
frontends:
  - name: site
    frontend_routes:
      - frontend: docs
        path_prefix: /docs
      - frontend: docs
        path_prefix: /blog
  - name: docs
```

`site` is the frontend whose hostnames, such as its custom domain `example.com`,
serve the routes. Requests under `/docs` and `/blog` go to `docs`; everything
else stays on `site`.

## Build the mounted frontend for its paths

Volcano forwards the path unchanged: a visitor's `GET /docs/intro` reaches
`docs` as `GET /docs/intro`. Build the mounted frontend so its pages live under
the prefixes it is mounted at:

- Put its pages in matching directories, such as `app/docs/` and `app/blog/`.
  This works for a frontend mounted at several prefixes.
- Or set `basePath: '/docs'` in its `next.config.js` when it is mounted at one
  prefix only. Its `next/image` images are optimized under the `basePath`, as
  [on its own hostname](./deploy.md#optimize-images-under-a-basepath).

In the cloud, Volcano sets each frontend's Next.js build ID, even when the app
defines `generateBuildId`, so frontends built separately never share one. Two frontends
share a build ID only when one is
[deployed from the other's build](./deploy.md#deploy-one-build-to-several-frontends),
and then they serve the same build files, so a root build file such as
`/_next/static/<buildId>/_buildManifest.js` is the same from either. If the
mounted frontend should run a different build, build it on its own instead of
reusing the main frontend's. Local mode keeps the build ID your app sets, so
there give each app its own: don't set `generateBuildId` to one shared value,
such as a single git commit SHA, across apps you mount together.

The mounted frontend's own hostname keeps working, so you can deploy and check
it there before you add the route.

Volcano also sends the mounted frontend's build files to it. Next.js requests
`/_next/static/...` and `/_next/image` at the root of the site, outside your
prefixes, so Volcano finds which frontend's current deployment has each file:

- `/_next/static/...` goes to the frontend whose deployment serves that file,
  checking the main frontend first. A file no frontend serves gets the main
  frontend's `404`.
- `/_next/image?url=...` goes to the frontend that owns `url`: the mounted
  frontend when `url` is under its prefix or is one of its
  `/_next/static/media` files, the main frontend otherwise. A remote image,
  such as `url=https://...`, is optimized by the main frontend, under its own
  `images.remotePatterns`, sizes, and qualities. For a mounted app's remote
  images, allow them in the main frontend's `next.config` too, or set
  `unoptimized` on them.
- `/_next/data/<buildId>/<page>.json`, the page data a Pages Router app fetches
  when it navigates, goes to the frontend whose deployment built that
  `buildId`, so a locale in the path, such as `.../en/docs/intro.json`, is
  never mistaken for a route. If no deployment built it, the request goes where
  the page goes: `.../docs/intro.json` reaches the frontend mounted at `/docs`.
  When two frontends deploy the same build, page data goes to the one whose
  route the page is under; localized page data of a shared build goes to the
  main frontend, which runs that same build.

Other root paths stay on the main frontend. If the mounted frontend serves its
own public files or API routes, put them under a mounted prefix, such as
`public/docs/logo.svg` or `app/docs/api/search/route.js`, or mount an extra
prefix for them.

### Link between frontends with plain links

Each frontend is a separate app. Use a plain `<a href="/docs">` to go from one
to the other, not the framework's client-side `<Link>`, which only navigates
within one app. Inside one frontend, `<Link>` works as usual.

## Add a route

Frontend routes are rolling out. Where
[`GET /capabilities`](../api-reference/overview.md) lists `frontend_routes` as
`unavailable`, creating or changing a route answers `404` with code
`feature_unavailable`, and applying (or dry-running) a manifest that would
create or change one answers `400` with code `feature_unavailable` and changes
nothing. Listing and deleting routes always work, and a manifest that keeps or
removes routes still applies. Local mode always accepts them.

Call the API with the mounted frontend's ID:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$SITE_ID/frontend-routes" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"target_frontend_id\":\"$DOCS_ID\",\"path_prefix\":\"/docs\"}"
```

```json
{
  "id": "3b8e6d2a-1c4f-4e7a-9b05-6a2d8f1c0e47",
  "project_id": "c4e8a1f2-7d3b-4e9a-b6c0-1f2e3d4c5b6a",
  "frontend_id": "2d6b1c0e-8f4a-4b7e-9d3a-5e1f0c2b7a64",
  "target_frontend_id": "7f0a2c9d-5e3b-4b18-8d6f-1c4e9a2b3d50",
  "path_prefix": "/docs",
  "created_at": "2026-10-23T12:00:00Z",
  "updated_at": "2026-10-23T12:00:00Z"
}
```

`GET` on the same path lists the routes, and `PUT` or `DELETE` on
`/frontend-routes/{routeId}` replaces or removes one. `GET` on the frontend
includes its routes as `frontend_routes`. See the
[frontend API reference](../api-reference/frontend-endpoints.md#frontend-routes).

Or declare `frontend_routes` on the mounting frontend in `volcano-config.yaml`
and apply it with `PUT /projects/{id}/config`. The list is the complete
set: routes you leave out are deleted, and `frontend_routes: []` deletes them
all. Omitting the key leaves the routes as they are. See
[project configuration](../projects/configuration.md). The `volcano` CLI
doesn't accept the key or offer route commands yet; until it does,
`volcano cloud config deploy` rejects a manifest that declares it.

## How requests are matched

- `path_prefix` matches whole segments: `/docs` matches `/docs` and
  `/docs/intro`, not `/documents`.
- Function and Frontend routes on one frontend share one set of paths. Two
  routes can't use the same prefix, but one can sit under another: with `docs`
  mounted at `/docs` and a
  [Function route](./function-routes.md) at `/docs/api`, `/docs/api/search` runs
  the function and `/docs/intro` reaches `docs`. The longest matching prefix
  wins.
- A route applies to every hostname of the mounting frontend: its generated
  hostname, a custom domain, and `*.frontends.localhost` in local mode.
- The mounted frontend's own routes don't apply to requests it gets through a
  route. Mount each frontend from the frontend that owns the hostname.
- Requests to a mounted frontend count toward that frontend's usage and its
  [per-visitor limit](../guides/plans-and-limits.md#frontends).
- While the mounted frontend has no active deployment, its paths answer `502`,
  as its own hostname does, rather than falling back to the main frontend.
- A route change can take a few seconds to reach every request.

## Delete a mounted frontend

A frontend that another frontend mounts can't be deleted. The delete answers
`409` and names the frontends whose routes mount it; remove those routes first.
This includes routes from a frontend that is itself being deleted: they keep
blocking until that delete finishes.
Deleting a project removes its routes with it.

## Local mode

Routes work the same on the frontend URL Volcano returns in local mode, such as
`http://FRONTEND_ID.frontends.localhost:8080`, including the mounted frontend's
build files and images.

## Limits and errors

A frontend can have up to 64 routes, Function and Frontend routes together.
`path_prefix` must start with `/`, can't be `/` alone, can't end with `/`, and
is at most 512 bytes. A frontend can be mounted at several prefixes, but can't
mount itself.

| Status | Error                                                                                     | Fix                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `404`  | `Frontend routes are not available yet; ...` with code `feature_unavailable`              | Frontend routes aren't available in this environment yet                                 |
| `400`  | `route path prefix is invalid`                                                            | Use a prefix like `/docs`                                                                |
| `400`  | `a Frontend cannot mount itself`                                                          | Mount another frontend                                                                   |
| `404`  | `route resources do not exist in the Project`                                             | Mount a frontend of the same project                                                     |
| `409`  | `Frontend path is already routed`                                                         | Pick another prefix, or replace the existing Function or Frontend route                  |
| `409`  | `Frontend route limit reached`                                                            | Remove a Function or Frontend route; the limit is 64 across both kinds                   |
| `404`  | `Frontend route not found`                                                                | Use a route ID from listing the frontend's routes                                        |
| `409`  | `the mounted Frontend is being deleted`                                                   | Mount another frontend                                                                   |
| `409`  | `the Frontend is being deleted`                                                           | A frontend being deleted takes no new routes                                             |
| `409`  | `Frontend routes on <names> mount this Frontend. Remove those routes before deleting it.` | Returned by a frontend delete; remove the routes first                                   |
| `409`  | `Another Frontend's route mounts this Frontend. Remove that route before deleting it.`    | The same, when the mounting frontends couldn't be named; list them and remove the routes |
