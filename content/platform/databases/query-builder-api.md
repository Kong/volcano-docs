---
title: "Query Builder API"
description: "Query your PostgreSQL database from the browser using a simple, chainable query API!"
---

Query your PostgreSQL database from the browser using a simple, chainable query API!

## Quick Start

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// STEP 1: Sign in (REQUIRED!)
// This proves who you are and gets you an access token
await volcano.auth.signIn({ 
  email: 'user@example.com', 
  password: 'password' 
});

// STEP 2: Set your database name (do this once)
volcano.database('notes_db');

// STEP 3: Query data with simple, chainable methods
const { data, error } = await volcano
  .from('posts')
  .select('*');

console.log('Posts:', data);
// Your access token was automatically sent
// auth.uid() returned YOUR user ID
// Data filtered to YOUR posts only
```

> **Authentication Note:** You must sign in before querying! The SDK automatically sends your access token with every query, which proves your identity to the database. See [Authentication & Impersonation Guide](authentication-and-impersonation.md) for details.

---

## Authentication & User Impersonation

### How Authentication Works (Automatic!)

**You don't manually pass authentication** - the SDK handles it automatically!

#### Step 1: Sign In

```javascript
// Sign in user (creates session with access token)
await volcano.auth.signIn({ 
  email: 'user@example.com', 
  password: 'password' 
});

// OR sign up new user
await volcano.auth.signUp({ 
  email: 'newuser@example.com', 
  password: 'password123' 
});

// OR use anonymous
await volcano.auth.signUpAnonymous();
```

#### Step 2: Query Database

```javascript
// Just query - auth is automatic!
const { data } = await volcano.from('posts').select('*');

// Behind the scenes (you don't need to do this):
// - SDK sends: Authorization: Bearer {your_access_token}
// - Volcano validates JWT and extracts:
//   • user_id: "abc-123-..."
//   • email: "user@example.com"
//   • role: "authenticated"
// - Passes to database via pgproxy
// - auth.uid() = "abc-123-..."
// - RLS filters: WHERE user_id = auth.uid()
// - You see ONLY your data
```

### The Auth Flow

```text
Your Code                    What Happens Behind the Scenes
────────────────            ──────────────────────────────────

volcano.auth.signIn()    →  1. Validates credentials
                            2. Creates JWT token with user_id
                            3. Stores in SDK (this.accessToken)

volcano.from('posts')    →  4. Builds query request
  .select('*')               5. Adds header:
                                Authorization: Bearer {token}
                            6. Sends to Volcano API

                         →  7. Volcano validates JWT
                            8. Extracts user_id, email, role
                            9. Builds: application_name=
                               volcano_user_access:user_id
                            10. Connects to pgproxy

                         →  11. pgproxy parses auth context
                            12. Sets session variables:
                                SET request.jwt_sub = 'user_id'
                                SET request.jwt_email = 'email'
                                SET request.jwt_role = 'role'

                         →  13. Query executes
                            14. auth.uid() returns user_id
                            15. RLS policies filter data
                            16. Only your data returned
```

### Who Are You Querying As?

```javascript
// Check current user
const { user } = await volcano.auth.getUser();

console.log('Querying as:');
console.log('  User ID:', user.id);        // ← This is what auth.uid() returns
console.log('  Email:', user.email);       // ← This is what auth.email() returns
console.log('  Role:', user.role);         // ← This is what auth.role() returns

// All queries execute as THIS user
const { data } = await volcano.from('posts').select('*');
// Returns: Only this user's posts
```

### Impersonation = Sign In As Different User

**You can't impersonate other users, but you can switch users:**

```javascript
// Query as User A
await volcano.auth.signIn({ email: 'alice@example.com', password: 'alice-pass' });
const { data: aliceData } = await volcano.from('posts').select('*');
// Returns: Alice's posts (auth.uid() = Alice's ID)

// Switch to User B
await volcano.auth.signOut();
await volcano.auth.signIn({ email: 'bob@example.com', password: 'bob-pass' });
const { data: bobData } = await volcano.from('posts').select('*');
// Returns: Bob's posts (auth.uid() = Bob's ID)

// Alice and Bob see completely different data!
```

### Anonymous Users Get Their Own Identity

```javascript
// Create anonymous user
await volcano.auth.signUpAnonymous();

const { user } = await volcano.auth.getUser();
console.log('Anonymous user ID:', user.id);  // Has a real user_id!

