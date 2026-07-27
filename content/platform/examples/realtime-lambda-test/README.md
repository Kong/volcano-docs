---
title: "Realtime Lambda Test"
description: "This example demonstrates how to test Volcano Realtime capabilities from within a Lambda function."
---

# Realtime Lambda Test

This example demonstrates how to test Volcano Realtime capabilities from within a Lambda function.

## What This Tests

1. **Connection** - Connects to the Volcano Realtime server
2. **Broadcast Channels** - Subscribes and sends messages
3. **Presence Channels** - Tracks user presence
4. **Postgres Changes** - Subscribes to database change events
5. **RLS Isolation** - Verifies users only receive their own data

## Security Focus

This test specifically validates **Row-Level Security (RLS) isolation**:

- Creates a test table with RLS policies
- Inserts records for the current user
- Verifies the user receives change events for their own records
- Inserts records for a different user
- **Verifies the user does NOT receive change events for other users' records**

This is critical for multi-tenant applications where data isolation is essential.

## Deployment

```bash
# From this example's directory
cd realtime-lambda-test
npm install
zip -r function.zip .

# Deploy using Volcano CLI or API
volcano functions deploy realtime-test --file function.zip
```

## Environment Variables

Set these in your Volcano project:

| Variable | Description |
|----------|-------------|
| `VOLCANO_API_URL` | The Volcano API server URL |
| `VOLCANO_ANON_KEY` | Your project's anon key |
| `VOLCANO_REALTIME_URL` | (Optional) Realtime WebSocket URL |

## Invocation

This function requires an authenticated user context:

```bash
# Invoke with user authentication
curl -X POST https://your-project.volcano.dev/functions/realtime-test \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

## Expected Output

```json
{
  "success": true,
  "summary": "6 passed, 0 failed",
  "tests": [
    { "name": "Connection", "passed": true },
    { "name": "Broadcast Subscribe", "passed": true },
    { "name": "Broadcast Send", "passed": true },
    { "name": "Presence Channel", "passed": true },
    { "name": "Postgres Subscribe", "passed": true },
    { "name": "Postgres Change Received", "passed": true },
    { "name": "RLS Isolation", "passed": true },
    { "name": "Disconnect", "passed": true }
  ],
  "errors": []
}
```

## RLS Policy Setup

For the RLS isolation test to work, your database table needs proper RLS policies:

```sql
-- Enable RLS on your table
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Create a policy that uses the JWT claim
CREATE POLICY user_isolation ON your_table
  FOR ALL
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
```

The `request.jwt.claim.sub` setting is automatically set by Volcano when authenticating database connections, ensuring that RLS policies can identify the current user.
