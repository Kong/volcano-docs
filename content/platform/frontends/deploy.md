---
title: "Deploy a frontend"
description: "Build and deploy a Next.js site to Volcano with the CLI, set variables, attach a custom domain, and view logs."
---

Deploy a Next.js site to Volcano and serve it at a Volcano URL or your own
domain. This uses the [Volcano CLI](/cli); install it and sign in first (see the
[Quickstart](../getting-started/quickstart.md)).

## 1. Scaffold or bring your app

Start a new Next.js project scaffolded for Volcano, or use an existing one:

```bash
volcano init nextjs        # new project
# or: cd into your existing Next.js app
```

Select the project you're deploying to:

```bash
volcano projects create my-app
volcano use my-app
```

## 2. Set variables

Values your build needs go in project variables. Prefix anything the browser
needs with `NEXT_PUBLIC_`:

```bash
volcano variables deploy NEXT_PUBLIC_API_URL=https://api.example.com
```

## 3. Deploy

```bash
volcano cloud frontends deploy
```

The CLI uploads your app, Volcano builds it, publishes the assets, and returns
the site URL. Watch progress and check status:

```bash
volcano cloud frontends list
volcano cloud frontends get my-site
```

Redeploy after changes — traffic stays on the live build until the new one is
ready:

```bash
volcano cloud frontends redeploy my-site
```

### Dependencies

Volcano installs your dependencies before running the build, and picks the
package manager in this order:

| Your project | Volcano installs with |
| --- | --- |
| declares `"packageManager": "pnpm@9.15.0"` (or `yarn@`, `npm@`) in `package.json` | the manager you declared, at that version |
| declares nothing and ships one lockfile | the manager that lockfile belongs to |
| declares nothing and ships several lockfiles | `pnpm`, then `yarn`, then `npm` |
| declares nothing and ships no lockfile | `npm` |

`packageManager` wins over the lockfiles, so a stale `pnpm-lock.yaml` left in a
project that declares `npm@10` no longer changes what runs. Declaring it is the
only way to be certain, and it is what to reach for when several lockfiles are
checked in — where a single manager is required, several lockfile families fail
the build rather than falling back to that order.

**Ship the lockfile that belongs to that manager.** Volcano installs from it, so
your build gets the versions you tested. Without it — none shipped, or
`packageManager` naming a manager whose lockfile is missing — dependencies
resolve fresh during the build and can differ from your local install. Where
locked installs are required, the build stops instead:

```text
no pnpm lockfile found and ALLOW_UNLOCKED_INSTALLS=false
```

The build log names the manager and version that were selected, so check there
first when a build installed something you did not expect.

### Regional runtime repair

After propagation retries, Volcano treats a regional runtime as missing only
when the frontend proxy receives a provider-confirmed not-found response for
the deployed runtime or its invocation URL. Volcano first verifies that the same
deployment is still serving and that the region is still expected, then queues durable repair
of that immutable generation. Repair does not rebuild source, create a new
deployment, or change what `active` and `degraded` mean.

Volcano does not repair application errors, ambiguous provider failures such as
timeouts, throttling, or network errors, user deletion, regional convergence,
or resources removed by a non-preserved staging purge. The request that detects
drift can still fail while repair runs; Volcano does not replay it in another
region. Repair is request-driven and does not proactively audit idle frontends.

Volcano controls the Next.js build ID, including when an application defines
`generateBuildId`. Redeploying the same frontend with identical source, build
variables, app path, architecture, and build toolchain keeps the same opaque
build ID and `_next/static` asset URLs. Changing any of those build inputs
changes the ID. Build IDs are scoped to the project and frontend; do not use
them as release identifiers.

Each generated frontend runtime image must fit the configured
`LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB`. Volcano checks an uncompressed upper
bound—the exact pinned base-image layers plus the generated application
layer—before publishing. A server or image-optimizer image over the limit fails
the asynchronous deployment. Remove unused production dependencies or large
generated files from the frontend bundle to reduce its size.

## 4. Add a custom domain

Custom domains are **PRO** and use **bring-your-own-certificate (BYOC)** TLS —
supply your own PEM certificate and unencrypted private key (`--chain` is
optional):

```bash
volcano cloud frontends domain create my-site \
  --domain app.example.com \
  --cert  ./fullchain-leaf.pem \
  --key   ./privkey.pem \
  --chain ./chain.pem
volcano cloud frontends domain get my-site      # status + the default URL to point DNS at
```

Then create a `CNAME` for your domain pointing at the frontend's default
Volcano URL (`<frontend-id>.frontends.<region-domain>`, from `domain get` /
`frontends get`). That host is stable across redeploys:

```text
app.example.com.  CNAME  <frontend-id>.frontends.volcano.run.
```

The domain goes `active` once Volcano finishes attaching your certificate —
that status doesn't confirm DNS is live, so verify it separately. See
[custom domains](overview.md#custom-domains) for rotation and other details.

## 5. View logs

```bash
volcano cloud frontends logs my-site
```

Build logs show the selected Node.js and package-manager versions, dependency
installation, Next.js detection, the build command, and Next.js/OpenNext
output. Validation failures include an actionable message. Platform
orchestration and infrastructure diagnostics stay in operator logs.

## Next

- [Frontends overview](overview.md) — how builds, variables, and domains fit together.
- [Environment variables](../functions/environment-variables.md) — build vs runtime.
- [Frontend API reference](../api-reference/frontend-endpoints.md) — deploy over HTTP.
- [Deploy from GitHub](../projects/git-deploy.md) — redeploy on every push instead of running the CLI.

## Rewrite routes to public files

With the default Volcano frontend configuration, `beforeFiles` rewrites can serve files from your app's `public` directory:

```js
// next.config.mjs
export default {
  async rewrites() {
    return {
      beforeFiles: [{ source: '/dashboard/:path*', destination: '/app/index.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};
```

Place the document at `public/app/index.html`. Requests to `/dashboard` and its nested paths return that document while preserving the browser URL. Headers configured for the requested route still apply. Missing files remain 404 responses.

Rebuild existing deployments to enable public-file rewrites.

- Use regular files in `public` for rewrite destinations. Symbolic links are not included.
- Files reachable through rewrites increase deployment size. Unrelated public files and identity self-rewrites are excluded from the server copy.
- The server copy is capped at 256 MiB and 20,000 files, and each file is capped at 199 MiB to leave room within Lambda's streamed-response limit. The build warning names files skipped at either byte cap. A rewrite to a skipped file returns 404; narrow the rewrite destinations or change the app to use the file's direct static URL.
- Rewrites to public files do not support byte ranges. Use direct static URLs for seekable media and resumable downloads.
- Configured locales work when the app has no `basePath`, and `basePath` works when i18n is disabled. The build warns that rewrites to public files do not resolve when `basePath` and i18n are combined.

Public-file responses include a content-based `ETag`. Uncompressed `GET` responses include a byte length. Matching conditional requests return `304` without reading the file body.

Precompressed public files such as `.gz` downloads retain their compressed bytes and are served as downloads. Dynamic rewrite parameters can include encoded slashes (`%2F`) to reach nested public files.

The default `max-age=0` still requires revalidation; validators reduce transferred bytes, not the number of origin requests.
