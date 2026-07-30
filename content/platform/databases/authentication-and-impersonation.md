---
title: "Database Authentication & User Impersonation"
description: "Understanding how your identity is passed to the database for Row-Level Security."
---

Understanding how your identity is passed to the database for Row-Level Security.

## Overview

When you query your Volcano database, **your identity is automatically passed to the database**. This enables:

- **Automatic user identification** - `auth.uid()` knows who you are
- **Row-Level Security** - Data filtered to what you can access
- **No manual user_id passing** - Handled automatically
- **Impossible to spoof** - Cryptographically secured

---

## How It Works

### The Complete Flow

```text
┌──────────────────────┐
│ 1. You Sign In       │
│    - Get JWT token   │
│    - Token contains: │
│      • user_id       │
│      • email         │
│      • role          │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ 2. You Query         │
│    - SDK sends token │
│    - Header:         │
│      Authorization:  │
│      Bearer {token}  │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ 3. Volcano Validates │
│    - Checks JWT      │
│    - Extracts:       │
│      • user_id       │
│      • email         │
│      • role          │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ 4. Builds Auth Info  │
│    - Creates:        │
│      application_    │
│      name=volcano_   │
│      user_access:    │
│      user_id         │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ 5. pgproxy Parses    │
│    - Extracts auth   │
│    - Sets variables: │
│      SET request.    │
│      jwt_sub='id'    │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ 6. Database Sees You │
│    - auth.uid() =    │
│      YOUR user_id    │
│    - RLS filters     │
│      your data       │
└──────────────────────┘
```

---

## Using with SDK (Browser)

### Automatic Authentication

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

volcano.database('your_database_name');

// Step 1: Sign in (required!)
await volcano.auth.signIn({ 
  email: 'alice@example.com', 
  password: 'alice-password' 
});

// Step 2: Query
const { data } = await volcano
  .from('posts')
  .select('*');

// Access token automatically sent
// Your user_id extracted from token
// auth.uid() = Alice's ID
// RLS filters to Alice's posts
```

### What Gets Sent

When you call `.from('posts').select('*')`:

```http
POST /databases/DB_ID/query/select
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                      ↑ Your access token (contains your user_id)

Body:
{
  "table": "posts",
  "select": ["*"]
}
```

**The Authorization header proves who you are!**

### What the Database Sees

```sql
-- When you query, the database session has these values set:

SELECT 
  current_setting('request.jwt_sub'),      -- Returns: YOUR user_id
  current_setting('request.jwt_email'),    -- Returns: YOUR email
  current_setting('request.jwt_role');     -- Returns: YOUR role

-- Auth helper functions read these:
SELECT 
  auth.uid(),      -- Returns: YOUR user_id (from token!)
  auth.email(),    -- Returns: YOUR email (from token!)
  auth.role();     -- Returns: YOUR role (from token!)
```

**These values come directly from YOUR JWT token!**

---

## User Impersonation Explained

### What "Impersonation" Means

**Impersonation = Querying as a specific user**

In Volcano, you **always** query as the signed-in user. You **cannot** query as someone else (this is a security feature!)

### Single User Session

```javascript
// Alice signs in
await volcano.auth.signIn({ 
  email: 'alice@example.com', 
  password: 'pass' 
});

// All queries execute as Alice
const posts = await volcano.from('posts').select('*');
// auth.uid() = Alice's ID
// Returns: Alice's posts

const orders = await volcano.from('orders').select('*');
// auth.uid() = Alice's ID (still!)
// Returns: Alice's orders

// Cannot query as Bob while signed in as Alice!
```

### Switching Users (Impersonating Different User)

```javascript
// Sign in as Alice
await volcano.auth.signIn({ 
  email: 'alice@example.com', 
  password: 'alice-pass' 
});

const { data: alicePosts } = await volcano.from('posts').select('*');
console.log('Alice sees:', alicePosts.length, 'posts');
// Returns: Alice's posts

// Sign out Alice
await volcano.auth.signOut();

// Sign in as Bob
await volcano.auth.signIn({ 
  email: 'bob@example.com', 
  password: 'bob-pass' 
});

const { data: bobPosts } = await volcano.from('posts').select('*');
console.log('Bob sees:', bobPosts.length, 'posts');
// Returns: Bob's posts (completely different data!)

// Alice and Bob see different data with the same query!
```

### Multi-User Application

```javascript
// In a multi-user app, each user signs in with their own credentials

