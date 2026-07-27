---
title: "Email Verification"
description: "Require users to confirm their email addresses before signing in."
---

Require users to confirm their email addresses before signing in.

## Overview

Email verification adds a security layer by ensuring users own the email addresses they register with:

```text
1. User signs up → Receives confirmation email
2. User clicks link → Email confirmed
3. User can now sign in
```

**Use cases:**
- Prevent fake account creation
- Verify email ownership
- Enable password reset functionality
- Reduce spam and abuse
- Compliance requirements

## Configuration

### Enable Email Verification

```json
{
  "require_email_confirmation": true,
  "email_confirmation_timeout": 86400
}
```

**Settings:**
- `require_email_confirmation` - Enable/disable (default: false)
- `email_confirmation_timeout` - Token expiry in seconds (default: 86400 = 24 hours)
- `require_email_confirmation=true` requires `email_enabled=true`

### Configure Email Sending

Email verification requires SMTP configuration:

```json
{
  "email_enabled": true,
  "email_from_address": "noreply@myapp.com",
  "email_from_name": "My App",
  "smtp_host": "smtp.sendgrid.net",
  "smtp_port": 587,
  "smtp_username": "apikey",
  "smtp_password": "SG.your-api-key",
  "smtp_use_tls": true
}
```

If `require_email_confirmation` is enabled, API updates that set `email_enabled` to `false` are rejected until `require_email_confirmation` is disabled first.

**SMTP Providers:**
- **SendGrid:** smtp.sendgrid.net:587
- **AWS SES:** email-smtp.{region}.amazonaws.com:587
- **Mailgun:** smtp.mailgun.org:587
- **Gmail:** smtp.gmail.com:587 (requires app password)
- **Custom:** Any SMTP server

## Email Confirmation Flow

### 1. User Signs Up

```http
POST /auth/signup
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed": false
  }
}
```

**What happens:**
- User created with `email_confirmed: false`
- Confirmation token generated and stored
- Confirmation email sent to user

### 2. Confirmation Email Sent

**Email contains:**
- Confirmation link with token
- Link expires after configured timeout
- Clear call-to-action button

**Example link:**
```text
https://yourapp.com/confirm?token=abc123xyz789
```

### 3. User Confirms Email

```http
POST /auth/confirm
Authorization: Bearer <anon_key>
Content-Type: application/json
```

**Request:**
```json
{
  "token": "abc123xyz789"
}
```

**Response:**
```json
{
  "message": "Email confirmed successfully"
}
```

**Also possible:**
```json
{
  "message": "Email already confirmed"
}
```

**What happens:**
- Token validated (project-scoped + expiration checked)
- User marked as `email_confirmed: true`
- Token cleared (one-time use)

### 4. User Can Sign In

```http
POST /auth/signin
Authorization: Bearer <anon_key>
```

**Before confirmation:**
```json
{
  "error": "email confirmation required - please check your email for confirmation link"
}
```

**After confirmation:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "email_confirmed": true
  }
}
```

## Resend Confirmation

If user didn't receive the email:

```http
POST /auth/resend-confirmation
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
  "message": "If the email exists and is unconfirmed, a confirmation link has been sent"
}
```

**Security:**
- Generic response (doesn't reveal if email exists)
- Doesn't reveal if already confirmed
- Rate limited like signup
- If user exists and is unconfirmed, resend rotates token (old link becomes invalid)
- If user doesn't exist or is already confirmed, no email is sent

## Frontend Integration

```javascript
// Sign up
const { user, session } = await volcano.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

if (!user.email_confirmed) {
  showMessage('Please check your email for confirmation link');
}

// User clicks link from email → opens /confirm?token=abc123

// Confirm email
await volcano.auth.confirmEmail(urlParams.get('token'));
showMessage('Email confirmed! You can now sign in.');

// Sign in
const { user, session } = await volcano.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});
// ✓ Success - email is confirmed

