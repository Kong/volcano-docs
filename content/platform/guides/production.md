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
frontend builds; `NEXT_PUBLIC_*` also reaches the browser).
`volcano/volcano.env` holds the local development server's values, and
`volcano cloud deploy` refuses its local URL and keys, so put the cloud
project's values in `volcano/cloud.env`:

```bash
DATABASE_URL=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_API_URL=https://api.example.com
```

The deploy below saves them before it builds anything, since function and
frontend builds read them. Never hard-code secrets in source. See
[environment variables](../functions/environment-variables.md).

## Deploy your project

Create the database your project uses:

```bash
volcano cloud databases create app --region us-east-1 --pg-version 16
```

The database starts as `provisioning`. Run `volcano cloud databases get app`
until its `Status` is `active`; migrations refuse a database that isn't. Then
deploy everything in one run:

```bash
volcano cloud deploy --env-file volcano/cloud.env --with-migrations -d app
```

`volcano cloud deploy` saves the variables in `volcano/cloud.env`, applies
the migrations in `volcano/migrations`, deploys your functions, durable
functions, and the frontends listed in `.volcano/source-layout.json`, then
applies `volcano-config.yaml`. It waits until every deployment is live and
prints each frontend's URL. Leave out `--with-migrations` on later deploys
unless your migrations are safe to run again. See the
[CLI deploy reference](/cli/deploy) for every option and the commands that
deploy one kind of resource at a time.

A frontend builds with the variables its entry in `volcano-config.yaml`
selects, so list the `NEXT_PUBLIC_*` names its pages read:

```yaml
frontends:
  - name: my-site
    variable_scope: scoped
    variables: [NEXT_PUBLIC_API_URL]
```

The [manifest](../projects/configuration.md) is the recommended way to manage
production settings — variables, schedules, auth, and function and frontend
settings — from one reviewed file. It configures functions and frontends but
never creates them; `volcano cloud deploy` creates them first, then applies it.
Keep variables in one place: either `volcano/cloud.env` or the manifest's
`variables` section. A deploy refuses both, because applying the section
deletes every variable it doesn't list. With variables in the manifest, run
`volcano cloud deploy --no-env-file`.

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
otherwise the next `volcano cloud deploy` or `volcano cloud config deploy`
removes the domain.

## Observe

```bash
volcano cloud functions logs hello
volcano cloud frontends logs my-site
```

## Before you launch

- Work through the [security checklist](security-checklist.md).
- Review your plan against [plans and limits](plans-and-limits.md) — upgrade to
  SUPERAGENT for higher caps and scheduled functions.
