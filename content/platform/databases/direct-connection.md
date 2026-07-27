---
title: "Direct PostgreSQL Connection"
description: "Connect directly to your Volcano PostgreSQL database from Lambda functions, Node.js servers, or any PostgreSQL client."
---

Connect directly to your Volcano PostgreSQL database from Lambda functions, Node.js servers, or any PostgreSQL client.

## Overview

**Two ways to connect:**

### 1. REST API (Browser)
Use Query Builder query builder
No PostgreSQL driver needed
Works from browser
See [Query Builder API Guide](query-builder-api.md)

### 2. Direct Connection (Lambda/Server)
Native PostgreSQL protocol
Full SQL power
Any PostgreSQL client/ORM
**This guide**

---

## Authentication & User Impersonation

### The Key: `application_name` Parameter

Volcano uses two connection modes via the `application_name` parameter:

**Full Admin Access** (for DDL, migrations):
```text
postgres://volcano_client_11111111-1111-1111-1111-111111111111:vpg_password@host:port/db?application_name=volcano_full_access
```

**User Impersonation** (RLS enforced):
```text
postgres://volcano_client_11111111-1111-1111-1111-111111111111:vpg_password@host:port/db?application_name=volcano_user_access:USER_ID
                                                              ↑
                                                  This makes auth.uid() return USER_ID
```

**Anonymous Access** (RLS enforced, no user context):
```text
postgres://volcano_client_11111111-1111-1111-1111-111111111111:vpg_password@host:port/db?application_name=volcano_user_access
```

### Format

```text
volcano_full_access              # Full admin access (DDL/migrations)
volcano_user_access:{user_id}    # User impersonation (RLS enforced)
volcano_user_access              # Anonymous access (anon role, RLS enforced)
```

The proxy identifies the database by the **username** in the connection string
(`volcano_client_{id}`), which is globally unique — database names are only
unique within a project, so the username is what reaches the exact database even
when two projects reuse a name. `application_name` carries only the access mode,
so it can be overridden by clients for their own purposes without changing which
database is reached. Use the `connection_string` Volcano returns as-is; for user
impersonation, keep its username and set `application_name` to
`volcano_user_access:{user_id}`.

**Example:**
```text
username=volcano_client_11111111-1111-1111-1111-111111111111  application_name=volcano_user_access:abc-123-uuid    # User impersonation
username=volcano_client_11111111-1111-1111-1111-111111111111  application_name=volcano_full_access                 # Admin access
```

The proxy looks up the user's email and role from the database automatically. This is more secure because:
- **No spoofing**: Email and role cannot be forged by the client
- **User validation**: The proxy verifies the user exists in the database's project
- **Override-safe**: routing lives in the username, not the client-settable `application_name`

When pgproxy receives a user impersonation request, it:
1. Validates the user exists in the database's project
2. Looks up their email and role from the database
3. Sets the auth context:

```sql
SET LOCAL request.jwt_sub = 'abc-123-uuid';
SET LOCAL request.jwt_email = 'user@example.com';  -- Looked up from DB
SET LOCAL request.jwt_role = 'authenticated';       -- Looked up from DB
```

Then:
```sql
SELECT auth.uid();    -- Returns: 'abc-123-uuid'
SELECT auth.email();  -- Returns: 'user@example.com'
SELECT auth.role();   -- Returns: 'authenticated'
```


---

## Quick Start

### Get Your Connection String

```bash
# Via API
curl https://api.volcano.dev/projects/PROJECT_ID/databases/DATABASE_NAME \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

**Response includes:**
```json
{
  "connection_string": "postgres://volcano_client_11111111-1111-1111-1111-111111111111:vpg_abc123@database.volcano.dev:5432/my_app?sslmode=require&application_name=volcano_full_access"
}
```

This is your **base connection string** with full admin access (for DDL/migrations). To impersonate a user, change the `application_name` from `volcano_full_access` to `volcano_user_access` and add the user ID.
The password is Volcano-managed and starts with `vpg_`. Neon owner credentials are internal and will not authenticate through pgproxy.

---

## Lambda Functions (Recommended)

### From event.__volcano_auth

**When users invoke your Lambda with their access token**, Volcano automatically creates `event.__volcano_auth`:

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  // 1. Get auth context (created by Volcano from user's JWT)
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  console.log('User invoking function:', auth.user_id, auth.email);
  
  // 2. Select the access mode by REPLACING application_name. DATABASE_URL already
  //    has application_name=volcano_full_access, so set (don't append) it —
  //    a duplicate param would leave the startup mode up to the driver.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  const connStr = url.toString();
  
  // 3. Connect to database
  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  try {
    // 5. Query - auth.uid() returns auth.user_id
    const { rows } = await client.query('SELECT * FROM posts');
    // RLS automatically filters to this user's posts!
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        posts: rows,
        queried_as: auth.user_id
      })
    };
  } finally {
    await client.end();
  }
};
```

