---
title: "Row-Level Security"
description: "Secure your data at the database level using PostgreSQL's RLS."
---

Secure your data at the database level using PostgreSQL's RLS.

## What is RLS?

Row-Level Security (RLS) automatically filters query results based on the authenticated user.

**Without RLS:**
```sql
SELECT * FROM posts;
-- Returns ALL posts (security hole)
```

**With RLS:**
```sql
SELECT * FROM posts;
-- Returns only current user's posts (automatically filtered)
```

## Setup

### 1. Auth Helpers (Auto-Installed)

When you create a database via Volcano, auth helpers are automatically installed:

```sql
auth.uid()    -- Returns current user's ID
auth.email()  -- Returns current user's email
auth.role()   -- Returns current user's role
```

### 2. Enable RLS on Table

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
```

### 3. Create Policies

```sql
-- Users can only see their own posts
CREATE POLICY "users_view_own_posts" ON posts
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert their own posts
CREATE POLICY "users_create_own_posts" ON posts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own posts
CREATE POLICY "users_update_own_posts" ON posts
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can only delete their own posts
CREATE POLICY "users_delete_own_posts" ON posts
  FOR DELETE
  USING (user_id = auth.uid());
```

Or all operations at once:
```sql
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## Using in Functions

When you connect to your database from your functions, Volcano automatically handles user context:

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL  // Set by Volcano
});

exports.handler = async (event) => {
  // User context is automatically set by Volcano!
  // No manual SET commands needed
  
  const client = await pool.connect();
  try {
    // RLS automatically filters based on authenticated user
    const result = await client.query('SELECT * FROM posts');
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)  // Only current user's posts
    };
  } finally {
    client.release();
  }
};
```

**How it works:**
- Volcano detects the authenticated user from `event.__volcano_auth`
- User context is automatically injected into the database connection
- `auth.uid()` returns the current user's ID
- RLS policies filter automatically

## Auto-Set user_id

Create a trigger to automatically set user_id on insert:

```sql
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
```

Now you can omit user_id in inserts:

```javascript
// user_id automatically set to current user
await client.query(
  'INSERT INTO posts (title, content) VALUES ($1, $2)',
  ['My Post', 'Content']
);
```

## Public Read, Authenticated Write

```sql
-- Anyone can read
CREATE POLICY "public_read" ON posts
  FOR SELECT
  USING (true);

-- Only authenticated users can insert
CREATE POLICY "authenticated_insert" ON posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

// Users can only modify their own
CREATE POLICY "own_update" ON posts
  FOR UPDATE
  USING (user_id = auth.uid());
```

## Advanced: Public and Private Data

Combine public and private data in one table:

```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT,
  is_public BOOLEAN DEFAULT false
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can see own posts OR public posts
CREATE POLICY "posts_read" ON posts
  FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

-- Users can only modify own posts
CREATE POLICY "posts_write" ON posts
  FOR INSERT, UPDATE, DELETE
  USING (user_id = auth.uid());

GRANT ALL ON posts TO authenticated;
GRANT SELECT ON posts TO anon;  -- Anon can only read
```

## Testing RLS

Test your RLS policies using different authenticated users:

```javascript
// Test as User 1
const user1Token = await signIn('user1@example.com', 'password');
const response1 = await invokeFunction(functionId, {}, user1Token);
// Should see only User 1's data

// Test as User 2
const user2Token = await signIn('user2@example.com', 'password');
const response2 = await invokeFunction(functionId, {}, user2Token);
// Should see only User 2's data
```

## Common Patterns

**User-owned resources:**
```sql
USING (user_id = auth.uid())
```

**Role-based:**
```sql
USING (
  auth.role() = 'admin' OR
  user_id = auth.uid()
)
```

**Public + owned:**
```sql
USING (
  is_public = true OR
  user_id = auth.uid()
)
```

## See Also

- [Database Roles](database-roles.md) - Understanding anon vs authenticated roles
- [Auth Helpers](auth-helpers.md) - auth.uid(), auth.email(), auth.role()
- [Function Integration](../authentication/backend/function-integration.md) - Using RLS in functions
- Examples - Complete RLS examples




