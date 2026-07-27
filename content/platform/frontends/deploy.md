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

## 4. Add a custom domain

```bash
volcano cloud frontends domain create my-site --domain app.example.com
volcano cloud frontends domain get my-site      # follow DNS/verification status
```

## 5. View logs

```bash
volcano cloud frontends logs my-site
```

## Next

- [Frontends overview](overview.md) — how builds, variables, and domains fit together.
- [Environment variables](../functions/environment-variables.md) — build vs runtime.
- [Frontend API reference](../api-reference/frontend-endpoints.md) — deploy over HTTP.