**How it works:**
1. User calls function with their access token
2. Volcano validates JWT and creates `event.__volcano_auth`
3. Lambda builds connection string with user's identity
4. pgproxy receives and sets session variables
5. `auth.uid()` returns the user's ID
6. RLS filters data to that user

### With Connection Pooling (Production)

pgproxy fixes the access mode and RLS identity from `application_name` at connection **startup** — `SET application_name` after connect has no effect. So a pool can only ever serve one identity: key pools by user.

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
  
  // Get a connection from THIS user's pool — every connection in it started
  // up as volcano_user_access:{userId}, so RLS is already in effect.
  const client = await poolForUser(auth.user_id).connect();
  
  try {
    const { rows } = await client.query('SELECT * FROM posts');
    
    return {
      statusCode: 200,
      body: JSON.stringify({ posts: rows })
    };
  } finally {
    client.release();  // Return to pool
  }
};
```

**Why pooling?**
- New connection: 50-100ms overhead
- Pooled connection: 1-5ms overhead
- **10-50x faster!**

---

## Node.js Server (Custom Backend)

If you have your own Node.js server and want to impersonate Volcano auth users:

### Option 1: Validate User's Access Token

```javascript
const { Pool } = require('pg');
const express = require('express');
const jwt = require('jsonwebtoken');

// One pool per auth user: the RLS identity is fixed at connection startup by
// application_name, so a shared pool cannot switch users per request.
// In production, bound this cache (e.g. LRU with idle eviction).
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

const app = express();

app.get('/api/posts', async (req, res) => {
  // 1. Get access token from header
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // 2. Validate token (call Volcano API or decode JWT)
  // For production, validate with Volcano API
  // For this example, we decode (you have the JWT secret)
  const claims = jwt.verify(token, process.env.JWT_SECRET);
  
  // 3. Get a connection from this user's pool (started under RLS)
  const client = await poolForUser(claims.user_id).connect();
  
  try {
    // 4. Query - auth.uid() = claims.user_id
    const { rows } = await client.query('SELECT * FROM posts');
    
    res.json({ posts: rows });
  } finally {
    client.release();
  }
});

app.listen(3000);
```

### Option 2: Build Connection String Per Request

```javascript
const { Client } = require('pg');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();

app.get('/api/posts', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const claims = jwt.verify(token, process.env.JWT_SECRET);
  
  // Build connection string with user's auth context. Replace application_name
  // (DATABASE_URL already carries volcano_full_access) so the connection starts
  // up under RLS instead of leaving duplicate params to the driver.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${claims.user_id}`);
  const connStr = url.toString();
  
  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  try {
    const { rows } = await client.query('SELECT * FROM posts');
    res.json({ posts: rows });
  } finally {
    await client.end();
  }
});
```

---

## Any PostgreSQL Client

The `application_name` parameter works with **any** PostgreSQL client!

### Node.js (pg)

```javascript
const { Client } = require('pg');

const client = new Client({
  host: 'database.volcano.dev',
  port: 5432,
  database: 'mydb',
  user: 'volcano_client_11111111-1111-1111-1111-111111111111',
  password: 'password',
  ssl: { rejectUnauthorized: false },
  application_name: 'volcano_user_access:user-id'
});

await client.connect();
const { rows } = await client.query('SELECT auth.uid()');
console.log('Auth UID:', rows[0].auth_uid);  // Returns: user-id
```

### Python (psycopg2)

```python
import psycopg2
from urllib.parse import quote

auth_context = f"volcano_user_access:{user_id}"

conn = psycopg2.connect(
    host="database.volcano.dev",
    port=5432,
    database="mydb",
    user="volcano_client_11111111-1111-1111-1111-111111111111",
    password="password",
    application_name=auth_context,
    sslmode="require"
)

cursor = conn.cursor()
cursor.execute("SELECT auth.uid()")
print(cursor.fetchone()[0])  # Returns: user_id
```

### Go (pgx)

```go
import (
    "context"
    "fmt"
    "net/url"
    "os"

    "github.com/jackc/pgx/v5"
)

