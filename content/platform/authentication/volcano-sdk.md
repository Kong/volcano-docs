---
title: "Volcano SDK"
description: "The Volcano SDK (@volcano.dev/sdk) is a JavaScript library for authentication, database queries, and serverless functions."
---

The Volcano SDK (`@volcano.dev/sdk`) is a JavaScript library for authentication, database queries, and serverless functions.

## Installation

### NPM

```bash
npm install @volcano.dev/sdk
```

### CDN

```html
<script src="https://unpkg.com/@volcano.dev/sdk@latest/dist/index.js"></script>
```

> **Note:** Use `@volcano.dev/sdk`.

## Quick Start

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

// Initialize SDK
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// For database queries, set database name
volcano.database('your_database_name');

// Sign up with email/password
await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Query database
const { data } = await volcano
  .from('posts')
  .select('*')
  .eq('status', 'published')
  .limit(10);

// OR sign in with OAuth
volcano.auth.signInWithGoogle();  // Redirects to Google
volcano.auth.signInWithGitHub();  // Redirects to GitHub

// Call your functions
const result = await volcano.functions.invoke('get-data', {
  action: 'get_data'
});
```

## Features

| Feature | Description |
|---------|-------------|
| Query Builder | `.from().select().eq()` syntax for database queries |
| Direct PostgreSQL access | Query databases directly from the browser |
| Automatic RLS | Row-level security enforced on all queries |
| Universal | Works in browser and Lambda environments |

---

## API Reference

### Initialization

```javascript
const volcano = new VolcanoAuth({
  apiUrl: string,       // Volcano API URL
  anonKey: string,      // Your project's anon key (contains project ID)
  accessToken?: string, // Optional: for server-side use (Lambda)
  refreshToken?: string // Optional: for server-side use
});
```

**Server-side (Lambda) Usage:**
```javascript
// Use accessToken from event.__volcano_auth for Lambda functions
const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: event.__volcano_auth.access_token
});
```

---

### Email/Password Authentication

#### Sign Up

```javascript
const { user, session, error } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  metadata: {            // Optional
    name: 'John Doe',
    age: 30
  }
});

if (error) {
  console.error('Signup failed:', error.message);
} else {
  console.log('User created:', user.email);
}
```

**Returns:**
```javascript
{
  user: {
    id: 'uuid',
    email: 'user@example.com',
    email_confirmed: false,
    ...
  },
  session: {
    access_token: 'eyJhbG...',
    refresh_token: 'refresh_...',
    expires_in: 3600
  },
  error: null  // or Error object on failure
}
```

---

#### Sign In

```javascript
const { user, session, error } = await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});

if (error) {
  console.error('Signin failed:', error.message);
} else {
  console.log('Signed in:', user.email);
}
```

---

#### Sign Out

```javascript
await volcano.auth.signOut();
```

Clears local session and invalidates refresh token on server.

---

### OAuth authentication

#### Sign in with Google

```javascript
volcano.auth.signInWithGoogle();
```

Redirects to Google for authorization. After approval, Google redirects back and user is signed in.

---

#### Sign in with GitHub

```javascript
volcano.auth.signInWithGitHub();
```

---

#### Sign in with Microsoft

```javascript
volcano.auth.signInWithMicrosoft();
```

---

#### Sign in with Apple

```javascript
volcano.auth.signInWithApple();
```

---

#### Generic OAuth sign in

```javascript
volcano.auth.signInWithOAuth(provider);
// provider: 'google', 'github', 'microsoft', or 'apple'
```

---

### OAuth provider management

#### Link OAuth provider to current user

```javascript
const { data, error } = await volcano.auth.linkOAuthProvider('google');

if (error) {
  console.error('Failed to link:', error.message);
} else {
  // data = { authorization_url: 'https://accounts.google.com/...' }
  // Redirect user to authorization URL
  window.location.href = data.authorization_url;
}
```

**Use Case:** User has password, wants to also enable Google sign-in

---

#### Unlink OAuth provider

```javascript
const { error } = await volcano.auth.unlinkOAuthProvider('google');

