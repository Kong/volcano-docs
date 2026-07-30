---
title: "Function Integration"
description: "Access authenticated user context in your serverless functions."
---

Access authenticated user context in your serverless functions.

## Receiving User Context

When a function is invoked with an auth user token, the user context is injected into the event:

```javascript
exports.handler = async (event) => {
  // Check if user is authenticated
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Access user information
  const { user_id, email, project_id, role } = event.__volcano_auth;
  
  console.log('User ID:', user_id);
  console.log('Email:', email);
  console.log('Project:', project_id);
  console.log('Role:', role);  // "authenticated" or "anonymous"
};
```

## User Context Fields

```javascript
event.__volcano_auth = {
  user_id: 'uuid',           // Auth user's unique ID
  email: 'user@example.com', // User's email
  project_id: 'uuid',        // Project the user belongs to
  role: 'authenticated',     // "authenticated" or "anonymous"
  access_token: 'eyJhbGci...' // The caller's access token
}
```

**Role values:**
- `"authenticated"` - User signed up with email/password or OAuth
- `"anonymous"` - Guest user (created via `signUpAnonymous()`)

**Note:** Both user types have a `user_id`. When an anonymous user converts to authenticated, their `user_id` remains the same - preserving all their data.

## With service key

If invoked with a service key (not auth user token), `__volcano_auth` is `undefined`:

```javascript
if (!event.__volcano_auth) {
  // Invoked with service key (service-to-service)
  // Or no authentication
}
```

## Handling Different User Types

```javascript
exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Handle based on user type
  if (auth.role === 'anonymous') {
    // Guest user - maybe limit features
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: limitedData,
        suggestion: 'Create an account to unlock all features'
      })
    };
  }

  // Full authenticated user
  return {
    statusCode: 200,
    body: JSON.stringify({ data: fullData })
  };
};
```

## Database Integration

`DATABASE_URL` defaults to `application_name=volcano_full_access` (admin, bypasses RLS). Rewrite
`application_name` to `volcano_user_access:{user_id}` before connecting, and pgproxy sets the
session variables Row-Level Security policies read automatically:

```javascript
const { Pool } = require('pg');

// One pool per auth user — the RLS identity is fixed at connection startup.
// In production, bound this cache (e.g. LRU with idle eviction).
const poolsByUser = new Map();
function poolForUser(userId) {
  let pool = poolsByUser.get(userId);
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('application_name', `volcano_user_access:${userId}`);
    pool = new Pool({ connectionString: url.toString(), max: 5 });
    poolsByUser.set(userId, pool);
  }
  return pool;
}

exports.handler = async (event) => {
  if (!event.__volcano_auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { user_id } = event.__volcano_auth;
  const client = await poolForUser(user_id).connect();

  try {
    // RLS policies work automatically — works for both authenticated and anonymous users
    const result = await client.query('SELECT * FROM posts');
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };
  } finally {
    client.release();
  }
};
```

## Complete Example

```javascript
const { Pool } = require('pg');

// One pool per auth user — the RLS identity is fixed at connection startup.
// In production, bound this cache (e.g. LRU with idle eviction).
const poolsByUser = new Map();
function poolForUser(userId) {
  let pool = poolsByUser.get(userId);
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('application_name', `volcano_user_access:${userId}`);
    pool = new Pool({ connectionString: url.toString(), max: 5 });
    poolsByUser.set(userId, pool);
  }
  return pool;
}

exports.handler = async (event) => {
  // 1. Verify authentication
  if (!event.__volcano_auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { user_id } = event.__volcano_auth;

  // 2. Get a connection from this user's pool — RLS is already in effect
  const client = await poolForUser(user_id).connect();

  try {
    // 3. Handle different actions
    const { action } = event;

    switch (action) {
      case 'create_post':
        await client.query(
          'INSERT INTO posts (title, content) VALUES ($1, $2)',
          [event.title, event.content]
          // user_id automatically set by trigger
        );
        return { statusCode: 201, body: 'Post created' };

      case 'get_posts':
        // RLS automatically filters to user's posts
        // Works for both anonymous and authenticated users
        const result = await client.query('SELECT * FROM posts');
        return {
          statusCode: 200,
          body: JSON.stringify(result.rows)
        };

      default:
        return { statusCode: 400, body: 'Unknown action' };
    }
  } finally {
    client.release();
  }
};
```

## Environment Variables

Volcano automatically injects these into your functions:

```javascript
process.env.DATABASE_URL  // Your database connection string
// Plus any variables you configure
```

## See Also

- [Row-Level Security](../../databases/row-level-security.md) - Secure data at database level
- [Auth Helpers](../../databases/auth-helpers.md) - Using auth.uid(), auth.email()
- [Examples](../../examples/lambda-sdk-example/README.md) - Complete working examples

