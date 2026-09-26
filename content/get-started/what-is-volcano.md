---
title: What is Volcano?
description: AI infrastructure for agents and applications, with functions, durable functions, databases, authentication, realtime, file storage, frontend hosting, and distributed locks.
order: 1
---

Volcano is AI infrastructure for agents and applications. It gives you the
pieces most applications need, without running infrastructure yourself:

- **Databases** — PostgreSQL for apps and agents, with row-level security, branching, and a browser-friendly query builder.
- **Functions** — agents and APIs in Node.js, Python, or Ruby, invoked over HTTP.
- **Frontend hosting** — deploy Next.js from source.
- **Durable functions** — multi-step workflows that checkpoint and resume for up to a year.
- **Authentication** — email and password, OAuth providers (Google, GitHub, Microsoft, Apple), and anonymous users.
- **Realtime** — database events, broadcast, and presence.
- **File storage** — buckets with access-control policies and resumable uploads.
- **Distributed locks** — coordinate agents, workers, and durable functions so each task is picked up once.

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
