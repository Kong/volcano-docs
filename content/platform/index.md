---
title: "Volcano Documentation"
description: "Volcano is a serverless platform for building applications with functions, databases, and authentication."
---

Volcano is a serverless platform for building applications with functions, databases, and authentication. Deploy backend logic, provision PostgreSQL databases, and add user authentication—all through a unified API.

## Quick start

New to Volcano? Start here:

1. [Quickstart guide](getting-started/quickstart.md) — Deploy your first function in 5 minutes
2. [Core concepts](getting-started/overview.md) — Understand how Volcano works
3. [Installation](getting-started/installation.md) — Set up the SDK and CLI

## Core features

### Functions

Serverless functions that run your backend code. Supports Node.js, Python, and Ruby.

| Guide | Description |
|-------|-------------|
| [Overview](functions/overview.md) | What functions are and how they work |
| [Creating functions](functions/creating-functions.md) | Deploy your first function |
| [Invoking functions](functions/invoking-functions.md) | Call functions from your app |
| [User context](functions/user-context.md) | Access authenticated user data |
| [Environment variables](functions/environment-variables.md) | Configure secrets and settings |
| [Logs](functions/logs.md) | View and filter function logs |

### Databases

Serverless PostgreSQL with built-in authentication and row-level security.

| Guide | Description |
|-------|-------------|
| [Overview](databases/overview.md) | Database features and access methods |
| [Quick start](databases/quick-start.md) | Set up a database in 5 minutes |
| [Query Builder API](databases/query-builder-api.md) | Query from the browser with the SDK |
| [REST API](databases/rest-api.md) | HTTP endpoints for database operations |
| [Direct connection](databases/direct-connection.md) | Connect from Lambda with user impersonation |
| [Row-level security](databases/row-level-security.md) | Secure data with policies |
| [Auth helpers](databases/auth-helpers.md) | SQL functions for user context |

### Authentication

User authentication with email/password, OAuth providers, and anonymous users.

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

S3-backed file storage with RLS-style access control policies.

| Guide | Description |
|-------|-------------|
| [Overview](storage/overview.md) | Storage features and quick start |
| [JavaScript SDK](storage/javascript-sdk.md) | Complete SDK reference |
| [Policies](storage/policies.md) | RLS-style access control |
| [Buckets](storage/buckets.md) | Creating and managing buckets |

### Project locks

Renewable leases so only one backend worker runs a task at a time.

| Guide | Description |
|-------|-------------|
| [JavaScript SDK](locks/javascript-sdk.md) | Coordinate backend workers with renewable project leases |

### Realtime

Live updates over WebSockets: Postgres changes, presence, and broadcast.

| Guide | Description |
|-------|-------------|
| [Overview](realtime/overview.md) | Realtime features and the connection model |
| [Postgres changes](realtime/postgres-changes.md) | Subscribe to database changes |
| [Broadcast](realtime/broadcast.md) | Send messages between clients |
| [Presence](realtime/presence.md) | Track who is online |
| [JavaScript SDK](realtime/javascript-sdk.md) | Client SDK reference |
| [Security](realtime/security.md) | Channel authorization and limits |

### Frontends

Deploy static and server-rendered sites (Next.js) with build/runtime variables and custom domains.

| Guide | Description |
|-------|-------------|
| [Overview](frontends/overview.md) | How frontends build, deploy, and serve |
| [Deploy a frontend](frontends/deploy.md) | Deploy a Next.js site with the CLI |

### Security

| Guide | Description |
|-------|-------------|
| [Anon keys](authentication/security/anon-keys.md) | Public keys for frontend use |
| [Service keys](authentication/security/service-keys.md) | Secret keys with admin access |
| [Token types](authentication/security/token-types.md) | Understanding different token types |
| [Security checklist](guides/security-checklist.md) | Production security guide |

### Projects

| Guide | Description |
|-------|-------------|
| [Deploy from GitHub](projects/git-deploy.md) | Connect a repo and deploy on every push to the production branch |
| [Configuration manifest](projects/configuration.md) | Declarative `volcano-config.yaml` reference (config deploy/pull) |

### CLI

The Volcano CLI lets you manage your projects from the terminal.

| Guide | Description |
|-------|-------------|
| [Volcano CLI](https://github.com/Kong/volcano-cli/tree/main/docs) | CLI installation, authentication, and command reference — maintained in the volcano-cli repo (`volcano <command> --help`, `volcano docs search`) |

## API reference

Complete REST API documentation for all Volcano endpoints.

| Reference | Description |
|-----------|-------------|
| [Overview](api-reference/overview.md) | API basics and authentication |
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
| [Plans and limits](guides/plans-and-limits.md) | Free vs Pro limits by resource |
| [Database migrations](guides/migrations.md) | Manage schema changes with the CLI |
| [Deployment performance](guides/deployment-performance.md) | Deployment latency objectives, phases, and telemetry |

## Examples

Working code examples in the [examples/](examples/README.md) directory:

- **nodejs-hello/** — Simple Node.js function
- **python-data/** — Python data processing
- **frontend-auth-nextjs/** — Next.js frontend with authentication
- **lambda-sdk-example/** — Using the SDK in Lambda functions
- **realtime-chat/** — Real-time chat with presence tracking

## Getting help

- [GitHub Issues](https://github.com/Kong/volcano-hosting/issues) — Report bugs and request features
- [API reference](api-reference/overview.md) — REST API endpoints, authentication, and errors
