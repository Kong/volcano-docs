---
title: "Overview"
description: "Volcano is a serverless backend platform with three core services — functions, databases, and authentication — unified behind one API."
---

Volcano is a serverless backend platform. It provides three core services: functions for running code, databases for storing data, and authentication for managing users. All services work together through a unified API.

## How Volcano works

```text
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
│                  (Web, Mobile, or Server)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Volcano API                            │
├─────────────────┬──────────────────┬────────────────────────┤
│    Functions    │    Databases     │    Authentication      │
│  (Serverless)   │   (PostgreSQL)   │   (JWT + Sessions)     │
└─────────────────┴──────────────────┴────────────────────────┘
```

Your application makes API calls to Volcano. Volcano manages the underlying infrastructure—serverless functions, PostgreSQL databases, and user sessions—so you can focus on building your product.

## Core concepts

### Projects

A project is a container for your application's resources. Each project has its own:

- Functions
- Databases
- Authentication configuration
- API keys

Most applications need one project. You might create multiple projects to separate environments (development, staging, production) or different applications.

### Functions

Functions are serverless code that runs on demand. You write the code, upload it to Volcano, and invoke it via HTTP. Volcano handles provisioning, scaling, and execution.

Supported runtimes:
- Node.js (22.x, 24.x)
- Python (3.9, 3.10, 3.11, 3.12, 3.13)
- Ruby (3.2, 3.3, 3.4)

Functions can access databases, user context, and environment variables. They're useful for:

- API endpoints
- Background processing
- Scheduled tasks
- Webhooks

### Databases

Databases are serverless PostgreSQL instances. They auto-scale based on usage and pause when idle to save costs.

You can access databases two ways:

1. **Query Builder / REST API** — Make HTTP requests from browsers or servers
2. **Direct connection** — Connect from your functions with standard PostgreSQL clients

Databases include built-in support for row-level security (RLS). Combined with authentication, you can write policies that automatically filter data based on the current user.

### Authentication

Authentication lets your application's users sign up, sign in, and manage their accounts. It supports:

- Email and password
- OAuth providers (Google, GitHub, Microsoft, Apple)
- Anonymous users (for guest access)

When a user authenticates, they receive a JWT access token. This token can be used to:

- Invoke functions with user context
- Query databases with automatic RLS enforcement
- Access protected resources

## API keys

Volcano uses different keys for different purposes:

| Key type | Purpose | Use in |
|----------|---------|--------|
| Platform token | Manage projects, deploy functions, provision databases | Backend, CI/CD |
| Anon key | Initialize SDK, allow users to sign up/sign in | Frontend |
| Service key | Invoke functions as admin, bypass RLS | Backend only |
| Access token | Authenticate as a specific user | Frontend, functions |

> **Important:** Never expose platform tokens or service keys in frontend code. These keys have admin access and should only be used in secure server environments.

## A typical workflow

1. **Create a project** — Use your platform token to create a project via the API
2. **Deploy functions** — Write code, package it, and upload to Volcano
3. **Provision a database** — Create a PostgreSQL database for your data
4. **Configure authentication** — Enable signup methods and create API keys
5. **Build your frontend** — Use the SDK to authenticate users and invoke functions
6. **Set up RLS** — Write policies to secure your data per user

## What's next

| Guide | Description |
|-------|-------------|
| [Quickstart](quickstart.md) | Deploy your first function in 5 minutes |
| [Installation](installation.md) | Set up the SDK and CLI |
| [Projects](../projects/overview.md) | Learn about project management |
| [Functions](../functions/overview.md) | Deep dive into serverless functions |
| [Databases](../databases/overview.md) | Learn about PostgreSQL databases |
| [Authentication](../authentication/overview.md) | Add user auth to your app |
