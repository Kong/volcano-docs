---
title: "Volcano Frontend Auth - Next.js"
description: "A production-ready Next.js application demonstrating all Volcano Hosting authentication features including email/password, anonymous users, OAuth, password r\u2026"
---

# Volcano Frontend Auth - Next.js

A production-ready Next.js application demonstrating all Volcano Hosting authentication features including email/password, anonymous users, OAuth, password recovery, and email management.

## Features

✅ **Dynamic Configuration**
- No .env setup required for testing
- In-browser credential entry
- Saved to localStorage
- Clear and reconfigure anytime

✅ **Email/Password Authentication**
- User signup with validation
- User signin with session management
- Protected routes

✅ **Anonymous User Flow**
- Instant access without signup
- Full app functionality as anonymous
- Convert to permanent account
- All data preserved during conversion

✅ **Password Recovery**
- Forgot password flow
- Token-based reset
- Email integration

✅ **Email Management**
- Change email address
- Confirmation flow
- Cancel pending changes

✅ **OAuth Provider Linking**
- Link Google, GitHub, Microsoft, Apple
- Unlink providers
- Manage multiple auth methods

✅ **User Dashboard**
- Profile management
- Password updates
- Session information
- Sign out functionality

✅ **Modern Next.js Patterns**
- App Router (Next.js 15)
- TypeScript
- Client-side auth state
- Protected routes
- Dynamic configuration
- localStorage persistence

## Prerequisites

A Volcano project with an anon key (and anonymous sign-ins enabled for the
anonymous flow). Create one with the CLI:

```bash
npm install -g @volcano.dev/cli
volcano signup
volcano projects create my-app
volcano use my-app
```

You'll paste the project's API URL and anon key into the app's config below.

## Quick Start

### 1. Install Dependencies

```bash
cd examples/frontend-auth-nextjs
yarn install
# or simply
yarn
```

### 2. Run Development Server

```bash
yarn dev
```

### 3. Open Browser & Configure

Navigate to: **http://localhost:3001**

**The app will automatically prompt for credentials** if not configured!

#### Option A: Dynamic Configuration (Recommended for Testing)
1. Open the app in browser
2. Enter your credentials in the configuration form
3. Credentials are saved to localStorage
4. Start using the examples immediately

#### Option B: Environment Variables (Recommended for Development)
```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your values
NEXT_PUBLIC_VOLCANO_API_URL=http://localhost:8000
NEXT_PUBLIC_VOLCANO_ANON_KEY=your-anon-key
```

**Note:** Environment variables take precedence over localStorage. The project ID is embedded in the anon key - no need to specify it separately.

## Available Scripts

```bash
yarn install      # Install dependencies
yarn dev          # Start development server (port 3001)
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint with auto-fix
yarn lint:check   # Check linting without fixing
yarn type-check   # TypeScript type checking
yarn format       # Format code with Prettier
yarn format:check # Check formatting
yarn clean        # Remove build artifacts and node_modules
yarn reinstall    # Clean install (removes node_modules first)
```

## Project Structure

```
frontend-auth-nextjs/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page (example index)
│   ├── globals.css         # Global styles
│   ├── auth/
│   │   └── page.tsx        # Email/password auth
│   ├── anonymous/
│   │   └── page.tsx        # Anonymous user conversion
│   └── dashboard/
│       └── page.tsx        # Protected user dashboard
├── lib/
│   └── volcano.ts          # Volcano SDK wrapper
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.example
```

## Pages

### Home (/)
- Overview of all 7 examples
- Quick start instructions
- Links to each flow

### 1. Email/Password Auth (/auth)
- Signup/Signin toggle
- Form validation
- Error handling
- Redirects to dashboard on success

### 2. Anonymous Flow (/anonymous)
- **Step 1:** Create anonymous user
- **Step 2:** Dashboard (with conversion prompt)
- **Step 3:** Conversion form
- **Step 4:** Success confirmation

### 3. Password Recovery (/password-reset)
- **Request Reset:** Send recovery token to email
- **Reset Password:** Enter token and new password
- Token validation
- Automatic redirect to signin after success

### 4. Email Change (/email-change)
- Request email change (sends confirmation to new email)
- Confirm with token
- Cancel pending change
- Shows current and pending email

### 5. OAuth Provider Linking (/oauth-linking)
- View linked OAuth providers
- Link Google, GitHub, Microsoft, Apple
- Unlink providers
- Visual status indicators

### 6. Dashboard (/dashboard)
- Protected route (redirects if not authenticated)
- User profile display
- Profile update form
- Session management
- Sign out

## Usage Examples

### Sign Up New User

1. Go to `/auth`
2. Switch to "Sign Up" tab
3. Enter email, password, and optional name
4. Click "Create Account"
5. Redirected to dashboard

### Anonymous User Flow

1. Go to `/anonymous`
2. Click "Start as Anonymous" (no credentials!)
3. View anonymous dashboard
4. Click "Upgrade to Permanent Account"
5. Enter email/password
6. Account converted (same user ID, data preserved)

### Update Profile

1. Sign in (any method)
2. Go to `/dashboard`
3. Update name or password
4. Click "Update Profile"

## SDK Integration

The example imports the published Volcano SDK package:

```typescript
import VolcanoAuth from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL,
  anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY,
});

// Use SDK methods
await volcano.auth.signUp({ email, password });
await volcano.auth.signUpAnonymous();
await volcano.auth.convertAnonymous({ email, password });
```

## Building for Production

```bash
# Build
yarn build

# Start production server
yarn start

# Or deploy to Vercel
vercel deploy
```

## Environment Variables

Required for production:

```bash
NEXT_PUBLIC_VOLCANO_API_URL=https://your-api.com
NEXT_PUBLIC_VOLCANO_ANON_KEY=your-anon-key
```

## Customization

### Styling

Edit `app/globals.css` to customize:
- Colors and branding
- Layout and spacing
- Component styles

### Add More Features

- **Email Confirmation:** Handle email verification on signup
- **Function Calls:** Add serverless function invocation
- **Multi-Factor Auth:** Add MFA/2FA support (when available)
- **Account Deletion:** Implement account deletion flow

### Protected Routes

Create middleware to protect routes:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check auth state and redirect if needed
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*']
};
```

Keep the `matcher` to the routes middleware decides: Volcano serves those from
your runtime on every request so middleware always runs, and leaves the rest of
the site cached at the edge. See [Frontends](../../frontends/overview.md#caching).

## Troubleshooting

### SDK Not Loading

- Ensure you're in the `examples/frontend-auth-nextjs` directory
- Ensure dependencies are installed (`yarn install`)
- Check Next.js console for import errors

### CORS Errors

- Configure CORS in your Volcano project auth settings
- Add your Next.js URL to allowed origins
- Or disable CORS enforcement for development

### Auth Not Working

1. Check `.env.local` has correct values
2. Verify Volcano server is running on port 8000
3. Confirm anon key is valid and has required permissions
4. Check browser console for errors

## License

MIT
