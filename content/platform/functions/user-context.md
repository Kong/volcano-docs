---
title: "Accessing User Information in Functions"
description: "Learn how to access authenticated user information in your serverless functions."
---

Learn how to access authenticated user information in your serverless functions.

## Overview

When users invoke your functions, Volcano automatically injects their authentication context into the event payload. This lets you:

- Identify which user is making the request
- Differentiate between guest (anonymous) and registered users
- Apply user-specific logic and permissions
- Track user data across sessions

## The `__volcano_auth` Object

Functions invoked with an auth user token receive a special `__volcano_auth` object:

```javascript
exports.handler = async (event) => {
  console.log(event.__volcano_auth);
  // {
  //   user_id: "550e8400-e29b-41d4-a716-446655440000",
  //   email: "user@example.com",
  //   project_id: "123e4567-e89b-12d3-a456-426614174000",
  //   role: "authenticated",
  //   access_token: "eyJhbGci..."
  // }
};
```

## Context Fields

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string (UUID) | Unique identifier for the user. Persists across anonymous → authenticated conversion |
| `email` | string | User's email (or internal format for anonymous users) |
| `project_id` | string (UUID) | The project this user belongs to |
| `role` | string | User type: `"authenticated"` or `"anonymous"` |
| `access_token` | string | The caller's access token — forward it to the Volcano SDK/API to make calls as this user |

## Checking if User is Authenticated

### Basic Authentication Check

```javascript
exports.handler = async (event) => {
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  // User is authenticated (either anonymous or registered)
  const { user_id, role } = event.__volcano_auth;
  console.log(`User ${user_id} with role ${role}`);
};
```

### Public Endpoints (Optional Auth)

```javascript
exports.handler = async (event) => {
  if (event.__volcano_auth) {
    // Authenticated request - personalize response
    const { user_id } = event.__volcano_auth;
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Welcome back!',
        user_id: user_id
      })
    };
  }

  // Unauthenticated - show public content
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Welcome, guest!'
    })
  };
};
```

## User Types and Roles

### Authenticated Users

Users who signed up with email/password or OAuth:

```javascript
{
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  project_id: "123e4567-e89b-12d3-a456-426614174000",
  role: "authenticated",
  access_token: "eyJhbGci..."
}
```

### Anonymous Users

Guest users created via `signUpAnonymous()`:

```javascript
{
  user_id: "660f9511-f39c-52e5-b827-557766551111",
  email: "anon-1234567890@anonymous.volcano.internal",
  project_id: "123e4567-e89b-12d3-a456-426614174000",
  role: "anonymous",
  access_token: "eyJhbGci..."
}
```

**Note:** Anonymous users have a real `user_id` for tracking their data. When they convert to authenticated users, this ID stays the same - preserving all their data.

## Differentiating User Types

```javascript
exports.handler = async (event) => {
  const auth = event.__volcano_auth;

  if (!auth) {
    return { statusCode: 401, body: 'Login required' };
  }

  if (auth.role === 'anonymous') {
    // Guest user
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: { /* limited features */ },
        message: 'Create an account to unlock all features!',
        is_guest: true
      })
    };
  }

  if (auth.role === 'authenticated') {
    // Full registered user
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: { /* full features */ },
        is_guest: false
      })
    };
  }
};
```

## Common Patterns

