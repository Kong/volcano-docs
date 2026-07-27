---
title: "Database REST API"
description: "Query your PostgreSQL databases directly from your application using a REST API."
---

Query your PostgreSQL databases directly from your application using a REST API.

## Overview

The Database REST API lets you perform CRUD operations on your database tables using HTTP requests.

| Feature | Description |
|---------|-------------|
| Frontend applications | Query databases directly from browser/mobile |
| Quick prototyping | No SQL knowledge required |
| Automatic security | Row-level security enforced automatically |
| Type-safe | Structured queries with validation |

**Authentication:** Requires an auth user access token (obtained via signup/signin)

**Endpoint:** `POST /databases/{databaseName}/query/{operation}`

---

## Getting Started

### 1. Sign Up a User

```javascript
const response = await fetch('https://api.yourapp.com/auth/signup', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123'
  })
});

const { access_token } = await response.json();
// Save this access_token for database queries
```

### 2. Query Your Database

```javascript
const response = await fetch('https://api.yourapp.com/databases/notes_db/query/select', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,  // ← Your access token (proves your identity!)
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    select: ['id', 'title', 'content'],
    filters: [
      { column: 'status', operator: 'eq', value: 'published' }
    ],
    order: [
      { column: 'created_at', ascending: false }
    ],
    limit: 10
  })
});

const { data } = await response.json();
console.log('Posts:', data);
// Data is automatically filtered to your posts only
// The access_token identifies you to the database
// auth.uid() returns your user_id
// RLS filters the results
```

---

## Operations

### SELECT - Query Data

**Endpoint:** `POST /databases/{databaseName}/query/select`

**Request Body:**
```json
{
  "table": "posts",
  "select": ["id", "title", "content"],
  "filters": [
    { "column": "status", "operator": "eq", "value": "published" },
    { "column": "views", "operator": "gt", "value": 100 }
  ],
  "order": [
    { "column": "created_at", "ascending": false }
  ],
  "limit": 20,
  "offset": 0
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Post",
      "content": "Post content here",
      "created_at": "2026-01-13T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Parameters:**
- `table` (required): Table name
- `select` (optional): Columns to return (omit for `*`)
- `filters` (optional): WHERE conditions
- `order` (optional): ORDER BY clauses
- `limit` (optional): Maximum rows to return
- `offset` (optional): Number of rows to skip (pagination)

---

### INSERT - Create Data

**Endpoint:** `POST /databases/{databaseName}/query/insert`

**Request Body:**
```json
{
  "table": "posts",
  "values": {
    "title": "My New Post",
    "content": "This is the content",
    "status": "draft"
  }
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My New Post",
      "content": "This is the content",
      "status": "draft",
      "user_id": "user-uuid",
      "created_at": "2026-01-13T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Note:** If your table has a trigger that auto-sets `user_id` using `auth.uid()`, it will be set to the authenticated user automatically!

---

### UPDATE - Modify Data

**Endpoint:** `POST /databases/{databaseName}/query/update`

**Request Body:**
```json
{
  "table": "posts",
  "values": {
    "title": "Updated Title",
    "status": "published"
  },
  "filters": [
    { "column": "id", "operator": "eq", "value": "post-uuid" }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Updated Title",
      "status": "published",
      "updated_at": "2026-01-13T10:05:00Z"
    }
  ],
  "count": 1
}
```

**Security:** Row-Level Security ensures you can only update your own data!

---

### DELETE - Remove Data

**Endpoint:** `POST /databases/{databaseName}/query/delete`

**Request Body:**
```json
{
  "table": "posts",
  "filters": [
    { "column": "id", "operator": "eq", "value": "post-uuid" }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Deleted Post"
    }
  ],
  "count": 1
}
```

**Safety:** UPDATE and DELETE require at least one filter to prevent accidental mass changes.

**Security:** Row-Level Security ensures you can only delete your own data!

---

## Filter Operators

| Operator | SQL Equivalent | Example |
|----------|----------------|---------|
| `eq` | `=` | `{ "column": "status", "operator": "eq", "value": "published" }` |
| `neq` | `<>` | `{ "column": "status", "operator": "neq", "value": "draft" }` |
| `gt` | `>` | `{ "column": "views", "operator": "gt", "value": 100 }` |
| `gte` | `>=` | `{ "column": "views", "operator": "gte", "value": 100 }` |
| `lt` | `<` | `{ "column": "price", "operator": "lt", "value": 50 }` |
| `lte` | `<=` | `{ "column": "price", "operator": "lte", "value": 50 }` |
| `like` | `LIKE` | `{ "column": "title", "operator": "like", "value": "%search%" }` |
| `ilike` | `ILIKE` | `{ "column": "title", "operator": "ilike", "value": "%search%" }` (case-insensitive) |
| `is` | `IS NULL` | `{ "column": "deleted_at", "operator": "is", "value": null }` |
| `in` | `IN` | `{ "column": "id", "operator": "in", "value": ["id1", "id2"] }` |

---

## Complete Examples

### E-commerce Order Search

```javascript
const response = await fetch(`${apiUrl}/databases/${databaseName}/query/select`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'orders',
    select: ['id', 'order_number', 'customer_name', 'total', 'status', 'created_at'],
    filters: [
      { column: 'status', operator: 'neq', value: 'cancelled' },
      { column: 'total', operator: 'gte', value: 50 },
      { column: 'created_at', operator: 'gte', value: '2026-01-01' },
      { column: 'customer_name', operator: 'ilike', value: '%smith%' }
    ],
    order: [
      { column: 'created_at', ascending: false }
    ],
    limit: 100
  })
});

const { data, count } = await response.json();
console.log(`Found ${count} orders:`, data);
```

### Social Media Feed

```javascript
const response = await fetch(`${apiUrl}/databases/${databaseName}/query/select`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    select: ['id', 'content', 'like_count', 'comment_count', 'created_at'],
    filters: [
      { column: 'like_count', operator: 'gt', value: 10 },
      { column: 'visibility', operator: 'eq', value: 'public' },
      { column: 'deleted_at', operator: 'is', value: null }
    ],
    order: [
      { column: 'like_count', ascending: false },
      { column: 'created_at', ascending: false }
    ],
    limit: 50
  })
});

const { data } = await response.json();
// data is automatically filtered to posts user has access to (RLS)
```

### Create a Post

```javascript
const response = await fetch(`${apiUrl}/databases/${databaseName}/query/insert`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    values: {
      title: 'My New Post',
      content: 'This is my first post!',
      status: 'published'
    }
  })
});

const { data } = await response.json();
const newPost = data[0];
console.log('Created post:', newPost.id);
// user_id is automatically set to your user ID!
```

### Update a Post

```javascript
const response = await fetch(`${apiUrl}/databases/${databaseName}/query/update`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'posts',
    values: {
      title: 'Updated Title',
      status: 'published'
    },
    filters: [
      { column: 'id', operator: 'eq', value: postId }
    ]
  })
});

const { data } = await response.json();
// RLS ensures you can only update your own posts
```

### Delete a Post

```javascript
const response = await fetch(`${apiUrl}/databases/${databaseName}/query/delete`, {
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
// RLS ensures you can only delete your own posts
```

---

## Using with Volcano SDK

The `@volcano.dev/sdk` makes this even simpler:

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Sign in
await volcano.auth.signIn({ 
  email: 'user@example.com', 
  password: 'password' 
});

// Query database (future SDK feature)
const posts = await volcano.from('posts')
  .select('id, title, content')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10);
