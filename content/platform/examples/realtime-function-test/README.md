---
title: "Realtime Function Test"
description: "This example demonstrates how to test Volcano Realtime capabilities from within a function."
---

This example demonstrates how to test Volcano Realtime capabilities from within a function.

## What This Tests

1. **Connection** - Connects to the Volcano Realtime server as the invoking user
2. **Broadcast Channels** - Subscribes and sends messages
3. **Presence Channels** - Finds the user in a presence channel's state
4. **Postgres Changes** - Receives the change event for a row the user owns
5. **RLS Isolation** - Verifies users only receive their own data

## Security Focus

This test specifically validates **Row-Level Security (RLS) isolation**:

- Creates a test table with an RLS policy
- Inserts a record for a different user, then one for the current user
- Verifies the user receives the change event for their own record
- **Verifies the user does NOT receive the change event for the other user's record**

This is critical for multi-tenant applications where data isolation is essential.

## How It Works

Volcano passes the invoking user to the function in `event.__volcano_auth`. The
function connects to Realtime with that user's `access_token`, so Realtime
checks the table's RLS policy as that user before delivering each change.

The function writes over its own `pg` connection to
`REALTIME_TEST_DATABASE_URL`. The first invocation creates the table, and every
invocation deletes its two records after the checks:

```sql
CREATE TABLE IF NOT EXISTS public.realtime_test (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.realtime_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY realtime_test_user_only ON public.realtime_test
  FOR SELECT
  USING (user_id = auth.uid());
```

A database's `connection_string` has full access and bypasses RLS, which lets
the function create the table and insert a record for another user. Any
signed-in user who invokes the function writes through that connection, so when
you finish testing, delete the function, the `realtime-test` anon keys and the
`REALTIME_TEST_*` variables, and drop `realtime_test`. Use full access only for
setup like this. To query as the invoking user, pass their `user_id` to
`databaseConnectionString(connectionString, { userId })`; see
[Accessing user information in functions](../../functions/user-context.md#row-level-security-rls).

## Project Variables

Set these project variables before you deploy. Their names are specific to
this test, so they don't replace values your project already uses.

| Variable | Description |
|----------|-------------|
| `REALTIME_TEST_API_URL` | The Volcano API server URL |
| `REALTIME_TEST_ANON_KEY` | An anon key with `realtime.connect`, `realtime.subscribe` and `realtime.publish`. The default anon key has auth permissions only. |
| `REALTIME_TEST_DATABASE_URL` | The `connection_string` of the database Realtime watches |

Realtime watches one database per project: the newest one that is active or
being restored. The commands below expect `PROJECT_ID`, `PLATFORM_TOKEN` and
that database's name in `DATABASE_NAME`.

```bash
ANON_KEY=$(curl -fsS -X POST "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"realtime-test","permissions":["realtime.connect","realtime.subscribe","realtime.publish"]}' \
  | jq -er '.key_value')

CONNECTION_STRING=$(curl -fsS "https://api.volcano.dev/projects/$PROJECT_ID/databases/$DATABASE_NAME" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq -er '.connection_string')

set_variable() {
  [ -n "$2" ] || { echo "No value for $1" >&2; return 1; }
  curl -fsS -o /dev/null -X POST "https://api.volcano.dev/projects/$PROJECT_ID/variables" \
    -H "Authorization: Bearer $PLATFORM_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg name "$1" --arg value "$2" '{name: $name, value: $value}')"
}

set_variable REALTIME_TEST_API_URL https://api.volcano.dev
set_variable REALTIME_TEST_ANON_KEY "$ANON_KEY"
set_variable REALTIME_TEST_DATABASE_URL "$CONNECTION_STRING"
```

## Deployment

From this example's directory, zip the handler and its `package.json` and upload
them. Volcano installs the dependencies during the build. New functions are
`private`, so only service keys could call this one; `visibility=authenticated`
lets your project's signed-in users invoke it.

```bash
zip function.zip index.js package.json
FUNCTION_ID=$(curl -fsS -X POST "https://api.volcano.dev/projects/$PROJECT_ID/functions" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=realtime-test" \
  -F "code=@function.zip" \
  -F "runtime=nodejs24.x" \
  -F "handler=index.handler" \
  -F "visibility=authenticated" | jq -er '.id')
```

## Invocation

This function requires an authenticated user context, so call it with a
signed-in user's access token. Wait for the build to finish, then invoke the
`invoke_url` the API returns for the function rather than building a host,
which differs between deployments:

```bash
while [ "$(curl -fsS "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNCTION_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq -r '.status')" = provisioning ]; do
  sleep 5
done

INVOKE_URL=$(curl -fsS "https://api.volcano.dev/projects/$PROJECT_ID/functions/$FUNCTION_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq -er '.invoke_url')

# Invoke with user authentication
curl -X POST "$INVOKE_URL" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{}}'
```

## Expected Output

```json
{
  "success": true,
  "summary": "7 passed, 0 failed",
  "tests": [
    { "name": "Connection", "passed": true },
    { "name": "Broadcast Subscribe", "passed": true, "channel": "broadcast:test-function-broadcast" },
    { "name": "Broadcast Send", "passed": true },
    { "name": "Presence Channel", "passed": true, "channel": "presence:test-function-presence", "presenceKeys": 1 },
    { "name": "Postgres Subscribe", "passed": true, "channel": "postgres:public:realtime_test" },
    { "name": "Postgres Change Received", "passed": true, "receivedCount": 1 },
    {
      "name": "RLS Isolation",
      "passed": true,
      "message": "Correctly did not receive change for other user"
    }
  ]
}
```

Any failed test sets `success` to `false` and the status to `500`.
`RLS Isolation` fails as inconclusive when no change arrived for the caller's
own record. Without `__volcano_auth` the function answers `401`; with a project
variable missing, `500` naming the variables it needs.

In local mode, send a user's access token too. A call without one runs as the
local service key, which Realtime doesn't accept, so `Connection` fails.

## RLS Policy Setup

To isolate change events on your own tables, enable RLS and add a `SELECT`
policy on `auth.uid()`, as `realtime_test` does. Realtime delivers a change only
to subscribers who can `SELECT` the row; see
[Postgres Changes](../../realtime/postgres-changes.md#row-level-security).
