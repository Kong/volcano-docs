---
title: "Authentication"
description: "Volcano provides a complete authentication system for your applications. Each project has its own isolated set of users, tokens, and configuration."
---

Volcano provides a complete authentication system for your applications. Each project has its own isolated set of users, tokens, and configuration.

## Features

| Feature | Description |
|---------|-------------|
| Email/password | Traditional sign up and sign in with email and password |
| OAuth providers | Sign in with Google, GitHub, Microsoft, or Apple |
| Anonymous users | Guest access that can be upgraded to full accounts |
| JWT tokens | Secure access and refresh tokens with configurable lifetimes |
| Password reset | Email-based forgot password flow |
| Session management | Track and revoke user sessions |
| Row-level security | Automatic data isolation when combined with databases |

## How authentication works

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. User signs up or signs in                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Volcano returns access token + refresh token             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. User includes access token when invoking functions       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Function receives user context in event.__volcano_auth   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Function queries database with RLS enforcing user access │
└─────────────────────────────────────────────────────────────┘
```

## API keys

Volcano uses two types of project-level API keys for authentication:

### Anon key

The anon key is safe to use in frontend applications. It allows users to:

- Sign up and sign in
- Refresh access tokens
- Sign out
- Access their own data (RLS enforced)

```javascript
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourproject.volcano.dev',
  anonKey: 'your-anon-key'
});
```

Every project has a default anon key created automatically. You can create additional anon keys for different environments.

### Service key

The service key has admin access and should only be used in secure server environments.

- Bypasses row-level security
- Can access all users' data
- Can perform admin operations

> **Warning:** Never expose service keys in frontend code. They provide full access to your project's data.

```javascript
// Server-side only
const volcanoAdmin = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.VOLCANO_ANON_KEY,
  accessToken: process.env.VOLCANO_SERVICE_KEY
});
```

For more details, see [Anon keys](security/anon-keys.md) and [Service keys](security/service-keys.md).

## User tokens

When a user authenticates, they receive two tokens:

### Access token

- Short-lived (default: 1 hour)
- Contains user identity (user_id, email, role)
- Used to invoke functions and query databases
- Included in the `Authorization` header

### Refresh token

- Long-lived (default: 7 days)
- Used to obtain new access tokens
- Stored in the database
- Can be revoked to log out a user

Token lifetimes are configurable per project. See [Token lifetimes](configuration/token-lifetimes.md).

## Authentication methods

### Email and password

Traditional authentication where users create an account with their email address and a password.

```javascript
// Sign up
const { user, session } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123'
});

// Sign in
const { user, session } = await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'securepassword123'
});
```

Password requirements are configurable. See [Password requirements](configuration/password-requirements.md).

Signups can be limited to specific email domains, across every method below. See [Email domain allowlist](configuration/email-domain-allowlist.md).

### OAuth providers

Users can sign in with their existing accounts from supported providers:

- Google
- GitHub
- Microsoft
- Apple

OAuth authentication doesn't require users to create a password. Users can also link OAuth providers to an existing email/password account.

```javascript
// Redirect to OAuth provider
await volcano.auth.signInWithOAuth({
  provider: 'google',
  redirectTo: 'https://yourapp.com/callback'
});
```

See [OAuth providers](oauth-providers.md) for setup instructions.

### Anonymous users

Anonymous users can access your application without creating an account. They receive a user ID and can have their data persisted. Later, they can upgrade to a full account by adding email and password.

```javascript
// Create anonymous user
const { user, session } = await volcano.auth.signUpAnonymous();

// Later: convert to full account
await volcano.auth.convertAnonymous({
  email: 'user@example.com',
  password: 'securepassword123'
});
```

See [Anonymous users](anonymous-users.md) for details.

## Quick example

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

// Initialize with anon key (safe for frontend)
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourproject.volcano.dev',
  anonKey: 'your-anon-key'
});

// Sign up a new user
const { user, error } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123'
});

if (error) {
  console.error('Signup failed:', error.message);
  return;
}

console.log('User created:', user.id);

// The SDK stores the session automatically
// Future requests include the access token

// Invoke a function with user context
const result = await volcano.functions.invoke('my-function', {
  payload: { action: 'get_profile' }
});
```

## What's next

| Guide | Description |
|-------|-------------|
| [Quickstart](quickstart.md) | Add authentication to your app in 5 minutes |
| [Concepts](concepts.md) | Understand users, tokens, and sessions |
| [OAuth providers](oauth-providers.md) | Set up social sign-in |
| [Anonymous users](anonymous-users.md) | Enable guest access |
| [Configuration](configuration/overview.md) | Customize authentication behavior |
| [Security](security/token-types.md) | Learn about token types and security |
