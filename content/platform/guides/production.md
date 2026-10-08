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

## Configure secrets and variables

Store configuration and secrets as project variables (available to functions and
frontend builds; `NEXT_PUBLIC_*` also reaches the browser). Put them in
`volcano/volcano.env`:

```bash
DATABASE_URL=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_API_URL=https://api.example.com
```

Then save them to the cloud project. Set them before deploying a frontend, since
its build reads them:

```bash
volcano cloud variables deploy
```

Never hard-code secrets in source. See [environment variables](../functions/environment-variables.md).

## Deploy your project

Deploy functions and frontends, then apply the rest of your project from one
manifest:

```bash
volcano cloud functions deploy --all      # functions
volcano cloud frontends deploy --variable-scope scoped --variable NEXT_PUBLIC_API_URL
volcano cloud config deploy               # settings in volcano-config.yaml
```

The [manifest](../projects/configuration.md) is the recommended way to manage
production settings — variables, schedules, auth, and function and frontend
settings — from one reviewed file. It configures functions and frontends but
never creates them, so deploy them first; an entry for one that does not exist
yet is skipped. See
[First deploy with `volcano-config.yaml`](../frontends/deploy.md#first-deploy-with-volcano-configyaml).

## Databases and migrations

```bash
volcano cloud databases create app --region us-east-1 --pg-version 16
volcano cloud databases migration up --all -d app   # apply schema changes
```

Protect data with [row-level security](../databases/row-level-security.md) before
going live.

## Custom domain

```bash
volcano cloud frontends domain create my-site \
  --domain app.example.com --cert ./fullchain-leaf.pem --key ./privkey.pem
```

Each frontend has one custom domain. See
[Add a custom domain](../frontends/deploy.md#4-add-a-custom-domain). If
`volcano-config.yaml` declares this frontend, add `custom_domain` to its entry;
otherwise the next `volcano cloud config deploy` removes the domain.

## Observe

```bash
volcano cloud functions logs hello
volcano cloud frontends logs my-site
```

## Before you launch

- Work through the [security checklist](security-checklist.md).
- Review your plan against [plans and limits](plans-and-limits.md) — upgrade to
  SUPERAGENT for higher caps and scheduled functions.
