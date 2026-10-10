---
title: "Volcano Documentation"
description: "Volcano is AI infrastructure for agents and applications: functions, durable functions, databases, auth, realtime, storage, hosting, and locks."
---

Volcano is AI infrastructure for agents and applications. It gives you functions, durable functions, databases, authentication, realtime, file storage, frontend hosting, and distributed locks, all through one API.

## Quick start

New to Volcano? Start here:

1. [Quickstart guide](getting-started/quickstart.md) — Deploy your first function in 5 minutes
2. [Core concepts](getting-started/overview.md) — Understand how Volcano works
3. [Installation](getting-started/installation.md) — Set up the SDK and CLI

## Ways to use Volcano

Everything Volcano does is one API. The dashboard, the CLI, the SDKs, and the
MCP server are all ways of calling it — see
[Ways to use Volcano](interfaces/README.md) for which to reach for.

| Interface | Reach for it when | Documentation |
|-----------|-------------------|---------------|
| Dashboard | Exploring, one-off changes, reading logs and usage | [Dashboard](interfaces/dashboard.md) |
| CLI | Deploying from a terminal or CI, migrations, local development | [CLI reference](/cli) |
| SDK | Writing application code — auth, queries, storage, realtime, durable functions, and distributed locks | [JavaScript](/sdk/js), [Python](/sdk/python), [Ruby](/sdk/ruby) |
| REST API | Automating what the CLI does not cover | [API reference](api-reference/overview.md) |
| MCP server | Letting an AI agent inspect or change one project | [MCP server](interfaces/mcp.md) |

## Core features

### Functions

Agents and APIs in Node.js, Python, or Ruby, invoked over HTTP and deployed to the project's regions, with cron schedules and the caller's identity on the request.

| Guide | Description |
|-------|-------------|
| [Overview](functions/overview.md) | What functions are and how they work |
| [Creating functions](functions/creating-functions.md) | Deploy your first function |
| [Invoking functions](functions/invoking-functions.md) | Call functions from your app |
| [Scheduled invocations](functions/scheduled-invocations.md) | Run a function on a cron schedule |
| [User context](functions/user-context.md) | Access authenticated user data |
| [Environment variables](functions/environment-variables.md) | Configure secrets and settings |
| [Logs](functions/logs.md) | View and filter function logs |

### Durable functions

JavaScript or Python workflows that checkpoint each step and resume for up to a year, with waits, retries, approvals, idempotent starts, and cron schedules.

| Guide | Description |
|-------|-------------|
| [Durable functions](functions/durable-functions.md) | Long-running work that checkpoints and resumes |
| [Durable approvals](functions/durable-approvals.md) | Pause a workflow until a person approves or denies it |
| [Developing durable functions locally](guides/durable-functions-locally.md) | Run one on your machine, then deploy it unchanged |

### Databases

PostgreSQL that auto-scales and branches in under a minute, with row-level security, a browser query builder or a direct connection, and backups with point-in-time restore on SUPERAGENT.

| Guide | Description |
|-------|-------------|
| [Overview](databases/overview.md) | Database features and access methods |
| [Quick start](databases/quick-start.md) | Set up a database in 5 minutes |
| [Branching](databases/branching.md) | Fork a copy of a database for every pull request, migration, or test run |
| [Backups and restore](databases/backups.md) | Back up a database and restore it to a backup or a point in time (SUPERAGENT) |
| [Importing data](databases/importing-data.md) | Move an existing PostgreSQL database in with `pg_dump`, and bulk-load rows with `COPY` |
| [Query Builder API](databases/query-builder-api.md) | Query from the browser with the SDK |
| [REST API](databases/rest-api.md) | HTTP endpoints for database operations |
| [Direct connection](databases/direct-connection.md) | Connect from a function with user impersonation |
| [Row-level security](databases/row-level-security.md) | Secure data with policies |
| [Auth helpers](databases/auth-helpers.md) | SQL functions for user context |

### Authentication

Email and password, Google, GitHub, Microsoft, and Apple, plus anonymous users that convert to a permanent account.

| Guide | Description |
|-------|-------------|
| [Overview](authentication/overview.md) | Authentication features and flow |
| [Quickstart](authentication/quickstart.md) | Add auth to your app |
| [Concepts](authentication/concepts.md) | Users, tokens, and sessions |
| [OAuth providers](authentication/oauth-providers.md) | Google, GitHub, Microsoft, Apple |
| [Anonymous users](authentication/anonymous-users.md) | Guest access with upgrade path |
| [Password reset](authentication/password-reset.md) | Forgot password flow |
| [Configuration](authentication/configuration/overview.md) | Customize auth behavior |

