---
title: "Frontends overview"
description: "Deploy static and server-rendered sites on Volcano, with build/runtime variables, custom domains, and zero-downtime redeploys."
---

A **frontend** is a web site — static or server-rendered — that Volcano builds,
hosts, and serves. You push your project's source; Volcano builds it, publishes
the static assets to the edge, and runs any server-rendered routes on managed
runtimes. Every frontend belongs to a [project](../projects/overview.md).

## How it works

1. You deploy your source (the CLI uploads a `tar.gz` of your app).
2. Volcano builds it, resolving your project [variables](../functions/environment-variables.md) at build time.
3. Static assets publish to the edge; server-rendered routes run on managed runtimes.
4. The site is served at a Volcano URL, or at your own [custom domain](#custom-domains).

Redeploys are **zero-downtime**: the live build keeps serving until the new one
is ready, then traffic cuts over. A failed redeploy leaves the previous
deployment running. Deploys use latest-wins queueing — a newer deploy supersedes
an older queued one.

## Frameworks

Next.js is supported today (`framework: nextjs`), including static export and
server-side rendering. For a monorepo, point Volcano at the app with `app_root`
(for example `apps/web`).

## Variables

All project variables are available to the **build**. Variables prefixed with
`NEXT_PUBLIC_` are also available to the deployed frontend at **runtime**. Manage
them with `volcano variables …` or the [declarative config](../projects/configuration.md).

## Custom domains

Bring your own domain and attach it to a frontend:

```bash
volcano cloud frontends domain create my-site --domain app.example.com
volcano cloud frontends domain get my-site
```

Volcano provisions the certificate and rotates it without downtime.

## Next

- [Deploy a frontend](deploy.md) — step-by-step with the CLI.
- [Frontend API reference](../api-reference/frontend-endpoints.md) — the HTTP surface.
- [CLI reference](/cli) — every `volcano cloud frontends` command.
