---
title: 'Database Roles and Security'
description: 'When you create a database in Volcano, it comes with built-in roles for secure multi-tenant access.'
---

When you create a database in Volcano, it comes with built-in roles for secure multi-tenant access.

## Default grants

Volcano grants every table you create in the `public` schema to two roles:

| Role            | Default grant on new tables in `public` | Default grant on new sequences |
| --------------- | --------------------------------------- | ------------------------------ |
| `anon`          | `SELECT`                                | none                           |
| `authenticated` | `ALL`                                   | `ALL`                          |

These grants decide what each role may touch. Row-level security decides which rows, and only once you enable it on the table. Until you do, any user session, including an anonymous user's, can read, change, and delete every row of the table, and connections that run as `anon` can read every row.

Make this the first step for every table you create in `public`:

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
```

Then add [policies](row-level-security.md) for the rows each role may use. With RLS enabled and no policies, `anon` and `authenticated` see no rows. To keep a table away from both roles entirely, revoke the grants or create it in a schema of your own:

```sql
REVOKE ALL ON internal_notes FROM anon, authenticated;
```

## Available Roles

### No User Session (`anon`)

**Used when:** No user is signed in

**Permissions:**

- `SELECT` on new tables in `public` by default
- Sees only the rows your policies allow, on tables with RLS enabled
- Reads every row of a table without RLS, on connections that run as `anon`

**Example:**

```javascript
// Unauthenticated request - automatically uses 'anon' role
// On a table with RLS enabled, sees only rows a policy allows
```

### User Sessions (`authenticated`)

**Used when:** A registered or anonymous user is signed in. This is the PostgreSQL role; `auth.role()` returns `authenticated` for registered users and `anonymous` for anonymous users.

**Permissions:**

- `ALL` on new tables and sequences in `public` by default
- Reads and writes only the rows your policies allow, on tables with RLS enabled
- Reads, changes, and deletes every row of a table without RLS
- Cannot modify database schema

**Example:**

```javascript
// Authenticated request - automatically uses 'authenticated' role
// Can perform CRUD operations on own data
const result = await client.query('SELECT * FROM posts');
// Returns only current user's posts, once posts has RLS and a policy
```

### Volcano Platform (`volcano_platform`)

**Used when:** Volcano reads your database's size and query statistics, when realtime looks up a table's primary key, and when a migration run takes its lock and keeps its history

**Permissions:**

- Cannot log in
- Reads query statistics for every role (`pg_monitor`)
- Reads and writes the migration history in the `_volcano_migrations` schema, once a migration run creates it
- No access to your tables beyond what you grant to `PUBLIC`

Statements run as `volcano_platform` never appear in [database queries](../api-reference/databases.md#get-database-queries), including your own after `SET ROLE volcano_platform`. Don't drop, alter, or grant the role:

- If you drop it, Volcano recreates it the next time it needs it. Statements recorded before the drop appear under `unknown` until statistics reset.
- Volcano checks the role when it creates or repairs it. If the role can log in or other roles are members of it at that point, Volcano refuses to use it: database queries return an error, and Volcano runs its size reads, primary-key lookups, and migration bookkeeping as the database owner, where they appear in database queries.

```sql
SELECT rolname, rolcanlogin
FROM pg_roles
WHERE rolname = 'volcano_platform';
```

```text
     rolname      | rolcanlogin
------------------+-------------
 volcano_platform | f
```

## How It Works

### Automatic Role Selection

Volcano automatically selects the correct role based on authentication:

```javascript
// In your function
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

**For any user session, including an anonymous user:**

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

Tables you create in `public` already carry the [default grants](#default-grants). Grant explicitly for tables in other schemas, or after you revoke. A table in another schema also needs `USAGE` on its schema:

```sql
-- Only for a schema other than public
GRANT USAGE ON SCHEMA app TO anon, authenticated;

-- Grant to authenticated users
GRANT ALL ON posts TO authenticated;

-- Grant to requests without a user session
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
- Don't leave a table in `public` without ENABLE ROW LEVEL SECURITY

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
