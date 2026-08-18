---
title: "Database Connection Pool Example"
description: "Production-ready example showing how to use connection pooling with Volcano SDK for optimal performance."
---

# Database Connection Pool Example

Production-ready example showing how to use connection pooling with Volcano SDK for optimal performance.

## Features

- ✅ Connection pool reused across invocations
- ✅ Automatic auth context injection per request
- ✅ Row-Level Security automatically enforced
- ✅ 10-50x faster than creating new connections
- ✅ Handles CRUD operations
- ✅ Error handling and validation

## Performance Comparison

**Without Pool (Simple Pattern):**
```
Request → Create connection (50-100ms) → Query (10ms) → Close → Response
Total: ~60-110ms per request
```

**With Pool (Production Pattern):**
```
Request → Get from pool (1-5ms) → Query (10ms) → Release → Response
Total: ~11-15ms per request
```

**Result: 4-10x faster!**

## Setup

### 1. Create Database Table

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own posts
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());

-- Auto-set user_id on insert
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

### 2. Deploy Function

```bash
# Zip source and dependency manifests.
# Volcano installs dependencies during the function build.
zip -r function.zip index.js package.json package-lock.json

# Deploy via Volcano
# (Set DATABASE_URL as environment variable in Volcano)
```

### 3. Usage

**From Browser:**
```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Sign in
await volcano.auth.signIn({ email, password });

// Get posts (calls the function, which queries the database)
const result = await volcano.functions.invoke('get-posts-function-id', {
  action: 'get_posts',
  filter: 'recent'
});

console.log('Posts:', result.posts);

// Create post
await volcano.functions.invoke('get-posts-function-id', {
  action: 'create_post',
  title: 'My First Post',
  content: 'Hello World!'
});
```

## Why Use Connection Pooling?

### Benefits:
1. **Faster** - Reuses connections (1-5ms vs 50-100ms)
2. **Efficient** - Fewer database connections
3. **Scalable** - Handles concurrent requests better
4. **Production-ready** - Industry standard pattern

### When to Use Each Pattern:

**Simple Pattern (createClient):**
- Learning/prototyping
- Low-traffic apps (<100 requests/day)
- Simple functions

**Pool Pattern (createPool):**
- Production apps
- High-traffic (>100 requests/day)
- Need maximum performance
- Multiple concurrent requests

## Environment Variables

Set these in your Volcano function:

```env
DATABASE_URL=<from Volcano database settings>
VOLCANO_PROJECT_ID=<your project ID>
VOLCANO_ANON_KEY=<your anon key>
VOLCANO_API_URL=<your Volcano API URL>
```

## See Also

- [Row-Level Security Guide](../../databases/row-level-security.md)
- [Auth Helpers](../../databases/auth-helpers.md)
- [SDK Documentation](https://github.com/Kong/volcano-sdk-js)
