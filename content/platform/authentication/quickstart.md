---
title: "Authentication quickstart"
description: "Add user authentication to your application in 5 minutes."
---

Add user authentication to your application in 5 minutes.

## Prerequisites

- A Volcano project with the Volcano API URL and an anon key
- The Volcano SDK installed in your frontend

## Step 1: Initialize the SDK

Create a Volcano client with your project's anon key:

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.volcano.dev',
  anonKey: 'your-anon-key'
});
```

You can find your anon key in the project settings or by calling the API:

```bash
curl "https://api.volcano.dev/projects/YOUR_PROJECT_ID/anon-keys" \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN"
```

## Step 2: Sign up a user

Create a new user with email and password:

```javascript
const { user, session, error } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123'
});

if (error) {
  console.error('Signup failed:', error.message);
  return;
}

console.log('User created:', user.id);
console.log('Access token:', session.access_token);
```

The response includes the user object and a session with tokens:

```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "role": "authenticated",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "rt_xyz789...",
    "expires_in": 3600
  }
}
```

The SDK automatically stores the session and includes the access token in subsequent requests.

## Step 3: Sign in an existing user

Authenticate a returning user:

```javascript
const { user, session, error } = await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'securepassword123'
});

if (error) {
  console.error('Signin failed:', error.message);
  return;
}

console.log('Welcome back:', user.email);
```

## Step 4: Get the current user

Check if a user is logged in:

```javascript
const { user, error } = await volcano.initialize();

if (user) {
  console.log('Logged in as:', user.email);
} else {
  console.log('Not logged in');
}
```

Or fetch the latest user data from the server:

```javascript
const { user, error } = await volcano.auth.getUser();

if (user) {
  console.log('Current user:', user.email);
}
```

## Step 5: Sign out

End the user's session:

```javascript
await volcano.auth.signOut();
```

This revokes the refresh token on the server and clears the local session.

## Step 6: Invoke a function with user context

When a user is authenticated, the SDK automatically includes their access token when invoking functions:

```javascript
// User's identity is sent automatically
const result = await volcano.functions.invoke('my-function', {
  payload: { action: 'get_profile' }
});
```

In your function, access the user's identity through `event.__volcano_auth`:

```javascript
// Volcano function
exports.handler = async (event) => {
  // Check if user is authenticated
  if (!event.__volcano_auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const { user_id, email, role } = event.__volcano_auth;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${email}!`,
      userId: user_id
    })
  };
};
```

## Step 7: Query a database with RLS

When you query a database through the SDK or from a function, row-level security policies automatically filter data based on the authenticated user.

### From the browser (Query Builder)

```javascript
volcano.database('main');

// Only returns rows where user_id matches the current user
const { data, error } = await volcano
  .from('posts')
  .select('id, title, content')
  .order('created_at', { ascending: false });

console.log('My posts:', data);
```

### From a function

```javascript
const { Client } = require('pg');

exports.handler = async (event) => {
  if (!event.__volcano_auth) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { user_id } = event.__volcano_auth;

  // Connect with user identity for RLS. DATABASE_URL defaults to
  // application_name=volcano_full_access (bypasses RLS), so replace it.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${user_id}`);
  const client = new Client({ connectionString: url.toString() });

  await client.connect();

  // RLS automatically filters to this user's data
  const { rows } = await client.query('SELECT * FROM posts');

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify(rows)
  };
};
```

> **Note:** For RLS to work, you need to create policies on your tables. See [Row-level security](../databases/row-level-security.md).

## Complete example

Here's a full React component with authentication:

```jsx
import { useState, useEffect } from 'react';
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: process.env.REACT_APP_VOLCANO_API_URL,
  anonKey: process.env.REACT_APP_VOLCANO_ANON_KEY
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    volcano.initialize().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleSignUp = async (email, password) => {
    const { user, error } = await volcano.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    setUser(user);
  };

  const handleSignIn = async (email, password) => {
    const { user, error } = await volcano.auth.signIn({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    setUser(user);
  };

  const handleSignOut = async () => {
    await volcano.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <AuthForm onSignUp={handleSignUp} onSignIn={handleSignIn} />;
  }

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  );
}
```

## What's next

| Guide | Description |
|-------|-------------|
| [OAuth providers](oauth-providers.md) | Add Google, GitHub, and other social logins |
| [Anonymous users](anonymous-users.md) | Let users try your app without signing up |
| [Password reset](password-reset.md) | Implement forgot password flow |
| [User context](../functions/user-context.md) | Access user data in functions |
| [Row-level security](../databases/row-level-security.md) | Secure database access per user |
| [Configuration](configuration/overview.md) | Customize password rules and token lifetimes |
