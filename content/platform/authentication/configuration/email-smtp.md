---
title: "Email SMTP Configuration"
description: "Configure SMTP for sending transactional emails (confirmations, password resets, notifications)."
---

Configure SMTP for sending transactional emails (confirmations, password resets, notifications).

## Overview

Volcano uses SMTP (Simple Mail Transfer Protocol) to send emails. This works with all major email providers including SendGrid, AWS SES, Mailgun, and any custom SMTP server.

## Required Settings

```json
{
  "email_enabled": true,
  "email_from_address": "noreply@myapp.com",
  "smtp_host": "smtp.provider.com",
  "smtp_port": 587,
  "smtp_username": "your-username",
  "smtp_password": "your-password",
  "smtp_use_tls": true
}
```

### email_enabled

**Type:** Boolean  
**Default:** false  
**Required:** Yes (to send emails)

Enables email sending. Must be true for confirmation emails, password reset emails, and notifications to be sent.
When `require_email_confirmation` is enabled, this setting cannot be turned off until email confirmation is disabled.

### email_from_address

**Type:** String  
**Default:** null  
**Required:** Yes (when email_enabled = true)

The sender email address. Must be a valid email address.

**Examples:**
- `noreply@myapp.com`
- `hello@myapp.com`
- `notifications@myapp.com`

**Important:**
- Must be authorized by your email provider
- Should match your domain's SPF/DKIM records
- Use noreply@ for automated emails

### email_from_name

**Type:** String  
**Default:** null  
**Optional**

Display name shown to recipients.

**Examples:**
- `My App`
- `My App Support`
- `My Company`

**Result:**
```text
From: My App <noreply@myapp.com>
```

### smtp_host

**Type:** String  
**Default:** null  
**Required:** Yes

SMTP server hostname.

**Common providers:**
- SendGrid: `smtp.sendgrid.net`
- AWS SES: `email-smtp.{region}.amazonaws.com`
- Mailgun: `smtp.mailgun.org`
- Gmail: `smtp.gmail.com`

### smtp_port

**Type:** Integer  
**Default:** 587  
**Required:** Yes

SMTP server port.

**Common ports:**
- `587` - STARTTLS (recommended)
- `465` - SSL/TLS
- `25` - Unencrypted (not recommended)

**Recommendation:** Use 587 with TLS enabled.

### smtp_username

**Type:** String  
**Default:** null  
**Required:** Yes

SMTP authentication username.

**Provider-specific:**
- SendGrid: `apikey` (literal string)
- AWS SES: Your IAM SMTP username
- Mailgun: Your SMTP username
- Gmail: Your email address

### smtp_password

**Type:** String  
**Default:** null  
**Required:** Yes  
**Sensitive:** Yes

SMTP authentication password or API key.

**Provider-specific:**
- SendGrid: Your API key (starts with `SG.`)
- AWS SES: Your IAM SMTP password
- Mailgun: Your SMTP password
- Gmail: App-specific password (not your account password)

**Security:**
- Never commit to version control
- Use environment variables or secrets management
- Rotate regularly
- Stored encrypted at rest (AES-256-GCM) and decrypted in-process only when sending or testing email
- Never returned by the config API. Responses expose only `smtp_password_configured`; send a non-empty `smtp_password` in an update to replace it, or omit the field to preserve the configured value

### smtp_use_tls

**Type:** Boolean  
**Default:** true  
**Recommended:** true

Use STARTTLS for encrypted connection.

**When true:** Connection upgraded to TLS after initial handshake (port 587)  
**When false:** Unencrypted connection (not recommended for production)

## Provider Setup Guides

### SendGrid

**1. Create API Key:**
- Go to https://app.sendgrid.com/settings/api_keys
- Create key with "Mail Send" permission
- Copy API key (starts with `SG.`)

**2. Verify Sender:**
- Go to Settings → Sender Authentication
- Verify your domain or single sender
- Use verified address as `email_from_address`

**3. Configuration:**
```json
{
  "email_enabled": true,
  "email_from_address": "noreply@yourdomain.com",
  "email_from_name": "Your App",
  "smtp_host": "smtp.sendgrid.net",
  "smtp_port": 587,
  "smtp_username": "apikey",
  "smtp_password": "SG.your-actual-api-key-here",
  "smtp_use_tls": true
}
```

### AWS SES

**1. Verify Email/Domain:**
```bash
aws ses verify-email-identity --email-address noreply@yourdomain.com
# Or verify entire domain for any address
aws ses verify-domain-identity --domain yourdomain.com
```

**2. Create SMTP Credentials:**
- Go to SES Console → SMTP Settings
- Click "Create My SMTP Credentials"
- Save username and password

**3. Configuration:**
```json
{
  "email_enabled": true,
  "email_from_address": "noreply@yourdomain.com",
  "smtp_host": "email-smtp.us-east-1.amazonaws.com",
  "smtp_port": 587,
  "smtp_username": "AKIAIOSFODNN7EXAMPLE",
  "smtp_password": "your-smtp-password",
  "smtp_use_tls": true
}
```