// User A's browser
await volcanoA.auth.signIn({ email: 'userA@example.com', ... });
const { data: dataA } = await volcanoA.from('posts').select('*');
// Returns: User A's posts

// User B's browser (different device/session)
await volcanoB.auth.signIn({ email: 'userB@example.com', ... });
const { data: dataB } = await volcanoB.from('posts').select('*');
// Returns: User B's posts

// Each user sees only their own data!
```

---

## Different User Types

### Authenticated Users (Email/Password)

```javascript
await volcano.auth.signIn({ email, password });

// Your identity in database:
// - auth.uid() = your user_id
// - auth.email() = your email
// - auth.role() = "authenticated"

const { data } = await volcano.from('posts').select('*');
// Returns: Your authenticated posts
```

### Anonymous Users

```javascript
await volcano.auth.signUpAnonymous();

// Your identity in database:
// - auth.uid() = anonymous user_id (still a real ID!)
// - auth.email() = null
// - auth.role() = "anonymous"

const { data } = await volcano.from('posts').select('*');
// Returns: This anonymous user's posts
// RLS still enforced!
```

**Key Point:** Anonymous users have a real `user_id` and are isolated just like authenticated users!

### OAuth Users (Google, GitHub, etc.)

```javascript
volcano.auth.signInWithGoogle();
// (OAuth flow completes)

// Your identity in database:
// - auth.uid() = your user_id
// - auth.email() = email from Google
// - auth.role() = "authenticated"

const { data } = await volcano.from('posts').select('*');
// Returns: Your posts (linked to OAuth identity)
```

---

## Security: Why You Can't Bypass This

### Q: Can I query as another user?

**A: No. Impossible.**

```javascript
// This won't work
const { data } = await volcano
  .from('posts')
  .eq('user_id', 'someone-elses-id');

// What actually happens:
// 1. Your filter: WHERE user_id = 'someone-elses-id'
// 2. RLS adds: AND user_id = auth.uid()  (YOUR ID)
// 3. Final: WHERE user_id = 'someone-elses-id' AND user_id = YOUR_ID
// 4. Result: Empty (can't match two different IDs!)
```

### Q: Can I modify the access token?

**A: No. It's cryptographically signed.**

```javascript
// This won't work
volcano.accessToken = 'fake-token-with-different-user-id';

// What happens:
// 1. Volcano validates JWT signature
// 2. Signature doesn't match
// 3. Request rejected: "invalid or expired token"
```

### Q: Can I query without authenticating?

**A: No. Authentication is required.**

```javascript
// This won't work - no sign in
const { data, error } = await volcano.from('posts').select('*');

// Error: "No active session. Please sign in first."
```

---

## Admin Access (Service Role)

### For Platform Admin Operations

If you need to access ALL data (bypassing RLS), use **platform tokens** with direct SQL in Lambda:

```javascript
// Lambda function with platform token (not auth user token)
exports.handler = async (event) => {
  // Connect with service_role (bypasses RLS)
  const db = new Client({
    connectionString: process.env.SERVICE_ROLE_CONNECTION_STRING
  });
  
  await db.connect();
  
  // See ALL data (not filtered by RLS)
  const { rows } = await db.query('SELECT * FROM posts');
  
  await db.end();
  return { statusCode: 200, body: JSON.stringify({ posts: rows }) };
};
```

**Note:** This is for admin operations only, not user queries!

---

## Checking Your Identity

### Who Am I Querying As?

```javascript
// Check current user
const { user } = await volcano.auth.getUser();

if (user) {
  console.log('Querying as:');
  console.log('  ID:', user.id);           // ← auth.uid() returns this
  console.log('  Email:', user.email);     // ← auth.email() returns this
  console.log('  Role:', user.role);       // ← auth.role() returns this
} else {
  console.log('Not signed in - queries will fail');
}
```

### Verify in Database

You can verify what the database sees:

```javascript
// Sign in
await volcano.auth.signIn({ email: 'test@example.com', password: 'pass' });

// Get your user info
const { user } = await volcano.auth.getUser();
console.log('My user ID:', user.id);

// Query posts
const { data } = await volcano.from('posts').select('*');

