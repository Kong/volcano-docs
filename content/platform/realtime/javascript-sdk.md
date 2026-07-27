---
title: "JavaScript SDK"
description: "The Volcano Realtime JavaScript SDK: WebSocket connections with automatic reconnection, subscription management, and TypeScript support."
---

The Volcano Realtime JavaScript SDK provides a simple interface for WebSocket connections with automatic reconnection, subscription management, and TypeScript support.

## Installation

```bash
npm install @volcano.dev/sdk centrifuge
```

The SDK requires the `centrifuge` package as a peer dependency for WebSocket communication.

## Quick start

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

// Create a realtime instance
// Note: No projectId needed - it's in your anonKey
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',
  accessToken: 'user-access-token'
});

// Connect
await realtime.connect();

// Create a channel - just specify the name
const channel = realtime.channel('my-channel');

// Subscribe to events
channel.on('message', (payload) => {
  console.log('Received:', payload);
});

await channel.subscribe();

// Send a message
await channel.send({ event: 'message', text: 'Hello!' });
```

## Configuration

```typescript
interface RealtimeConfig {
  // Required
  apiUrl: string;           // Your Volcano API URL
  anonKey: string;          // Your project's anon key (or empty for service key)
  accessToken: string;      // User's access token or service key
  
  // Optional
  getToken?: () => Promise<string>;  // Function to refresh token
}
```

### Frontend (User Token)

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: anonKey,         // Required for user tokens
  accessToken: accessToken,
  getToken: async () => {
    // Called when token needs refresh
    const newToken = await refreshAccessToken();
    return newToken;
  }
});
```

### Backend (Service Key)

For server-side applications, use a service role key:

```javascript
// Service key only - project ID inferred from key
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: '',                   // Not required with service key
  accessToken: process.env.SERVICE_KEY  // sk-...
});

// With anon key for additional validation
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: process.env.ANON_KEY,
  accessToken: process.env.SERVICE_KEY
});
```

**Service key notes:**
- Project ID is extracted from the service key JWT
- If anon key is provided, project IDs must match
- Service keys bypass RLS for Postgres changes
- Never expose service keys in client-side code

### No project ID needed

Unlike some other SDKs, you never specify a `projectId`. The project is automatically determined from your anon key JWT:

```javascript
// ✅ Correct - project comes from anonKey
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',
  accessToken: accessToken
});

// ❌ Wrong - don't pass projectId
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  projectId: 'proj-123',  // Not needed!
  anonKey: 'your-anon-key',
  accessToken: accessToken
});
```

## Connection lifecycle

### Connect

```javascript
// Returns a promise that resolves when connected
await realtime.connect();
```

### Connection events

```javascript
realtime.onConnect((ctx) => {
  console.log('Connected to realtime server');
});

realtime.onDisconnect((ctx) => {
  console.log('Disconnected from realtime server');
});

realtime.onError((ctx) => {
  console.error('Realtime error:', ctx);
});
```

### Disconnect

```javascript
// Gracefully disconnect
realtime.disconnect();
```

### Check connection status

```javascript
if (realtime.isConnected()) {
  console.log('Connected');
}
```

## Channels

### Create a channel

```javascript
// Broadcast channel (default)
const channel = realtime.channel('channel-name');

// Presence channel
const presence = realtime.channel('lobby', { type: 'presence' });

// Postgres changes channel
const db = realtime.channel('public:messages', { type: 'postgres' });
```

### Channel naming

Just use simple, descriptive names. The SDK handles project namespacing automatically:

```javascript
// Good - simple names
const chat = realtime.channel('chat-room-123');
const notifications = realtime.channel('user-notifications');
const game = realtime.channel('game-session');

// The SDK sends: "broadcast:chat-room-123"
// Server prefixes: "proj-xxx:broadcast:chat-room-123"
```

### Subscribe

```javascript
// Subscribe and wait for confirmation
await channel.subscribe();
```

### Unsubscribe

```javascript
channel.unsubscribe();
```

### Remove all channels

```javascript
realtime.removeAllChannels();
```

## Broadcast events

### Listen

```javascript
// Listen for specific event types
channel.on('message', (payload) => {
  console.log('Message:', payload);
});

channel.on('typing', (payload) => {
  console.log('User is typing:', payload);
});

// Listen for all events
channel.on('*', (payload) => {
  console.log('Any event:', payload);
});
```

