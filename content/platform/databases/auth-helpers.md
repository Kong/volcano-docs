---
title: "Auth Helpers"
description: "PostgreSQL functions for accessing authenticated user information."
---

PostgreSQL functions for accessing authenticated user information.

## Auto-Installation

Auth helpers are automatically installed when you create a database via Volcano.

They're installed in the `auth` schema:
- `auth.uid()` - Get current user's ID
- `auth.email()` - Get current user's email  
- `auth.role()` - Get current user's role
- `auth.is_authenticated()` - Check if user is authenticated

## auth.uid()

Returns the authenticated user's ID as UUID.

```sql
SELECT auth.uid();
-- Returns: '123e4567-e89b-12d3-a456-426614174000' or NULL
```

**Usage in RLS policies:**
```sql
CREATE POLICY "users_own_data" ON my_table
  USING (user_id = auth.uid());
```

**Usage in queries:**
```sql
SELECT * FROM posts WHERE user_id = auth.uid();
```

**Returns NULL when:**
- No user authenticated
- Function invoked with service key (not auth user token)
- Session variables not set

## auth.email()

Returns the authenticated user's email.

```sql
SELECT auth.email();
-- Returns: 'user@example.com' or empty string
```

**Usage:**
```sql
-- Log who updated record
UPDATE posts 
SET last_modified_by = auth.email()
WHERE id = $1;
```

## auth.role()

Returns the user's role.

```sql
SELECT auth.role();
-- Returns: 'authenticated' or 'anon'
```

**Possible values:**
- `'authenticated'` - Signed-in user (has full CRUD permissions on own data)
- `'anon'` - Not authenticated (read-only access to public data)

**Usage in policies:**
```sql
-- Only authenticated users can insert
CREATE POLICY "authenticated_only" ON posts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

## auth.is_authenticated()

Boolean check if user is authenticated.

```sql
SELECT auth.is_authenticated();
-- Returns: true or false
```

**Equivalent to:**
```sql
auth.uid() IS NOT NULL
```

**Usage:**
```sql
SELECT 
  CASE 
    WHEN auth.is_authenticated() THEN 'Welcome back!'
    ELSE 'Please sign in'
  END;
```

## How They Work

**Automatic (Recommended):**

When you use Volcano's database connections, user context is automatically set based on the authenticated user from your function:

```javascript
// No manual setup needed!
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// auth.uid() automatically returns the current user
const result = await pool.query('SELECT * FROM posts WHERE user_id = auth.uid()');
```

**Manual (Advanced):**

If you need to manually set user context:

```javascript
await client.query('SET request.jwt_sub = $1', [user_id]);
await client.query('SET request.jwt_email = $1', [email]);
await client.query('SET request.jwt_role = $1', [role]);
```

The auth helpers read these session variables to return the current user's information.

## Manual Installation

If needed, install manually:

```bash
psql $DATABASE_URL -f examples/auth-helpers.sql
```

## Testing

You can test auth helpers by manually setting session variables:

```sql
-- Set test user
SET request.jwt_sub = '123e4567-e89b-12d3-a456-426614174000';
SET request.jwt_email = 'test@example.com';
SET request.jwt_role = 'authenticated';

-- Test functions
SELECT auth.uid();           -- Returns the UUID
SELECT auth.email();         -- Returns 'test@example.com'
SELECT auth.role();          -- Returns 'authenticated'
SELECT auth.is_authenticated();  -- Returns true

-- Reset
RESET request.jwt_sub;
RESET request.jwt_email;
RESET request.jwt_role;
```

**Note:** In production, Volcano automatically sets these based on the authenticated user.

## See Also

- [Row-Level Security](row-level-security.md) - Using helpers in RLS policies
- [Lambda Integration](../authentication/backend/lambda-integration.md) - Setting session variables
- Examples - Complete SQL file




