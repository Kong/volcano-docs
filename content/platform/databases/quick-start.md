---
title: "Database quick start"
description: "Get started with Volcano databases."
---

Get started with Volcano databases.

## Choose your path

| Path | Best for | Features |
|------|----------|----------|
| [Query Builder API](#query-builder-quick-start) | Frontend apps, mobile apps, quick prototyping | Chainable query methods, no SQL required |
| [Direct SQL](#direct-sql-quick-start) | Complex queries, backend services | JOINs, CTEs, transactions, ORMs |

---

## Query Builder quick start

### Step 1: Install SDK

```bash
npm install @volcano.dev/sdk
```

Or via CDN:
```html
<script src="https://unpkg.com/@volcano.dev/sdk@latest/dist/index.js"></script>
```

### Step 2: Initialize SDK

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Set your database name (get from Volcano dashboard)
volcano.database('notes_db');
```

### Step 3: Sign in user

> **Important:** You must sign in before querying. The access token proves who you are.

```javascript
// Sign up new user
const { user, session } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123'
});

console.log('User ID:', user.id);  // This is what auth.uid() returns in database
console.log('Access token:', session.access_token);  // Automatically used for queries

// Or sign in existing user
await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'securePassword123'
});
```

### Step 4: Query Your Database

```javascript
// Get all data - RLS automatically filters to YOUR data!
const { data, error } = await volcano
  .from('posts')
  .select('*');

console.log('Your posts:', data);

// What happened:
// 1. SDK sent your access token
// 2. Volcano extracted your user_id from the JWT
// 3. auth.uid() returns your user_id in the database
// 4. RLS filtered results to your posts only
```

### Step 5: Filter and Sort

```javascript
// Get published posts, sorted by most recent
const { data } = await volcano
  .from('posts')
  .select('id, title, content, created_at')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Recent posts:', data);
```

### Step 6: Insert Data

```javascript
// Create a new post
const { data, error } = await volcano
  .insert('posts', {
    title: 'My First Post',
    content: 'Hello Volcano!',
    status: 'published'
  });

const newPost = data[0];
console.log('Created post:', newPost.id);
// user_id is automatically set to your user ID!
```

### Step 7: Update Data

```javascript
// Update a post
const { data } = await volcano
  .update('posts', {
    title: 'Updated Title',
    status: 'published'
  })
  .eq('id', postId);

console.log('Updated post:', data[0]);
// RLS ensures you can only update YOUR posts
```

### Step 8: Delete Data

```javascript
// Delete a post
const { data } = await volcano
  .delete('posts')
  .eq('id', postId);

console.log('Deleted post:', data[0]);
// RLS ensures you can only delete YOUR posts
```

You're now querying PostgreSQL from the browser with Query Builder syntax.

| Feature | Description |
|---------|-------------|
| Automatic RLS | Row-level security enforced on all queries |
| No SQL required | Chainable query methods |
| Direct access | Query databases directly from browser |
| Built-in security | Input validation and parameterized queries |

---

## REST API quick start

### Step 1: Create a Database

```bash
curl -X POST https://api.yourapp.com/projects/PROJECT_ID/databases \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_app_db",
    "region": "aws-us-east-1",
    "pg_version": "16"
  }'
```

Use the `connection_string` from the response as-is: it already contains the
unique username (`volcano_client_{id}`) the proxy routes by. You only change
`application_name` to pick the access mode.

### Step 2: Create a Table with RLS

Connect to your database and run:

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own posts
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());

-- Auto-set user_id on insert
CREATE FUNCTION set_user_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_id_trigger
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Grant permissions
GRANT ALL ON posts TO authenticated;
```

### Step 3: Sign Up a User

```javascript
const response = await fetch('https://api.yourapp.com/auth/signup', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ANON_KEY',  // Get from project settings
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123'
  })
});

const { access_token, user } = await response.json();
console.log('User ID:', user.id);
console.log('Access Token:', access_token);
// Save access_token for database queries!
```

### Step 4: Query Your Database

```javascript
// SELECT - Get all posts
const response = await fetch('https://api.yourapp.com/databases/notes_db/query/select', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    order: [{ column: 'created_at', ascending: false }],
    limit: 10
  })
});

const { data, count } = await response.json();
console.log(`Found ${count} posts:`, data);
// Automatically filtered to current user's posts!
```

### Step 5: Insert Data

```javascript
// INSERT - Create a post
const response = await fetch('https://api.yourapp.com/databases/notes_db/query/insert', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    values: {
      title: 'My First Post',
      content: 'Hello Volcano!'
    }
  })
});

const { data } = await response.json();
const newPost = data[0];
console.log('Created post:', newPost.id);
// user_id automatically set to your user ID!
```

### Step 6: Update Data

```javascript
// UPDATE - Modify a post
const response = await fetch('https://api.yourapp.com/databases/notes_db/query/update', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    values: {
      title: 'Updated Title'
    },
    filters: [
      { column: 'id', operator: 'eq', value: postId }
    ]
  })
});

const { data } = await response.json();
// RLS ensures you can only update YOUR posts
```

### Step 7: Delete Data

```javascript
// DELETE - Remove a post
const response = await fetch('https://api.yourapp.com/databases/notes_db/query/delete', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    filters: [
      { column: 'id', operator: 'eq', value: postId }
    ]
  })
});

const { data } = await response.json();
// RLS ensures you can only delete YOUR posts
```

You now have a fully functional database with automatic security.

---

## Direct SQL quick start

### Step 1: Create a Database

Same as REST API - create via API or dashboard.

### Step 2: Create a Lambda Function

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  // Build connection string with auth context. Replace application_name
  // (DATABASE_URL already carries volcano_full_access) so the connection
  // reliably starts up under RLS.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  try {
    // Query with full SQL power!
    // auth.uid() = auth.user_id from event.__volcano_auth
    const { rows } = await client.query(`
      SELECT id, title, content, created_at 
      FROM posts 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, ['published', 10]);
    
    await client.end();
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ posts: rows }) 
    };
  } catch (error) {
    await client.end();
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
```

### Step 3: Call from Frontend

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'ANON_KEY'
});

// Sign in
await volcano.auth.signIn({ 
  email: 'user@example.com', 
  password: 'password' 
});

// Call Lambda function (auth automatically passed in event.__volcano_auth)
const result = await volcano.functions.invoke('get-posts', {});
console.log('Posts:', result.posts);
```

**How auth flows to Lambda:**
1. User's access token sent with `invoke()` call
2. Volcano validates token and creates `event.__volcano_auth`
3. Lambda uses `event.__volcano_auth` to build connection string
4. pgproxy receives auth and sets `auth.uid()`

---

## Comparison

| Feature | REST API | Direct SQL |
|---------|----------|------------|
| **Where** | Browser, Mobile | Lambda Functions |
| **Requires SQL** | No | Yes |
| **Complexity** | Simple CRUD | Any query |
| JOINs | Not supported | Full support |
| ORMs | Not supported | Full support |
| Transactions | Single query | Full support |
| RLS Enforced | Automatic | Automatic |
| **Performance** | Fast | Faster (direct) |
| **Learning Curve** | Easy | Moderate |

**Recommendation:** Start with REST API, use Direct SQL when you need more power.

---

## What's next

| Guide | Description |
|-------|-------------|
| [REST API](rest-api.md) | Complete REST API documentation |
| [Row-level security](row-level-security.md) | Secure your data |
| [Connection strings](connection-strings.md) | Using databases in Lambda functions |
| [Auth helpers](auth-helpers.md) | Database helper functions |
| [Creating databases](creating-databases.md) | Database management |