// Query as anonymous user
const { data } = await volcano.from('posts').select('*');
// Returns: This anonymous user's posts
// auth.uid() = anonymous user's ID
// RLS works the same way!
```

**Key Point:** Even anonymous users have a `user_id` and RLS works for them!

### Security Guarantees

**You can ONLY query as yourself**
- Your access token proves your identity
- Cannot forge or modify tokens
- Cannot access other users' data

**RLS is always enforced**
- Every query uses your user_id from the JWT
- Policies use `auth.uid()` which comes from YOUR token
- Impossible to bypass

**No way to "trick" the system**
```javascript
// This won't work - you can't pass a different user_id
const { data } = await volcano
  .from('posts')
  .eq('user_id', 'someone-elses-id');  // RLS still filters to YOUR data!

// The RLS policy WHERE user_id = auth.uid() is added AFTER your filters
// Final query: WHERE user_id = 'someone-elses-id' AND user_id = YOUR_ID
// Result: Empty (can't match two different IDs)
```

---

## API Reference

### SELECT Queries

#### Get All Rows

```javascript
const { data, error } = await volcano
  .from('posts')
  .select('*');
```

#### Select Specific Columns

```javascript
const { data } = await volcano
  .from('posts')
  .select('id, title, content, created_at');
```

#### With Filters

```javascript
// Equal
const { data } = await volcano
  .from('posts')
  .select('*')
  .eq('status', 'published');

// Not equal
const { data } = await volcano
  .from('posts')
  .select('*')
  .neq('status', 'draft');

// Greater than
const { data } = await volcano
  .from('posts')
  .select('*')
  .gt('views', 1000);

// Greater than or equal
const { data } = await volcano
  .from('products')
  .select('*')
  .gte('price', 50);

// Less than
const { data } = await volcano
  .from('products')
  .select('*')
  .lt('price', 100);

// Less than or equal
const { data } = await volcano
  .from('products')
  .select('*')
  .lte('stock', 10);
```

#### Pattern Matching

```javascript
// Case-sensitive pattern match
const { data } = await volcano
  .from('posts')
  .select('*')
  .like('title', '%Tutorial%');

// Case-insensitive pattern match (recommended)
const { data } = await volcano
  .from('users')
  .select('*')
  .ilike('name', '%john%');  // Matches "John", "JOHN", "johnny"
```

#### NULL Values

```javascript
// Get rows where column is NULL
const { data } = await volcano
  .from('posts')
  .select('*')
  .is('deleted_at', null);

// Get rows where column is NOT NULL
const { data } = await volcano
  .from('posts')
  .select('*')
  .neq('deleted_at', null);
```

#### IN Operator

```javascript
const { data } = await volcano
  .from('posts')
  .select('*')
  .in('status', ['draft', 'published', 'archived']);
```

#### Multiple Filters (AND)

```javascript
const { data } = await volcano
  .from('products')
  .select('*')
  .eq('category', 'electronics')
  .gte('price', 100)
  .lte('price', 500)
  .eq('in_stock', true);

// SQL equivalent: WHERE category = 'electronics' 
//                  AND price >= 100 
//                  AND price <= 500 
//                  AND in_stock = true
```

### Ordering

```javascript
// Order by single column (descending)
const { data } = await volcano
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false });

// Multiple order columns
const { data } = await volcano
  .from('posts')
  .select('*')
  .order('like_count', { ascending: false })
  .order('created_at', { ascending: false });

// Default is ascending
const { data } = await volcano
  .from('users')
  .select('*')
  .order('name');  // Ascending by default
```

### Pagination

```javascript
// First page (rows 1-10)
const { data: page1 } = await volcano
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)
  .offset(0);

// Second page (rows 11-20)
const { data: page2 } = await volcano
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)
  .offset(10);

// Third page (rows 21-30)
const { data: page3 } = await volcano
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)
  .offset(20);
```

### INSERT Data

```javascript
// Insert single row
const { data, error } = await volcano
  .insert('posts', {
    title: 'My New Post',
    content: 'Hello World!',
    status: 'published'
  });

const newPost = data[0];
console.log('Created:', newPost.id);

// user_id is automatically set to authenticated user!
```

### UPDATE Data

```javascript
// Update by ID
const { data, error } = await volcano
  .update('posts', {
    title: 'Updated Title',
    status: 'published'
  })
  .eq('id', postId);

const updatedPost = data[0];

// RLS ensures you can only update YOUR posts
```

### DELETE Data

```javascript
// Delete by ID
const { data, error } = await volcano
  .delete('posts')
  .eq('id', postId);

const deletedPost = data[0];