**Regions:**
- us-east-1: `email-smtp.us-east-1.amazonaws.com`
- us-west-2: `email-smtp.us-west-2.amazonaws.com`
- eu-west-1: `email-smtp.eu-west-1.amazonaws.com`

### Mailgun

**1. Get SMTP Credentials:**
- Go to Dashboard → Sending → Domain Settings
- Find SMTP credentials section
- Copy hostname, username, password

**2. Configuration:**
```json
{
  "email_enabled": true,
  "email_from_address": "noreply@mg.yourdomain.com",
  "smtp_host": "smtp.mailgun.org",
  "smtp_port": 587,
  "smtp_username": "postmaster@mg.yourdomain.com",
  "smtp_password": "your-mailgun-smtp-password",
  "smtp_use_tls": true
}
```

### Gmail (Development Only)

**1. Enable 2FA and Create App Password:**
- Go to Google Account → Security
- Enable 2-Step Verification
- Create App Password for "Mail"

**2. Configuration:**
```json
{
  "email_enabled": true,
  "email_from_address": "youraccount@gmail.com",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_username": "youraccount@gmail.com",
  "smtp_password": "your-16-character-app-password",
  "smtp_use_tls": true
}
```

**Note:** Gmail has sending limits (500/day for free accounts). Use only for development.

## Testing SMTP Configuration

### Test Connection

After configuring SMTP, test the connection:

```bash
# Send test email using nc/telnet
echo "QUIT" | nc smtp.sendgrid.net 587
# Should connect successfully
```

### Send Test Email

The fastest way to verify your SMTP settings is the dedicated test-email
endpoint, which sends a diagnostic message using your project's **saved**
config — no need to create a user or trigger a signup flow.

**Dashboard:** in **Auth Settings → Email**, after enabling email and entering
your SMTP settings, **save your changes**, then use **Send a test email**: enter
a recipient and click *Send test email*. (The button is disabled while there are
unsaved changes, because the test uses the persisted configuration.)

**API:**

```bash
# 1. Save your SMTP config (must include email_enabled=true and smtp_host)
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{...smtp config...}'

# 2. Send a diagnostic test email using the saved config
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/auth/config/test-email \
  -H "Authorization: Bearer TOKEN" \
  -d '{"to_email":"you@yourdomain.com"}'
# 200 {"success":true} on delivery; 400 if email_enabled/smtp_host unset;
# 502 if SMTP delivery fails (see the error message for the SMTP-level reason)
```

The endpoint uses the project's stored credentials, so save before testing.
Supplying `html_body`/`text_body` (with an optional `subject`) instead renders a
custom message — that override path backs the template editor's "Send Test"
preview. See the `testEmailConfig` operation in the API reference for details.

## Troubleshooting

### Connection Refused

**Symptoms:**
- Error: "failed to connect to SMTP server"

**Solutions:**
- Verify `smtp_host` and `smtp_port` are correct
- Check firewall allows outbound connections on SMTP port
- Verify provider's SMTP service is enabled

### Authentication Failed

**Symptoms:**
- Error: "SMTP authentication failed"

**Solutions:**
- Verify `smtp_username` and `smtp_password` are correct
- For SendGrid: ensure password starts with `SG.`
- For AWS SES: use SMTP credentials (not IAM credentials)
- For Gmail: use app password (not account password)

### TLS/SSL Errors

**Symptoms:**
- Error: "failed to start TLS"

**Solutions:**
- Verify `smtp_use_tls` matches port (587 = TLS, 465 = SSL)
- Check provider supports TLS on the port
- Try `smtp_use_tls: false` for port 25 (not recommended)

### Emails Not Delivered

**Symptoms:**
- No errors but emails don't arrive

**Solutions:**
- Check spam folder
- Verify sender address is authorized (SPF/DKIM)
- Check provider's sending quotas/limits
- Review provider's delivery logs
- Verify recipient address is valid

### Emails Marked as Spam

**Solutions:**
- Set up SPF record for your domain
- Configure DKIM signing
- Use verified sender domain
- Avoid spam trigger words
- Use plain templates (defaults are optimized)
- Maintain low bounce rate

## Security Best Practices

### Protect SMTP Credentials

| Avoid | Do instead |
|-------|------------|
| Commit passwords to git | Use environment variables |
| Expose in client-side code | Use secrets management (AWS Secrets Manager, etc.) |
| Log passwords | Rotate credentials regularly |
| Share between projects | Use separate credentials per environment |

### Use Dedicated Sending Domain

**Recommended:**
```text
Production: noreply@myapp.com
Staging: noreply@staging.myapp.com
Development: noreply@dev.myapp.com
```

**Benefits:**
- Separate reputation per environment
- Easy to identify source
- Easier troubleshooting

### Monitor Sending

**Track:**
- Emails sent per hour/day
- Bounce rates
- Spam complaint rates
- Delivery rates

**Alert on:**
- High bounce rate (>5%)
- Authentication failures
- Unusual sending volume

## See Also

- [Email Verification](../email-verification.md)
- [Email Templates](email-templates.md)
- [Password Reset](../password-reset.md)




