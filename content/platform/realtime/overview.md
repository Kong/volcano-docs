---
title: "Realtime"
description: "Volcano Realtime provides WebSocket-based real-time communication for your applications."
---

Volcano Realtime provides WebSocket-based real-time communication for your applications. Enable live updates, collaborative features, and instant notifications with minimal setup.

## Features

| Feature | Description |
|---------|-------------|
| Broadcast | Pub/sub messaging between connected clients |
| Presence | Track online users and share state in real-time |
| Postgres Changes | Subscribe to database INSERT/UPDATE/DELETE events |
| Per-project | Each project has isolated realtime channels |
| SDK support | JavaScript/TypeScript SDK with automatic reconnection |
| Security | JWT-based authentication with automatic project isolation |

## Quick example

### Connect and subscribe to a channel

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',        // Contains your project ID
  accessToken: 'user-access-token'
});

// Connect
await realtime.connect();

// Subscribe to a broadcast channel
// Just specify the channel name - project isolation is automatic
const channel = realtime.channel('chat-room-123');

channel.on('message', (payload) => {
  console.log('New message:', payload);
});

await channel.subscribe();

// Send a message
await channel.send({ event: 'message', text: 'Hello, world!' });
```

### Track user presence

```javascript
// 1. Sign up with metadata (display_name appears in presence)
const { session } = await volcano.auth.signUpAnonymous({
  display_name: 'Alice'
});

// 2. Connect with the session
const realtime = new VolcanoRealtime({
  apiUrl,
  anonKey,
  accessToken: session.access_token
});
await realtime.connect();

// 3. Subscribe to presence
const presenceChannel = realtime.channel('lobby', { type: 'presence' });

presenceChannel.on('presence_sync', () => {
  const state = presenceChannel.getPresenceState();
  const users = Object.values(state).map(info => 
    info.connInfo?.user_metadata?.display_name || 'Anonymous'
  );
  console.log('Online users:', users);
});

presenceChannel.on('join', (info) => {
  const name = info.connInfo?.user_metadata?.display_name;
  console.log('User joined:', name);
});

presenceChannel.on('leave', (info) => {
  console.log('User left');
});

await presenceChannel.subscribe();
await presenceChannel.track(); // Automatic - uses metadata from signup
```

### Subscribe to database changes

```javascript
const dbChannel = realtime.channel('public:messages', { type: 'postgres' });

dbChannel.onPostgresChanges('INSERT', 'public', 'messages', (payload) => {
  console.log('New message inserted:', payload.record);
});

dbChannel.onPostgresChanges('UPDATE', 'public', 'messages', (payload) => {
  console.log('Message updated:', payload.record);
  console.log('Previous value:', payload.old_record);
});

await dbChannel.subscribe();
```

## Channel types

Volcano Realtime supports three types of channels:

### Broadcast channels (default)

```javascript
const channel = realtime.channel('room-name');
// or explicitly:
const channel = realtime.channel('room-name', { type: 'broadcast' });
```

Send and receive messages between all connected clients. Perfect for chat rooms, live updates, and notifications.

### Presence channels

```javascript
const channel = realtime.channel('lobby', { type: 'presence' });
```

Track which users are online and share state. Great for showing who's online, typing indicators, and collaborative cursors.

### Postgres Changes channels

```javascript
const channel = realtime.channel('schema:table', { type: 'postgres' });
```

Receive real-time notifications when database rows are inserted, updated, or deleted. Filtered by Row Level Security policies.

## Disable Realtime features

Update the project Realtime configuration:

```bash
curl -X PUT "$VOLCANO_API_URL/projects/$PROJECT_ID/realtime/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"postgres_changes_enabled":false}'
```

- Setting `postgres_changes_enabled` to `false` closes active connections subscribed to Postgres Changes across all server instances. Broadcast and Presence connections stay open. Volcano removes the project database listeners and generated notification triggers.
- Setting `enabled` to `false` closes all active Realtime connections for the project across all server instances.
- New connections or subscriptions are rejected while their feature is disabled. Clients can connect again after you enable it.

## Project isolation

**You never need to specify a project ID.** The project is automatically determined from your anon key:

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',         // Contains project_id in JWT claims
  accessToken: 'user-access-token'
});

// These channel names are scoped to your project automatically
const chat = realtime.channel('chat-room');      // Only accessible within your project
const presence = realtime.channel('lobby', { type: 'presence' });
```

This is consistent with how all other Volcano SDK methods work - the project context comes from your anon key.

## Authentication

Volcano Realtime supports multiple authentication methods:

### Option 1: User Token (Frontend)

For frontend applications with authenticated users:

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',       // Required: identifies the project
  accessToken: 'user-token',      // Required: authenticates the user
  getToken: async () => {         // Optional: auto-refresh token
    return await refreshAccessToken();
  }
});
```

### Option 2: Service Role Key (Backend)

For backend services, you can use a service role key. The service key contains the project ID, so the anon key is optional:

```javascript
// Backend - service key only (simplest)
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: '',                    // Not required with service key
  accessToken: 'sk-your-service-key'
});

// Backend - service key with anon key (extra validation)
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',       // Optional: additional validation
  accessToken: 'sk-your-service-key'
});
```

> **Note**: Service keys bypass Row Level Security for Postgres changes. Use them only in trusted backend environments.

### Authentication Summary

| Scenario | Anon Key | Access Token | Use Case |
|----------|----------|--------------|----------|
| Frontend with user | Required | User JWT | End-user applications |
| Backend service | Optional | Service Key | Server-to-server, bots |
| Backend with extra validation | Required | Service Key | Stricter security |

## Next steps

- [Broadcast channels](./broadcast.md) - Learn about pub/sub messaging
- [Presence](./presence.md) - Track online users
- [Postgres Changes](./postgres-changes.md) - Subscribe to database events
- [JavaScript SDK](./javascript-sdk.md) - Full SDK documentation
- [Security](./security.md) - Best practices and security model