// RLS ensures you can only delete YOUR posts
```

---

## Complete Examples

### Todo App

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

volcano.database('notes_db');

// Sign in
await volcano.auth.signIn({ 
  email: 'user@example.com', 
  password: 'password' 
});

// Get all todos
async function getTodos() {
  const { data, error } = await volcano
    .from('todos')
    .select('id, title, completed, created_at')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error:', error);
    return [];
  }
  
  return data;
}

// Get incomplete todos only
async function getIncompleteTodos() {
  const { data } = await volcano
    .from('todos')
    .select('*')
    .eq('completed', false)
    .order('created_at', { ascending: false });
    
  return data;
}

// Create todo
async function createTodo(title) {
  const { data, error } = await volcano
    .insert('todos', {
      title: title,
      completed: false
    });
    
  if (error) {
    console.error('Error creating todo:', error);
    return null;
  }
  
  return data[0];
}

// Toggle todo
async function toggleTodo(id, completed) {
  const { data, error } = await volcano
    .update('todos', { completed })
    .eq('id', id);
    
  if (error) {
    console.error('Error updating todo:', error);
    return null;
  }
  
  return data[0];
}

// Delete todo
async function deleteTodo(id) {
  const { data, error } = await volcano
    .delete('todos')
    .eq('id', id);
    
  return data[0];
}
```

### Blog App

```javascript
// Get published posts
async function getPublishedPosts(page = 1, perPage = 10) {
  const { data, count } = await volcano
    .from('posts')
    .select('id, title, excerpt, author_id, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(perPage)
    .offset((page - 1) * perPage);
    
  return { posts: data, total: count };
}

// Search posts
async function searchPosts(query) {
  const { data } = await volcano
    .from('posts')
    .select('id, title, excerpt')
    .eq('status', 'published')
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
    
  return data;
}

// Get user's drafts
async function getMyDrafts() {
  const { data } = await volcano
    .from('posts')
    .select('*')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });
    
  // RLS automatically filters to current user's posts
  return data;
}

// Publish a draft
async function publishPost(postId) {
  const { data, error } = await volcano
    .update('posts', { 
      status: 'published',
      published_at: new Date().toISOString()
    })
    .eq('id', postId);
    
  if (error) {
    throw error;
  }
  
  return data[0];
}
```

### E-commerce App

```javascript
// Get products by category
async function getProductsByCategory(category, minPrice, maxPrice) {
  const { data } = await volcano
    .from('products')
    .select('id, name, price, image_url, rating')
    .eq('category', category)
    .gte('price', minPrice)
    .lte('price', maxPrice)
    .eq('in_stock', true)
    .order('rating', { ascending: false })
    .limit(50);
    
  return data;
}

// Search products
async function searchProducts(searchTerm) {
  const { data } = await volcano
    .from('products')
    .select('id, name, description, price')
    .ilike('name', `%${searchTerm}%`)
    .eq('in_stock', true)
    .order('popularity', { ascending: false })
    .limit(20);
    
  return data;
}

// Get user's orders
async function getMyOrders() {
  const { data } = await volcano
    .from('orders')
    .select('id, order_number, total, status, created_at')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
    
  // RLS automatically filters to current user's orders
  return data;
}

// Create order
async function createOrder(items, total) {
  const { data, error } = await volcano
    .insert('orders', {
      items: JSON.stringify(items),
      total: total,
      status: 'pending'
    });
    
  if (error) {
    throw error;
  }
  
  return data[0];
}
```

---


## Row-Level Security

**Automatic Protection:** All queries enforce RLS automatically!

```javascript
// User A signs in
await volcano.auth.signIn({ email: 'alice@example.com', password: 'pass' });

// Query posts
const { data } = await volcano
  .from('posts')
  .select('*');

// Returns ONLY Alice's posts (RLS filters automatically)
// Even though query says SELECT *, RLS adds WHERE user_id = auth.uid()
```

**No Manual Filtering Needed:**

**You DON'T need to:**
```javascript
// Don't do this (not needed!)
.eq('user_id', currentUserId)
```

**Just query:**
```javascript
// RLS filters automatically!
.from('posts').select('*')
```

---

## Advanced Patterns

### Search with Multiple Criteria

```javascript
async function searchPosts(searchTerm, category, minViews) {
  let query = volcano
    .from('posts')
    .select('id, title, excerpt, category, views')
    .eq('status', 'published');
    
  if (searchTerm) {
    query = query.ilike('title', `%${searchTerm}%`);
  }
  
  if (category) {
    query = query.eq('category', category);
  }
  
  if (minViews) {
    query = query.gte('views', minViews);
  }
  
  const { data, error } = await query
    .order('views', { ascending: false })
    .limit(50);
    
  return data;
}
```

