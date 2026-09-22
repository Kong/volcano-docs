---
title: "Dashboard"
description: "The Volcano dashboard: create and inspect projects, read logs and usage, manage keys, and change configuration in a browser."
order: 2
---

The dashboard at [volcano.dev](https://volcano.dev) is the browser interface to
your projects. Sign in with your Volcano account and every project you own is
there.

It is a client of the same API the CLI uses, so nothing it creates is special.
A project, function, or database made by clicking is the same resource
`volcano` deploys to and the REST API returns.

## What you can do here

**Projects.** Create a project, see what it contains, rename it, or delete it.
The project overview is the fastest way to answer "what is deployed right now".

**Functions and frontends.** Browse what is deployed, check deployment status
and history, and open a live URL. Deploys themselves are usually better from
the [CLI](/cli) or [Git](../projects/git-deploy.md), because those are
repeatable.

**Databases.** Create a database, browse branches and backups, and read
connection details. See [Databases](../databases/overview.md).

**Storage.** Create buckets, browse objects, and edit access policies. See
[Storage](../storage/overview.md).

**Authentication.** Turn sign-in methods on, configure OAuth providers, edit
email templates, and look at the users who have signed up. See
[Authentication](../authentication/overview.md).

**Logs and usage.** Search logs across functions, frontends, and databases, and
see what the project is consuming against your plan. See
[Logs](../functions/logs.md) and
[Plans and limits](../guides/plans-and-limits.md).

**Variables and keys.** Set environment variables, and create or revoke anon
keys, service keys, and project access tokens. See
[Token types](../authentication/security/token-types.md).

**Domains.** Attach a custom domain to a frontend.

## When to use something else

The dashboard is the right tool for looking at things and for changes you are
not going to make twice. Two jobs belong elsewhere:

- **Anything repeatable.** A deploy you will run again, a migration, or a step
  in CI belongs in the [CLI](/cli), where it can be scripted and reviewed.
- **Anything your application does at runtime.** Signing users in, querying
  with row-level security, uploading files — that is an [SDK](/sdk/js), not a
  person in a browser.

## Reading a project's configuration as a file

Much of what the dashboard edits also lives in
[`volcano-config.yaml`](../projects/configuration.md), the declarative manifest
for a project. `volcano config pull` writes the project's current
configuration to that file, and `volcano config deploy` applies it. Use it when
you want configuration reviewed in a pull request rather than changed by
clicking.