func main() {
    // DATABASE_URL already carries application_name=volcano_full_access, so parse
    // it and REPLACE application_name (Set) — appending a second one would leave
    // the startup mode up to the driver's duplicate-param handling.
    u, _ := url.Parse(os.Getenv("DATABASE_URL"))
    q := u.Query()
    q.Set("application_name", fmt.Sprintf("volcano_user_access:%s", userID))
    u.RawQuery = q.Encode()

    conn, _ := pgx.Connect(context.Background(), u.String())
    defer conn.Close(context.Background())
    
    var authUID string
    conn.QueryRow(context.Background(), "SELECT auth.uid()::TEXT").Scan(&authUID)
    fmt.Println("Auth UID:", authUID)  // Returns: userID
}
```

### psql (Command Line)

```bash
psql "postgres://volcano_client_11111111-1111-1111-1111-111111111111:pass@database.volcano.dev:5432/mydb?sslmode=require&application_name=volcano_user_access:USER_ID"

# Then query:
SELECT auth.uid();
-- Returns: USER_ID
```

---

## Without User Impersonation (Service Role)

### For Admin Operations

If you need to access ALL data (bypassing RLS), use the **service role connection string**:

```javascript
const { Client } = require('pg');

// Use service_role connection string (has BYPASSRLS)
const client = new Client({
  connectionString: process.env.SERVICE_ROLE_CONNECTION_STRING
});

await client.connect();

// See ALL data (no RLS filtering)
const { rows } = await client.query('SELECT * FROM posts');
// Returns: All users' posts (not filtered)

await client.end();
```

**When to use:**
- Admin dashboards
- Background jobs
- Data migrations
- Analytics aggregation

> **Warning:** Service role bypasses RLS - use carefully!

---

## Using ORMs with Auth Context

### Sequelize

```javascript
const { Sequelize } = require('sequelize');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const sequelize = new Sequelize(url.toString());
  
  // Define model
  const Post = sequelize.define('Post', {
    id: { type: DataTypes.UUID, primaryKey: true },
    title: DataTypes.STRING,
    content: DataTypes.TEXT,
    user_id: DataTypes.UUID
  });
  
  // Query - RLS enforced!
  const posts = await Post.findAll();
  // Returns: Only this user's posts
  
  await sequelize.close();
};
```

### Prisma

```javascript
const { PrismaClient } = require('@prisma/client');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  const databaseUrl = url.toString();
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });
  
  // Query - RLS enforced!
  const posts = await prisma.post.findMany();
  // Returns: Only this user's posts
  
  await prisma.$disconnect();
};
```

### TypeORM

```javascript
const { DataSource } = require('typeorm');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  // Build connection with auth (simplified format)
  const appName = `volcano_user_access:${auth.user_id}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', appName);
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: url.toString(),
    entities: [Post],
    synchronize: false
  });
  
  await dataSource.initialize();
  
  const postRepo = dataSource.getRepository(Post);
  const posts = await postRepo.find();
  // Returns: Only this user's posts (RLS enforced)
  
  await dataSource.destroy();
};
```

---

## Advanced: Multiple Users in One Connection

You **can't** impersonate multiple users with one connection. Each connection impersonates ONE user.

### This Won't Work

```javascript
// BAD - application_name is set at connection time!
const client = new Client({ connectionString: baseConnStr });
await client.connect();

// Try to change user (won't work!)
await client.query("SET application_name = 'volcano_user_access:user1'");
await client.query('SELECT * FROM posts');  // Still uses original app_name

// Try to change again (won't work!)
await client.query("SET application_name = 'volcano_user_access:user2'");
await client.query('SELECT * FROM posts');  // Still uses original app_name
```

**Why:** pgproxy reads `application_name` during connection **startup**, not from SET commands.

### Correct Approach

**Create a new connection per user:**

```javascript
async function queryAsUser(userId) {
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${userId}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  try {
    const { rows } = await client.query('SELECT * FROM posts');
    return rows;  // Filtered to userId's posts
  } finally {
    await client.end();
  }
}

// Query as different users
const user1Posts = await queryAsUser('user1-id');
const user2Posts = await queryAsUser('user2-id');

// Different results!
```

**Or pool connections per user.** Since the auth identity is fixed at connection startup, a pool can only ever serve one user — so key pools by user:

```javascript
const { Pool } = require('pg');

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

async function queryAsUser(userId) {
  const client = await poolForUser(userId).connect();
  
  try {
    const { rows } = await client.query('SELECT * FROM posts');
    return rows;  // Every connection in this pool started as userId
  } finally {
    client.release();
  }
}
```

---

## Connection String Formats

### Via pgproxy (Recommended)

```text
postgres://volcano_client_11111111-1111-1111-1111-111111111111:vpg_password@database.volcano.dev:5432/dbname?sslmode=require&application_name=volcano_user_access:USER_ID
```

