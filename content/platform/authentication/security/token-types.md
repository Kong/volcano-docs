---
title: "Token Types"
description: "Volcano uses different token types for different purposes."
---

Volcano uses different token types for different purposes.

## Platform User Token

**Purpose:** Manage your projects, functions, and databases

**Created via:** Management API (port 8001)

**Used for:**
- Creating/deleting projects
- Managing functions and databases
- Viewing logs
- Managing auth users (admin operations)
- Creating/revoking anon keys

**Format:** Random token

**Example:**
```bash
curl -X GET https://api.volcano.dev/projects \
  -H "Authorization: Bearer your-platform-token"
```

---

## Anon Key

**Purpose:** Public client access for auth endpoints and optional public function invokes

**Created:** Automatically with each project

**Used for:**
- Signup endpoint
- Signin endpoint  
- Refresh endpoint
- Logout endpoint
- Invoking functions marked `is_public: true` (requires `functions.invoke` permission)

**Format:** JWT (project-scoped)

**Safe to expose:** Yes (designed for frontend)

**Example:**
```javascript
// Frontend code (safe to include)
const volcano = new VolcanoAuth({
  anonKey: 'eyJhbGciOiJIUz...'  // Safe in client code
});

await volcano.auth.signUp({...});  // Uses anon key
```

**Why it's safe:**
- Only works for YOUR project
- Can't create users in other projects
- Can't access admin endpoints
- Can be revoked if compromised

---

## Auth User Access Token

**Purpose:** Authenticated end-user requests

**Created:** Returned from signup/signin

**Used for:**
- Invoking functions (with user context)
- Accessing user profile (`GET /auth/user`)
- Updating profile (`PUT /auth/user`)

**Format:** JWT

**Lifetime:** 1 hour (configurable)

**Contains:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "project_id": "project-uuid",
  "role": "authenticated"
}
```

**Example:**
```javascript
// After signin, SDK stores access token
await volcano.auth.signIn({...});

// Automatically used for function calls
await volcano.functions.invoke('my-function', {
  action: 'get_data'
});
```

**In your function:**
```javascript
exports.handler = async (event) => {
  const { user_id, email } = event.__volcano_auth;
  // User context available
};
```

---

## Auth User Refresh Token

**Purpose:** Get new access tokens without re-entering password

**Created:** Returned from signup/signin

**Used for:** Refreshing expired access tokens

**Format:** Random hex string

**Lifetime:** 30 days (configurable)

**Stored:** Database (can be revoked)

**Example:**
```javascript
// Automatically handled by SDK
await volcano.auth.refreshSession();

// Or manually:
const response = await fetch('/auth/refresh', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${anonKey}`,  // Note: uses anon key!
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refresh_token: refreshToken
  })
});
```

---

## Service Key

**Purpose:** Admin operations, background jobs, database admin access

**Created via:** Platform Dashboard or API

**Used for:**
- Function invocation (background jobs, webhooks, cron)
- Database queries with RLS bypass (admin access)
- Admin operations across all users

**Format:** JWT

> **Warning:** Backend only. Never expose service keys in frontend code.

**No user context:** Functions don't receive `__volcano_auth`

**Example:**
```bash
# Create service key
curl -X POST https://api.volcano.dev/projects/abc-123/service-keys \
  -H "Authorization: Bearer platform-token" \
  -d '{"name":"admin-key"}'

# Use for function invocation (admin operation)
curl -X POST http://api.volcano.dev/functions/func-id/invoke \
  -H "Authorization: Bearer service-key" \
  -d '{"action":"cleanup_all_users"}'

# Use for database query (bypasses RLS)
curl -X POST https://api.volcano.dev/databases/db-id/query/select \
  -H "Authorization: Bearer service-key" \
  -d '{"table":"posts"}'  # Sees ALL users' posts
```

**When to use:**
- Background jobs (no specific user)
- Admin operations (need to see all data)
- Analytics across all users
- Content moderation

**Security:**
- Bypasses Row-Level Security
- Can access ALL users' data
- Store in environment variables only
- Never commit to git

---

## Comparison

| Token Type | Created By | Used For | Scoped To | User Context | RLS |
|------------|------------|----------|-----------|--------------|-----|
| **Platform Token** | You (Management API) | Project management | Account | No | N/A |
| **Anon Key** | Auto (per project) | Public auth + public function invoke | Project | No | N/A |
| **Access Token** | Signup/signin | Functions + DB queries | Project + User | Yes | Enforced |
| **Refresh Token** | Signup/signin | Token refresh | User | No | N/A |
| **Service Key** | You (Platform API) | Functions + DB (admin) | Project | No | Bypassed |

## Which Token to Use?

**Frontend user signup/signin:**
→ Use **Anon Key**

**Frontend calling functions (as user):**
→ Use **Access Token** (from signin)

**Backend admin operations / cron jobs:**
→ Use **Service Key**

**Managing your project:**
→ Use **Platform Token**

**Getting new access token:**
→ Use **Refresh Token** (with Anon Key)

**Database queries (user-scoped):**
→ Use **Access Token** (RLS enforced)

**Database queries (admin/all users):**
→ Use **Service Key** (RLS bypassed)

## See Also

- [Anon Keys](anon-keys.md) - Public keys for frontend authentication
- [Service Keys](service-keys.md) - Admin keys for backend operations



