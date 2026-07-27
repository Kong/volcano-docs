---
title: "Database Authentication Flow - Complete Guide"
description: "How authentication works in client-side (browser) vs server-side (Lambda) scenarios."
---

How authentication works in client-side (browser) vs server-side (Lambda) scenarios.

---

## Client-Side (Browser) - Automatic Session Persistence

### How It Works

When users sign in, their session is **automatically persisted** across page reloads using localStorage!

### The Flow

```javascript
// ═══════════════════════════════════════
// PAGE 1: Login page
// ═══════════════════════════════════════

import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// User signs in
await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});

// SDK automatically saves to localStorage:
// - volcano_access_token
// - volcano_refresh_token

// Navigate to another page
window.location.href = '/dashboard';
```

```javascript
// ═══════════════════════════════════════
// PAGE 2: Dashboard (different page/reload)
// ═══════════════════════════════════════

import { VolcanoAuth } from '@volcano.dev/sdk';

// Initialize SDK again (new page)
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Restore session from localStorage
await volcano.initialize();

// Check if user is logged in
const { user } = await volcano.auth.getUser();

if (user) {
  console.log('Still logged in as:', user.email);
  
  // Query database - works immediately!
  volcano.database('notes_db');
  const { data } = await volcano.from('posts').select('*');
  console.log('Your posts:', data);
} else {
  console.log('Not logged in - redirect to login');
  window.location.href = '/login';
}
```

### Session Lifecycle

```text
Page 1 (Login)          localStorage              Page 2 (Dashboard)
──────────────          ────────────              ──────────────────

signIn()          →     Save tokens         →     initialize()
                        - access_token             Restore tokens
                        - refresh_token            from localStorage
                                                        ↓
                                                   Query database
                                                   (tokens loaded!)
```

### Automatic Token Management

```javascript
// Initial page load
const volcano = new VolcanoAuth({ ... });

// SDK automatically:
// 1. Checks localStorage for saved tokens
// 2. Loads access_token and refresh_token
// 3. Ready to query!

// You can query immediately if session exists
await volcano.initialize();  // Restores session

volcano.database('notes_db');
const { data } = await volcano.from('posts').select('*');
// Works! Tokens loaded from localStorage
```

### Session Expiration & Refresh

```javascript
// When access token expires, SDK auto-refreshes
const { data, error } = await volcano.from('posts').select('*');

// If error is "expired token":
// 1. SDK automatically calls refreshSession()
// 2. Gets new access_token using refresh_token
// 3. Saves new token to localStorage
// 4. Retries the query
// 5. Returns data

// You don't need to handle this - it's automatic!
```

---

## Server-Side (Lambda) - Event Context

### How It Works

In Lambda functions, the auth context comes in `event.__volcano_auth` and you pass it to the database!

### Using Standard pg Library (Recommended)

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  console.log('Querying as user:', auth.user_id);
  
  // Replace application_name in the connection string. DATABASE_URL already
  // carries application_name=volcano_full_access, so set (don't append) it to
  // reliably switch this connection to user access.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  // Query - auth.uid() = auth.user_id from event
  const { rows } = await client.query('SELECT * FROM posts');
  
  await client.end();
  
  return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
};
```

**How it works:**
```javascript
// 1. User calls function with their access token
fetch('/functions/func-id/invoke', {
  headers: { 'Authorization': 'Bearer {user_access_token}' }
});

// 2. Volcano validates token and injects into event
event.__volcano_auth = {
  user_id: 'abc-123...',      // ← From user's JWT!
  email: 'user@example.com',  // ← From user's JWT!
  role: 'authenticated',      // ← From user's JWT!
  project_id: 'project-uuid'
};

// 3. Build application_name with auth from event (simplified format)
const appName = `volcano_user_access:${auth.user_id}`;

// 4. pgproxy receives connection and sets:
// SET LOCAL request.jwt_sub = 'user_id'
// SET LOCAL request.jwt_email = 'email'
// SET LOCAL request.jwt_role = 'role'

