---
title: "Lambda with Service Key Example"
description: "CRITICAL SECURITY WARNING"
---

# Lambda with Service Key Example

⚠️ **CRITICAL SECURITY WARNING** ⚠️

Service keys **BYPASS Row-Level Security** and grant admin access to ALL data from ALL users.

**DO:**
- ✅ Use ONLY in backend Lambda functions
- ✅ Store in environment variables
- ✅ Use for admin operations (analytics, moderation, bulk updates)
- ✅ Audit all service key usage

**DON'T:**
- ❌ NEVER expose in frontend code
- ❌ NEVER commit to git
- ❌ NEVER use for regular user operations
- ❌ NEVER share service keys

---

## Features

This example demonstrates admin operations using service keys:

✅ **Analytics** - Get stats across all users  
✅ **Content Moderation** - Flag/remove any user's posts  
✅ **Bulk Operations** - Update multiple records  
✅ **Data Export** - Backup all data  
✅ **Cleanup** - Delete old posts across all users

---

## Setup

### 1. Get Service Key

From Volcano Dashboard:
1. Navigate to **Service Keys** page
2. Copy an existing key OR create new one
3. **NEVER expose this key publicly!**

### 2. Install Dependencies

```bash
npm install @volcano.dev/sdk
```

### 3. Set Environment Variables

```bash
VOLCANO_API_URL=https://your-volcano-instance.com
ANON_KEY=ak-xxx...  # ← From Anon Keys page
SERVICE_ROLE_KEY=eyJhbGc...  # ← From Service Keys page
DATABASE_NAME=your_database_name  # ← From Databases page
```

### 4. Deploy to Volcano

```bash
volcano deploy --function lambda-service-key-example
```

---

## Usage Examples

### 1. Get Analytics (All Users)

```javascript
// Call from admin dashboard or cron job
const response = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'get_analytics'
  })
});

const { analytics } = await response.json();

console.log(analytics);
// {
//   total_posts: 1543,
//   total_users: 87,
//   posts_by_status: {
//     published: 1234,
//     draft: 289,
//     archived: 20
//   },
//   recent_activity: {
//     last_24h: 42,
//     last_7d: 156
//   },
//   top_users: [
//     { user_id: 'uuid', post_count: 53 },
//     { user_id: 'uuid', post_count: 41 },
//     ...
//   ]
// }
```

### 2. Moderate Content

```javascript
// Flag inappropriate posts
const response = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'moderate_content',
    post_ids: ['post-uuid-1', 'post-uuid-2'],
    action: 'flag',
    reason: 'Inappropriate content'
  })
});

const result = await response.json();
// {
//   moderated: 2,
//   failed: 0,
//   results: [...]
// }
```

### 3. Bulk Update

```javascript
// Update all draft posts to published
const response = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'bulk_update',
    table: 'posts',
    updates: { status: 'published' },
    filters: { status: 'draft' }
  })
});

const result = await response.json();
// {
//   updated_count: 289,
//   message: 'Bulk updated 289 records in posts'
// }
```

### 4. Export All Data

```javascript
// Backup all data
const response = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'export_all_data'
  })
});

const { export: data } = await response.json();
// {
//   export: {
//     posts: [...],  // ALL posts from ALL users
//   },
//   total_records: 1543,
//   exported_at: '2026-01-14T...'
// }
```

### 5. Cleanup Old Posts

```javascript
// Dry run first (see what would be deleted)
const dryRun = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'cleanup_old_posts',
    days_old: 365,
    dry_run: true
  })
});

const { would_delete } = await dryRun.json();
console.log(`Would delete ${would_delete} posts`);

// Actually delete
const result = await fetch('https://your-lambda-url.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'cleanup_old_posts',
    days_old: 365,
    dry_run: false
  })
});
```

---

## How It Works

### Service Key Bypasses RLS

```javascript
// Initialize SDK with SERVICE KEY
const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: process.env.SERVICE_ROLE_KEY  // ← Admin key overrides anonKey!
});

volcano.database(process.env.DATABASE_NAME);

// Query ALL data from ALL users (RLS BYPASSED)
const { data } = await volcano
  .from('posts')
  .select('*');
// Returns ALL posts, regardless of user_id
```

### vs. User Token (RLS Enforced)