**Advantages:**
- Automatic auth context injection
- Connection pooling
- Works with any client

### Direct to Neon

Direct Neon credentials are internal to Volcano and are not returned by the API. Use the pgproxy connection string returned by Volcano instead.

---

## Impersonating Different User Types

### Authenticated User (Email/Password)

With the simplified format, email and role are looked up from the database:

```javascript
const appName = `volcano_user_access:${userId}`;
```

**Database sees:**
- `auth.uid()` = userId
- `auth.email()` = looked up from auth_users table
- `auth.role()` = "authenticated"

### Anonymous Access (No Auth Context)

For anonymous access, use the `volcano_user_access` format without a user ID:

```javascript
const appName = `volcano_user_access`;
```

**Database sees:**
- `auth.uid()` = NULL
- `auth.email()` = NULL
- `auth.role()` = "anon" (uses anon PostgreSQL role)

### Service Role (No RLS)

```javascript
// Use service_role connection string
// Don't set application_name
const client = new Client({
  connectionString: process.env.SERVICE_ROLE_CONNECTION_STRING
});
```

**Database sees:**
- `auth.uid()` = NULL
- `auth.role()` = "service_role"
- **RLS bypassed** (BYPASSRLS privilege)

---

## Security Considerations

### Safe Patterns

**Using event.__volcano_auth (Lambda):**
```javascript
const auth = event.__volcano_auth;  // ← Created by Volcano, trusted
const appName = `volcano_user_access:${auth.user_id}`;
```

**Validating JWT tokens (Node.js):**
```javascript
const claims = jwt.verify(token, process.env.JWT_SECRET);
const appName = `volcano_user_access:${claims.user_id}`;
```

### Unsafe Patterns

**Never trust user input directly:**
```javascript
// DANGEROUS - user can set any user_id!
const userId = req.body.user_id;  // From user input
const appName = `volcano_user_access:${userId}`;  // Don't do this!
```

**Always validate:**
```javascript
// SAFE - user_id comes from validated JWT
const claims = jwt.verify(token, JWT_SECRET);
const appName = `volcano_user_access:${claims.user_id}`;
```

---

## Troubleshooting

### Problem: auth.uid() returns NULL

**Cause:** application_name not set or wrong format

**Solution:**
```javascript
// Verify format (simplified - 3 parts)
const appName = `volcano_user_access:${userId}`;
console.log('Application name:', appName);

// Must be: volcano_user_access:user_id
```

### Problem: Can't access another user's data

**Cause:** RLS is working! (This is correct)

**Solution:** This is intentional. Each connection can only access one user's data. To query as a different user, create a new connection with their auth context.

### Problem: Connection pool shows wrong user_id

**Cause:** The pool was created from a connection string with a different (or full-access) `application_name`. The identity is fixed at connection **startup** — `SET application_name` after connect has no effect on pgproxy.

**Solution:** Create the pool from a connection string whose `application_name` is already `volcano_user_access:{userId}`, and keep one pool per user:

```javascript
// Wrong - SET after connect does nothing for pgproxy
const client = await pool.connect();
await client.query('SET application_name = $1', [appName]);

// Correct - bake the identity into the pool's connection string
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('application_name', `volcano_user_access:${userId}`);
const userPool = new Pool({ connectionString: url.toString() });
```

---

## Examples

### Query as Specific User

```javascript
const { Client } = require('pg');

async function getPostsAsUser(userId, projectId) {
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${userId}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  try {
    const { rows } = await client.query('SELECT * FROM posts');
    return rows;  // Filtered to this user's posts
  } finally {
    await client.end();
  }
}

const projectId = 'project-uuid';

// Query as User A
const user1Posts = await getPostsAsUser('abc-123-uuid', projectId);

// Query as User B
const user2Posts = await getPostsAsUser('def-456-uuid', projectId);

// Different results!
console.log('User 1 has', user1Posts.length, 'posts');
console.log('User 2 has', user2Posts.length, 'posts');
```

### Verify Identity

```javascript
const { Client } = require('pg');

async function verifyAuthContext(userId, projectId) {
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${userId}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  try {
    const { rows } = await client.query(`
      SELECT 
        auth.uid()::TEXT as user_id,
        auth.email() as email,
        auth.role() as role
    `);
    
    console.log('Database sees:');
    console.log('  auth.uid():', rows[0].user_id);
    console.log('  auth.email():', rows[0].email);  // Looked up from DB
    console.log('  auth.role():', rows[0].role);    // Always 'authenticated'
    
    // Verify they match
    console.log('Expected user_id:', userId);
    console.log('Match:', rows[0].user_id === userId);
    
    return rows[0];
  } finally {
    await client.end();
  }
}

// Verify auth context is working
await verifyAuthContext('test-user-uuid', 'project-uuid');
```