// 5. Query executes
// auth.uid() = user_id from event.__volcano_auth
```

### With Connection Pooling (Production)

---

## Complete Examples

### Client-Side App (React)

```javascript
import { useEffect, useState } from 'react';
import { VolcanoAuth } from '@volcano.dev/sdk';

// Initialize SDK once
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

volcano.database('your_notes_db');

function App() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // On app load, restore session from localStorage
    async function initAuth() {
      const { user } = await volcano.initialize();
      setUser(user);
      
      if (user) {
        console.log('Session restored for:', user.email);
        // Load user's data
        loadPosts();
      }
    }
    
    initAuth();
    
    // Listen for auth changes
    volcano.auth.onAuthStateChange((user) => {
      setUser(user);
      if (user) {
        loadPosts();
      } else {
        setPosts([]);
      }
    });
  }, []);

  async function handleLogin(email, password) {
    await volcano.auth.signIn({ email, password });
    // Tokens automatically saved to localStorage
    // onAuthStateChange callback fires
    // Posts automatically loaded
  }

  async function loadPosts() {
    // Query database - tokens automatically used
    const { data } = await volcano
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
      
    setPosts(data);
  }

  async function createPost(title, content) {
    // Insert - access token automatically sent
    const { data, error } = await volcano
      .insert('posts', { title, content });
      
    if (!error) {
      // Reload posts
      loadPosts();
    }
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div>
      <h1>Welcome {user.email}</h1>
      <button onClick={() => volcano.auth.signOut()}>Sign Out</button>
      {/* Tokens automatically cleared from localStorage on signOut */}
      
      <PostsList posts={posts} />
      <CreatePostForm onSubmit={createPost} />
    </div>
  );
}
```

**Key Points:**
- Tokens saved to localStorage on sign in
- Tokens restored from localStorage on page reload
- `volcano.initialize()` restores session automatically
- All queries use restored tokens
- Works across page navigations

---

### Server-Side Lambda Function

```javascript
const { VolcanoAuth } = require('@volcano.dev/sdk');

const volcano = new VolcanoAuth({
  projectId: process.env.VOLCANO_PROJECT_ID,
  anonKey: process.env.VOLCANO_ANON_KEY,
  apiUrl: process.env.VOLCANO_API_URL
});

// Connection pool outside handler (reused)
const pool = volcano.database.createPool({ max: 20 });

