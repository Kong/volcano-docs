---
title: "Volcano Hosting Examples"
description: "This directory contains complete examples demonstrating Volcano Hosting features."
---

# Volcano Hosting Examples

This directory contains complete examples demonstrating Volcano Hosting features.

## Examples

### 🎯 frontend-auth-nextjs (Recommended for Frontend)
**Complete Next.js authentication application** with all Volcano auth and storage features.

**Features:**
- ✅ Email/password authentication
- ✅ Anonymous user signup and conversion
- ✅ Password recovery flow
- ✅ Email change with confirmation
- ✅ OAuth provider linking (Google, GitHub, Microsoft, Apple)
- ✅ Protected routes
- ✅ Session management
- ✅ **File storage** with upload, download, and delete
- ✅ TypeScript + Next.js 15

**Quick Start:**
```bash
cd frontend-auth-nextjs
yarn install
cp .env.example .env.local
# Edit .env.local with your Volcano credentials
yarn dev
# Open http://localhost:3001
```

**Scripts:**
- `yarn dev` - Development server
- `yarn build` - Production build
- `yarn lint` - Run linter
- `yarn type-check` - TypeScript validation

---

### 🐍 python-data
**Python function example** showing data processing.

**Features:**
- Python runtime
- JSON request/response
- Data transformation example

---

### 📘 nodejs-hello
**Simple Hello World function** for getting started.

**Features:**
- Basic Node.js function
- Minimal example
- Perfect for first deployment

---

### 💬 realtime-chat (Next.js + Realtime)
**Minimal chat application** (~250 lines) showing realtime messaging and presence tracking.

**Features:**
- ✅ Real-time messaging with broadcast channels
- ✅ Presence tracking - see who's online with display names
- ✅ Anonymous authentication - no account required
- ✅ User metadata - display names from signup
- ✅ In-browser configuration
- ✅ Built with Next.js 15 and Volcano SDK

**Quick Start:**
```bash
cd realtime-chat
yarn install
yarn dev
# Open http://localhost:3005
```

**What it demonstrates:**
- Anonymous signup with `display_name` metadata
- Broadcast channels for chat messages
- Presence channels to track online users
- User metadata appearing in presence events
- Symmetric visibility (late joiners see existing users)

**Note:** All code in one file (`app/page.tsx`) - no abstractions, just pure SDK usage.

---

## Recommended Learning Path

1. **Start Here:** `frontend-auth-nextjs`
   - Modern Next.js app with all auth features
   - Run `yarn dev` and explore all 7 pages
   - Best practices and production patterns
   - Complete authentication flows

2. **Realtime Features:** `realtime-chat`
   - See Volcano Realtime in action
   - Broadcast and presence channels
   - Anonymous auth with metadata
   - Minimal example (~250 lines total)

## Prerequisites

Each example connects to a Volcano project. Install the CLI and create one:

```bash
npm install -g @volcano.dev/cli
volcano signup                    # create your account
volcano projects create my-app    # create a project
volcano use my-app
```

Then copy your project's API URL and anon key into the example's `.env` (see the
example's own README). New to Volcano? Start with the
[Quickstart](../getting-started/quickstart.md).

## Documentation

- [Authentication Guide](../authentication/overview.md)
- [Functions Guide](../functions/overview.md)
- [Database Guide](../databases/overview.md)
- [Storage Guide](../storage/overview.md)
- [SDK Reference](https://github.com/Kong/volcano-sdk-js)

## Getting Help

Each example has its own README with detailed instructions:
- [frontend-auth-nextjs/README.md](./frontend-auth-nextjs/README.md)
- [realtime-chat/README.md](./realtime-chat/README.md)

## License

MIT

