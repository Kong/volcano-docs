---
title: "Authentication Concepts"
description: "Core authentication concepts in Volcano: platform vs auth users, token types, project isolation, sessions, and access keys."
---

## Users

**Platform Users** - Developers who use Volcano (you)
- Created via Management API
- Own projects and resources
- Authenticate with platform user tokens

**Auth Users** - End-users of your application
- Created via your project's auth endpoints
- Isolated per project
- Authenticate with access tokens

## Token Types

### Anon Key

Project-specific public key for frontend authentication.

```text
Used for: signup, signin, refresh, logout
Safe to expose: Yes (in frontend code)
Scoped to: Single project
Get from: Project Settings → Authentication
```

**Why it exists:** Prevents anyone from creating users in your project without your anon key.

### Access Token

Short-lived JWT for authenticated requests.

```text
Lifetime: 1 hour (configurable)
Format: JWT
Contains: user_id, email, role, project_id
Used for: Invoking functions, accessing user profile
```

### Refresh Token

Long-lived token for getting new access tokens.

```text
Lifetime: 30 days (configurable)
Format: Random hex string
Stored: Database (revocable)
Used for: Getting new access tokens
```

### service key

Service token for server-to-server communication.

```text
Used for: Background jobs, webhooks, cron
Scope: Full project access
No user context: Functions don't receive __volcano_auth
```

## Project Isolation

Each project has completely separate auth users:

```text
Project A:
- user@example.com (password: abc)
- Auth users: 100

Project B:
- user@example.com (password: xyz)  ← Same email, different account
- Auth users: 50

Projects are completely isolated. Tokens from A don't work in B.
```

## Sessions

When a user signs in, a session is created:

```text
Session includes:
- Refresh token (for getting new access tokens)
- IP address (for security)
- User agent (device/browser info)
- Last activity timestamp
- Expiration date
```

Sessions can be:
- Refreshed (extends lifetime)
- Timed out (inactivity or max duration)
- Revoked (logout or admin action)

## Permissions

Anon keys have limited permissions:

```text
Default anon key permissions:
- auth.signup
- auth.signin
- auth.refresh
- auth.logout

Cannot do:
- List users (admin only)
- Delete users (admin only)
- Modify settings (admin only)
```

You can create multiple anon keys with different permissions.

## Row-Level Security

Your PostgreSQL database can restrict data based on the authenticated user:

```sql
-- Only show posts created by current user
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());
```

Connect with the user's identity to enable this automatically — `DATABASE_URL` defaults to
`application_name=volcano_full_access` (bypasses RLS), so rewrite it to
`volcano_user_access:{user_id}` before connecting:

```javascript
// In your function
const { user_id } = event.__volcano_auth;

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('application_name', `volcano_user_access:${user_id}`);
const client = new Client({ connectionString: url.toString() });
await client.connect();

// pgproxy sets the session variables auth.uid() reads, so RLS policies work automatically
const posts = await client.query('SELECT * FROM posts');
// Only returns current user's posts
```

## Next Steps

- [Quickstart](quickstart.md) - Build your first authenticated app
- [Anon Keys](security/anon-keys.md) - Understand anon key security
- [Token Types](security/token-types.md) - When to use each token
- [Row-Level Security](../databases/row-level-security.md) - Secure your data at database level