exports.handler = async (event) => {
  console.log('Event auth context:', event.__volcano_auth);
  
  // Auth context comes from the user's access token
  // When user invokes function:
  //   fetch('/invoke', { headers: { 'Authorization': 'Bearer {user_token}' } })
  // Volcano validates token and injects:
  //   event.__volcano_auth = { user_id, email, role, project_id }
  
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ error: 'Unauthorized - no auth context' })
    };
  }
  
  console.log('Querying as user:', auth.user_id, '(' + auth.email + ')');
  
  const client = await pool.connect();
  
  try {
    // Pass event.__volcano_auth to database
    await volcano.database.setAuthContext(client, auth);
    
    // Now query - auth.uid() = auth.user_id
    const { rows } = await client.query(`
      SELECT id, title, content, created_at 
      FROM posts 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        posts: rows,
        count: rows.length,
        queried_as: {
          user_id: auth.user_id,
          email: auth.email,
          role: auth.role
        }
      })
    };
  } finally {
    client.release();
  }
};
```

**How user identity flows to database:**

```text
Browser                    Volcano                    Lambda
────────                   ───────                    ──────

User signs in         →    Validates credentials →    N/A
Gets access token          Creates JWT with user_id
                          
User calls function   →    Validates token        →   event.__volcano_auth = {
with token                 Extracts user_id              user_id, email, role
                                                      }

                                                   →   Build application_name with
                                                       event.__volcano_auth
                                                       
                                                   →   application_name=
                                                       volcano_user_access:user_id
                                                       
                                                   →   pgproxy parses auth context
                                                       
                                                   →   SET LOCAL request.jwt_sub
                                                       = user_id
                                                       
                                                   →   auth.uid() returns user_id
```

---

## Comparison: Client vs Server

### Client-Side (Browser)

**Session Storage:** localStorage (automatic)

**Code:**
```javascript
// Page 1: Sign in
await volcano.auth.signIn({ email, password });
// Tokens saved to localStorage automatically

// Page 2: Query (after reload/navigation)
await volcano.initialize();  // Restores from localStorage
const { data } = await volcano.from('posts').select('*');
// Tokens automatically used
```

**How auth is passed:**
```http
POST /databases/DB_ID/query/select
Authorization: Bearer {access_token_from_localStorage}
                      ↑ Automatically added by SDK
```

### Server-Side (Lambda)

**Session Storage:** event.__volcano_auth (per-request)

**Code:**
```javascript
// Lambda receives auth in event
const { Client } = require('pg');

const auth = event.__volcano_auth;

// Replace application_name (DATABASE_URL already has volcano_full_access)
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);

const client = new Client({ connectionString: url.toString() });
await client.connect();
const { rows } = await client.query('SELECT * FROM posts');
await client.end();
```

**How auth is passed:**
```text
event.__volcano_auth { user_id, project_id }
         ↓
Build: application_name=volcano_user_access:user_id
         ↓
pgproxy looks up user and sets: request.jwt_sub = user_id
         ↓
auth.uid() returns user_id
```

---

## Common Patterns

### Client-Side: Protect Routes

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({ ... });

// On app initialization
async function initApp() {
  // Try to restore session
  const { user, error } = await volcano.initialize();
  
  if (user) {
    // User is logged in
    console.log('Logged in as:', user.email);
    showDashboard();
  } else {
    // Not logged in
    showLoginPage();
  }
}

// Call on every page load
initApp();
```

### Client-Side: Auto-Refresh Tokens

```javascript
// SDK handles this automatically!
const { data, error } = await volcano.from('posts').select('*');

// If access_token expired:
// 1. SDK detects 401 error
// 2. Calls refreshSession() automatically
// 3. Uses refresh_token to get new access_token
// 4. Saves new token to localStorage
// 5. Retries the query
// 6. Returns data

// You just see the result - no error handling needed!
```

### Server-Side: Simple Pattern

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  // auth contains the user's identity (from their JWT):
  console.log('User ID:', auth.user_id);
  console.log('Email:', auth.email);
  console.log('Role:', auth.role);
  
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  const { rows } = await client.query('SELECT * FROM posts WHERE user_id = auth.uid()');
  
  await client.end();
  
  return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
};
```

### Server-Side: Production Pattern (Connection Pool)

pgproxy fixes the auth identity from `application_name` at connection **startup**, so a pool serves exactly one user. Keep one pool per auth user:

```javascript
const { Pool } = require('pg');

// One pool per auth user, reused across invocations while the container is
// warm. In production, bound this cache (e.g. LRU with idle eviction).
const poolsByUser = new Map();

function poolForUser(userId) {
  let pool = poolsByUser.get(userId);
  if (!pool) {
    // Replace application_name (DATABASE_URL already has volcano_full_access)
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('application_name', `volcano_user_access:${userId}`);
    pool = new Pool({ connectionString: url.toString(), max: 5 });
    poolsByUser.set(userId, pool);
  }
  return pool;
}

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  // Every connection in this pool started as volcano_user_access:{userId}
  const client = await poolForUser(auth.user_id).connect();
  
  try {
    // Query - auth.uid() = auth.user_id from event
    const { rows } = await client.query('SELECT * FROM posts');
    
    return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
  } finally {
    client.release();
  }
};
```

---

## How event.__volcano_auth is Created

### User Invokes Function

```javascript
// Browser code
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({ ... });

// User signs in
await volcano.auth.signIn({ email: 'user@example.com', password: 'pass' });

// Invoke function with user's access token
const result = await volcano.functions.invoke('get-posts', {
  action: 'get_posts'
});

// Behind the scenes:
// fetch('/functions/FUNC_ID/invoke', {
//   headers: { 'Authorization': 'Bearer {user_access_token}' },
//   body: JSON.stringify({ action: 'get_posts' })
// });
```

### Volcano Creates event.__volcano_auth

```go
// Volcano backend (internal/handlers/functions.go)

// 1. Validate token
claims := validateAccessToken(token)

// 2. Inject into event payload
if claims.Type == "auth_user" {
    payload["__volcano_auth"] = map[string]interface{}{
        "user_id":    claims.UserID,    // ← From JWT!
        "email":      claims.Email,      // ← From JWT!
        "role":       claims.Role,       // ← From JWT!
        "project_id": projectID,
    }
}

// 3. Invoke Lambda with augmented payload
lambda.Invoke(functionName, payload)
```

### Lambda Receives It

```javascript
exports.handler = async (event) => {
  console.log('Received event:', event);
  
  // Event contains:
  // {
  //   action: 'get_posts',
  //   __volcano_auth: {
  //     user_id: 'abc-123...',
  //     email: 'user@example.com',
  //     role: 'authenticated',
  //     project_id: 'project-uuid'
  //   }
  // }
  
  const auth = event.__volcano_auth;
  // This is the user's identity from their JWT token
};
```

---

## Summary

### Client-Side (Browser)

**Q:** How is auth persisted across pages?  
**A:** localStorage (automatic)

**Q:** How do I use it?  
**A:** Just call `volcano.initialize()` on page load

```javascript
// Tokens automatically saved on sign in
await volcano.auth.signIn({ email, password });

// Tokens automatically restored on page load
await volcano.initialize();

// Queries automatically use restored tokens
const { data } = await volcano.from('posts').select('*');
```

### Server-Side (Lambda)

**Q:** How do I get user's identity?  
**A:** From `event.__volcano_auth`

**Q:** How do I pass it to database?  
**A:** Build `application_name` parameter with auth context

```javascript
// Extract auth from event
const auth = event.__volcano_auth;

// Replace application_name in the connection string (DATABASE_URL already
// carries volcano_full_access — set, don't append)
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);

// Connect
const client = new Client({ connectionString: url.toString() });
```

### Where event.__volcano_auth Comes From

**A:** Volcano creates it from the user's access token!

```text
User calls function with their token
  ↓
Volcano validates token
  ↓
Volcano extracts user_id, email, role from token
  ↓
Volcano creates event.__volcano_auth
  ↓
Lambda receives it
  ↓
SDK passes to database
```

---

## Connection Format Reference

Volcano uses the `application_name` parameter to control access levels:

### Full Admin Access
```text
volcano_full_access
```
- For DDL operations: CREATE TABLE, ALTER TABLE, migrations
- Bypasses Row Level Security
- Use for admin/maintenance scripts only

### User Impersonation (RLS Enforced)
```text
volcano_user_access:{user_id}
```
- Queries run as the specified user
- Row Level Security is enforced
- `auth.uid()` returns the user_id
- Use for authenticated user operations

### Anonymous Access (RLS Enforced)
```text
volcano_user_access
```
- Queries run with `anon` role
- Row Level Security is enforced
- `auth.uid()` returns NULL
- Use for public, unauthenticated queries

---

## See Also

- **[Direct Connection](direct-connection.md)** - PostgreSQL connection with auth impersonation
- [Authentication & Impersonation](authentication-and-impersonation.md) - Complete auth guide
- [Query Builder API](query-builder-api.md) - Query builder reference
- [SDK Documentation](https://github.com/Kong/volcano-sdk-js) - Complete SDK guide
- [Row-Level Security](row-level-security.md) - Using auth.uid() in policies
