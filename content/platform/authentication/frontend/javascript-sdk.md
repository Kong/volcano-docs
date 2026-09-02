---
title: "JavaScript SDK"
description: "Complete reference for the Volcano JavaScript SDK (@volcano.dev/sdk)."
---

Complete reference for the Volcano JavaScript SDK (`@volcano.dev/sdk`).

## Installation

```bash
npm install @volcano.dev/sdk
```

Or via CDN:

```html
<script src="https://unpkg.com/@volcano.dev/sdk@latest/dist/index.js"></script>
```

## Initialization

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// For database queries, set database name
volcano.database('your_database_name');
```

**Parameters:**
- `apiUrl` - Your Volcano API URL
- `anonKey` - Your anon key (Project Settings → Authentication) - contains project ID
- `accessToken` (optional) - Access token for server-side use (functions)
- `refreshToken` (optional) - Refresh token for server-side use

**Server-side Usage (functions):**
```javascript
const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: event.__volcano_auth.access_token  // User's token from the function event
});
```

**New in v1.2.0:**
- Added `accessToken` and `refreshToken` constructor options for server-side use
- Standardized error handling: all methods return `{ ..., error }` instead of throwing
- Removed `createSignedUrl()` from storage API

**New in v1.1.0:**
- Package published as `@volcano.dev/sdk`
- Added Query Builder database query API
- Universal support (browser and server-side)

## Methods

### auth.signUp()

Create a new user account.

```javascript
const { user, session, error } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  metadata: {
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg'
  }
});

if (error) {
  console.error('Signup failed:', error.message);
} else {
  console.log('User created:', user.email);
}
```

**Parameters:**
- `email` (required) - User's email
- `password` (required) - User's password
- `metadata` (optional) - Custom user data

**Returns:**
```javascript
{
  user: {
    id: 'uuid',
    email: 'user@example.com',
    user_metadata: {...},
    created_at: '2024-01-01T00:00:00Z'
  },
  session: {
    access_token: 'eyJ...',
    refresh_token: 'f4e3d2...',
    expires_in: 3600
  },
  error: null  // or Error object on failure
}
```

**Error Cases:**
- Email already exists → error.message contains details
- Password too weak → error.message contains details
- Invalid email → error.message contains details

---

### auth.signIn()

Sign in an existing user.

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

**Returns:** Same as signUp() - `{ user, session, error }`

**Error Cases:**
- Invalid credentials → error.message contains details
- Account banned/deleted → error.message contains details

---

### auth.signOut()

Sign out the current user.

```javascript
const { error } = await volcano.auth.signOut();
if (error) throw error;
```

**Effect:**
- Clears local session
- Revokes the refresh token on success
- Returns an error when the logout request fails, after clearing locally

---

### auth.getUser()

Get the current user's profile.

```javascript
const { user } = await volcano.auth.getUser();
```

**Returns:**
```javascript
{
  user: {
    id: 'uuid',
    email: 'user@example.com',
    email_confirmed: false,
    user_metadata: {...},
    status: 'active',
    created_at: '...',
    updated_at: '...'
  }
}
```

**Errors:**
- Not signed in → 401
- Token expired → 401 (automatically refreshes)

---

### auth.updateUser()

Update the current user's profile.

```javascript
const { user } = await volcano.auth.updateUser({
  password: 'newpassword123',
  metadata: {
    name: 'Jane Doe',
    avatar: 'https://example.com/new-avatar.jpg'
  }
});
```

**Parameters:**
- `password` (optional) - New password
- `metadata` (optional) - User data keys to merge into the existing metadata
  (omitted keys remain unchanged; set a key to `null` to remove it; merging is
  shallow, so nested objects replace the stored value for that top-level key)

**Errors:**
- Password doesn't meet requirements → 400
- Not signed in → 401

---

### auth.refreshSession()

Manually refresh the access token.

```javascript
const { session } = await volcano.auth.refreshSession();
```

Usually automatic, but can be called manually.

---

### auth.onAuthStateChange()

Listen to authentication state changes.

```javascript
volcano.auth.onAuthStateChange((user) => {
  if (user) {
    console.log('User signed in:', user.email);
  } else {
    console.log('User signed out');
  }
});
```

---

### functions.invoke()

Call a Volcano function with authentication.

```javascript
const { data, status, headers, version, error } = await volcano.functions.invoke('get-posts', {
  action: 'get_posts',
  limit: 10
});

if (error) {
  console.error('Function call failed:', error.message);
} else {
  console.log('Status:', status);
  console.log('Volcano version:', version);
  console.log('Headers:', headers);
  console.log('Result:', data);
}
```

**Parameters:**
- `functionName` - Function name
- `payload` - Data to send to function

**Authentication:**
- Automatically includes access token
- Function receives user context in `event.__volcano_auth`
 - Function routing is handled transparently by the SDK

**Returns:** `{ data, status, headers, version, error }`
- `data`: parsed response body from your function
- `status`: HTTP status code returned by your function
- `headers`: response headers (includes forwarded function headers)
- `version`: value of `X-Volcano-Version` (`<version>` in production, `<env>-<version>` in non-production)
- `error`: network/platform error (null for successful function passthrough responses)

---

## Error Handling

All SDK methods return an `error` property instead of throwing:

```javascript
const { user, error } = await volcano.auth.signIn({...});

if (error) {
  console.error('Error:', error.message);
  // Handle error
} else {
  // Success
  console.log('Logged in as:', user.email);
}
```

Common error messages:
- `"invalid email or password"` - Wrong credentials
- `"account is banned"` - User banned
- `"anonKey is required"` - Forgot anon key in init
- `"rate limit exceeded"` - Too many requests
- `"No active session"` - Not signed in

## Session Management

The SDK automatically:
- Stores tokens in localStorage
- Restores session on page reload
- Refreshes access tokens before expiry
- Clears session on logout

**Restore session on load:**
```javascript
const volcano = new VolcanoAuth({...});

// Automatically tries to restore
const { user } = await volcano.initialize();

if (user) {
  // User already signed in
} else {
  // Show login form
}
```

## TypeScript Support

Coming soon. For now, you can create type definitions:

```typescript
interface VolcanoUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  created_at: string;
}

interface VolcanoSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
```

## Complete Example

See `examples/frontend-integration/simple-auth.html` for a complete working example with UI.

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  
  <script src="volcano-auth-sdk.js"></script>
  <script>
    const volcano = new VolcanoAuth({
      apiUrl: 'https://api.volcano.dev',
      anonKey: 'your-anon-key'
    });

    // Sign up
    document.getElementById('signupBtn').onclick = async () => {
      const { user } = await volcano.auth.signUp({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      });
      
      console.log('Welcome!', user.email);
      
      // Call function
      const posts = await volcano.functions.invoke('get-posts', {});
      displayPosts(posts.data);
    };

    // Restore session on load
    volcano.initialize().then(({ user }) => {
      if (user) showDashboard(user);
      else showLoginForm();
    });
  </script>
</body>
</html>
```

## See Also

- [Examples](../../examples/frontend-auth-nextjs/README.md) - Complete working examples
