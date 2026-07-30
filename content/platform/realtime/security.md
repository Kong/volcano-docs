---
title: "Realtime Security"
description: "The Volcano Realtime security model: authentication flow, channel authorization, and best practices for securing realtime features."
---

Volcano Realtime is designed with security-first principles. This document covers the security model, authentication flow, and best practices for securing your realtime features.

## Authentication

Volcano Realtime supports multiple authentication modes:

### Mode 1: User Token + Anon Key (Frontend)

For frontend applications with authenticated users.

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',    // Required: identifies project
  accessToken: userToken        // Required: authenticates user
});
```

**Requirements:**
- Anon key: Contains project ID (safe to expose client-side)
- Access token: User's JWT from Volcano Auth (contains user ID, project ID)
- Session must be valid (not expired, not revoked)
- User must not be banned

### Mode 2: Service Role Key (Backend)

For backend services and server-to-server communication.

```javascript
// Service key only - project ID inferred from key
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: '',                   // Not required
  accessToken: 'sk-your-key'     // Service role key
});

// With anon key for extra validation
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',      // Optional: must match service key project
  accessToken: 'sk-your-key'
});
```

**Requirements:**
- Service key must exist in database (not deleted)
- If anon key is provided, project IDs must match
- Service key JWT project must match database record

**Security notes:**
- Service keys bypass RLS for Postgres changes
- Use only in trusted backend environments
- Never expose in client-side code

### Authentication Comparison

| Credential | User Token Mode | Service Key Mode |
|------------|-----------------|------------------|
| Anon Key | Required | Optional |
| Access Token | User JWT | Service Key |
| RLS Enforcement | Yes | Bypassed |
| Use Case | Frontend apps | Backend services |
| Session Check | Yes | No |
| Ban Check | Yes | No |

## Automatic project isolation

**You never need to specify a project ID.** The project is automatically determined from your anon key:

```javascript
// ✅ Correct - project derived from anonKey
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: anonKey,
  accessToken: accessToken
});

// Channel names are simple - no project prefix needed
const chat = realtime.channel('chat-room');
const presence = realtime.channel('lobby', { type: 'presence' });
const db = realtime.channel('public:messages', { type: 'postgres' });
```

The server:
1. Extracts project ID from the anon key JWT
2. Automatically prefixes all channels with the project ID
3. Enforces that users can only access their project's channels

### Cross-project attack prevention

Cross-project access is **impossible** by design:

1. Anon key contains the project ID
2. Server prefixes all channels with that project ID
3. Client cannot override or specify a different project

If a malicious client attempts any manipulation:
- Invalid anon key → connection rejected
- Forged project in channel name → server ignores it, uses anon key project

Security events are logged to server logs:

```text
[realtime] Connection accepted: user=user_12345 project=proj_abc123 role=anonymous
```

## Channel authorization

### Broadcast channels (default)

Any authenticated user in the project can join:

```javascript
const channel = realtime.channel('announcements');
```

### Presence channels

Any authenticated user can track and be tracked:

```javascript
const channel = realtime.channel('lobby', { type: 'presence' });
```

### Postgres changes channels

**Respect Row Level Security.** Users only receive events for rows they can SELECT:

```javascript
const channel = realtime.channel('public:messages', { type: 'postgres' });
// User will only receive events for rows they can access via RLS
```

The server:
1. Receives a database change notification
2. For each subscriber, executes an RLS check
3. Only forwards the event if the user can SELECT that row

## Banned users

Users banned via the Auth Admin API are automatically blocked:

1. On connection attempt, server checks if user is banned
2. Banned users receive an authentication error
3. If a user is banned while connected, their connection is terminated

### Session revocation

When a user's session is revoked:

1. Revocation is broadcast via Redis to all server instances
2. User's active connections are terminated within seconds
3. User must re-authenticate to reconnect

## Rate limiting

Realtime enforces rate limits to prevent abuse:

| Action | Limit |
|--------|-------|
| Concurrent connections | 200 (FREE), 100,000 (PRO) |
| Channels per connection | 100 (FREE), 500 (PRO) |
| Publishes per second | 10 per connection |
| Message size | 256 KB (FREE), 1 MB (PRO) |

When a rate limit is exceeded:
1. The action is rejected
2. An event is logged to server logs
3. Client receives an error response

## Plan limits

Limits vary by plan:

| Limit | FREE | PRO |
|-------|------|-----|
| Concurrent connections | 200 | 100,000 |
| Messages per month | 100,000 | Unlimited |
| Max message size | 256 KB | 1 MB |
| Channels per connection | 100 | 500 |

See [Plans and limits](../guides/plans-and-limits.md) for limits across all resources.

## Monitoring

All security events are logged to server logs for monitoring:

**Events logged**:
- ✅ `auth_success` - Successful authentication
- ❌ `auth_failure` - Failed authentication attempt
- 🚨 `cross_project_attempt` - Cross-project access blocked
- 🚫 `banned_user_attempt` - Banned user attempted to connect
- ⚠️ `rate_limited` - Rate limit exceeded
- 📡 `disconnect` - Client disconnected

View events in your server logs or use external monitoring tools.

## Input validation

All client inputs are validated before processing:

### Channel names

- Maximum length: 255 characters
- Only alphanumeric, hyphens, underscores, colons
- SQL injection patterns are blocked
- Path traversal attempts are blocked

### Message payloads

- Maximum size: Configurable by plan
- Validated JSON structure
- Binary data must be base64 encoded

### Presence data

- Maximum size: 1 KB
- Validated JSON structure

## Best practices

### 1. Never expose access tokens

```javascript
// ❌ DON'T: Hardcode tokens
const realtime = new VolcanoRealtime({
  accessToken: 'eyJhbGciOiJIUzI1NiI...'
});