if (error) {
  console.error('Failed to unlink:', error.message);
  // Common: "cannot unlink last authentication method"
}
```

Returns `error` if this is the user's only authentication method.

---

#### Get linked OAuth providers

```javascript
const { providers, error } = await volcano.auth.getLinkedOAuthProviders();

if (error) {
  console.error('Failed to get providers:', error.message);
} else {
  // providers = [
  //   { provider: 'google', linked_at: '2026-01-03T10:00:00Z', updated_at: '...' },
  //   { provider: 'github', linked_at: '2026-01-05T14:30:00Z', updated_at: '...' }
  // ]
}
```

---

### User management

#### Get current user

```javascript
const { user, error } = await volcano.auth.getUser();

if (error) {
  console.error('Not authenticated');
} else {
  console.log('Current user:', user);
}
```

---

#### Update user profile

```javascript
const { user, error } = await volcano.auth.updateUser({
  password: 'new-password',  // Optional
  metadata: {                 // Optional
    name: 'Jane Doe',
    preferences: { theme: 'dark' }
  }
});
```

Metadata updates merge the supplied keys into the current user metadata.
Existing keys that are not supplied remain unchanged.
Merging is shallow: a nested object replaces the stored value for that top-level key.

---

#### Refresh session

```javascript
const { session, error } = await volcano.auth.refreshSession();

if (error) {
  // Session expired, redirect to login
  window.location.href = '/login';
} else {
  // Session refreshed, new tokens stored automatically
  console.log('New access token:', session.access_token);
}
```

---

#### Listen to auth state changes

```javascript
volcano.auth.onAuthStateChange((user) => {
  if (user) {
    console.log('User signed in:', user);
  } else {
    console.log('User signed out');
  }
});
```

---

#### Session management

View and manage active sessions across devices:

```javascript
// Get all sessions
const { sessions, total, error } = await volcano.auth.getSessions();

sessions.forEach(session => {
  console.log(`${session.provider} - ${session.user_agent}`);
  console.log(`  Current session: ${session.is_current}`);
  console.log(`  IP: ${session.ip_address}`);
});

// Sign out from a specific device
await volcano.auth.deleteSession('session-uuid');

// Sign out from all other devices (keep current session)
await volcano.auth.deleteAllOtherSessions();
```

---

### Function invocation

```javascript
const { data, error } = await volcano.functions.invoke('get-data', {
  action: 'get_data',
  params: { id: 123 }
});

if (error) {
  console.error('Function call failed:', error.message);
} else {
  console.log('Result:', data);
}
```

**Automatic token refresh:** If access token is expired, SDK automatically refreshes it and retries.
Function routing is handled transparently by the SDK when invoking by name.

---

## Examples

### OAuth-only app

```html
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Example</title>
  <script src="volcano-auth-sdk.js"></script>
</head>
<body>
  <h1>Sign In</h1>
  
  <button onclick="volcano.auth.signInWithGoogle()">
    Sign in with Google
  </button>
  
  <button onclick="volcano.auth.signInWithGitHub()">
    Sign in with GitHub
  </button>

  <script>
const volcano = new VolcanoAuth({
  apiUrl: 'https://api.volcano.dev',
  anonKey: 'your-anon-key'
});

    // Check if already logged in
    volcano.auth.initialize().then(({ user }) => {
      if (user) {
        window.location.href = '/dashboard';
      }
    });
  </script>
</body>
</html>
```

---

### Hybrid auth (email + OAuth)

```javascript
// Email/password signup
async function signUpWithEmail() {
  const { user, error } = await volcano.auth.signUp({
    email: document.getElementById('email').value,
    password: document.getElementById('password').value
  });
  
  if (error) {
    alert('Signup failed: ' + error.message);
  } else {
    window.location.href = '/dashboard';
  }
}