### Send

```javascript
// Send a message to all subscribers
await channel.send({ 
  event: 'message',
  text: 'Hello everyone!',
  userId: 'user-123'
});
```

## Presence events

### Track presence

```javascript
const presence = realtime.channel('lobby', { type: 'presence' });
await presence.subscribe();

// Start tracking your presence
presence.track({ 
  name: 'Alice',
  status: 'online' 
});
```

### Get presence state

```javascript
const state = presence.getPresenceState();
// Returns: { 'client-id': { name: 'Alice', status: 'online' }, ... }
```

### Listen for presence events

```javascript
// Full state sync
presence.onPresenceSync((state) => {
  console.log('All users:', state);
});

// User joined
presence.on('join', (info) => {
  console.log('User joined:', info);
});

// User left
presence.on('leave', (info) => {
  console.log('User left:', info);
});
```

## Postgres Changes events

### Listen for changes

```javascript
const db = realtime.channel('public:messages', { type: 'postgres' });

// Listen for specific operations
db.onPostgresChanges('INSERT', 'public', 'messages', (payload) => {
  console.log('New row:', payload.record);
});

db.onPostgresChanges('UPDATE', 'public', 'messages', (payload) => {
  console.log('Updated row:', payload.record);
  console.log('Old values:', payload.old_record);
});

db.onPostgresChanges('DELETE', 'public', 'messages', (payload) => {
  console.log('Deleted row ID:', payload.old_record?.id);
});

// Listen for all changes
db.onPostgresChanges('*', 'public', 'messages', (payload) => {
  console.log('Change type:', payload.type);
});

await db.subscribe();
```

### Row-Level Security

Database changes are filtered by RLS policies. Users only receive changes for rows they have access to:

```javascript
// If your RLS policy is: user_id = auth.uid()
// Users will only receive changes for their own rows
db.onPostgresChanges('*', 'public', 'notes', (payload) => {
  // Only changes to THIS user's notes
  console.log('My note changed:', payload.record);
});
```

## TypeScript support

```typescript
import { VolcanoRealtime, RealtimeChannel } from '@volcano.dev/sdk/realtime';

const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: anonKey,
  accessToken: accessToken
});

// Typed channel
const channel: RealtimeChannel = realtime.channel('chat');
```

## React integration

### Custom hook

```typescript
import { useEffect, useState, useCallback } from 'react';
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

export function useRealtime(apiUrl: string, anonKey: string, accessToken: string) {
  const [realtime, setRealtime] = useState<VolcanoRealtime | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const rt = new VolcanoRealtime({
      apiUrl,
      anonKey,
      accessToken
    });
    
    rt.onConnect(() => setIsConnected(true));
    rt.onDisconnect(() => setIsConnected(false));
    
    rt.connect();
    setRealtime(rt);

    return () => {
      rt.disconnect();
    };
  }, [apiUrl, anonKey, accessToken]);

  return { realtime, isConnected };
}
```

### Usage

```tsx
function ChatRoom({ roomId }) {
  const { realtime, isConnected } = useRealtime(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_ANON_KEY,
    accessToken
  );

  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!realtime || !isConnected) return;

    const channel = realtime.channel(`chat-${roomId}`);
    
    channel.on('message', (payload) => {
      setMessages(prev => [...prev, payload]);
    });
    
    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [realtime, isConnected, roomId]);

  const sendMessage = async (text) => {
    const channel = realtime?.channel(`chat-${roomId}`);
    await channel?.send({ event: 'message', text, userId: currentUser.id });
  };

  return (
    <div>
      {!isConnected && <div>Connecting...</div>}
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## Error handling

```javascript
try {
  await realtime.connect();
} catch (error) {
  console.error('Connection failed:', error);
}

// Handle errors via callback
realtime.onError((ctx) => {
  console.error('Realtime error:', ctx);
});
```

## Best practices

1. **Single instance**: Create one `VolcanoRealtime` instance per application
2. **Token refresh**: Use `getToken` callback for automatic token refresh
3. **Clean up**: Always unsubscribe from channels when components unmount
4. **Error handling**: Always handle connection errors
5. **Simple channel names**: Use descriptive names without project prefixes