```

---

## Row-Level Security

**Automatic Protection:** All queries automatically enforce Row-Level Security (RLS).

### How It Works

1. **You sign in** - Receive an access token with your user ID
2. **You query** - Send access token with request
3. **Volcano validates** - Checks your token and identity
4. **Your identity is injected** - `auth.uid()` returns your user ID
5. **RLS filters data** - You see only what you have access to

### Example RLS Policy

```sql
-- Create policy on your table
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());
```

**Result:** Each user automatically sees only their own posts!

### No manual work required

You don't need to:
- Manually add `WHERE user_id = $1` to queries
- Pass user ID in every request
- Worry about forgetting security filters

Volcano automatically:
- Injects your user ID into the database session
- Ensures `auth.uid()` returns your ID
- Lets RLS policies filter data

---

## Pagination

Combine `limit` and `offset` for pagination:

```javascript
// Page 1 (rows 1-10)
const page1 = await query({
  table: 'posts',
  limit: 10,
  offset: 0
});

// Page 2 (rows 11-20)
const page2 = await query({
  table: 'posts',
  limit: 10,
  offset: 10
});

// Page 3 (rows 21-30)
const page3 = await query({
  table: 'posts',
  limit: 10,
  offset: 20
});
```

---

## Ordering

### Single Column

```json
{
  "table": "posts",
  "order": [
    { "column": "created_at", "ascending": false }
  ]
}
```

### Multiple Columns

```json
{
  "table": "posts",
  "order": [
    { "column": "like_count", "ascending": false },
    { "column": "created_at", "ascending": false }
  ]
}
```

### With NULL Handling

```json
{
  "table": "posts",
  "order": [
    { "column": "priority", "ascending": false, "nulls_first": true }
  ]
}
```

---

## Advanced Filtering

### Multiple Conditions (AND)

All filters are combined with AND:

```json
{
  "table": "products",
  "filters": [
    { "column": "category", "operator": "eq", "value": "electronics" },
    { "column": "price", "operator": "gte", "value": 100 },
    { "column": "price", "operator": "lte", "value": 500 },
    { "column": "in_stock", "operator": "eq", "value": true }
  ]
}
```

SQL equivalent:
```sql
WHERE category = 'electronics' 
  AND price >= 100 
  AND price <= 500 
  AND in_stock = true