// OAuth signup
function signUpWithGoogle() {
  volcano.auth.signInWithGoogle();
}

// User dashboard - link additional providers
async function showLinkOptions() {
  const { providers, error } = await volcano.auth.getLinkedOAuthProviders();
  
  if (error) return;
  
  if (!providers.find(p => p.provider === 'google')) {
    showButton('Link Google', () => linkGoogle());
  }
  
  if (!providers.find(p => p.provider === 'github')) {
    showButton('Link GitHub', () => linkGitHub());
  }
}

async function linkGoogle() {
  const { data, error } = await volcano.auth.linkOAuthProvider('google');
  if (!error) {
    window.location.href = data.authorization_url;
  }
}
```

---

### Provider management UI

```javascript
async function renderProviderManagement() {
  const { providers, error } = await volcano.auth.getLinkedOAuthProviders();
  
  if (error) return;
  
  const html = providers.map(p => `
    <div class="provider-card">
      <span>${p.provider}</span>
      <button onclick="unlinkProvider('${p.provider}')">Unlink</button>
    </div>
  `).join('');
  
  document.getElementById('providers').innerHTML = html;
}

async function unlinkProvider(provider) {
  const { error } = await volcano.auth.unlinkOAuthProvider(provider);
  
  if (error) {
    alert('Error: ' + error.message);
    // Might be: "cannot unlink last authentication method"
  } else {
    alert(`${provider} unlinked`);
    renderProviderManagement(); // Refresh
  }
}
```

---

## Error handling

All SDK methods return an `error` property instead of throwing. This allows for cleaner error handling:

### Common errors

```javascript
const { user, error } = await volcano.auth.signIn({ email, password });

if (error) {
  if (error.message.includes('invalid email or password')) {
    // Wrong credentials
  } else if (error.message.includes('account is banned')) {
    // User is banned
  } else {
    // Other error
    console.error('Login failed:', error.message);
  }
}
```

### OAuth errors

```javascript
const { error } = await volcano.auth.unlinkOAuthProvider('google');

if (error) {
  if (error.message.includes('cannot unlink last authentication method')) {
    alert('You need to set a password before unlinking Google');
  } else if (error.message.includes('provider not linked')) {
    alert('Google is not linked to your account');
  }
}
```

---

## Session management

### Automatic token storage

SDK automatically stores tokens in localStorage:
- `volcano_access_token`
- `volcano_refresh_token`

### Automatic token refresh

When access token expires (401 error), SDK automatically:
1. Uses refresh token to get new access token
2. Retries the original request
3. If refresh fails, clears session

```javascript
// This happens automatically
await volcano.functions.invoke('my-function', {});
// If token expired:
//   1. SDK refreshes token
//   2. Retries invoke
//   3. Returns result
```

### Manual session restore

```javascript
// On app load
const { user } = await volcano.auth.initialize();

if (user) {
  // User is logged in
  showDashboard();
} else {
  // User is not logged in
  showLogin();
}
```

---

## OAuth-specific features

### Check which providers are linked

```javascript
const { providers, error } = await volcano.auth.getLinkedOAuthProviders();

if (!error) {
  const hasGoogle = providers.some(p => p.provider === 'google');
  const hasGitHub = providers.some(p => p.provider === 'github');

  if (hasGoogle) {
    console.log('User can sign in with Google');
  }
}
```

### Link multiple providers

```javascript
// User can link multiple OAuth providers
await linkProvider('google');   // Now has: password + Google
await linkProvider('github');   // Now has: password + Google + GitHub
await linkProvider('microsoft'); // Now has: password + Google + GitHub + Microsoft

// User can sign in with ANY of these methods
```

### Hybrid user journey

```javascript
// Day 1: User signs up with email/password
const { error: signupError } = await volcano.auth.signUp({ 
  email: 'user@example.com', 
  password: 'pwd123' 
});

