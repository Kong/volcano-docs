---
title: 'Service keys'
description: 'Service keys provide admin-level access to your project. They bypass row-level security (RLS) and can access all data across all users.'
---

Service keys provide admin-level access to your project. They bypass row-level security (RLS) and can access all data across all users.

> **Warning:** Service keys must never be exposed in frontend code. They provide full access to your project's data and should only be used in secure server environments.

## What service keys are for

Service keys are designed for backend operations that need to access data across multiple users:

- **Admin dashboards** — View and manage all users' data
- **Background jobs** — Process data across the entire system
- **Data migrations** — Update records for all users
- **Analytics** — Aggregate data across users

## Creating a service key

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/service-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin-Key"}'
```

Response:

```json
{
  "id": "sk_abc123",
  "project_id": "proj_xyz789",
  "name": "Admin-Key",
  "key_value": "sk-eyJhbGci...",
  "key_prefix": "sk-eyJhbGciO",
  "permissions": ["*"],
  "created_at": "2024-01-15T10:00:00Z"
}
```

> **Important:** Save the `key_value` immediately. This is your service key. You can retrieve it later via the API, but it's displayed truncated in the dashboard using `key_prefix`.

## Scope a service key

Pass `permissions` when you create a key to limit what it can do. A key created without `permissions`, or with an empty list, gets `["*"]`, which grants every permission but the reserved ones. `ai.invoke` and `grants.mint` are reserved: `"*"` doesn't include them, only a person creates a key that holds one, and it must be the key's only permission; see [Create an AI key](#create-an-ai-key) and [Create a key that mints grants](#create-a-key-that-mints-grants).

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/service-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "invoke-only", "permissions": ["functions.invoke"]}'
```

A list without `*` restricts these operations:

| Operation                             | Permission                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoke a function                     | `functions.invoke`                                                                                                                                                                                                                                                                                                                |
| Read, stop, and message a durable run | `functions.invoke`, plus the `client_token` the run's start returned                                                                                                                                                                                                                                                              |
| Storage objects                       | `storage.upload`, `storage.download`, `storage.list`, `storage.delete`                                                                                                                                                                                                                                                            |
| Project locks                         | `locks.manage`                                                                                                                                                                                                                                                                                                                    |
| Sandboxes                             | `sandboxes.read`, `sandboxes.sessions.create`, `sandboxes.exec`, `sandboxes.files.read`, `sandboxes.files.write`, `sandboxes.proxy.connect`, `sandboxes.suspend`, `sandboxes.resume`, `sandboxes.terminate`, `sandboxes.templates.read`, `sandboxes.templates.write`, `sandboxes.deployments.read`, `sandboxes.deployments.write` |
| Auth endpoints called through the key | `auth.signin`, `auth.signup`, `auth.refresh`, `auth.logout`, `auth.password_reset`                                                                                                                                                                                                                                                |

Volcano is extending the list to the database API and realtime. Once it applies there, a key without `*` needs:

| Operation                                                   | Permission           |
| ----------------------------------------------------------- | -------------------- |
| Database API, `/databases/{name}/query/*` and branch routes | `*`                  |
| Subscribe to broadcast and presence channels                | `realtime.subscribe` |
| Publish on broadcast channels                               | `realtime.publish`   |
| Watch Postgres changes                                      | `*`                  |

Without it, the database API answers `403` and realtime refuses the subscribe or publish. A subscription opened before the rule applied ends within seconds, with unsubscribe code `2100` and reason `service key scope`; the SDKs do not resubscribe. A durable run's channel keeps the rule above. Until then, every service key but an [AI key](#create-an-ai-key), scoped or not, can query and change every table with RLS bypassed, subscribe to any other channel, publish on broadcast channels, and watch changes to any table. A backend that queries your database or watches table changes needs a key holding `*`.

## Create an AI key

An AI key is a service key for the Volcano AI gateway, which calls models on your project's behalf. Volcano pays the model provider for those calls, and your project isn't billed for them. Create one with the same route as any service key, asking for `ai.invoke` and nothing else; `ai.invoke` beside another permission gets `400`. Only a person creates one: signed in to the dashboard, or with a `volcano login` token whose sign-in is live. A project access token, a request made through MCP, a platform token created through the token API, and a sign-in that ended get `403` with code `person_required`.

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/service-keys" \
  -H "Authorization: Bearer $VOLCANO_LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "builder", "permissions": ["ai.invoke"]}'
