---
title: "Lambda with Volcano SDK Example"
description: "This example shows how to use the @volcano.dev/sdk in AWS Lambda functions for clean, expressive database queries with automatic Row-Level Security."
---

# Lambda with Volcano SDK Example

This example shows how to use the **@volcano.dev/sdk** in AWS Lambda functions for clean, expressive database queries with automatic Row-Level Security.

## Features

✅ **Clean Query Builder** - Familiar `.from().select().eq()` syntax  
✅ **Automatic RLS** - User authentication enforced automatically  
✅ **No Connection Management** - SDK handles everything  
✅ **Type-Safe** - Full TypeScript support  
✅ **User Context** - Access user info from `event.__volcano_auth`

## Setup

### 1. Install Dependencies

```bash
npm install @volcano.dev/sdk
```

### 2. Set Environment Variables

Configure these in your Lambda function:

```bash
VOLCANO_API_URL=https://your-volcano-instance.com
ANON_KEY=your-anon-key
DATABASE_NAME=your_database_name
```

**Note:** The project ID is embedded in the anon key - no need to specify it separately.

### 3. Deploy to Volcano

```bash
# Using Volcano CLI
volcano deploy --function lambda-sdk-example
```

## Usage

### From Frontend (Browser)

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://your-volcano-instance.com',
  anonKey: 'your-anon-key'
});

// Sign in user
await volcano.auth.signIn({ email, password });

// Call Lambda function
const response = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'get_posts',
    filter: 'published',
    limit: 20
  })
});

const { posts } = await response.json();
console.log('User posts:', posts);
```

## Example Queries

### Get Posts

```javascript
// Event from frontend
{
  action: 'get_posts',
  filter: 'published',  // or 'recent' or 'all'
  limit: 50
}

// Response (only user's posts - RLS enforced)
{
  posts: [
    {
      id: 'uuid',
      title: 'My Post',
      content: 'Post content...',
      status: 'published',
      created_at: '2026-01-14T...'
    }
  ],
  count: 1,
  user_id: 'user-uuid'
}
```

### Create Post

```javascript
// Event
{
  action: 'create_post',
  title: 'New Post',
  content: 'Post content...',
  status: 'draft'
}

// Response
{
  post: {
    id: 'new-uuid',
    title: 'New Post',
    content: 'Post content...',
    status: 'draft'
  },
  message: 'Post created successfully'
}
```

### Update Post

```javascript
// Event
{
  action: 'update_post',
  id: 'post-uuid',
  status: 'published'
}

// Response (only if user owns this post - RLS enforced)
{
  post: {
    id: 'post-uuid',
    status: 'published'
  },
  message: 'Post updated successfully'
}
```

### Delete Post

```javascript
// Event
{
  action: 'delete_post',
  id: 'post-uuid'
}

// Response (only if user owns this post - RLS enforced)
{
  message: 'Post deleted successfully',
  deleted_id: 'post-uuid'
}
```

## How It Works

### 1. User Authentication

When a frontend user signs in with Volcano, they receive a JWT access token:

```javascript
const { session } = await volcano.auth.signIn({ email, password });
// session.access_token is the JWT
```

### 2. Lambda Receives Auth Context

Volcano automatically injects `event.__volcano_auth` into your Lambda:

```javascript
{
  user_id: 'uuid',
  email: 'user@example.com',
  role: 'authenticated',
  project_id: 'project-uuid',
  access_token: 'jwt-token'
}
```

### 3. SDK Enforces RLS

The SDK uses the access token to enforce Row-Level Security:

```javascript
// Initialize with user's token
const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: auth.access_token  // ← User's token!
});

// All queries are scoped to this user
const { data } = await volcano
  .from('posts')
  .select('*');
// Only returns posts where user_id = auth.user_id
```

## Database Schema Example

```sql
-- Create posts table with RLS
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own posts
CREATE POLICY "Users can view own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own posts
CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own posts
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can only delete their own posts
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);
```

## Comparison: SDK vs Direct PostgreSQL

### Using SDK (This Example) ✅ RECOMMENDED

```javascript
const { data } = await volcano
  .from('posts')
  .select('id, title, content')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10);
```

**Pros:**
- ✅ Clean, expressive syntax
- ✅ No connection management
- ✅ Automatic RLS enforcement
- ✅ Type-safe with TypeScript
- ✅ Error handling built-in

### Using Direct PostgreSQL

```javascript
const { Client } = require('pg');
const { databaseConnectionString } = require('@volcano.dev/sdk');

// Access mode + RLS identity are fixed at connection startup, so open a client
// with the user-access connection string. databaseConnectionString keeps the
// unique routing username in DATABASE_URL and only sets application_name.
const client = new Client({
  connectionString: databaseConnectionString(process.env.DATABASE_URL, { userId: auth.user_id }),
});
await client.connect();

const { rows } = await client.query(
  'SELECT id, title, content FROM posts WHERE status = $1 ORDER BY created_at DESC LIMIT 10',
  ['published']
);
await client.end();
```

**Use when:**
- ⚠️ Need advanced SQL features
- ⚠️ Complex joins or transactions
- ⚠️ Performance-critical bulk operations

## Best Practices

### ✅ DO

- Use SDK for standard CRUD operations
- Initialize SDK with user's `access_token`
- Check `event.__volcano_auth` for authentication
- Use RLS policies to secure data
- Return proper HTTP status codes

### ❌ DON'T

- Don't hardcode credentials
- Don't skip authentication checks
- Don't use service keys in user-facing functions
- Don't bypass RLS for user operations
- Don't expose internal error details

## Security

### RLS Enforcement

The SDK automatically enforces RLS using the user's JWT token:

```javascript
// User A queries (user_id: 'aaa')
const { data } = await volcano.from('posts').select('*');
// Returns: posts where user_id = 'aaa'

// User B queries (user_id: 'bbb')
const { data } = await volcano.from('posts').select('*');
// Returns: posts where user_id = 'bbb'
```

### Auth Context Validation

Always validate `event.__volcano_auth`:

```javascript
if (!auth || !auth.user_id) {
  return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
}
```

## Testing Locally

```javascript
// Test event
const testEvent = {
  __volcano_auth: {
    user_id: 'test-user-id',
    email: 'test@example.com',
    role: 'authenticated',
    project_id: 'test-project',
    access_token: 'test-jwt-token'
  },
  action: 'get_posts',
  filter: 'all'
};

// Run handler
const result = await exports.handler(testEvent);
console.log(JSON.parse(result.body));
```

## Learn More

- [Volcano SDK Documentation](https://github.com/Kong/volcano-sdk-js)
- [Database Pool Example](../database-pool-example/README.md) - Direct PostgreSQL approach
- [Authentication Guide](../../authentication/overview.md)
- [Row-Level Security](../../databases/row-level-security.md)
