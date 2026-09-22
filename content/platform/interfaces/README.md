---
title: "Ways to use Volcano"
description: "Volcano is one platform behind five interfaces — dashboard, CLI, SDK, REST API, and MCP server. Which one to reach for, and what each takes."
order: 1
---

Everything Volcano does is one API. The dashboard, the CLI, the SDKs, and the
MCP server are all ways of calling it, so nothing is available through only one
of them, and moving between them does not mean rebuilding anything.

| Interface | Reach for it when | Credential |
|-----------|-------------------|------------|
| [Dashboard](dashboard.md) | Exploring, one-off changes, reading logs and usage, anything you would rather click than script | Your login |
| [CLI](/cli) | Deploying from a terminal or CI, migrations, local development | Platform token (`pk-`) or project access token (`pt-`) |
| [SDK](/sdk/js) | Writing application code — auth, queries, storage, realtime — from a browser, a function, or a server | Anon key, service key, or a signed-in user's token |
| [REST API](../api-reference/overview.md) | Automating something the CLI does not cover, or calling Volcano from a language with no SDK | Platform token (`pk-`) or project access token (`pt-`) |
| [MCP server](mcp.md) | Letting an AI agent inspect or change one project | Project access token (`pt-`) |

## Choosing one

**Start in the dashboard.** It is the fastest way to see what a project has and
to make a change you are not going to repeat. Nothing you do there is a dead
end — a project created by clicking is the same project the CLI deploys to.

**Move to the CLI when you repeat yourself.** Deploys, migrations, and anything
that belongs in CI are jobs for `volcano`. It is also the only interface that
understands your project on disk: `volcano-config.yaml`, your migrations
directory, and the source it packages and uploads.

**Use an SDK from application code.** There are SDKs for
[JavaScript](/sdk/js), [Python](/sdk/python), and [Ruby](/sdk/ruby), and they
are how your *users* reach Volcano — signing in, querying with row-level
security applied, uploading files, subscribing to changes. That is a different
job from the three above, which are how *you* manage the project. Each feature
also has its own guide: [auth](../authentication/volcano-sdk.md),
[databases](../databases/query-builder-api.md),
[storage](../storage/javascript-sdk.md), and
[realtime](../realtime/javascript-sdk.md).

**Use the REST API when nothing else fits.** Every control-plane operation is
an HTTP endpoint, and the CLI and dashboard are both clients of it. Go straight
to it for automation in a language with no SDK, or for an endpoint no command
wraps yet. [Using the API](../api-reference/using-the-api.md) walks through a
first call.

**Point an agent at the MCP server, not at a shell.** An agent given a project
access token over MCP gets a fixed set of tools, each one an API call it would
be allowed to make anyway. The alternative — handing a credential to an agent
that runs CLI commands — grants everything the credential can do, with nothing
narrowing it.

## Control plane and data plane

The interfaces split along a line worth knowing, because the credentials do
too.

**Control plane** is managing the project: creating functions, deploying,
provisioning databases, reading logs, setting variables. The dashboard, the
CLI, the REST API, and MCP all work here, and they take credentials that belong
to you or your automation — a platform token or a project access token.

**Data plane** is your application running: a user signing in, a query with
row-level security applied, a file upload, a function invocation. The SDKs work
here, with an anon key, a service key, or a signed-in user's token.

A control-plane credential cannot read your users' data, and a data-plane
credential cannot deploy. That is why an agent holding a project access token
has no tool to query a database — see
[What it cannot do](mcp.md#what-it-cannot-do). For the full comparison, see
[Token types](../authentication/security/token-types.md).