### User-Specific Data Queries

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
  if (!event.__volcano_auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { user_id } = event.__volcano_auth;
  const client = await pool.connect();

  try {
    // Query data for this specific user
    const result = await client.query(
      'SELECT * FROM todos WHERE user_id = $1',
      [user_id]
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };
  } finally {
    client.release();
  }
};
```

### Row-Level Security (RLS)

`process.env.DATABASE_URL` carries `application_name=volcano_full_access` (admin, bypasses RLS) by
default. To enforce RLS for the invoking user, rewrite `application_name` to
`volcano_user_access:{user_id}` before connecting — pgproxy then sets the session
variables (`request.jwt_sub`, `request.jwt_email`, `request.jwt_role`) that back
`auth.uid()`/`auth.email()`/`auth.role()` automatically on every query. See
[Direct connection](../databases/direct-connection.md#authentication--user-impersonation)
for pooling and other client details.

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
    // Query automatically filtered by RLS policies
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

### Feature Gating by User Type

```javascript
exports.handler = async (event) => {
  const auth = event.__volcano_auth;

  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { action } = event;

  // Premium features only for registered users
  const premiumFeatures = ['export', 'analytics', 'team_sharing'];
  
  if (premiumFeatures.includes(action) && auth.role === 'anonymous') {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'This feature requires a full account',
        upgrade_url: '/signup'
      })
    };
  }

  // Process the action
  // ...
};
```

### Audit Logging

```javascript
exports.handler = async (event) => {
  const auth = event.__volcano_auth;

  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { user_id, email, role } = event.__volcano_auth;
  const { action, resource_id } = event;

  // Log the action with user context
  await logAction({
    user_id,
    email,
    role,
    action,
    resource_id,
    timestamp: new Date(),
    ip_address: event.headers?.['x-forwarded-for']
  });

  // Continue with operation
  // ...
};
```

## When `__volcano_auth` is NOT Present

The context is `undefined` when invoked with:

- **service key** (service-to-service calls)
- **No Authorization** header
- **Invalid token**

```javascript
exports.handler = async (event) => {
  if (!event.__volcano_auth) {
    // Could be:
    // 1. Service-to-service call (service key)
    // 2. Unauthenticated request
    // 3. Invalid/expired token
    
    // Check if this is a valid use case
    // or return 401 Unauthorized
  }
};
```

## Security Best Practices

### Always Validate User Context

```javascript
// DON'T: Assume context exists
const userId = event.__volcano_auth.user_id; // May crash!

// DO: Always check first
if (!event.__volcano_auth) {
  return { statusCode: 401, body: 'Unauthorized' };
}
const userId = event.__volcano_auth.user_id;
```

### Don't Trust Client Input for User ID

```javascript
// DON'T: Use user_id from request body
const userId = event.user_id; // Could be forged!

// DO: Use authenticated context
const userId = event.__volcano_auth.user_id; // Verified by Volcano
```

### Validate Project Isolation

The `project_id` in context ensures users can only access their project's resources:

```javascript
const { project_id, user_id } = event.__volcano_auth;

// Volcano guarantees:
// - user_id belongs to project_id
// - Token is valid for this project
// - User is active and not banned
```

## Complete Example

```javascript
const { Pool } = require('pg');

// One pool per auth user — the RLS identity is fixed at connection startup
// by application_name, so a shared pool can't switch users per request.
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
  // 1. Validate authentication
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  const { user_id, role } = event.__volcano_auth;
  console.log(`Request from user ${user_id} (${role})`);

  // 2. Get a connection from this user's pool — it started up as
  //    volcano_user_access:{user_id}, so RLS is already in effect.
  const client = await poolForUser(user_id).connect();

  try {
    // 3. Process request based on action
    const { action, data } = event;

    switch (action) {
      case 'create_item':
        // Create item for this user
        const result = await client.query(
          'INSERT INTO items (user_id, name, data) VALUES ($1, $2, $3) RETURNING *',
          [user_id, data.name, data]
        );
        
        return {
          statusCode: 201,
          body: JSON.stringify(result.rows[0])
        };

      case 'list_items':
        // RLS automatically filters to user's items
        const items = await client.query('SELECT * FROM items ORDER BY created_at DESC');
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            items: items.rows,
            user_type: role
          })
        };

      case 'upgrade_prompt':
        // Show upgrade message for anonymous users
        if (role === 'anonymous') {
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Create an account to save your items permanently',
              is_guest: true
            })
          };
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'You have full access!',
            is_guest: false
          })
        };

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unknown action' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  } finally {
    client.release();
  }
};
```

## See Also

- [Invoking Functions](invoking-functions.md) - How to call your functions
- [Anonymous Users](../authentication/anonymous-users.md) - Guest user authentication
- [Row-Level Security](../databases/row-level-security.md) - Database-level permissions
- [Lambda Integration](../authentication/backend/lambda-integration.md) - Auth integration details