```javascript
// Initialize SDK with USER token
const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: auth.access_token  // ← User's token
});

volcano.database(process.env.DATABASE_NAME);

// Query ONLY user's data (RLS ENFORCED)
const { data } = await volcano
  .from('posts')
  .select('*');
// Returns only posts where user_id = current user
```

---

## Common Admin Operations

### Analytics Dashboard

```javascript
exports.handler = async (event) => {
  const volcano = new VolcanoAuth({
    apiUrl: process.env.VOLCANO_API_URL,
    anonKey: process.env.ANON_KEY,
    accessToken: process.env.SERVICE_ROLE_KEY
  });
  
  volcano.database(process.env.DATABASE_NAME);
  
  // Get all data for analytics
  const { data: posts } = await volcano.from('posts').select('*');
  const { data: users } = await volcano.from('users').select('*');
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      total_posts: posts.length,
      total_users: users.length,
      active_users: users.filter(u => u.status === 'active').length
    })
  };
};
```

### Content Moderation

```javascript
// Flag inappropriate content
const { data } = await volcano
  .update('posts', { 
    status: 'flagged',
    moderation_reason: 'Spam detected'
  })
  .eq('id', postId);
```

### Bulk Email

```javascript
// Get all users for newsletter
const { data: users } = await volcano
  .from('users')
  .select('email, name')
  .eq('email_notifications', true);

// Send emails to all users
for (const user of users) {
  await sendEmail(user.email, 'Newsletter', content);
}
```

### Data Migration

```javascript
// Migrate data structure
const { data: posts } = await volcano.from('posts').select('*');

for (const post of posts) {
  await volcano
    .update('posts', { 
      new_field: transformData(post.old_field) 
    })
    .eq('id', post.id);
}
```

---

## Security Best Practices

### 1. Environment Variables Only

```javascript
// ✅ GOOD - From environment
accessToken: process.env.SERVICE_ROLE_KEY

// ❌ BAD - Hardcoded
accessToken: 'eyJhbGc...'
```

### 2. Audit Logging

```javascript
exports.handler = async (event) => {
  console.log('Admin operation:', {
    action: event.action,
    timestamp: new Date().toISOString(),
    params: event
  });
  
  // Perform operation
  const result = await performAdminOperation(event);
  
  // Log result
  console.log('Operation completed:', {
    success: true,
    records_affected: result.count
  });
  
  return result;
};
```

### 3. Action Validation

```javascript
const ALLOWED_ACTIONS = [
  'get_analytics',
  'moderate_content',
  'bulk_update',
  'export_all_data',
  'cleanup_old_posts'
];

if (!ALLOWED_ACTIONS.includes(event.action)) {
  return {
    statusCode: 403,
    body: JSON.stringify({ error: 'Action not allowed' })
  };
}
```

### 4. Rate Limiting

```javascript
// Implement rate limiting for admin operations
const redis = new Redis(process.env.REDIS_URL);
const key = `admin:${event.action}:${Date.now() / 60000}`;
const count = await redis.incr(key);

if (count > 10) {
  return {
    statusCode: 429,
    body: JSON.stringify({ error: 'Rate limit exceeded' })
  };
}
```

---

## When to Use Service Keys

### ✅ DO Use Service Keys For:

- **Analytics** - Cross-user statistics and reports
- **Content Moderation** - Review and flag inappropriate content
- **Bulk Operations** - Update multiple records efficiently
- **Data Export** - Backups and migrations
- **System Maintenance** - Cleanup and optimization
- **Admin Dashboards** - Management interfaces

### ❌ DON'T Use Service Keys For:

- **User Operations** - Use user tokens instead
- **Frontend Code** - NEVER in browser
- **Regular Queries** - Use RLS for user-scoped data
- **Public APIs** - Expose via user authentication

---

## Testing

```javascript
// Test event
const testEvent = {
  action: 'get_analytics'
};

// Run handler
const result = await exports.handler(testEvent);
console.log(JSON.parse(result.body));
```

---

## Database Schema

Make sure your database has the required tables:

```sql
-- Posts table with RLS
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft',
  user_id UUID NOT NULL,
  moderation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (service key bypasses this)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- User policy (service key ignores this)
CREATE POLICY "Users can view own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Learn More

- [Service Keys Documentation](../../authentication/security/service-keys.md)
- [Lambda SDK Example](../lambda-sdk-example/README.md) - User authentication
- [Row-Level Security](../../databases/row-level-security.md)
- [Security Best Practices](../../authentication/security/anon-keys.md)
