---
title: "Anonymous users"
description: "Anonymous users allow guest access to your application without requiring registration."
---

Anonymous users allow guest access to your application without requiring registration.

## Overview

Anonymous authentication creates temporary users that can be converted to permanent accounts later. The user receives a unique ID and tokens, allowing them to use your application immediately.

| Use case | Description |
|----------|-------------|
| Try before signup | Let users explore your app before committing to an account |
| Guest checkout | Allow purchases without mandatory registration |
| Temporary access | Provide limited-time access to features |
| Gradual onboarding | Capture user data incrementally |

## Enable anonymous signins

To enable anonymous authentication, update your project's auth configuration:

```json
{
  "enable_anonymous_signins": true
}
```

Anonymous signins are disabled by default.

## Create an anonymous user

```http
POST /auth/signup-anonymous
Authorization: Bearer <anon_key>
```

Response:

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "f4e3d2...",
  "user": {
    "id": "uuid",
    "email": "anon-xyz@anonymous.volcano.internal",
    "user_metadata": {"anonymous": true},
    "status": "active"
  }
}
```

The anonymous user receives:

| Field | Description |
|-------|-------------|
| `id` | Unique user ID for tracking data across sessions |
| `access_token` | JWT for calling functions and APIs |
| `refresh_token` | Token for refreshing the session |
| `email` | Internal email address (not shown to users) |

## Using anonymous users

### Frontend

```javascript
const volcano = new VolcanoAuth({
  anonKey: 'your-anon-key'
});

// Create anonymous user
const { user, session } = await volcano.auth.signUpAnonymous();

// User can now call functions
const result = await volcano.functions.invoke('get-posts', {});
```

### In functions

Anonymous users have a `role` of `anonymous` in the user context:

```javascript
exports.handler = async (event) => {
  const { user_id, role } = event.__volcano_auth;

  if (role === 'anonymous') {
    console.log('Guest user:', user_id);
  }

  // Both anonymous and authenticated users have user_id
  await client.query(
    'INSERT INTO carts (user_id, items) VALUES ($1, $2)',
    [user_id, items]
  );
};
```

## Convert to authenticated user

When an anonymous user decides to create a permanent account:

```http
POST /auth/user/convert-anonymous
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "user_metadata": {
    "name": "John Doe"
  }
}
```

Response:

```json
{
  "user": {
    "id": "same-uuid",
    "email": "user@example.com",
    "user_metadata": {...},
    "status": "active"
  }
}
```

The conversion process:

- Preserves the user ID (all existing data remains associated)
- Adds email and password credentials
- Updates metadata
- If `require_email_confirmation=true`, user must confirm email before email/password signin
- When `email_enabled=true` and confirmation is required, conversion sends a confirmation email

### Frontend example

```javascript
await volcano.auth.convertAnonymous({
  email: 'user@example.com',
  password: 'Password123'
});

// Same user ID, now with permanent credentials
```

## Detecting anonymous users

### In functions

Check the `role` field in the user context:

```javascript
const auth = event.__volcano_auth;

if (!auth) {
  return { statusCode: 401, body: 'Unauthorized' };
}

if (auth.role === 'anonymous') {
  console.log('Anonymous user:', auth.user_id);
}

if (auth.role === 'authenticated') {
  console.log('Registered user:', auth.email);
}
```

### In the database

```sql
-- Check user_metadata
SELECT user_metadata->>'anonymous' FROM auth_users WHERE id = $1;

-- Or check for password (NULL indicates anonymous)
SELECT encrypted_password FROM auth_users WHERE id = $1;
```

### User context comparison

| Field | Anonymous | Authenticated |
|-------|-----------|---------------|
| `user_id` | UUID | UUID |
| `email` | `anon-xyz@anonymous.volcano.internal` | `user@example.com` |
| `project_id` | UUID | UUID |
| `role` | `anonymous` | `authenticated` |

## Security

Anonymous users are fully isolated:

| Protection | Description |
|------------|-------------|
| Unique ID | Each anonymous user receives a unique identifier |
| RLS enforcement | Row-level security policies apply based on `user_id` |
| Project isolation | Anonymous users cannot access other projects |
| Data isolation | Anonymous users cannot access other users' data |

Conversion safeguards:

| Rule | Description |
|------|-------------|
| Email uniqueness | Cannot convert to an email that already exists |
| Password requirements | New password must meet configured requirements |
| Authentication required | Must have a valid access token to convert |

## Configuration

```bash
# Enable anonymous signins
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/auth/config" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable_anonymous_signins": true}'
```

## Database schema

Anonymous users are stored in the `auth_users` table with specific characteristics:

| Field | Anonymous | After conversion |
|-------|-----------|------------------|
| `email` | Internal format | Real email |
| `encrypted_password` | NULL | Hashed password |
| `user_metadata` | Contains `"anonymous": true` | Updated |

## What's next

| Guide | Description |
|-------|-------------|
| [Provider separation](configuration/provider-separation.md) | Configure which auth methods are available |
| [Session management](configuration/session-management.md) | Manage user sessions |




