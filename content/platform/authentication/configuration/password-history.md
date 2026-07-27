---
title: "Password History"
description: "Prevent users from reusing recent passwords."
---

Prevent users from reusing recent passwords.

## Configuration

**Setting:** `max_password_history`  
**Type:** Integer  
**Default:** 0 (disabled)  
**Range:** 0-20

Controls how many previous passwords to remember and prevent reuse.

```json
{"max_password_history": 5}  // Remember last 5 passwords
```

## How It Works

When enabled, password changes are automatically stored in history:

```text
User signs up with Password1 → stored
User changes to Password2 → stored  
User changes to Password3 → stored
User tries Password1 → rejected (in last 3)
```

## Use Cases

**Compliance requirements (SOC 2, HIPAA):**
```json
{"max_password_history": 10}
```

**Balanced security:**
```json
{"max_password_history": 5}
```

**Disabled (default):**
```json
{"max_password_history": 0}
```

## User Experience

When a user tries to reuse a password:

```json
{
  "error": "password was used recently, cannot reuse last 5 passwords"
}
```

Clear message indicates how many passwords they need to avoid.

## Implementation

Password history is automatic:
- Stored via database triggers
- No application code changes needed
- Works with password updates and resets
- Old entries auto-cleaned when beyond limit

## Configuration

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{"max_password_history": 5}'
```

## See Also

- [Password Requirements](password-requirements.md)
- [Session Management](session-management.md)