```

### Case-Insensitive Search

```json
{
  "table": "users",
  "filters": [
    { "column": "name", "operator": "ilike", "value": "%john%" }
  ]
}
```

Matches: "John", "JOHN", "john", "Johnny", etc.

### NULL Values

```json
{
  "table": "posts",
  "filters": [
    { "column": "deleted_at", "operator": "is", "value": null }
  ]
}
```

Returns only posts where `deleted_at IS NULL` (not deleted).

### Date Ranges

```json
{
  "table": "orders",
  "filters": [
    { "column": "created_at", "operator": "gte", "value": "2026-01-01" },
    { "column": "created_at", "operator": "lt", "value": "2026-02-01" }
  ]
}
```

Returns orders created in January 2026.

---

## Common Patterns

### Get User's Recent Posts

```json
{
  "table": "posts",
  "select": ["id", "title", "created_at"],
  "order": [
    { "column": "created_at", "ascending": false }
  ],
  "limit": 10
}
```

Row-Level Security automatically filters to current user's posts!

### Search Posts by Title

```json
{
  "table": "posts",
  "filters": [
    { "column": "title", "operator": "ilike", "value": "%search term%" }
  ]
}
```

### Get Popular Posts

```json
{
  "table": "posts",
  "filters": [
    { "column": "like_count", "operator": "gt", "value": 100 },
    { "column": "status", "operator": "eq", "value": "published" }
  ],
  "order": [
    { "column": "like_count", "ascending": false }
  ],
  "limit": 50
}
```

### Update User Profile

```json
{
  "table": "profiles",
  "values": {
    "bio": "Updated bio",
    "avatar_url": "https://example.com/avatar.jpg"
  },
  "filters": [
    { "column": "id", "operator": "eq", "value": "profile-uuid" }
  ]
}
```

---

## Error Handling

### Authentication Errors

```json
// 401 Unauthorized
{
  "error": "Authentication required for database queries"
}
```

**Fix:** Include valid access token in Authorization header

### Invalid Query

```json
// 400 Bad Request
{
  "error": "Failed to build query: invalid table name"
}
```

**Fix:** Ensure table and column names are valid identifiers

### Database Errors

```json
// 400 Bad Request
{
  "error": "Query failed: relation \"posts\" does not exist"
}
```

**Fix:** Ensure table exists in your database

### Permission Denied (RLS)

```json
// 200 OK with empty results
{
  "data": [],
  "count": 0
}
```

Row-Level Security silently filters out data you don't have access to.

---

## Security

### Automatic protection

| Protection | Description |
|------------|-------------|
| Row-level security | Enforced on all queries |
| SQL injection prevention | All inputs validated |
| Parameterized queries | Values never interpolated |
| Identity verification | JWT validated on every request |  

### What's protected

**Your identity:**
- Extracted from your JWT access token
- Cannot be spoofed or modified
- Automatically used in RLS policies

**Your data:**
- RLS policies filter automatically
- You can only see/modify data you own
- No manual security checks needed

### Best practices

1. **Always use RLS policies** on tables with user data
   ```sql
   ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_posts" ON posts
     FOR ALL USING (user_id = auth.uid());
   ```

2. **Auto-set user_id** on INSERT using triggers
   ```sql
   CREATE TRIGGER set_user_id 
     BEFORE INSERT ON posts
     FOR EACH ROW
     EXECUTE FUNCTION set_user_id_trigger();
   ```

3. **Validate input** in your application before sending queries

---

## When to use REST API vs Direct SQL

### Use REST API when:

| Use case | Description |
|----------|-------------|
| Simple CRUD operations | SELECT, INSERT, UPDATE, DELETE |
| Frontend applications | Browser/mobile can't use direct PostgreSQL |
| Quick prototyping | No SQL knowledge required |
| Standard queries | Filtering, sorting, pagination |

### Use Direct SQL when:

| Use case | Description |
|----------|-------------|
| Complex queries | JOINs, subqueries, CTEs, window functions |
| Full PostgreSQL power | Advanced features and extensions |
| ORM integration | Sequelize, Prisma, TypeORM, etc. |
| Transactions | Multi-step operations |
| Performance | Direct connection is faster |

Both methods use the same RLS enforcement.

---

## Limits

- **Tables:** Must exist in your database
- **Columns:** Must be valid identifiers (alphanumeric + underscore)
- **Operators:** See supported operators table above
- **Filters:** Combined with AND (OR not yet supported)
- **UPDATE/DELETE:** Requires at least one filter for safety

---

## What's next

| Guide | Description |
|-------|-------------|
| [Authentication flow](authentication-flow.md) | How tokens are passed to database |
| [Query Builder API](query-builder-api.md) | Easier query builder syntax |
| [Row-level security](row-level-security.md) | Secure your tables |
| [Auth helpers](auth-helpers.md) | Using auth.uid(), auth.email() |
| [Authentication overview](../authentication/overview.md) | User signup/signin |

---

## FAQ

**Q: Can I use this from the browser?**  
A: Yes! That's exactly what it's designed for.

**Q: Is my data secure?**  
A: Yes! Row-Level Security is automatically enforced on all queries.

**Q: Do I need to write SQL?**  
A: No! The REST API handles SQL generation for you.

**Q: Can I do complex queries with JOINs?**  
A: For complex queries, use Lambda functions with direct SQL instead.

**Q: How fast is it?**  
A: Very fast! Direct connection to your database with connection pooling.

**Q: Do I need a backend server?**  
A: No! Call the REST API directly from your frontend.