---

## Complete Lambda Example

```javascript
const { Pool } = require('pg');

// One pool per auth user (the RLS identity is fixed at connection startup).
// In production, bound this cache (e.g. LRU with idle eviction).
const poolsByUser = new Map();

function poolForUser(userId) {
  let pool = poolsByUser.get(userId);
  if (!pool) {
    // Replace application_name (DATABASE_URL already has volcano_full_access)
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('application_name', `volcano_user_access:${userId}`);
    pool = new Pool({
      connectionString: url.toString(),
      max: 5,
      idleTimeoutMillis: 30000
    });
    poolsByUser.set(userId, pool);
  }
  return pool;
}

/**
 * Lambda handler that queries as the authenticated user
 */
exports.handler = async (event) => {
  // 1. Extract auth context (from user's JWT token)
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        error: 'No authentication context - user must sign in first' 
      })
    };
  }
  
  // Log who is making the request
  console.log('Request from user:', {
    user_id: auth.user_id,
    email: auth.email,
    role: auth.role,
    project_id: auth.project_id
  });
  
  // 2. Get a connection from THIS user's pool — every connection in it
  //    started up as volcano_user_access:{userId}, so RLS is already active.
  const client = await poolForUser(auth.user_id).connect();
  
  try {
    // 3. Parse request
    const { action, ...params } = event;
    
    // 4. Execute query based on action
    switch (action) {
      case 'get_posts': {
        const { rows } = await client.query(`
          SELECT id, title, content, created_at 
          FROM posts 
          WHERE status = $1 
          ORDER BY created_at DESC 
          LIMIT 50
        `, ['published']);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            posts: rows,
            count: rows.length,
            user_id: auth.user_id
          })
        };
      }
      
      case 'create_post': {
        const { title, content } = params;
        
        const { rows } = await client.query(`
          INSERT INTO posts (title, content, status) 
          VALUES ($1, $2, 'draft') 
          RETURNING id, title, user_id, created_at
        `, [title, content]);
        
        // user_id automatically set by trigger using auth.uid()
        
        return {
          statusCode: 201,
          body: JSON.stringify({ post: rows[0] })
        };
      }
      
      case 'update_post': {
        const { id, title, status } = params;
        
        const { rows } = await client.query(`
          UPDATE posts 
          SET title = $1, status = $2 
          WHERE id = $3 
          RETURNING id, title, status
        `, [title, status, id]);
        
        // RLS ensures only this user's posts can be updated
        
        if (rows.length === 0) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Post not found or access denied' })
          };
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({ post: rows[0] })
        };
      }
      
      case 'delete_post': {
        const { id } = params;
        
        const { rows } = await client.query(`
          DELETE FROM posts 
          WHERE id = $1 
          RETURNING id, title
        `, [id]);
        
        // RLS ensures only this user's posts can be deleted
        
        if (rows.length === 0) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Post not found or access denied' })
          };
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({ deleted: rows[0] })
        };
      }
      
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unknown action' })
        };
    }
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    // 5. Return connection to pool
    client.release();
  }
};
```

---

## Summary

### How to Impersonate Auth Users

**Key:** Replace the `application_name` parameter in the connection string (it already carries `volcano_full_access`)

**Format (Simplified):**
```text
volcano_user_access:{user_id}
```

The proxy looks up email and role from the database, making this more secure.

**Methods:**

1. **Lambda (Recommended):**
   ```javascript
   const auth = event.__volcano_auth;
   const appName = `volcano_user_access:${auth.user_id}`;
   ```

2. **Node.js Server:**
   ```javascript
   const claims = jwt.verify(token, JWT_SECRET);
   const appName = `volcano_user_access:${claims.user_id}`;
   ```

3. **Any Client:**
   ```javascript
   const url = new URL(DATABASE_URL);
   url.searchParams.set('application_name', `volcano_user_access:${userId}`);
   const connStr = url.toString();
   ```

**Result:**
- `auth.uid()` returns the user_id you specified
- `auth.email()` returns the user's email (looked up from database)
- `auth.role()` returns "authenticated" (all auth users)
- RLS policies use these values for filtering


---

## See Also

- [Authentication Flow](authentication-flow.md) - Complete auth guide
- [Query Builder API](query-builder-api.md) - Browser query builder
- [Row-Level Security](row-level-security.md) - Using auth.uid() in policies
- [Auth Helpers](auth-helpers.md) - Database helper functions
- [Examples](../examples/database-pool-example/README.md) - Production patterns