// ✅ DO: Get token from auth flow
const { accessToken } = await volcano.auth.getSession();
const realtime = new VolcanoRealtime({
  anonKey,
  accessToken
});
```

### 2. Use token refresh callback

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey,
  accessToken,
  getToken: async () => {
    // Called when token needs refresh
    const session = await volcano.auth.refreshSession();
    return session.accessToken;
  }
});
```

### 3. Use RLS for Postgres changes

Always enable Row Level Security on tables with realtime:

```sql
-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages in their rooms
CREATE POLICY "room_messages" ON messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_members 
      WHERE user_id = auth.uid()
    )
  );
```

### 4. Validate presence data

Don't trust presence data from other users for authorization:

```javascript
channel.on('join', (info) => {
  // ❌ DON'T: Trust user-provided data for permissions
  if (info.isAdmin) { ... }

  // ✅ DO: Use server-validated data only
  const isAdmin = await checkAdminStatus(info.userId);
});
```

### 5. Sanitize broadcast data

```javascript
// ❌ DON'T: Broadcast raw user input
await channel.send({ event: 'message', text: userInput });

// ✅ DO: Sanitize and validate
const sanitizedText = sanitizeHtml(userInput);
if (sanitizedText.length > 0 && sanitizedText.length < 10000) {
  await channel.send({ event: 'message', text: sanitizedText });
}
```

## Security configuration

Configure security settings in **Realtime > Settings**:

| Setting | Description | Default |
|---------|-------------|---------|
| Max channels per connection | Limit channel subscriptions | 100 (FREE) / 200 (PRO) |
| Max message size | Maximum broadcast payload | 32 KB (FREE) / 256 KB (PRO) |

## Incident response

If you suspect a security issue:

1. **Check server logs** for unusual patterns
2. **Revoke sessions** for affected users
3. **Ban users** if malicious activity is confirmed
4. **Rotate keys** if anon key or service key may be compromised
5. **Contact support** for assistance with serious incidents

## Compliance

Volcano Realtime supports common compliance requirements:

- **Encryption in transit**: All WebSocket connections use TLS
- **Authentication required**: No anonymous connections
- **Server logging**: All security events are logged to server logs
- **Session management**: Sessions can be revoked instantly
- **Data isolation**: Projects are strictly isolated
- **RLS enforcement**: Postgres changes filtered by RLS
