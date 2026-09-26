---
title: "MCP server"
description: "Connect an AI agent to one Volcano project over the Model Context Protocol, using the same project access token as the REST API."
---

Volcano hosts a Model Context Protocol (MCP) server, so an agent in your editor
can inspect a project — its functions, frontends, deployments, and logs — and,
with a full-scope token, change it.

It takes the same project access token as the REST API, over one endpoint:

```text
POST https://api.volcano.dev/mcp
```

The agent operates the project that token belongs to, and only that one. No tool
takes a project argument, so an agent cannot point a call at a project its
credential does not cover. Configuration for [Claude Code](#claude-code),
[Cursor](#cursor), and [Codex](#codex) is below.

## Configure your client

The endpoint is one URL, and authentication is a request header:

```text
POST https://api.volcano.dev/mcp
Authorization: Bearer pt-your-project-access-token
```

Against staging, use `https://api.staging.volcano.dev/mcp`.

Every client below reads the token from an environment variable, so the secret
stays out of a file you might commit. Export it first:

```bash
export VOLCANO_PROJECT_TOKEN=pt-your-project-access-token
```

### Claude Code

Add it from the command line:

```bash
claude mcp add --transport http volcano https://api.volcano.dev/mcp \
  --header "Authorization: Bearer $VOLCANO_PROJECT_TOKEN"
```

Or commit the server (not the token) to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "volcano": {
      "type": "http",
      "url": "https://api.volcano.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${VOLCANO_PROJECT_TOKEN}"
      }
    }
  }
}
```

`type` is required for Claude Code to treat the entry as remote. Restart the
session after editing the file.

If tools come back `401`, check that the variable reached the header rather than
being passed through literally — some Claude Code versions have shipped without
expanding `${VAR}` inside `headers`. `claude mcp list` warns when a variable is
unset. This endpoint does not offer OAuth, so a missing header fails as `401`
rather than silently starting a browser login.

### Cursor

Put this in `.cursor/mcp.json` for one project, or `~/.cursor/mcp.json` to use it
everywhere:

```json
{
  "mcpServers": {
    "volcano": {
      "url": "https://api.volcano.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${env:VOLCANO_PROJECT_TOKEN}"
      }
    }
  }
}
```

Cursor infers the transport from `url`, and uses `${env:NAME}` rather than
`${NAME}`. The variable has to be set in the environment Cursor itself was
launched from — if you start it from a desktop icon rather than a shell, a
variable exported in `.zshrc` will not reach it.

### Codex

Codex uses TOML, and takes the *name* of the environment variable rather than
the token:

```bash
codex mcp add volcano \
  --url https://api.volcano.dev/mcp \
  --bearer-token-env-var VOLCANO_PROJECT_TOKEN
```

That writes `~/.codex/config.toml`, which you can also edit directly:

```toml
[mcp_servers.volcano]
url = "https://api.volcano.dev/mcp"
bearer_token_env_var = "VOLCANO_PROJECT_TOKEN"
```

Check what was saved with `codex mcp get volcano --json`. The output should show
the variable name under `bearer_token_env_var` — if a real token appears there or
in the URL, remove the entry and add it again.

## Create a token for the agent

The MCP endpoint takes the same credential as the REST API: a project access token (`pt-`). Create one with your platform token, and start with `read_only`:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "coding-agent",
    "scope": "read_only",
    "expires_at": "2027-07-01T00:00:00Z"
  }'
```

```json
{
  "id": "0b6f2f3e-8f4e-4f1e-9a3a-1f9a7c2d5b10",
  "project_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "coding-agent",
  "token_prefix": "pt-000000000",
  "scope": "read_only",
  "status": "active",
  "expires_at": "2027-07-01T00:00:00Z",
  "created_at": "2024-07-02T09:14:22Z",
  "token": "pt-0000000000000000000000000000000000000000000000000000000000000000"
}
```

`read_only` covers everything an agent needs to investigate — the project, its functions and frontends, its deployments, its logs — and nothing it can use to change the project. Give an agent `full` only when it genuinely has to write: that scope is the whole project API, not just the tools listed here, so the same credential can delete the project. Set `expires_at` so a token you hand to an agent stops working on its own.

A **platform token (`pk-`) is refused with `403`.** The endpoint takes its project from the credential, and an account-wide token names no project:

```json
{
  "error": "this endpoint needs a project access token; a platform token does not name a project"
}
```

## Tools