// Resend confirmation (if needed)
await volcano.auth.resendConfirmation('user@example.com');
showMessage('Confirmation email resent');
```

## Email Customization

### Custom Subject Lines

```json
{
  "email_confirmation_subject": "Welcome! Confirm your email",
  "email_password_reset_subject": "Reset your password for MyApp",
  "email_password_changed_subject": "Security alert: Password changed"
}
```

### Custom Email Templates

Create custom templates per project (optional - overrides defaults):

```http
POST /projects/{projectId}/email-templates
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "template_type": "confirmation",
  "subject": "Welcome to MyApp!",
  "html_body": "...",
  "text_body": "..."
}
```

**Template variables:**
- `{{.Email}}` - User's email address
- `{{.ConfirmationURL}}` - Confirmation link with token
- `{{.ProjectName}}` - Your project name
- `{{.AppName}}` - Your app name

## Security

### Token Security

**Cryptographically secure:**
- Generated using crypto/rand
- 64 characters (32 bytes hex-encoded)
- One-time use (cleared after confirmation)
- Time-limited expiration

**Project-scoped:**
- Tokens only work within their project
- Cannot use Project A token in Project B

### Email Enumeration Prevention

**All responses are generic:**
- Resend confirmation: Same message whether email exists or not
- Already confirmed: Same message as not found
- Prevents attackers from discovering registered emails

### Rate Limiting

**Applies to:**
- Signup (includes confirmation email sending)
- Resend confirmation (uses signup rate limit)

## Configuration Examples

### SendGrid

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "email_enabled": true,
    "email_from_address": "noreply@myapp.com",
    "email_from_name": "My App",
    "smtp_host": "smtp.sendgrid.net",
    "smtp_port": 587,
    "smtp_username": "apikey",
    "smtp_password": "SG.your-sendgrid-api-key",
    "smtp_use_tls": true,
    "require_email_confirmation": true
  }'
```

### AWS SES

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "email_enabled": true,
    "email_from_address": "noreply@myapp.com",
    "smtp_host": "email-smtp.us-east-1.amazonaws.com",
    "smtp_port": 587,
    "smtp_username": "AKIAIOSFODNN7EXAMPLE",
    "smtp_password": "your-smtp-password",
    "smtp_use_tls": true,
    "require_email_confirmation": true
  }'
```

### Mailgun

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -d '{
    "email_enabled": true,
    "email_from_address": "noreply@mg.myapp.com",
    "smtp_host": "smtp.mailgun.org",
    "smtp_port": 587,
    "smtp_username": "postmaster@mg.myapp.com",
    "smtp_password": "your-mailgun-smtp-password",
    "smtp_use_tls": true,
    "require_email_confirmation": true
  }'
```

## Behavior

### When Email Verification Enabled

**Signup:**
- User created with `email_confirmed: false`
- Confirmation email sent automatically
- Returns access token (can use app but can't sign in again)

**Signin:**
- Blocked if email not confirmed
- Error: "email confirmation required"
- User must confirm email first

**Resend:**
- Generates new token
- Sends new email
- Previous token becomes invalid

### When Email Verification Disabled

**Signup:**
- User created with `email_confirmed: false` (or true, doesn't matter)
- No confirmation email sent
- Can sign in immediately

**Signin:**
- Works regardless of email_confirmed status
- No blocking

## Token Expiration

**Default:** 24 hours (86400 seconds)

**Configurable:**
```json
{"email_confirmation_timeout": 3600}  // 1 hour
{"email_confirmation_timeout": 604800}  // 7 days
```

**After expiration:**
- Token becomes invalid
- User must request new confirmation email
- Use resend-confirmation endpoint

## Troubleshooting

### Emails Not Sending

**Check configuration:**
```bash
# Get current config
curl https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN"

# Verify:
# - email_enabled: true
# - smtp_host, smtp_port set correctly
# - smtp_username, smtp_password are correct
# - email_from_address is valid
```

**Test SMTP connection:**
- Use `telnet smtp.host.com 587` to verify connectivity
- Check SMTP credentials with provider
- Verify from address is authorized (SPF/DKIM)

### Emails Going to Spam

**Improve deliverability:**
- Set up SPF records for your domain
- Configure DKIM signing
- Use verified sender address
- Keep email content simple (default templates optimized)
- Monitor bounce rates

### User Can't Find Email

**Common issues:**
- Email in spam folder
- Wrong email address entered
- Email service delay
- Token expired (user waited too long)

**Solution:**
- Use resend-confirmation endpoint
- Check spam folder
- Verify email address is correct

## See Also

- [SMTP Configuration](configuration/email-smtp.md)
- [Email Templates](configuration/email-templates.md)
- [Password Reset](password-reset.md)





