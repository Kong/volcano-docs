---
title: "Overview"
description: "Volcano is AI infrastructure for agents and applications: functions, durable functions, databases, auth, realtime, storage, hosting, and locks."
---

Volcano is AI infrastructure for agents and applications. It provides functions, durable functions, databases, authentication, realtime, file storage, frontend hosting, and distributed locks. All of them work together through a unified API.

## How Volcano works

```text
┌────────────────────────────────────────────────────────────────┐
│                        Your Application                        │
│                    (Web, Mobile, or Server)                    │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                          Volcano API                           │
├────────────────────────────────────────────────────────────────┤
│ Functions · Durable functions · Databases · Authentication     │
│ Realtime · File storage · Frontend hosting · Distributed locks │
└────────────────────────────────────────────────────────────────┘
```

Your application makes API calls to Volcano. Volcano manages functions, durable functions, databases, authentication, realtime, file storage, frontend hosting, and distributed locks, so you can focus on building your product.

## Core concepts

### Projects

A project is a container for your application's resources. Each project has its own:

- Functions
- Durable functions
- Databases
- Authentication
- File storage
- Realtime
- Frontend hosting
- Distributed locks
- API keys

Most applications need one project. You might create multiple projects to separate environments (development, staging, production) or different applications.

### Functions

Functions are code that runs on demand. You write the code, upload it to Volcano, and invoke it via HTTP. Volcano deploys each function to the project's regions, scales it, and can run it on a cron schedule. A call made with a user token includes that caller's identity.

Supported runtimes:
- Node.js (22.x, 24.x)
- Python (3.10, 3.11, 3.12, 3.13, 3.14)
- Ruby (3.3, 3.4, 4.0)

Functions can access databases, user context, and environment variables. They're useful for:

- API endpoints
- Background processing
- Scheduled tasks
- Webhooks

### Databases

Databases are PostgreSQL instances. They auto-scale based on usage and pause when idle. You can branch one into an isolated copy, and on SUPERAGENT restore it from a backup or to a point in time.

You can access databases two ways:

1. **Query Builder / REST API** — Make HTTP requests from browsers or servers
2. **Direct connection** — Connect from your functions with standard PostgreSQL clients

Databases include built-in support for row-level security (RLS). Combined with authentication, you can write policies that automatically filter data based on the current user.

### Authentication

Authentication lets your application's users sign up, sign in, and manage their accounts. It supports:

- Email and password
- OAuth providers (Google, GitHub, Microsoft, Apple)
- Anonymous users, which can convert to a permanent account

When a user authenticates, they receive a JWT access token. This token can be used to:

- Invoke functions with user context
- Query databases with automatic RLS enforcement
- Access protected resources

### Durable functions

Durable functions are written in JavaScript or Python. They checkpoint each step and resume for up to a year. A step can wait or retry, a start can be idempotent, and a cron schedule can start an execution on each tick. See [Durable functions](../functions/durable-functions.md).

### Realtime

Realtime delivers Postgres changes, broadcast messages, and presence over WebSockets. See [Realtime](../realtime/overview.md).

### File storage

File storage is buckets that are private by default, with access policies, per-file public links, and resumable uploads. See [Storage](../storage/overview.md).

### Frontend hosting

Frontend hosting deploys Next.js, static or server-rendered, and serves it from the edge. A failed build never replaces the live version. Custom domains are on SUPERAGENT. See [Frontends](../frontends/overview.md).

### Distributed locks

Distributed locks are renewable leases so one holder runs a task. Each lease carries a fencing token the protected resource can check. See [Distributed locks](../locks/javascript-sdk.md).

## API keys

Volcano uses different keys for different purposes:

| Key type | Purpose | Use in |
|----------|---------|--------|
| Platform token (`pk-`) | Manage every project in your account | Your terminal, backend, CI/CD |
| Project access token (`pt-`) | Manage one project, with a read-only option | CI, scripts, AI agents |
| Anon key | Initialize the SDK, let users sign up and sign in | Frontend |
| Service key | Invoke functions as admin, bypass RLS | Backend only |
| User access token | Authenticate as a specific user | Frontend, functions |

> **Important:** Never expose platform tokens, project access tokens, or service keys in frontend code. They act on your project rather than on behalf of one user, and belong only in environments you control.

For the full comparison, see [Token types](../authentication/security/token-types.md).

## A typical workflow

1. **Create a project** — Use your platform token to create a project via the API
2. **Deploy functions** — Write code, package it, and upload to Volcano
3. **Provision a database** — Create a PostgreSQL database for your data
4. **Configure authentication** — Enable signup methods and create API keys
5. **Build your frontend** — Use the SDK to authenticate users and invoke functions
6. **Set up RLS** — Write policies to secure your data per user

## Ways to use Volcano

Everything above is reachable five ways — the dashboard, the CLI, the SDKs, the
REST API, and the MCP server — and they are all clients of the same API, so
nothing is available through only one of them. See
[Ways to use Volcano](../interfaces/README.md) for which to reach for.

## What's next

| Guide | Description |
|-------|-------------|
| [Ways to use Volcano](../interfaces/README.md) | Dashboard, CLI, SDK, API, and MCP — and when to use each |
| [Quickstart](quickstart.md) | Deploy your first function in 5 minutes |
| [Installation](installation.md) | Set up the SDK and CLI |
| [Projects](../projects/overview.md) | Learn about project management |
| [Functions](../functions/overview.md) | Deep dive into functions |
| [Durable functions](../functions/durable-functions.md) | Workflows that checkpoint and resume |
| [Databases](../databases/overview.md) | Learn about PostgreSQL databases |
| [Authentication](../authentication/overview.md) | Add user auth to your app |
| [Realtime](../realtime/overview.md) | Database events, broadcast, and presence |
| [Storage](../storage/overview.md) | File buckets and access policies |
| [Frontends](../frontends/overview.md) | Deploy a Next.js site |
| [Distributed locks](../locks/javascript-sdk.md) | Coordinate workers so each task runs once |