| Tool | Scope | What it does | Endpoint |
|------|-------|--------------|----------|
| `get_project` | `read_only` | Returns the project's name, status, plan, and region | `GET /projects/{id}` |
| `list_functions` | `read_only` | Lists the project's functions, with runtime and status | `GET /projects/{id}/functions` |
| `list_frontends` | `read_only` | Lists the project's frontends, with status and live URLs | `GET /projects/{id}/frontends` |
| `list_deployments` | `read_only` | Lists recent deployments, newest first | `GET /projects/{id}/deployments` |
| `search_logs` | `read_only` | Searches the project's logs | `POST /projects/{id}/logs/search` |
| `list_databases` | `full` | Lists the project's databases. Returns connection strings | `GET /projects/{id}/databases` |
| `set_variable` | `full` | Creates or updates an environment variable | `POST /projects/{id}/variables` |

Arguments are not listed here, because they are not defined here. Each tool's
input schema is generated from the API's OpenAPI specification for the endpoint
it calls, so a tool accepts exactly the parameters and body fields that
endpoint accepts — with their types, allowed values, bounds, and documentation —
and a change to the API is carried into the tool schema without anyone editing a
list. Call `tools/list` to see the current schemas, which are always the ones
your token will be held to.

That includes the shapes an argument could not otherwise be guessed from. The
`resource` argument of `search_logs`, for instance, arrives as a tagged union
with each variant and its `type` value spelled out, so an agent can construct
`{"resource": {"type": "function"}, "limit": 20}` from the schema alone.

Scope is enforced by the same rules as the REST API. A `read_only` token is not shown the `full` tools in `tools/list`, and is refused if it calls one anyway — `set_variable` because it writes, `list_databases` because it hands back a credential that keeps working after the token is gone. A `full` token sees all seven.

## Call a tool

```bash
curl -X POST "https://api.volcano.dev/mcp" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {"name": "list_functions", "arguments": {}}
  }'
```

A tool returns the API's own JSON response as text content:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"data\":[{\"id\":\"550e8400-e29b-41d4-a716-446655440000\",\"name\":\"checkout\",\"status\":\"active\",\"runtime\":\"nodejs24.x\"}],\"page\":1,\"limit\":10,\"total\":1,\"has_more\":false}"
      }
    ]
  }
}
```

A call that ran and failed comes back as a tool result with `isError` set and the HTTP status included, so the agent can tell "you may not" from "that does not exist":

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "set_variable failed with HTTP 403: {\"error\":\"project access token is read-only\"}"
      }
    ],
    "isError": true
  }
}
```

A JSON-RPC error means the request itself was wrong — an unknown tool or bad params (`-32602`), an unknown method (`-32601`) — and nothing ran.

Results are capped at 64 KiB. Past that the text ends with a note saying it was truncated and to narrow the request, so an agent knows it is reading a prefix. Use `limit` and the `search_logs` filters rather than paging through a truncated result.

## What it cannot do

A project access token is a control-plane credential. It deploys and configures; it does not read your users' data or run your code. So there is no tool to invoke a function or query a database — those need a service key or an anon key, which are data-plane credentials the agent should not be holding. See [Service keys](../authentication/security/service-keys.md).

The rest of the boundary comes from the credential itself, and is the same over MCP as over HTTP: no other project, no account-level action, and no managing project access tokens — an agent cannot mint its replacement or erase the record of what it did. See [Project access tokens](../authentication/security/project-access-tokens.md).

## Revoke access

Revoking the token stops the agent. It takes effect immediately in the region handling the call and within seconds everywhere else, and the MCP endpoint then answers `401` like every other route:

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/access-tokens/$TOKEN_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```text
HTTP/1.1 204 No Content
```

Revoking does not undo what the agent already did. The token's usage counts show how much it called; rotate anything a `full` token could have read.

## Protocol details

Streamable HTTP: one JSON-RPC 2.0 object per request, one response per request. The server never initiates a message, so there is no server-to-client stream — a `GET` returns `405` with an `Allow: POST` header, and a batched array is rejected with a message saying so. `initialize` advertises protocol revision `2025-06-18` and a tools capability only.

Every request needs an `id`. Only the `notifications/*` methods may omit one, and only those are answered with `202` and no body; a `tools/call` without an `id` is refused with `-32600` and the tool does not run. A frame larger than 1 MiB is refused with `413`.

| Method | Purpose |
|--------|---------|
| `initialize` | Handshake; returns the protocol revision and server info |
| `notifications/initialized` | Client acknowledgement. The one method sent without an `id`; answered with `202` and no body |
| `ping` | Liveness check |
| `tools/list` | The tools this credential may call |
| `tools/call` | Run one tool |

Any other method returns `-32601`.

## What's next

| Reference | Description |
|-----------|-------------|
| [Project access tokens](../authentication/security/project-access-tokens.md) | Scopes, expiry, revocation, and the security model |
| [Using the API](../api-reference/using-the-api.md) | The same project API over plain HTTP |
| [Overview](../api-reference/overview.md) | Base URL, status codes, pagination |
| [Errors](../api-reference/errors.md) | Error codes and handling |
