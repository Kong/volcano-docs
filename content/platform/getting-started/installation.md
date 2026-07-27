---
title: "Installation"
description: "This guide covers installing the Volcano SDK for your frontend application and setting up your development environment."
---

This guide covers installing the Volcano SDK for your frontend application and setting up your development environment.

## Volcano CLI

The Volcano CLI lets you deploy and manage your projects from the terminal.

### Installation

**macOS (Homebrew):**
```bash
brew install volcano-cli
```

**Linux:**
```bash
curl -L https://volcano.dev/cli/install.sh | sh
```

**Or download directly:**
- [macOS (Intel)](https://volcano.dev/cli/volcano-darwin-amd64)
- [macOS (Apple Silicon)](https://volcano.dev/cli/volcano-darwin-arm64)
- [Linux](https://volcano.dev/cli/volcano-linux-amd64)
- [Windows](https://volcano.dev/cli/volcano-windows-amd64.exe)

### Authenticate

**Browser-based (easiest):**
```bash
volcano login
```

**Token-based (CI/CD):**
```bash
volcano login --token pk-xxxxxxxxxx
```

See the [Volcano CLI docs](https://github.com/Kong/volcano-cli/tree/main/docs) for authentication and the full command reference (or run `volcano <command> --help`).

### Verify Installation

```bash
volcano --version
volcano -v
volcano projects
```

## JavaScript SDK

The Volcano SDK works in browsers and Node.js. It provides methods for authentication, database queries, and function invocation.

### npm

```bash
npm install @volcano.dev/sdk
```

### yarn

```bash
yarn add @volcano.dev/sdk
```

### pnpm

```bash
pnpm add @volcano.dev/sdk
```

### CDN

For browser environments without a build step:

```html
<script src="https://unpkg.com/@volcano.dev/sdk@latest/dist/index.js"></script>
```

## Initialize the SDK

Create a client with your project's anon key:

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourproject.volcano.dev',
  anonKey: 'your-anon-key'
});
```

You can find your project ID and anon key in the Volcano dashboard or by querying the API:

```bash
# Get project details including default anon key
curl "https://api.volcano.dev/projects/YOUR_PROJECT_ID" \
  -H "Authorization: Bearer YOUR_PLATFORM_TOKEN"
```

## Framework setup

### React

```jsx
// src/lib/volcano.js
import { VolcanoAuth } from '@volcano.dev/sdk';

export const volcano = new VolcanoAuth({
  apiUrl: process.env.REACT_APP_VOLCANO_API_URL,
  anonKey: process.env.REACT_APP_VOLCANO_ANON_KEY
});
```

```jsx
// src/App.jsx
import { volcano } from './lib/volcano';
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session
    volcano.initialize().then(({ user }) => {
      setUser(user);
    });
  }, []);

  return (
    <div>
      {user ? <Dashboard user={user} /> : <LoginForm />}
    </div>
  );
}
```

### Next.js

```typescript
// lib/volcano.ts
import { VolcanoAuth } from '@volcano.dev/sdk';

export const volcano = new VolcanoAuth({
  apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL!,
  anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY!
});
```

For server components or API routes, use a service key instead:

```typescript
// lib/volcano-server.ts
import { VolcanoAuth } from '@volcano.dev/sdk';

export const volcanoAdmin = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL!,
  anonKey: process.env.VOLCANO_ANON_KEY!,
  accessToken: process.env.VOLCANO_SERVICE_KEY!
});
```

> **Important:** Only use service keys in server-side code. Never expose them to the browser.

### Vue

```javascript
// src/plugins/volcano.js
import { VolcanoAuth } from '@volcano.dev/sdk';

export const volcano = new VolcanoAuth({
  apiUrl: import.meta.env.VITE_VOLCANO_API_URL,
  anonKey: import.meta.env.VITE_VOLCANO_ANON_KEY
});
```

## Environment variables

Store your Volcano configuration in environment variables:

```bash
# .env.local (not committed to git)
VOLCANO_PROJECT_ID=your-project-id
VOLCANO_API_URL=https://api.yourproject.volcano.dev
VOLCANO_ANON_KEY=your-anon-key
VOLCANO_SERVICE_KEY=your-service-key  # Server-side only
```

| Variable | Description | Safe for frontend |
|----------|-------------|-------------------|
| `VOLCANO_PROJECT_ID` | Your project identifier | Yes |
| `VOLCANO_API_URL` | Your Volcano API endpoint | Yes |
| `VOLCANO_ANON_KEY` | Public key for SDK initialization | Yes |
| `VOLCANO_SERVICE_KEY` | Secret key with admin access | No |
| `VOLCANO_PLATFORM_TOKEN` | Account-level API token | No |

## TypeScript support

The SDK includes TypeScript definitions. No additional setup required:

```typescript
import { VolcanoAuth, User, Session } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourproject.volcano.dev',
  anonKey: 'your-anon-key'
});

// Types are inferred
const { user, error } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword'
});

if (user) {
  console.log(user.id); // string
  console.log(user.email); // string
}
```

## Verify installation

Test that the SDK is working:

```javascript
import { volcano } from './lib/volcano';

async function test() {
  try {
    // This will fail if credentials are invalid
    const { user, error } = await volcano.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123'
    });

    if (error) {
      console.error('Auth error:', error.message);
      return;
    }

    console.log('User created:', user.id);
  } catch (err) {
    console.error('SDK error:', err);
  }
}

test();
```

## What's next

| Guide | Description |
|-------|-------------|
| [Quickstart](quickstart.md) | Deploy your first function |
| [Authentication quickstart](../authentication/quickstart.md) | Add user login |
| [Database quick start](../databases/quick-start.md) | Query data from the browser |
