---
title: "Service keys"
description: "Service keys provide admin-level access to your project. They bypass row-level security (RLS) and can access all data across all users."
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
  -d '{"name": "Admin Key"}'
```

Response:

```json
{
  "id": "sk_abc123",
  "project_id": "proj_xyz789",
  "name": "Admin Key",
  "key_value": "sk-eyJhbGciOiJIUzI1NiIs...",
  "key_prefix": "sk-eyJhbGciO",
  "permissions": ["*"],
  "created_at": "2024-01-15T10:00:00Z"
}
```

> **Important:** Save the `key_value` immediately. This is your service key. You can retrieve it later via the API, but it's displayed truncated in the dashboard using `key_prefix`.

## Using service keys

### Invoke a function

```bash
curl -X POST "http://api.volcano.dev/functions/$FUNCTION_ID/invoke" \
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
    'Authorization': `Bearer ${process.env.SERVICE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts'
    // Returns ALL posts from ALL users
  })
});
```

## Service key vs user token

| Aspect | User access token | Service key |
|--------|-------------------|-------------|
| Purpose | Authenticate as a specific user | Admin operations |
| RLS | Enforced | Bypassed |
| Use in frontend | Yes | Never |
| Data access | Only user's own data | All data |
| Has user context | Yes | No |

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
  headers: { 'Authorization': `Bearer ${SERVICE_KEY}` }
});
// Returns: ALL posts from ALL users
```

## Security best practices

### Store in environment variables

```bash
# .env (server-side only, not committed to git)
SERVICE_KEY=vk_live_eyJhbGciOiJIUzI1NiIs...
```

```javascript
// Lambda function or backend server
const serviceKey = process.env.SERVICE_KEY;
```

### Rotate regularly

Regenerate service keys periodically (every 90 days recommended):

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/service-keys/$KEY_ID/regenerate" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

This generates a new key and immediately invalidates the old one. Update your environment variables before regenerating in production.

### Limit access

- Only share service keys with trusted team members
- Track who has access to service keys
- Revoke access when team members leave

## What service keys can do

Service keys have full access to your project:

- Read all data from all users
- Modify any data regardless of owner
- Delete any data across all users
- Invoke functions without user context
- Bypass all RLS policies

## What service keys cannot do

Even with full data access, service keys are still protected by:

- **SQL injection prevention** — All queries are parameterized
- **Project scoping** — Keys only work within their project
- **Table validation** — Only valid table names are accepted

## Managing service keys

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

## If a service key is compromised

1. Delete the compromised key immediately
2. Create a new service key
3. Update all services with the new key
4. Audit your database for unauthorized changes
5. Review access logs for suspicious activity

## Default service key

When you create a project, a default service key is automatically created. You can find it by listing your project's service keys or in the dashboard under **Authentication → Service Keys**.

## What's next

| Guide | Description |
|-------|-------------|
| [Anon keys](anon-keys.md) | Public keys safe for frontend use |
| [Token types](token-types.md) | Understanding all token types |
| [Row-level security](../../databases/row-level-security.md) | How RLS protects your data |
