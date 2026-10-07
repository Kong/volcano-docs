---
title: "Projects"
description: "A project holds functions, durable functions, databases, auth, storage, realtime, frontends, locks, and API keys."
---

A project is a container for your application's resources. Each project has its own functions, durable functions, databases, authentication, file storage, realtime, frontend hosting, distributed locks, and API keys.

## What's in a project

```text
my-app (Project)
├── Functions
│   ├── api-handler
│   ├── process-webhook
│   └── scheduled-task
├── Durable functions
│   └── order-pipeline
├── Databases
│   ├── main
│   └── analytics
├── Authentication
│   ├── Auth configuration
│   └── Auth users
├── File storage
│   └── uploads
├── Realtime
├── Frontends
│   └── web
├── Distributed locks
├── API keys
│   ├── Anon keys (for frontend)
│   └── Service keys (for backend)
└── Environment variables
    ├── API_KEY
    └── THIRD_PARTY_SECRET
```

## Project isolation

Projects are fully isolated from each other:

- Users in Project A cannot access Project B's data
- Functions in Project A cannot access Project B's databases
- API keys from Project A don't work with Project B

This isolation makes projects suitable for:

- **Different applications** — Each app gets its own project
- **Different environments** — Separate projects for development, staging, and production
- **Different customers** — Multi-tenant architectures with project-per-tenant

## Resource limits

Volcano enforces hard caps on resource creation:

- Each user can create up to 1,000 projects.
- Each project can contain up to 10,000 functions.
- Each project can contain up to 10,000 frontends.
- Each project can contain up to 10,000 databases on SUPERAGENT (1 on HOBBY).

See [Plans and limits](../guides/plans-and-limits.md) for HOBBY vs SUPERAGENT limits across every resource.

Create requests that would exceed these caps return `403 Forbidden`.

## Creating a project

```bash
curl -X POST "https://api.volcano.dev/projects" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

Project names contain letters, numbers, underscores, or hyphens and must be
1–255 characters after trimming surrounding whitespace. Invalid names return
`400 Bad Request`, including when creating a project from a template.

To constrain function deployment to a subset of regions (SUPERAGENT plan):

```bash
curl -X POST "https://api.volcano.dev/projects" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","all_regions":false,"selected_regions":["us-east-1"]}'
```

Response:

```json
{
  "id": "proj_abc123",
  "name": "my-app",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z"
}
```

When you create a project, Volcano automatically creates:

- A default anon key for frontend authentication
- A default service key for backend operations

## Project region policy

Each project controls where its functions are deployed:

- `all_regions=true` (default): deploy functions to all configured regions.
- `all_regions=false` + `selected_regions`: deploy only to listed regions.

You can update this later via `PATCH /projects/{id}`. Changes are applied asynchronously and functions will converge to the new region policy.

## Listing projects

```bash
curl "https://api.volcano.dev/projects" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Response:

```json
{
  "data": [
    {
      "id": "proj_abc123",
      "name": "my-app",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "proj_def456",
      "name": "staging-app",
      "status": "active",
      "created_at": "2024-01-10T08:00:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 2,
  "has_more": false
}
```

## Getting a project

```bash
curl "https://api.volcano.dev/projects/proj_abc123" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

## Deleting a project

```bash
curl -X DELETE "https://api.volcano.dev/projects/proj_abc123" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

> **Warning:** Deleting a project permanently removes all its resources including functions, databases, auth users, and API keys. This action cannot be undone.

When you delete a project, Volcano:

1. Deletes all function code from storage
2. Removes all deployed functions from every region
3. Terminates all database instances
4. Deletes all auth users and sessions
5. Revokes all API keys

## What's next

| Guide | Description |
|-------|-------------|
| [Creating projects](creating-projects.md) | Detailed project creation guide |
| [Export your source to GitHub](export-to-git.md) | Initialize an empty repository with a project's stored source and deploy it from Git |
| [Functions overview](../functions/overview.md) | Deploy functions |
| [Databases overview](../databases/overview.md) | Provision PostgreSQL databases |
| [Authentication overview](../authentication/overview.md) | Add user authentication |
