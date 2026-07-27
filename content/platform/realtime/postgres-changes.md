---
title: "Postgres Changes"
description: "Subscribe to real-time notifications when database rows are inserted, updated, or deleted."
---

Subscribe to real-time notifications when database rows are inserted, updated, or deleted. Changes are filtered through Row Level Security (RLS) policies, ensuring users only receive events for data they're authorized to see.

## How it works

1. When a user subscribes, Volcano lazily installs triggers on the table
2. When data changes, Postgres sends a notification via LISTEN/NOTIFY
3. The realtime server evaluates RLS policies for each subscriber
4. Authorized subscribers receive the change event via WebSocket

Triggers are created on-demand the first time a user subscribes to a table, not when the database is provisioned.

## Basic usage

### Subscribe to all changes on a table

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',
  accessToken: accessToken
});

await realtime.connect();

// Channel name is schema:table for postgres type
const channel = realtime.channel('public:messages', { type: 'postgres' });

// Listen for all changes
channel.onPostgresChanges('*', 'public', 'messages', (payload) => {
  console.log('Change type:', payload.type);
  console.log('New data:', payload.record);
  console.log('Old data:', payload.old_record);
});

await channel.subscribe();
```

### Subscribe to specific events

```javascript
// Only INSERTs
channel.onPostgresChanges('INSERT', 'public', 'messages', (payload) => {
  console.log('New message:', payload.record);
});

// Only UPDATEs
channel.onPostgresChanges('UPDATE', 'public', 'messages', (payload) => {
  console.log('Updated:', payload.record);
  console.log('Previous:', payload.old_record);
});

// Only DELETEs
channel.onPostgresChanges('DELETE', 'public', 'messages', (payload) => {
  console.log('Deleted:', payload.old_record);
});

await channel.subscribe();
```

## Payload structure

```typescript
interface PostgresChangePayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  record: Record<string, any> | null;      // New row data (null for DELETE)
  old_record: Record<string, any> | null;  // Old row data (null for INSERT)
  timestamp: string;
}
```

### INSERT payload

```javascript
{
  type: 'INSERT',
  schema: 'public',
  table: 'messages',
  record: { id: 1, text: 'Hello', user_id: 'user-123' },
  old_record: null,
  timestamp: '2024-01-15T10:30:00Z'
}
```

### UPDATE payload

```javascript
{
  type: 'UPDATE',
  schema: 'public',
  table: 'messages',
  record: { id: 1, text: 'Hello (edited)', user_id: 'user-123' },
  old_record: { id: 1, text: 'Hello', user_id: 'user-123' },
  timestamp: '2024-01-15T10:31:00Z'
}
```

### DELETE payload

```javascript
{
  type: 'DELETE',
  schema: 'public',
  table: 'messages',
  record: null,
  old_record: { id: 1, text: 'Hello (edited)', user_id: 'user-123' },
  timestamp: '2024-01-15T10:32:00Z'
}
```

## Row Level Security

**Postgres changes respect RLS policies.** If a user can't SELECT a row, they won't receive change events for it. This is a critical security feature.

### Example: User-scoped messages

```sql
-- Table with user_id column
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  room_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policy: users can only see their own messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages" ON messages
  FOR SELECT USING (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
```

With this policy:
- User A inserts a message → Only User A receives the INSERT event
- User B won't see User A's messages in realtime

### Example: Room-based access

```sql
-- Users can see messages in rooms they belong to
CREATE POLICY "room_members" ON messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_members 
      WHERE user_id = current_setting('request.jwt.claim.sub', true)::uuid
    )
  );
```

## Channel naming

For postgres channels, the name is `schema:table`:

```javascript
// Public schema, messages table
const channel = realtime.channel('public:messages', { type: 'postgres' });

// Custom schema
const channel = realtime.channel('app:orders', { type: 'postgres' });
```

For realtime validation, the `schema:table` channel name must be 64 characters or fewer.

Project isolation is automatic from your anon key - you never specify project ID.

## Example: Live notifications

```javascript
function NotificationFeed({ anonKey, accessToken }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const realtime = new VolcanoRealtime({
      apiUrl: 'https://api.yourapp.com',
      anonKey,
      accessToken
    });

    async function setup() {
      await realtime.connect();
      
      const channel = realtime.channel('public:notifications', { type: 'postgres' });
      
      channel.onPostgresChanges('INSERT', 'public', 'notifications', (payload) => {
        setNotifications(prev => [payload.record, ...prev]);
        
        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification(payload.record.title, {
            body: payload.record.message
          });
        }
      });
      
      await channel.subscribe();
    }
    
    setup();
    
    return () => realtime.disconnect();
  }, [anonKey, accessToken]);

  return (
    <div className="notifications">
      {notifications.map(n => (
        <div key={n.id} className="notification">
          <h4>{n.title}</h4>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}
```

## Lazy trigger installation

Triggers are installed lazily when users subscribe, not when databases are provisioned:

1. **Database provisioning**: Creates database, sets up roles - no realtime triggers
2. **First subscription**: When a user subscribes to `public:messages`, triggers are created
3. **Subsequent subscriptions**: Trigger already exists, just starts listening

This means:
- Faster database provisioning
- No overhead for tables without realtime
- Triggers are created with appropriate permissions

## Limitations

| Limitation | Description |
|------------|-------------|
| RLS required | Tables must have RLS enabled for secure filtering |
| No JOIN data | Only the changed row is sent, not related data |
| Primary key required | Tables must have a primary key |
| Large payloads | Avoid storing large data in realtime columns |

## Performance considerations

1. **Index your filter columns**: If filtering by `room_id`, ensure it's indexed

2. **Avoid high-frequency tables**: Tables with thousands of writes/second may cause performance issues

3. **Use specific filters**: The RLS check happens for each subscriber, so fewer subscribers = faster

4. **Consider batching**: For bulk operations, updates are sent individually

## Best practices

1. **Always use RLS**: Never rely on client-side filtering for security

2. **Handle reconnection**: Re-fetch data after reconnecting to catch missed events

3. **Optimistic updates**: Update UI immediately on user action, then reconcile with realtime events

4. **Debounce saves**: For frequently-updated data, debounce saves to reduce database load

5. **Use appropriate schemas**: Keep realtime tables in a dedicated schema for organization
