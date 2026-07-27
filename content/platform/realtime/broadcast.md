---
title: "Broadcast Channels"
description: "Broadcast channels for pub/sub messaging between connected clients — chat rooms, live updates, and notifications."
---

Broadcast channels enable pub/sub messaging between connected clients. Use them for chat rooms, live updates, notifications, and any scenario where multiple clients need to receive the same messages.

## How it works

1. Clients subscribe to a named channel
2. Any client can broadcast messages to the channel
3. All subscribed clients receive the message

Messages are not persisted - they're delivered in real-time to connected subscribers only.

## Basic usage

### Subscribe to a channel

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',
  accessToken: accessToken
});

await realtime.connect();

// Create a channel - just use a simple name
const channel = realtime.channel('chat-room-42');

// Listen for messages
channel.on('message', (payload) => {
  console.log('Received:', payload);
});

// Subscribe to the channel
await channel.subscribe();
```

### Send a broadcast

```javascript
// Send a message to all subscribers
await channel.send({ 
  event: 'message',
  text: 'Hello everyone!',
  userId: 'user-123',
  timestamp: Date.now()
});
```

### Listen for specific events

You can use different event names to categorize messages:

```javascript
// Listen for different event types
channel.on('message', handleMessage);
channel.on('typing', handleTyping);
channel.on('reaction', handleReaction);

await channel.subscribe();

// Send different types
await channel.send({ event: 'message', text: 'Hi!' });
await channel.send({ event: 'typing', userId: 'user-123', isTyping: true });
await channel.send({ event: 'reaction', messageId: 'msg-1', emoji: '👍' });
```

## Channel naming

Channel names are simple strings. Use descriptive, consistent naming:

```javascript
// Good patterns - simple and descriptive
'chat-room-123'           // Chat room by ID
'notifications'           // User notifications
'game-match-789'          // Game session
'product-updates'         // Product updates

// Channel names are case-sensitive
'Chat-Room' !== 'chat-room'
```

**Note**: You don't need to include project IDs in channel names. Project isolation is automatic based on your anon key.
Channel names can be up to 64 characters.

## Unsubscribe

```javascript
// Unsubscribe from the channel
channel.unsubscribe();
```

## Example: Chat room

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

class ChatRoom {
  constructor(roomId, userId, anonKey, accessToken) {
    this.roomId = roomId;
    this.userId = userId;
    this.realtime = new VolcanoRealtime({
      apiUrl: 'https://api.yourapp.com',
      anonKey: anonKey,
      accessToken: accessToken
    });
    this.channel = null;
    this.onMessage = () => {};
    this.onTyping = () => {};
  }

  async connect() {
    await this.realtime.connect();
    
    // Simple channel name - no project prefix needed
    this.channel = this.realtime.channel(`chat-${this.roomId}`);
    
    this.channel.on('message', (payload) => {
      this.onMessage(payload);
    });
    
    this.channel.on('typing', (payload) => {
      if (payload.userId !== this.userId) {
        this.onTyping(payload);
      }
    });
    
    await this.channel.subscribe();
  }

  async sendMessage(text) {
    await this.channel.send({
      event: 'message',
      userId: this.userId,
      text,
      timestamp: Date.now()
    });
  }

  async sendTyping(isTyping) {
    await this.channel.send({
      event: 'typing',
      userId: this.userId,
      isTyping
    });
  }

  disconnect() {
    this.channel?.unsubscribe();
    this.realtime.disconnect();
  }
}

// Usage
const chat = new ChatRoom('room-123', 'user-456', anonKey, accessToken);
chat.onMessage = (msg) => console.log(`${msg.userId}: ${msg.text}`);
chat.onTyping = (info) => console.log(`${info.userId} is typing...`);

await chat.connect();
await chat.sendMessage('Hello!');
```

## Project isolation

Channels are automatically isolated by project. Two different projects can have channels with the same name without conflict:

```javascript
// Project A
const realtimeA = new VolcanoRealtime({ anonKey: projectAKey, ... });
const channelA = realtimeA.channel('chat');  // Only Project A users

// Project B
const realtimeB = new VolcanoRealtime({ anonKey: projectBKey, ... });
const channelB = realtimeB.channel('chat');  // Only Project B users

// channelA and channelB are completely isolated
```

## Limits

| Limit | Free Plan | Pro Plan |
|-------|-----------|----------|
| Max message size | 256 KB | 1 MB |
| Max channels per connection | 100 | 500 |
| Messages per month | 100,000 | Unlimited |
| Concurrent connections | 200 | 100,000 |

## Best practices

1. **Use specific event names**: Instead of generic 'message', use descriptive events like 'chat-message', 'typing', 'reaction'

2. **Keep payloads small**: Send only necessary data. For large data, store it in the database and broadcast a reference

3. **Handle reconnection**: The SDK handles reconnection automatically, but you may want to re-fetch missed messages from your database

4. **Unsubscribe when done**: Always unsubscribe from channels when leaving a page or component

5. **Rate limit broadcasts**: Don't flood channels with messages. For typing indicators, debounce to every 500ms-1s
