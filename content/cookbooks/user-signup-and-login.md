---
title: User signup and login
description: Add email and password signup, login, session restoration, and sign-out to a browser application.
---

Create a browser authentication flow that the other recipes can reuse.

## Set up the client

Create a Volcano project, enable email/password authentication, and copy its API URL and anonymous key.
Configure the project's allowed browser origins for your application's local URL.
See the [SDK getting started guide](/sdk/js/getting-started) for project and client configuration.

Install the SDK in your application:

```bash
npm install @volcano.dev/sdk
```

Create `volcano.js`, replacing the placeholders with your project's settings.
Use the anonymous key in browser code; keep service keys in server code.

```javascript
import { VolcanoClient } from '@volcano.dev/sdk';

export const volcano = new VolcanoClient({
  apiUrl: 'YOUR_PROJECT_API_URL',
  anonKey: 'YOUR_PROJECT_ANON_KEY',
});
```

## Create an account and sign in

Create `auth.js` next to `volcano.js`.
Call these functions from your signup and login forms with the values the user entered.
Catch rejected promises in your form handlers and display the error message.

```javascript
import { volcano } from './volcano.js';

export async function signUp(email, password) {
  const { confirmationRequired, message, error } = await volcano.auth.signUp({
    email,
    password,
  });
  if (error) throw error;

  if (confirmationRequired) {
    return message ?? 'Check your email to confirm your account, then sign in.';
  }
  return 'Account requested. You can now sign in.';
}

export async function signIn(email, password) {
  const { user, error } = await volcano.auth.signIn({ email, password });
  if (error) throw error;
  return user;
}
```

Signup returns no session by default.
If email confirmation is required, ask the user to confirm their email before submitting the login form.
The signup response does not reveal whether an address already has an account.

## Restore the session and sign out

Call `initialize()` when your application starts, before opening a view that needs authentication:

```javascript
import { volcano } from './volcano.js';

const { user, error } = await volcano.initialize();
if (error) throw error;

if (user) {
  console.log('Signed in as', user.email);
} else {
  console.log('Show the login form');
}

export async function signOut() {
  const { error } = await volcano.auth.signOut();
  if (error) throw error;
}
```

Authentication controls identity; configure database and storage policies to control access to application data.
See the [authentication reference](/sdk/js/authentication) for auth listeners, OAuth, and session behavior.

## Check the result

1. Register a test account and complete email confirmation if enabled.
2. Sign in and confirm the returned user has an ID.
3. Reload the page and confirm `initialize()` restores the session.
4. Sign out, reload, and confirm the application shows the login form.
5. Submit an incorrect password and confirm your form displays an error.

Continue with [photo uploads](./photo-uploads.md) or [realtime chat](./realtime-chat.md).
