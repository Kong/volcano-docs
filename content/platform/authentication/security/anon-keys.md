---
title: "Anon keys"
description: "Anon keys are public API keys that are safe to use in frontend code. They allow users to sign up, sign in, and perform authentication operations."
---

Anon keys are public API keys that are safe to use in frontend code. They allow users to sign up, sign in, and perform authentication operations.

## What anon keys are for

Anon keys provide limited access to Volcano APIs based on their configured permissions. By default, anon keys only have authentication permissions:

- User signup and signin
- Token refresh
- Password reset
- User logout
- Email confirmation

You can configure additional permissions when creating anon keys to enable access to storage and realtime features.

Unlike service keys, anon keys enforce row-level security. Users can only access their own data.

## Where to use anon keys

Anon keys are designed for client-side code:

- Browser JavaScript
- Mobile applications
- React, Vue, Angular, and other frontend frameworks
- Public repositories (they're safe to commit)

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

// Safe to use in frontend code
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourproject.volcano.dev',
  anonKey: 'your-anon-key'
});

// Users can sign up
await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword'
});

// Users can sign in
await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'securepassword'
});
```

## Getting your anon key

### Via API

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Response:

```json
{
  "data": [
    {
      "id": "ak_abc123",
      "name": "Default",
      "key_value": "vk_anon_eyJhbGciOiJIUzI1NiIs...",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

Every project has a default anon key created automatically.

## Creating additional anon keys

Create separate anon keys for different environments:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production"}'
```

Common use cases:

- **Development** — For local development
- **Production** — For your live application
- **Mobile** — For mobile apps with different tracking
- **Testing** — For automated tests

## Anon key permissions

Each anon key has a set of permissions that control what operations it allows. By default, anon keys are created with **authentication permissions only** (no storage, realtime, or functions access).

### Available permissions

| Category | Permission | Description |
|----------|------------|-------------|
| **Auth** | `auth.signup` | Allow users to create new accounts |
| **Auth** | `auth.signin` | Allow users to sign in to existing accounts |
| **Auth** | `auth.refresh` | Allow refreshing expired access tokens |
| **Auth** | `auth.logout` | Allow users to sign out and invalidate sessions |
| **Auth** | `auth.password_reset` | Allow password reset flow (forgot/reset password) |
| **Auth** | `auth.confirm_email` | Allow email confirmation via token |
| **Auth** | `auth.resend_confirmation` | Allow resending email confirmation |
| **Storage** | `storage.upload` | Allow uploading files to storage buckets |
| **Storage** | `storage.download` | Allow downloading files from storage buckets |
| **Storage** | `storage.list` | Allow listing files in storage buckets |
| **Storage** | `storage.delete` | Allow deleting files from storage buckets |
| **Realtime** | `realtime.connect` | Allow connecting to realtime WebSocket |
| **Realtime** | `realtime.subscribe` | Allow subscribing to realtime channels |
| **Realtime** | `realtime.publish` | Allow publishing messages to broadcast channels |
| **Functions** | `functions.invoke` | Allow invoking serverless functions marked `is_public: true` |

### Default permissions

When you create an anon key without specifying permissions, it receives all **auth** permissions:

- `auth.signup`
- `auth.signin`
- `auth.refresh`
- `auth.logout`
- `auth.password_reset`
- `auth.confirm_email`
- `auth.resend_confirmation`

Storage and realtime permissions are **not** included by default. This follows the principle of least privilege.

### Creating a key with custom permissions

```bash
# Auth + Storage permissions
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frontend App",
    "permissions": [
      "auth.signup",
      "auth.signin",
      "auth.refresh",
      "auth.logout",
      "storage.upload",
      "storage.download"
    ]
  }'

# Auth + Realtime permissions
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chat App",
    "permissions": [
      "auth.signup",
      "auth.signin",
      "auth.refresh",
      "auth.logout",
      "realtime.connect",
      "realtime.subscribe",
      "realtime.publish"
    ]
  }'
```

### Permission enforcement

- **Auth endpoints**: Check the relevant auth permission (e.g., `auth.signup` for `/auth/signup`)
- **Storage endpoints**: Check the relevant storage permission (e.g., `storage.upload` for file uploads)
- **Realtime connections**: Check `realtime.connect` on WebSocket connection, `realtime.subscribe` on channel subscription, `realtime.publish` on message publishing
- **Function invocation**: Check `functions.invoke` permission and require target function `is_public: true`

If an anon key doesn't have the required permission, the request is rejected with a 403 Forbidden error.

## Anon key vs service key

| Aspect | Anon key | Service key |
|--------|----------|-------------|
| Safe in frontend | Yes | Never |
| RLS enforced | Yes | No (bypassed) |
| Data access | User's own data | All data |
| Use for | User authentication | Admin operations |
| Risk if exposed | Low | Critical |

Use anon keys for frontend authentication. Use service keys only in secure backend environments.

## What anon keys can do

With default permissions:
- Sign up new users (`auth.signup`)
- Sign in existing users (`auth.signin`)
- Refresh access tokens (`auth.refresh`)
- Sign out users (`auth.logout`)
- Request password resets (`auth.password_reset`)
- Confirm email addresses (`auth.confirm_email`)
- Resend confirmation emails (`auth.resend_confirmation`)

With additional permissions configured:
- Upload, download, list, and delete files (storage permissions)
- Connect to WebSocket and subscribe/publish to channels (realtime permissions)
- Invoke serverless functions (`functions.invoke`)
  - Only for functions explicitly marked public (`is_public: true`)

## What anon keys cannot do

Regardless of permissions:
- Access other users' data (RLS enforced)
- Bypass row-level security
- Manage users (ban, delete)
- Access admin endpoints
- **Query databases directly** (anon keys cannot use the database REST API - only auth user tokens and service keys can)
- Use the wildcard permission (`*`)

## Security

Anon keys are safe to expose because:

1. **Limited permissions** — Configurable, auth-only by default
2. **RLS enforced** — Users can only see their own data
3. **No admin access** — Cannot manage other users
4. **Project scoped** — Cannot access other projects
5. **Revocable** — Delete the key to revoke access
6. **No wildcard** — Cannot use `*` permission (reserved for service keys)

### Best practices

- Use different keys for development and production
- Rotate keys periodically
- Delete unused keys
- Monitor for unusual authentication patterns
- **Use least-privilege permissions** — Only grant the permissions your app needs
- Create separate keys with different permissions for different use cases (e.g., one for auth-only pages, another with storage access for upload features)

## Managing anon keys

### List keys

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### Delete a key

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys/$KEY_ID" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### Regenerate a key

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/anon-keys/$KEY_ID/regenerate" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

This generates a new key and immediately invalidates the old one. Update your frontend code with the new value.

## What's next

| Guide | Description |
|-------|-------------|
| [Service keys](service-keys.md) | Admin keys for backend use |
| [Token types](token-types.md) | Understanding all token types |
| [Authentication quickstart](../quickstart.md) | Get started with auth |