```

The response carries `key_value`. Mint [run tokens](../../guides/ai-gateway.md) with it. Read, regenerate, and delete it with the service key routes: reading it returns `key_value` again. Reading or regenerating an AI key, or any key that holds `ai.invoke`, takes the same person as creating one; anyone else gets `403` with code `person_required`, and lists leave its value out. An AI key only mints run tokens: the database API answers it `403` and realtime refuses its subscribe or publish, whether or not the rule above applies. A key that holds `*`, and a key created before AI keys existed, never count as AI keys. Where the `ai_gateway` capability in [`GET /capabilities`](../../api-reference/overview.md) is unavailable, asking for `ai.invoke` answers `404` with code `feature_unavailable`.

## Create a key that mints grants

A first-party app, such as the Builder, mints delegated grants on its users' projects with a key that holds `grants.mint`. The service key create route makes it: pass `"permissions": ["grants.mint"]` and nothing else. A key holds one reserved permission alone, so a key never holds `ai.invoke` and `grants.mint` together.

```bash
curl -X POST "https://api.volcano.dev/projects/$APP_PROJECT_ID/service-keys" \
  -H "Authorization: Bearer $VOLCANO_LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "builder-grants", "permissions": ["grants.mint"]}'
```

Only a registered first-party app's project may hold `grants.mint`, and only that project's owner, signed in as for an AI key, creates the key. Another project gets `403` with code `first_party_app_required`. The `ai_gateway` capability doesn't gate this key. Reading or regenerating it takes the same person as creating it.

## Using service keys

### Invoke a function

```bash
curl -X POST "https://api.volcano.dev/functions/$FUNCTION_ID/invoke" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"action": "admin_report"}}'
```

When you invoke a function with a service key, `event.__volcano_auth` is not present. The function runs without user context, which is appropriate for admin operations.

### Query a database (bypasses RLS)

```javascript
// Backend server code — NEVER in frontend
const response = await fetch(`https://api.volcano.dev/databases/${DB_ID}/query/select`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    table: 'posts',
    // Returns ALL posts from ALL users
  }),
});
```

## Service key vs user token

| Aspect           | User access token               | Service key      |
| ---------------- | ------------------------------- | ---------------- |
| Purpose          | Authenticate as a specific user | Admin operations |
| RLS              | Enforced                        | Bypassed         |
| Use in frontend  | Yes                             | Never            |
| Data access      | Only user's own data            | All data         |
| Has user context | Yes                             | No               |

### Example: User token (RLS enforced)

```javascript
// Query with user's access token
const { data } = await volcano.from('posts').select('*');
// Returns: Only this user's posts
```

### Example: Service key (RLS bypassed)

```javascript
// Query with service key (backend only)
const response = await fetch('/api/admin/posts', {
  headers: { Authorization: `Bearer ${SERVICE_KEY}` },
});
// Returns: ALL posts from ALL users
```

## Security best practices

### Store in environment variables

```bash
# .env (server-side only, not committed to git)
SERVICE_KEY=sk-your-service-key-here
```

```javascript
// Volcano function or backend server
const serviceKey = process.env.SERVICE_KEY;
```

### Rotate regularly

Regenerate service keys periodically (every 90 days recommended):

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/service-keys/$KEY_ID/regenerate" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

This generates a new key and invalidates the old one. The old key stops working within a few seconds, so update your environment variables before regenerating in production.

### Limit access

- Only share service keys with trusted team members
- Track who has access to service keys
- Revoke access when team members leave

## What service keys can do

A key holding `*` has full access to your project. A scoped key loses the operations its list leaves out, but keeps the database access below; see [Scope a service key](#scope-a-service-key).

- Read all data from all users
- Modify any data regardless of owner
- Delete any data across all users
- Invoke functions without user context
- Read, stop, and message every durable execution in the project, results and errors included. A key scoped to a list without `*` reaches an execution only with its `client_token`, which the start response returns
- Bypass all RLS policies

## What service keys cannot do

Even with full data access, service keys are still protected by:

- **SQL injection prevention** — All queries are parameterized
- **Project scoping** — Keys only work within their project
- **Table validation** — Only valid table names are accepted

## Managing service keys

Invalid names return HTTP `400` with a validation message. Names can contain
letters, numbers, underscores, and hyphens.
A duplicate key name returns HTTP `409`. Unexpected failures return HTTP `500`
with an operation-specific message, such as `failed to get service key`.

### List service keys

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/service-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### Delete a service key

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/service-keys/$KEY_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

A deleted key stops working within a few seconds.

## If a service key is compromised

1. Delete the compromised key immediately
2. Create a new service key
3. Update all services with the new key
4. Audit your database for unauthorized changes
5. Review access logs for suspicious activity

## Default service key

When you create a project, a default service key is automatically created. List the project's keys with `volcano projects keys service list`, then print one with `volcano projects keys service get <key-id> --show-key`, or call `GET /projects/{id}/service-keys`. The dashboard shows them under **Authentication → Service Keys**.

## What's next

| Guide                                                       | Description                       |
| ----------------------------------------------------------- | --------------------------------- |
| [Anon keys](anon-keys.md)                                   | Public keys safe for frontend use |
| [Token types](token-types.md)                               | Understanding all token types     |
| [Row-level security](../../databases/row-level-security.md) | How RLS protects your data        |
