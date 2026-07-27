---
title: "Password Reset"
description: "Allow users to reset forgotten passwords."
---

Allow users to reset forgotten passwords.

## How It Works

```text
1. User requests reset → recovery token generated
2. Recovery token stored in database
3. User resets password with token
4. Password updated, token cleared, sessions revoked
```

**Note:** Email sending requires integration with email service (SendGrid, AWS SES, or SMTP). Token generation and validation are implemented.

## Request Password Reset

```http
POST /auth/forgot-password
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

Response is always the same (prevents email enumeration).

## Reset Password

```http
POST /auth/reset-password
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "token": "recovery-token-from-email",
  "new_password": "NewPassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successful. Please sign in with your new password."
}
```

All existing sessions are revoked for security.

## Token Expiration

Recovery tokens expire after configured timeout (default: 1 hour).

**Configuration:**
```json
{"password_reset_timeout": 3600}  // 1 hour in seconds
```

## Disabling Password Reset

```json
{"allow_password_reset": false}
```

When disabled, forgot-password endpoint returns 403.

## Security

**Email enumeration prevented:**
- Same response whether email exists or not
- Generic success message

**Token security:**
- Random, cryptographically secure
- One-time use (cleared after successful reset)
- Time-limited expiration
- Project-scoped (cannot use across projects)

**Session revocation:**
- All sessions invalidated on reset
- User must sign in again everywhere

**Password validation:**
- New password must meet requirements
- Cannot reuse recent passwords (if history enabled)

## Frontend Integration

```javascript
// Request reset
await fetch('/auth/forgot-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

// User receives email (when email service configured)
// User clicks link with token

// Reset password
await fetch('/auth/reset-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: tokenFromUrl,
    new_password: 'NewPassword123'
  })
});

// User can now sign in with new password
```

## Email Service Integration

To send actual reset emails, integrate an email service:

**SendGrid:**
```go
// internal/email/sendgrid.go
func SendPasswordResetEmail(to, token string) {
    link := fmt.Sprintf("https://yourapp.com/reset?token=%s", token)
    // Send email with link
}
```

**AWS SES, SMTP:** Similar implementation

Then uncomment the email sending line in `AuthForgotPassword` handler.

## Configuration

```bash
# Enable password reset (default)
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -d '{"allow_password_reset": true, "password_reset_timeout": 3600}'

# Disable password reset
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -d '{"allow_password_reset": false}'
```

## See Also

- [Configuration Overview](configuration/overview.md)