### Pagination with Total Count

```javascript
async function getPostsPage(page = 1, perPage = 10) {
  const { data, error, count } = await volcano
    .from('posts')
    .select('id, title, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(perPage)
    .offset((page - 1) * perPage);
    
  return {
    posts: data,
    currentPage: page,
    totalPages: Math.ceil(count / perPage),
    total: count
  };
}
```

### Conditional Filters

```javascript
async function getProducts(filters = {}) {
  let query = volcano
    .from('products')
    .select('*');
    
  // Add filters dynamically
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice);
  }
  
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice);
  }
  
  if (filters.inStock) {
    query = query.eq('in_stock', true);
  }
  
  if (filters.searchTerm) {
    query = query.ilike('name', `%${filters.searchTerm}%`);
  }
  
  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(50);
    
  return data;
}

// Usage
const products = await getProducts({
  category: 'electronics',
  minPrice: 100,
  maxPrice: 500,
  inStock: true,
  searchTerm: 'laptop'
});
```

---

---

## When to Use What

### Use Query Builder (Browser)

**Frontend applications**
```javascript
const { data } = await volcano.from('posts').select('*');
```

**Pros:**
- No backend needed
- Simple, readable code
- Query builder syntax

**Cons:**
- Limited to simple queries
- No JOINs or subqueries

### Use Direct SQL (Lambda)

**Complex queries (Lambda functions)**
```javascript
// Use standard pg library in Lambda
const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  const { rows } = await client.query(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = $1
  `, ['published']);
  
  await client.end();
  return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
};
```

**Pros:**
- Full PostgreSQL power
- JOINs, CTEs, window functions
- Better performance

**Cons:**
- Requires Lambda function
- Need to know SQL

---


## Error Handling

```javascript
const { data, error } = await volcano
  .from('posts')
  .select('*')
  .eq('status', 'published');

if (error) {
  // Handle error
  console.error('Query failed:', error.message);
  return;
}

// Use data
console.log('Posts:', data);
```

---

## Best Practices

### 1. Set Database Name Once

```javascript
// At app initialization
volcano.database('notes_db');

// Then query anywhere
const { data } = await volcano.from('posts').select('*');
```

### 2. Always Check for Errors

```javascript
const { data, error } = await volcano.from('posts').select('*');

if (error) {
  // Show error to user or log it
  console.error(error);
  return;
}

// Use data safely
```

### 3. Use Appropriate Filters

```javascript
// Good - specific query
.eq('status', 'published')

// Bad - might return too much data
.gt('views', 0)  // Almost everything has views > 0!
```

### 4. Always Use Pagination for Large Datasets

```javascript
// Good
.limit(50)

// Bad - might return thousands of rows
// No limit
```

---

## Limitations

Volcano REST API currently has:

**Not Yet Supported:**
- JOINs (use direct SQL in Lambda instead)
- OR filters (only AND supported)
- Nested selects
- Aggregations (COUNT, SUM, AVG)
- `.range()` method (use `.limit()` and `.offset()`)

**Supported:**
- All basic CRUD operations
- All comparison operators
- Pattern matching (LIKE, ILIKE)
- Ordering and pagination
- Automatic RLS enforcement
- NULL value handling

**Workaround for Advanced Queries:**

For complex queries not supported by the query builder, use Lambda functions with direct SQL:

```javascript
// Create Lambda function with complex query
const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  
  // Replace application_name (DATABASE_URL already has volcano_full_access)
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);
  
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  
  const { rows } = await client.query(`
    SELECT p.*, COUNT(c.id) as comment_count
    FROM posts p
    LEFT JOIN comments c ON p.id = c.post_id
    WHERE p.status = $1
    GROUP BY p.id
    ORDER BY comment_count DESC
    LIMIT $2
  `, ['published', 10]);
  
  await client.end();
  return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
};

// Call from frontend
const result = await volcano.functions.invoke('get-popular-posts', {});
```

---

## See Also

- **[Direct Connection](direct-connection.md)** - Lambda/server with native PostgreSQL & auth impersonation
- **[Authentication Flow](authentication-flow.md)** - How auth works (client & server)
- [REST API Reference](rest-api.md) - Low-level REST API documentation
- [Row-Level Security](row-level-security.md) - How RLS works
- [Authentication](../authentication/overview.md) - User signup/signin
- [SDK Documentation](https://github.com/Kong/volcano-sdk-js) - Complete SDK guide