// Day 5: User links Google for convenience
const { data, error } = await volcano.auth.linkOAuthProvider('google');
if (!error) {
  window.location.href = data.authorization_url;
}

// Day 10: User links GitHub too
const { data: ghData } = await volcano.auth.linkOAuthProvider('github');

// Now user can sign in with:
// - Email + password
// - Google
// - GitHub
```

---

## Best practices

### Use SDK for all auth operations

Use SDK methods instead of manual fetch calls:

```javascript
// Recommended
volcano.auth.signInWithGoogle();
volcano.auth.linkOAuthProvider('github');
volcano.auth.getLinkedOAuthProviders();

// Not recommended
fetch('/auth/oauth/google/authorize');
```

### Initialize SDK once

```javascript
// At the top of your app
const volcano = new VolcanoAuth({...});

// Use everywhere
volcano.auth.signIn(...);
volcano.functions.invoke(...);
```

### Use convenience methods

```javascript
// Clear and readable
volcano.auth.signInWithGoogle();
volcano.auth.signInWithGitHub();

// Also works
volcano.auth.signInWithOAuth('google');
```

### Handle OAuth redirect

```javascript
// On your callback page or after OAuth redirect
async function handleOAuthCallback() {
  // SDK automatically handles session restoration
  const { user } = await volcano.auth.initialize();
  
  if (user) {
    // OAuth sign-in successful
    window.location.href = '/dashboard';
  }
}
```

---

## Method reference

### Auth methods

| Method | Description |
|--------|-------------|
| `signUp({email, password, metadata})` | Email/password signup |
| `signIn({email, password})` | Email/password signin |
| `signOut()` | Sign out user |
| `signInWithGoogle()` | Sign in with Google |
| `signInWithGitHub()` | Sign in with GitHub |
| `signInWithMicrosoft()` | Sign in with Microsoft |
| `signInWithApple()` | Sign in with Apple |
| `signInWithOAuth(provider)` | Generic OAuth signin |
| `linkOAuthProvider(provider)` | Link OAuth to current user |
| `unlinkOAuthProvider(provider)` | Unlink OAuth provider |
| `getLinkedOAuthProviders()` | List user's OAuth providers |
| `getUser()` | Get current user |
| `updateUser({password, metadata})` | Update profile |
| `refreshSession()` | Manually refresh token |
| `onAuthStateChange(callback)` | Listen to auth events |
| `initialize()` | Restore session on load |
| `getSessions()` | Get all user's sessions |
| `deleteSession(sessionId)` | Sign out from specific device |
| `deleteAllOtherSessions()` | Sign out from all other devices |

### Function methods

| Method | Description |
|--------|-------------|
| `invoke(functionName, payload)` | Call serverless function |

---

## Migration from oauth.js

If you were using `oauth.js`:

### Before (oauth.js)

```javascript
function signInWithGoogle() {
  window.location.href = `${API_URL}/auth/oauth/google/authorize`;
}

async function linkOAuthProvider(provider) {
  const response = await fetch(...);
  const data = await response.json();
  window.location.href = data.authorization_url;
}
```

### After (volcano-auth-sdk.js)

```javascript
// Initialize once
const volcano = new VolcanoAuth({
  apiUrl: API_URL,
  anonKey: ANON_KEY
});

// Use SDK methods
volcano.auth.signInWithGoogle();

async function linkProvider(provider) {
  const result = await volcano.auth.linkOAuthProvider(provider);
  window.location.href = result.authorization_url;
}
```

---

## What's next

| Resource | Description |
|----------|-------------|
| [OAuth providers](oauth-providers.md) | Configure OAuth providers |
| [OAuth integration guide](oauth-integration-guide.md) | Complete OAuth integration |
| [API reference](../api-reference/oauth.md) | OAuth API endpoints |
| [Examples](../examples/frontend-auth-nextjs/README.md) | Working code examples |
