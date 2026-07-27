---
title: "Presence"
description: "Presence channels let you track which users are online in real-time. Perfect for showing online indicators, collaborative features, and live user lists."
---

Presence channels let you track which users are online in real-time. Perfect for showing online indicators, collaborative features, and live user lists.

## How it works

1. Clients subscribe to a presence channel
2. User metadata (like `display_name`) from signup is automatically included in presence
3. All subscribers receive join, leave, and sync events
4. When a client disconnects, they're automatically removed

## Basic usage

### Track online users

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

// 1. Sign up with metadata
const volcano = new VolcanoAuth({ apiUrl, anonKey });
const { session } = await volcano.auth.signUpAnonymous({
  display_name: 'Alice',  // This will appear in presence events
  avatar_url: 'https://example.com/alice.jpg'
});

// 2. Connect to realtime
const realtime = new VolcanoRealtime({
  apiUrl,
  anonKey,
  accessToken: session.access_token
});

await realtime.connect();

// 3. Subscribe to presence channel
const channel = realtime.channel('lobby', { type: 'presence' });

// Listen for users joining
channel.on('join', (info) => {
  const username = info.connInfo?.user_metadata?.display_name || 'Anonymous';
  console.log('User joined:', username);
});

// Listen for users leaving
channel.on('leave', (info) => {
  console.log('User left');
});

// Listen for presence state updates
channel.on('presence_sync', () => {
  const state = channel.getPresenceState();
  const users = Object.values(state).map(info => ({
    id: info.client,
    name: info.connInfo?.user_metadata?.display_name || 'Anonymous',
    email: info.connInfo?.email
  }));
  console.log('Online users:', users);
});

await channel.subscribe();

// Note: track() is called automatically - presence comes from user metadata
await channel.track();
```

### Get current presence state

```javascript
// Get all users in the channel
const state = channel.getPresenceState();

// Returns an object like:
// {
//   'client-123': { 
//     user: 'user-id-1',
//     client: 'client-123',
//     connInfo: {
//       user_id: 'user-id-1',
//       email: 'alice@example.com',
//       user_metadata: {
//         display_name: 'Alice',
//         avatar_url: 'https://...'
//       }
//     }
//   }
// }

// Extract user list
const users = Object.values(state).map(info => ({
  id: info.client,
  name: info.connInfo?.user_metadata?.display_name,
  email: info.connInfo?.email
}));

console.log(`${users.length} users online`);
```

## User Metadata in Presence

Presence information comes from **user metadata set during signup**:

```javascript
// Anonymous signup with metadata
const { session } = await volcano.auth.signUpAnonymous({
  display_name: 'Alice',
  avatar_url: 'https://example.com/alice.jpg',
  status: 'online'
});

// This metadata is automatically included in presence events
// Other users will see it in connInfo.user_metadata
```

## Example: Online users list with names

```javascript
function OnlineUsers({ roomId, anonKey, accessToken }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const realtime = new VolcanoRealtime({ apiUrl, anonKey, accessToken });

    async function setup() {
      await realtime.connect();
      
      const channel = realtime.channel(`room-${roomId}`, { type: 'presence' });
      
      // Update user list on any presence change
      channel.on('presence_sync', () => {
        const state = channel.getPresenceState();
        const userList = Object.values(state).map(info => ({
          id: info.client,
          name: info.connInfo?.user_metadata?.display_name || 'Anonymous',
          avatar: info.connInfo?.user_metadata?.avatar_url
        }));
        setUsers(userList);
      });
      
      await channel.subscribe();
      await channel.track(); // Automatic - uses metadata from signup
    }
    
    setup();
    
    return () => realtime.disconnect();
  }, [roomId]);

  return (
    <div className="online-users">
      <h3>Online ({users.length})</h3>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.avatar && <img src={user.avatar} alt={user.name} />}
            <span>{user.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Example: Typing indicator

```javascript
// For typing indicators, use broadcast messages instead of presence
// Presence is best for "who's here", broadcast for "what they're doing"

const chatChannel = realtime.channel('chat-room');

chatChannel.on('message', (msg) => {
  if (msg.type === 'typing') {
    console.log(`${msg.username} is typing...`);
  }
});

// User starts typing
await chatChannel.send({
  type: 'typing',
  username: currentUser.name,
  isTyping: true
});

// User stops typing
await chatChannel.send({
  type: 'typing',
  username: currentUser.name,
  isTyping: false
});
```

## Channel naming

Use simple, descriptive names - project isolation is automatic:

```javascript
// Good - simple and descriptive
const lobby = realtime.channel('lobby', { type: 'presence' });
const room = realtime.channel('room-123', { type: 'presence' });
const dashboard = realtime.channel('dashboard-view', { type: 'presence' });
```

Presence channel names can be up to 64 characters.

## What's included in presence

**Automatic fields** (from server):
- `client` - Unique client connection ID
- `user` - User ID from authentication
- `connInfo.user_id` - User ID
- `connInfo.email` - User email
- `connInfo.user_metadata` - Custom data from signup (display_name, avatar_url, etc.)

**Note**: Email and user_id are always included. Set user metadata during signup to customize what appears in presence.

## Plan limits

Presence limits are based on your project plan:

| Limit | FREE | PRO |
|-------|------|-----|
| Max channels per connection | 100 | 200 |
| Max presences per channel | 10,000 | 10,000 |
| Message size (for broadcast) | Plan-based | Plan-based |

## Best practices

1. **Set user metadata during signup**: Include `display_name`, `avatar_url`, etc.

   ```javascript
   await volcano.auth.signUpAnonymous({
     display_name: 'Alice',
     avatar_url: 'https://example.com/alice.jpg'
   });
   ```

2. **Use appropriate channels**: Create separate presence channels for different contexts

3. **Handle multiple connections**: Users might have multiple tabs/devices - use `client` ID to differentiate

4. **Clean up on unmount**: Always unsubscribe when components unmount

5. **Use broadcast for actions**: Presence = "who's here", Broadcast = "what they're doing"

## See also

- [Broadcast Channels](./broadcast.md) - For chat messages and actions
- [JavaScript SDK](./javascript-sdk.md) - SDK reference
- [Security](./security.md) - Authentication and isolation
