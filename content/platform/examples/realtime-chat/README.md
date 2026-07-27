---
title: "Volcano Realtime Chat"
description: "Minimal real-time chat with presence tracking using the Volcano SDK. Shows how easy it is to build a full-featured chat app with online user lists."
---

# Volcano Realtime Chat

Minimal real-time chat with **presence tracking** using the Volcano SDK. Shows how easy it is to build a full-featured chat app with online user lists.

## Features

- ✅ **Anonymous authentication** - No account required, just pick a name
- ✅ **Real-time messaging** - Chat updates instantly via broadcast channels
- ✅ **Presence tracking** - See who's online with their display names
- ✅ **User metadata** - Display names from signup appear in presence
- ✅ **Symmetric visibility** - Late joiners see existing users
- ✅ **In-browser config** - Set up credentials directly in the UI

## Quick Start

```bash
yarn install
yarn dev
# Open http://localhost:3005
```

## How It Works

The entire app is in `app/page.tsx` (~250 lines):

```typescript
import { VolcanoAuth } from '@volcano.dev/sdk';
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

// 1. Sign up anonymously with display_name
const volcano = new VolcanoAuth({ apiUrl, anonKey });
const { session } = await volcano.auth.signUpAnonymous({ 
  display_name: 'Alice'  // This appears in presence events!
});

// 2. Connect to realtime
const realtime = new VolcanoRealtime({ 
  apiUrl, 
  anonKey, 
  accessToken: session.access_token 
});
await realtime.connect();

// 3. Subscribe to chat (broadcast channel)
const chat = realtime.channel('chat-general');
chat.on('message', (msg) => {
  console.log(`${msg.username}: ${msg.text}`);
});
await chat.subscribe();

// 4. Subscribe to presence (see who's online)
const presence = realtime.channel('chat-general', { type: 'presence' });

presence.on('presence_sync', () => {
  const state = presence.getPresenceState();
  const users = Object.values(state).map(info => ({
    id: info.client,
    name: info.connInfo?.user_metadata?.display_name || 'Anonymous'
  }));
  console.log('Online users:', users);
});

await presence.subscribe();
await presence.track(); // Automatic

// 5. Send messages
await chat.send({
  username: 'Alice',
  text: 'Hello everyone!',
  timestamp: new Date().toISOString()
});
```

## Key Concepts

### User Metadata in Presence

Display names come from **anonymous signup metadata**:

```javascript
// Signup with display_name
await volcano.auth.signUpAnonymous({ display_name: 'Alice' });

// It appears in presence events automatically:
presence.on('join', (info) => {
  const name = info.connInfo?.user_metadata?.display_name;
  console.log(`${name} joined`); // "Alice joined"
});
```

### Event Names

Use the correct event names:

- ✅ `on('presence_sync', callback)` - Presence state updated
- ✅ `onPresenceSync(callback)` - Helper method (recommended)
- ❌ `on('sync', callback)` - Wrong! This won't fire

## Prerequisites

1. **Volcano server running** with realtime enabled
2. **Project created** with:
   - Anon key generated
   - Anonymous signups enabled in auth settings
   - Realtime enabled in project settings

## Project Structure

```
realtime-chat/
├── app/
│   ├── page.tsx         # Main app (~250 lines)
│   ├── layout.tsx       # Root layout
│   └── globals.css      # Styles
├── package.json
└── README.md
```

All SDK functionality in one file - no abstractions, just pure SDK usage.