### Storage

Buckets that are private by default, with access policies, per-file public links, and resumable uploads.

| Guide | Description |
|-------|-------------|
| [Overview](storage/overview.md) | Storage features and quick start |
| [JavaScript SDK](storage/javascript-sdk.md) | Complete SDK reference |
| [Policies](storage/policies.md) | RLS-style access control |
| [Buckets](storage/buckets.md) | Creating and managing buckets |

### Distributed locks

Renewable leases so one holder runs a task, with a fencing token the protected resource can check.

| Guide | Description |
|-------|-------------|
| [JavaScript SDK](locks/javascript-sdk.md) | Coordinate backend workers with renewable project leases |

### Realtime

Postgres changes, broadcast, and presence over WebSockets.

| Guide | Description |
|-------|-------------|
| [Overview](realtime/overview.md) | Realtime features and the connection model |
| [Postgres changes](realtime/postgres-changes.md) | Subscribe to database changes |
| [Broadcast](realtime/broadcast.md) | Send messages between clients |
| [Presence](realtime/presence.md) | Track who is online |
| [JavaScript SDK](realtime/javascript-sdk.md) | Client SDK reference |
| [Security](realtime/security.md) | Channel authorization and limits |

### Frontends

Next.js, static or server-rendered, served from the edge. A failed build never replaces the live version. Custom domains are on every plan.

| Guide | Description |
|-------|-------------|
| [Overview](frontends/overview.md) | How frontends build, deploy, and serve |
| [Deploy a frontend](frontends/deploy.md) | Deploy a Next.js site with the CLI |

### Security

| Guide | Description |
|-------|-------------|
| [Anon keys](authentication/security/anon-keys.md) | Public keys for frontend use |
| [Service keys](authentication/security/service-keys.md) | Secret keys with admin access |
| [Project access tokens](authentication/security/project-access-tokens.md) | Project-scoped API credentials for CI, scripts, and agents |
| [Token types](authentication/security/token-types.md) | Understanding different token types |
| [Security checklist](guides/security-checklist.md) | Production security guide |

### Projects

| Guide | Description |
|-------|-------------|
| [Deploy from GitHub](projects/git-deploy.md) | Connect a repo and deploy on every push to the production branch |
| [Export your source to GitHub](projects/export-to-git.md) | Initialize an empty repository with a project's stored source and deploy it from Git |
| [Configuration manifest](projects/configuration.md) | Declarative `volcano-config.yaml` reference (config deploy/pull) |
| [Variable Environments](projects/variable-environments.md) | Create and manage Project variable Environments |

## API reference

Complete REST API documentation for all Volcano endpoints.

| Reference | Description |
|-----------|-------------|
| [Overview](api-reference/overview.md) | API basics and authentication |
| [Using the API](api-reference/using-the-api.md) | Create an access token, deploy, read logs, handle errors |
| [OpenAPI specification](api-reference/openapi.md) | Fetch the machine-readable contract and generate a client |
| [Authentication](api-reference/authentication.md) | Auth headers and token types |
| [Auth endpoints](api-reference/auth-endpoints.md) | Signup, signin, and user management |
| [Projects](api-reference/projects.md) | Project management endpoints |
| [Functions](api-reference/functions.md) | Function deployment and invocation |
| [Databases](api-reference/databases.md) | Database provisioning endpoints |
| [Storage](api-reference/storage.md) | Storage bucket and object endpoints |
| [Project locks](api-reference/locks.md) | Backend lease endpoints |
| [Errors](api-reference/errors.md) | Error codes and handling |

## Guides

Step-by-step guides for common tasks.

| Guide | Description |
|-------|-------------|
| [Deploy to production](guides/production.md) | Ship your project to the cloud |
| [Plans and limits](guides/plans-and-limits.md) | HOBBY vs SUPERAGENT limits by resource |
| [Database migrations](guides/migrations.md) | Manage schema changes with the CLI |
| [Deployment performance](guides/deployment-performance.md) | Deployment latency objectives, phases, and telemetry |
| [Sandboxes](guides/sandboxes.md) | Preview: run commands and HTTP services in isolated sessions |

## Examples

Working code examples in the [examples/](examples/README.md) directory:

- **nodejs-hello/** — Simple Node.js function
- **python-data/** — Python data processing
- **frontend-auth-nextjs/** — Next.js frontend with authentication
- **function-sdk-example/** — Using the SDK inside a function
- **realtime-chat/** — Real-time chat with presence tracking

## Getting help

- [API reference](api-reference/overview.md) — REST API endpoints, authentication, and errors
