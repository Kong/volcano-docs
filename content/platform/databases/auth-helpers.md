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

The helpers read PostgreSQL session variables (`request.jwt_sub`, `request.jwt_email`,
`request.jwt_role`) that **pgproxy** sets automatically — there's no manual `SET` for your
function code to run.

`process.env.DATABASE_URL` defaults to `application_name=volcano_full_access` (admin, no role
switch, RLS bypassed) and pgproxy does not populate these variables for it, so `auth.uid()`
returns `NULL` on that connection regardless of who invoked the function. To get a real user
identity, rewrite `application_name` to `volcano_user_access:{user_id}` before connecting:

```javascript
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('application_name', `volcano_user_access:${user_id}`);
const pool = new Pool({ connectionString: url.toString() });

// pgproxy sets request.jwt_sub etc. per request, so auth.uid() returns user_id
const result = await pool.query('SELECT * FROM posts WHERE user_id = auth.uid()');
```

See [Direct connection](direct-connection.md#authentication--user-impersonation) for pooling and
other client details.

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




