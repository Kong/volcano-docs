---
title: What is Volcano?
description: AI infrastructure for agents and applications, with functions, durable functions, databases, auth, realtime, storage, hosting, and locks.
order: 1
---

Volcano is AI infrastructure for agents and applications. It gives you the
pieces most applications need, without running infrastructure yourself:

- **Databases** — PostgreSQL that auto-scales, with row-level security, a browser query builder or a direct connection, branches, and backups with point-in-time restore on SUPERAGENT.
- **Functions** — agents and APIs in Node.js, Python, or Ruby, invoked over HTTP and deployed to the project's regions, with cron schedules and the caller's identity on the request.
- **Frontend hosting** — Next.js, static or server-rendered, served from the edge. A failed build never replaces the live version. Custom domains are on SUPERAGENT.
- **Durable functions** — JavaScript or Python workflows that checkpoint each step and resume for up to a year, with waits, retries, idempotent starts, and cron schedules.
- **Authentication** — email and password, Google, GitHub, Microsoft, and Apple, plus anonymous users that convert to a permanent account. That identity is available in Postgres policies.
- **Realtime** — Postgres changes, broadcast, and presence over WebSockets.
- **File storage** — buckets that are private by default, with access policies, per-file public links, and resumable uploads.
- **Distributed locks** — renewable leases so one holder runs a task, and a fencing token the protected resource can check.

## The model

A **project** is the container for everything else. You authenticate, select an
active project, then operate on the resources inside it — functions, durable
functions, databases, authentication, realtime, file storage, frontends,
distributed locks, and variables.

## Three ways to work

| Surface | Use it for |
| --- | --- |
| [CLI](/cli) | Managing projects, deploying functions, durable functions, and frontends, and running migrations. |
| [JavaScript SDK](/sdk/js) | Calling auth, database, storage, realtime, durable functions, and distributed locks from your app. |
| [Platform API](/platform) | Understanding how it all works and the raw HTTP surface. |

Next: [install the tools](./install.md).
