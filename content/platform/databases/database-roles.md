---
title: "Database Roles and Security"
description: "When you create a database in Volcano, it comes with built-in roles for secure multi-tenant access."
---

When you create a database in Volcano, it comes with built-in roles for secure multi-tenant access.

## Available Roles

### Anonymous Users (`anon`)

**Used when:** User is not authenticated

**Permissions:**
- Read public data
- Cannot write
- Cannot access private data

**Example:**
```javascript
// Unauthenticated request - automatically uses 'anon' role
// Can only SELECT from tables with public read policies
```

### Authenticated Users (`authenticated`)

**Used when:** User is signed in

**Permissions:**
- Read own data
- Write own data (INSERT, UPDATE, DELETE)
- Cannot access other users' data (RLS enforced)
- Cannot modify database schema

**Example:**
```javascript
// Authenticated request - automatically uses 'authenticated' role
// Can perform CRUD operations on own data
const result = await client.query('SELECT * FROM posts');
// Returns only current user's posts (RLS automatic)
```

## How It Works

### Automatic Role Selection

Volcano automatically selects the correct role based on authentication:

```javascript
// In your Lambda function
exports.handler = async (event) => {
  // If event.__volcano_auth exists → uses 'authenticated' role
  // If no auth → uses 'anon' role
  
  const client = await pool.connect();
  const result = await client.query('SELECT * FROM posts');
  // Automatically filtered by RLS!
};
```

**You don't need to:**
- Manually set roles
- Add WHERE clauses for user_id
- Manage permissions yourself

**Volcano handles:**
- Role selection
- User context injection
- RLS enforcement

### Multi-Tenant Isolation

Each user sees only their own data:

```sql
-- User 1 connects
SELECT * FROM posts;
-- Returns: User 1's posts only

-- User 2 connects  
SELECT * FROM posts;
-- Returns: User 2's posts only
```

**Security guarantees:**
- Users cannot see each other's data
- Users cannot modify each other's data
- Enforced at database level (not application code)

## Setting Up Tables

### 1. Enable RLS on Table

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
```

### 2. Create Policies

**For authenticated users:**
```sql
CREATE POLICY "authenticated_users_own_data" ON posts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

**For public read:**
```sql
CREATE POLICY "public_read" ON posts
  FOR SELECT
  TO anon
  USING (is_public = true);
```

### 3. Grant Permissions

```sql
-- Grant to authenticated users
GRANT ALL ON posts TO authenticated;

-- Grant to anonymous users
GRANT SELECT ON posts TO anon;
```

## Best Practices

### DO:
- Use RLS policies for all user data
- Use `auth.uid()` in policies
- Set `user_id` to `auth.uid()` on insert
- Grant minimal permissions to `anon` role

### DON'T:
- Don't bypass RLS in application code
- Don't manually filter by user_id (let RLS do it)
- Don't grant write permissions to `anon`
- Don't forget to ENABLE ROW LEVEL SECURITY

## Examples

### User Posts
```sql
CREATE TABLE user_posts (
  id SERIAL PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  title TEXT NOT NULL,
  content TEXT
);

ALTER TABLE user_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_posts_policy ON user_posts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON user_posts TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

### Public Content with Private Edits
```sql
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT,
  content TEXT,
  published BOOLEAN DEFAULT false
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Everyone can read published articles
CREATE POLICY articles_public_read ON articles
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Authors can manage their own articles
CREATE POLICY articles_author_manage ON articles
  FOR ALL
  TO authenticated
  USING (author_id = auth.uid());

GRANT SELECT ON articles TO anon;
GRANT ALL ON articles TO authenticated;
```

## See Also

- [Row-Level Security](row-level-security.md) - Complete RLS guide
- [Auth Helpers](auth-helpers.md) - Helper functions reference
- [Creating Databases](creating-databases.md) - Database setup