// All posts in data will have:
// post.user_id === user.id
// Because RLS filtered: WHERE user_id = auth.uid()
```

---

## Common Patterns

### Check Authentication Before Querying

```javascript
async function getMyPosts() {
  // Check if user is signed in
  const { user } = await volcano.auth.getUser();
  
  if (!user) {
    console.error('Please sign in first');
    return [];
  }
  
  // Query - auth is automatic
  const { data, error } = await volcano
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Query failed:', error);
    return [];
  }
  
  return data;
}
```

### Handle Auth Errors

```javascript
const { data, error } = await volcano.from('posts').select('*');

if (error) {
  if (error.message.includes('No active session')) {
    // User not signed in - redirect to login
    window.location.href = '/login';
  } else if (error.message.includes('expired')) {
    // Token expired - refresh
    await volcano.auth.refreshSession();
    // Retry query
  } else {
    // Other error
    console.error('Query error:', error);
  }
}
```

### Show User Info in UI

```javascript
async function initApp() {
  // Try to restore session
  const { user } = await volcano.initialize();
  
  if (user) {
    console.log('Signed in as:', user.email);
    console.log('Your user ID:', user.id);
    
    // Load user's data
    const { data: posts } = await volcano.from('posts').select('*');
    console.log(`You have ${posts.length} posts`);
  } else {
    console.log('Not signed in - showing login form');
  }
}
```

---

## FAQ

### Q: Do I need to pass user_id in my queries?

**A: No! Never.**

**Don't do this:**

```javascript
const userId = getCurrentUserId();
const { data } = await volcano
  .from('posts')
  .eq('user_id', userId);  // Not needed
```

**Just do this:**
```javascript
const { data } = await volcano
  .from('posts')
  .select('*');  // ← RLS filters automatically!
```

### Q: How does the database know my user_id?

**A: From your JWT access token.**

When you sign in, you get a JWT that contains:
```json
{
  "user_id": "abc-123-...",
  "email": "you@example.com",
  "role": "authenticated",
  "exp": 1234567890
}
```

This token is sent with every query, and Volcano extracts your `user_id` and passes it to the database via `auth.uid()`.

### Q: Can I query as a different user?

**A: No. You can only query as yourself.**

This is by design for security. To access different data:
1. Sign out current user
2. Sign in as different user
3. Query again

### Q: What if I want admin access to all data?

**A: Use platform tokens with direct SQL in Lambda functions.**

The query builder/REST API is for **user-level access** with RLS enforcement.

For admin operations that need to see all data, use Lambda functions with direct database connections using the service role.

### Q: How does the query builder enforce security?

**A: Through JWT tokens and Row-Level Security.**

When you query:
1. User signs in → Gets JWT token with user_id
2. JWT sent with every query
3. Volcano validates and extracts user identity
4. Passed to database via pgproxy
5. RLS policies use auth.uid() to filter data

Your queries are automatically secured!

---

## Testing Your Setup

### Verify RLS is Working

```javascript
// Create two users in your app
await volcano.auth.signUp({ email: 'alice@test.com', password: 'pass1' });
await volcano.auth.signUp({ email: 'bob@test.com', password: 'pass2' });

// Sign in as Alice
await volcano.auth.signIn({ email: 'alice@test.com', password: 'pass1' });

// Create Alice's post
await volcano.insert('posts', { title: 'Alice Post' });

// Sign out, sign in as Bob
await volcano.auth.signOut();
await volcano.auth.signIn({ email: 'bob@test.com', password: 'pass2' });

// Query posts as Bob
const { data } = await volcano.from('posts').select('*');

// If RLS is working: data.length === 0 (Bob sees no posts)
// If RLS is broken: data.length === 1 (Bob sees Alice's post - BAD!)

console.log('Bob sees', data.length, 'posts');
// Should be 0 if RLS is working correctly
```

### Check Your Identity

```javascript
// Get current user
const { user } = await volcano.auth.getUser();

console.log('Current identity:');
console.log('  User ID:', user.id);
console.log('  Email:', user.email);
console.log('  Role:', user.role);

// This is who you're querying as!
// auth.uid() in the database returns user.id
```

---

## See Also

- [Row-Level Security Guide](row-level-security.md) - Setting up RLS policies
- [Auth Helpers](auth-helpers.md) - Using auth.uid(), auth.email(), auth.role()
- [Authentication Overview](../authentication/overview.md) - User signup/signin
- [Query Builder API](query-builder-api.md) - Complete API reference
