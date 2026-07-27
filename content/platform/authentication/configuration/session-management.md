---
title: "Session Management"
description: "Force users to re-authenticate based on activity or time."
---

Force users to re-authenticate based on activity or time.

## Inactivity Timeout

**Setting:** `inactivity_timeout`  
**Type:** Integer (seconds)  
**Default:** 0 (disabled)

Force re-login after period of no activity.

**Use cases:**
- Banking: 300 (5 minutes)
- Admin panels: 1800 (30 minutes)
- Social apps: 0 (never)

**How it works:**
```text
User signs in → last_activity: now
User refreshes token → last_activity: now (updated)
User inactive for N seconds → next refresh fails
User must sign in again
```

**Configuration:**
```json
{"inactivity_timeout": 1800}  // 30 minutes
```

## Max Session Duration

**Setting:** `max_session_duration`  
**Type:** Integer (seconds)  
**Default:** 0 (disabled)

Force re-login after total session time, regardless of activity.

**Use cases:**
- Compliance (must re-auth daily): 86400 (24 hours)
- Shift-based (8-hour workday): 28800
- No limit: 0

**How it works:**
```text
User signs in → session_started: now
User active, keeps refreshing
After N seconds total → refresh fails
User must sign in again
```

**Configuration:**
```json
{"max_session_duration": 86400}  // 24 hours max
```

## Combining Both

You can use both timeouts:

```json
{
  "inactivity_timeout": 1800,      // 30 min inactive = logout
  "max_session_duration": 28800    // 8 hours max = logout
}
```

User logs out if:
- Inactive for 30 minutes, OR
- Signed in for 8 hours total

## Configuration Example

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "inactivity_timeout": 900,
    "max_session_duration": 14400
  }'
```

## User Session Management

Users can view and manage their own sessions through the SDK or API. This allows users to:
- See all devices where they're logged in
- Sign out from specific devices
- Sign out from all other devices

### Get My Sessions (SDK)

```javascript
// Get first page of sessions (default: 20 per page)
const { sessions, total, page, total_pages, error } = await volcano.auth.getSessions();

// Get specific page with custom limit
const result = await volcano.auth.getSessions({ page: 2, limit: 10 });

if (!error) {
  console.log(`Page ${page} of ${total_pages} (${total} total sessions)`);
  sessions.forEach(session => {
    console.log(`${session.provider} - ${session.user_agent}`);
    console.log(`  IP: ${session.ip_address}`);
    console.log(`  Active: ${session.is_active}`);
    console.log(`  Current: ${session.is_current}`);
  });
}
```

### Get My Sessions (API)

```bash
# Get first page (default: 20 per page)
curl https://api.volcano.dev/auth/user/sessions \
  -H "Authorization: Bearer ACCESS_TOKEN"

# Get specific page with custom limit
curl "https://api.volcano.dev/auth/user/sessions?page=2&limit=10" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

**Query Parameters:**
- `page` - Page number (1-indexed, default: 1)
- `limit` - Sessions per page (1-100, default: 20)

Response:
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "provider": "email",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1",
      "last_ip_address": "10.0.0.50",
      "is_active": true,
      "is_current": true
    },
    {
      "id": "another-session",
      "provider": "google",
      "user_agent": "Mobile Safari...",
      "ip_address": "10.0.0.100",
      "is_active": true,
      "is_current": false
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "total_pages": 2
}
```

### Sign Out from Specific Device (SDK)

```javascript
const { error } = await volcano.auth.deleteSession('session-uuid');
```

### Sign Out from Specific Device (API)

```bash
curl -X DELETE https://api.volcano.dev/auth/user/sessions/SESSION_ID \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Sign Out from All Other Devices (SDK)

```javascript
const { error } = await volcano.auth.deleteAllOtherSessions();
// Current session remains active, all others are revoked
```

### Sign Out from All Other Devices (API)

```bash
curl -X DELETE https://api.volcano.dev/auth/user/sessions \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Admin Session Management

Platform administrators can view and manage user sessions through the API or GUI.

### List User Sessions

View paginated sessions for a specific user:

```bash
# Get first page (default: 20 per page)
curl https://api.volcano.dev/projects/PROJECT_ID/auth/users/USER_ID/sessions \
  -H "Authorization: Bearer TOKEN"

# Get specific page with custom limit
curl "https://api.volcano.dev/projects/PROJECT_ID/auth/users/USER_ID/sessions?page=2&limit=10" \
  -H "Authorization: Bearer TOKEN"
```

**Query Parameters:**
- `page` - Page number (1-indexed, default: 1)
- `limit` - Sessions per page (1-100, default: 20)

Response:
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "user_id": "user-uuid",
      "provider": "email",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1",
      "last_ip_address": "10.0.0.50",
      "expires_at": "2024-01-15T12:00:00Z",
      "last_activity_at": "2024-01-14T10:30:00Z",
      "session_started_at": "2024-01-14T08:00:00Z",
      "is_active": true
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "total_pages": 2
}
```

**Session Fields:**
- `provider` - Authentication method used: `email`, `google`, `github`, `facebook`, `apple`, `anonymous`
- `ip_address` - Client IP address when the session was created
- `last_ip_address` - Client IP address of the most recent activity (token refresh)
- `user_agent` - Browser/device information
- `is_active` - Whether session is still valid (not expired)

### Revoke Specific Session

Force logout from a single device:

```bash
curl -X DELETE https://api.volcano.dev/auth/users/USER_ID/sessions/SESSION_ID \
  -H "Authorization: Bearer TOKEN"
```

### Revoke All Sessions

Force logout from all devices (useful for security incidents):

```bash
curl -X DELETE https://api.volcano.dev/auth/users/USER_ID/sessions \
  -H "Authorization: Bearer TOKEN"
```

### GUI Access

In the Volcano dashboard:
1. Navigate to **Auth Users**
2. Click the phone icon next to any user
3. View active and expired sessions
4. Click the trash icon to revoke individual sessions
5. Use "Revoke All" to log out from everywhere

## See Also

- [Token Lifetimes](token-lifetimes.md)
- [Configuration Overview](overview.md)




