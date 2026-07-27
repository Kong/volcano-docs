---
title: "Deploy to production"
description: "Take a Volcano project to production: deploy functions and frontends, set secrets, add a custom domain, and watch logs."
---

Once your project works locally (see the [Quickstart](../getting-started/quickstart.md)),
ship it to the cloud with the [Volcano CLI](/cli). Everything below targets your
cloud project — select it first:

```bash
volcano projects create my-app
volcano use my-app
```

## Deploy your project

Deploy resources individually, or apply your whole project from one manifest:

```bash
volcano cloud functions deploy --all      # functions
volcano cloud frontends deploy            # frontend
volcano config deploy                     # everything in volcano-config.yaml
```

`volcano config deploy` is the recommended path for production — it applies
functions, variables, schedules, and frontend settings from a single reviewed
[manifest](../projects/configuration.md).

## Configure secrets and variables

Store configuration and secrets as project variables (available to functions and
frontend builds; `NEXT_PUBLIC_*` also reaches the browser):

```bash
volcano variables deploy DATABASE_URL=... STRIPE_SECRET_KEY=...
```

Never hard-code secrets in source. See [environment variables](../functions/environment-variables.md).

## Databases and migrations

```bash
volcano databases create app
volcano migrations deploy                 # apply schema changes
```

Protect data with [row-level security](../databases/row-level-security.md) before
going live.

## Custom domain

```bash
volcano cloud frontends domain create my-site --domain app.example.com
```

## Observe

```bash
volcano functions logs hello
volcano cloud frontends logs my-site
```

## Before you launch

- Work through the [security checklist](security-checklist.md).
- Review your plan against [plans and limits](plans-and-limits.md) — upgrade to
  Pro for higher caps and scheduled functions.
