---
title: 'Sandboxes'
description: 'Run commands and HTTP services in isolated sessions, with files and processes that persist across steps.'
---

Sandboxes give an agent, an application, or a developer an isolated place to run code.
Run a single command in a temporary Sandbox, or keep a session alive for work that spans several steps: its files in `/workspace` and its background processes, including HTTP services, last until the session ends.
Hosted Sandboxes run in isolated virtual machines; local Sandboxes run in Docker containers on your machine.

## Quick example

Run a command in a temporary Sandbox from the CLI:

```bash
volcano cloud sandboxes exec --preset python3.12 -- python -c 'print(42)'
```

The command prints the guest's stdout and stderr and exits with the guest process's exit code.
Discover the presets you can use with `volcano cloud sandboxes presets` or `GET /sandboxes/presets`.

## Features

| Feature            | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| One-shot commands  | Run one command in a temporary Sandbox that Volcano terminates when the command finishes       |
| Sessions           | Keep a workspace, background processes, and HTTP services across many commands                 |
| Suspend and resume | Pause a session with its processes and files intact; suspended time uses no runtime allowance  |
| Files              | Read and write files in the session's `/workspace`, up to 8 MiB per operation                  |
| HTTP access        | Reach a session port over HTTP, WebSocket, SSE, or gRPC with short-lived, per-port credentials |
| User grants        | Let a signed-in project user run commands, read files, and connect to one session              |
| Templates          | Save a preset and memory size by name, or deploy a custom image from a `Dockerfile` fragment   |
| Safe retries       | Retrying a request with the same idempotency key never runs the command a second time          |
| Local mode         | The same API on your machine after `volcano start`                                             |

## One-shot command or session

Use a one-shot command when a single command produces the whole result.
Its response returns after Volcano has terminated the Sandbox, with the command's stdout, stderr, and exit code.

Use a session when several commands should share a workspace or a service must stay available.
Creating a session is asynchronous: poll it until its state is `running` before running commands.
Suspending a session keeps its processes and files; terminating it destroys them.

See [Run a command](../guides/sandboxes.md#run-a-command) and [Keep a session alive](../guides/sandboxes.md#keep-a-session-alive) for the API calls.

## Who can use Sandboxes

Platform user tokens, project service keys, and full-scope project access tokens manage Sandboxes.
Read-only project access tokens can inspect templates, deployments, sessions, and session files.
A signed-in project user can only use a session that has been explicitly granted to them, and cannot create, suspend, resume, or terminate sessions.
Anonymous keys cannot create or access sessions.
Keep service keys on your backend.

See [Grant a signed-in user access](../guides/sandboxes.md#grant-a-signed-in-user-access).

## Plans and limits

Runtime is configured baseline memory multiplied by running time, so a 1 GiB session running for 30 minutes uses 0.5 GBh however many commands it runs.
Suspended time, snapshots, and local sessions are not charged.

Each plan sets an included runtime allowance, a memory limit, a maximum session lifetime, and a limit on concurrent sessions.
See [Pricing and usage](../guides/sandboxes.md#pricing-and-usage) for each plan's values, what happens when the allowance runs out, and usage counters.

Check whether Sandboxes are available in an environment with [`GET /capabilities`](../api-reference/overview.md#capabilities).

## Next steps

| Guide                                                                       | Description                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Sandboxes guide](../guides/sandboxes.md)                                   | The full API: sessions, lifetimes, files, HTTP access, grants, and pricing |
| [Deploy a custom template](../guides/sandboxes.md#deploy-a-custom-template) | Build your own image from a `Dockerfile` fragment                          |
| [Run locally](../guides/sandboxes.md#run-locally)                           | Use Docker-backed Sandboxes with `volcano start`                           |
| [CLI](/cli/sandboxes)                                                       | Run commands and manage sessions, files, and templates from a terminal     |
| [JavaScript SDK](/sdk/js/sandboxes)                                         | The `client.sandboxes` facade in JavaScript                                |
| [Python SDK](/sdk/python/sandboxes)                                         | The `client.sandboxes` facade in Python                                    |
| [Ruby SDK](/sdk/ruby/sandboxes)                                             | The `client.sandboxes` facade in Ruby                                      |
| [MCP server](../interfaces/mcp.md#sandbox-tools)                            | Let an AI agent start sessions, run commands, and read files               |
