---
title: What is Volcano?
description: A serverless platform for functions, databases, auth, storage, and realtime, unified behind one API.
order: 1
---

Volcano is a backend platform that gives you the pieces most applications need,
without running infrastructure yourself:

- **Functions** — serverless backend code (Node.js, Python, Ruby), invoked over HTTP.
- **Databases** — managed PostgreSQL with row-level security and a browser-friendly query builder.
- **Authentication** — email/password, OAuth providers, and anonymous users.
- **Storage** — file buckets with access-control policies.
- **Realtime** — subscriptions for database changes, presence, and broadcast.

## The model

A **project** is the container for everything else. You authenticate, select an
active project, then operate on the resources inside it — functions, databases,
storage, variables, and frontends.

## Three ways to work

| Surface | Use it for |
| --- | --- |
| [CLI](/cli) | Managing projects, deploying functions, running migrations. |
| [JavaScript SDK](/sdk/js) | Calling auth, database, storage, and realtime from your app. |
| [Platform API](/platform) | Understanding how it all works and the raw HTTP surface. |

Next: [install the tools](./install.md).
