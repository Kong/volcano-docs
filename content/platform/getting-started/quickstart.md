---
title: "Quickstart"
description: "Install the Volcano CLI, run a function locally, then deploy it to the cloud."
---

Go from zero to a deployed function with the Volcano CLI — develop locally
first, then push the same project to the cloud.

## 1. Install the CLI

```bash
npm install -g @volcano.dev/cli
volcano --help
```

Other methods (pnpm, Bun, Homebrew) are in [installation](installation.md).

## 2. Sign up

```bash
volcano signup
```

This creates your account and logs you in.

## 3. Scaffold a project

```bash
volcano init javascript      # also: nextjs, python, ruby
```

This creates a starter project with a sample function under `volcano/functions/`
and a `volcano-config.yaml` describing it.

## 4. Develop locally

Start a full Volcano stack on your machine:

```bash
volcano start
volcano status
```

While the local environment is running, the top-level commands act on it.
Deploy the scaffolded function and invoke it:

```bash
volcano functions deploy --all
volcano functions list                       # see the deployed function's name
volcano functions invoke hello --payload '{"name":"Ada"}'
```

You'll get the function's JSON response. Edit `volcano/functions/hello.js`,
redeploy, and invoke again to iterate — no cloud round-trip.

## 5. Deploy to the cloud

Create a cloud project and select it:

```bash
volcano projects create my-app
volcano use my-app
```

Prefix a command with `cloud` to target the cloud project explicitly:

```bash
volcano cloud functions deploy --all
volcano cloud functions invoke hello --payload '{"name":"Ada"}'
```

Your function now runs on Volcano's managed infrastructure. To deploy the whole
project (functions, variables, databases, and more) from one manifest, use
`volcano config deploy` — see [declarative config](../projects/configuration.md).

## What's next

| Guide | Description |
|-------|-------------|
| [Functions](../functions/overview.md) | Runtimes, dependencies, and environment variables |
| [Add a database](../databases/quick-start.md) | Provision PostgreSQL with row-level security |
| [Add authentication](../authentication/quickstart.md) | Let users sign up and sign in |
| [Deploy a frontend](../frontends/overview.md) | Host a Next.js site on Volcano |
| [Deploy to production](../guides/production.md) | Ship your project to the cloud |
| [View logs](../functions/logs.md) | Debug with `volcano functions logs` |

For the full command set, see the [CLI reference](/cli) or run
`volcano <command> --help`.
