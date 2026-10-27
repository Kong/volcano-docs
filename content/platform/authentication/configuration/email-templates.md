---
title: 'Email Templates'
description: 'Customize email templates per project.'
---

Customize email templates per project.

## Overview

Volcano provides default email templates optimized for deliverability. You can override these with custom templates per project.

Default templates use your project name wherever `{{.ProjectName}}` appears,
including the message body and footer. Emails for your Volcano account use
`Volcano`.

## Default Templates

Read all built-in templates without authentication:

```bash
curl https://api.volcano.dev/email-templates/defaults
```

The response contains a `data` array. Each template has `type`, `subject`,
`html_body`, and `text_body`. Read one template with
`GET /email-templates/defaults/confirmation`; its response is the template object
without the `data` envelope. Built-in templates have no project or template ID.

### Confirmation Email

**When sent:** User signs up with email verification enabled

**Default subject:** "Confirm your email address"

The built-in template returned by `/email-templates/defaults/confirmation` uses
"Verify your email address". Signup and resend use the configured confirmation
subject, which defaults to "Confirm your email address".

**Contains:**

- Confirmation link with token
- Project name
- Security note

**Variables:**

- `{{.Email}}` - Recipient email
- `{{.ConfirmationURL}}` - Link with token
- `{{.ProjectName}}` - Your project name

### Password Reset Email

**When sent:** User requests password reset

**Default subject:** "Reset your password"

**Contains:**

- Reset link with token
- Expiration warning (1 hour)
- Security notes
- "Didn't request this?" message

**Variables:**

- `{{.Email}}` - Recipient email
- `{{.ResetURL}}` - Link with token
- `{{.ProjectName}}` - Your project name

### Password Changed Email

**When sent:** User successfully changes password

**Default subject:** "Your password was changed"

**Contains:**

- Confirmation of password change
- Security alert if unauthorized
- Contact info

**Variables:**

- `{{.Email}}` - Recipient email
- `{{.ProjectName}}` - Your project name

## Customizing Templates

### Custom Subject Lines

Update via configuration:

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "email_confirmation_subject": "Welcome to MyApp!",
    "email_password_reset_subject": "Reset your MyApp password",
    "email_password_changed_subject": "Security Alert: MyApp password changed"
  }'
```

### Custom Template Bodies

Every project starts with one row per template type, so overriding a template
(HTML + text) is an update:

```http
PUT /projects/{projectId}/email-templates/confirmation
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**

```json
{
  "subject": "Welcome to MyApp!",
  "html_body": "<!DOCTYPE html>...",
  "text_body": "Plain text version..."
}
```

Updating or deleting a template that does not exist returns `404` with
`{"error":"template not found"}`, including updates that change only a body.

Unexpected template failures return `500` with a fixed operation message, such as
`{"error":"failed to get email template"}`. Responses exclude internal diagnostics.

Responses for custom templates omit `subject`, `html_body`, and `text_body` when
the saved value is empty. Read each field as optional. Built-in template responses
always include all three fields.

If canceling an authentication request (for example, by disconnecting) prevents
Volcano from loading the project's saved template, Volcano does not send that
email. Signup confirmation and password reset emails can be requested again;
welcome and password-change notices cannot. Other lookup failures keep the
built-in fallback.

**Template types:**

- `confirmation` - Email confirmation
- `password_reset` - Password reset
- `password_changed` - Password change notification

## Template Variables

### Available Variables

All templates have access to:

| Variable               | Description         | Example                             |
| ---------------------- | ------------------- | ----------------------------------- |
| `{{.Email}}`           | Recipient email     | user@example.com                    |
| `{{.ProjectName}}`     | Project name        | My App                              |
| `{{.AppName}}`         | Application name    | My App                              |
| `{{.ConfirmationURL}}` | Confirmation link   | `https://app.com/confirm?token=abc` |
| `{{.ResetURL}}`        | Password reset link | `https://app.com/reset?token=xyz`   |

### Usage in Templates

```html
<h1>Welcome to {{.ProjectName}}!</h1>
<p>Hi {{.Email}},</p>
<p>Click here to confirm: <a href="{{.ConfirmationURL}}">Confirm Email</a></p>
```

Subject templates can use variables such as `{{.Name}}`, `{{.Email}}`, and
`{{.ProjectName}}`. Welcome emails use the saved welcome subject, or the built-in
welcome subject if it is unset or cannot render. Signup confirmation, password
reset, and password change emails use their auth-configuration subject, or the
send flow's built-in subject when unset. If a configured subject cannot render,
Volcano tries the saved subject, then the email type's built-in subject.
Email-change confirmation uses its built-in subject.

### Subject Headers

Keep rendered subject text on one line. Saving a new or changed email-template or auth-configuration subject with a literal interior line break after Go template whitespace trimming returns `400`; manifest apply reports `422`. Multiline template control flow with `{{-` and `-}}` trim markers, outer whitespace, and trailing newlines from YAML block scalars are allowed. Unicode is supported, and long subjects are folded to meet email header line limits without changing the text.

For previews and transactional emails, Volcano trims outer whitespace after rendering a subject that contains a line break. A remaining interior line break, including one introduced by a template variable, returns `400` for a test email or triggers the default transactional subject so confirmation and recovery links still arrive. Message bodies can contain line breaks.

Legacy subjects remain readable and export unchanged. Resubmitting the exact stored subject, including a full configuration save or export reapply, preserves it. Unrelated settings and template bodies remain editable. Changing the subject to another unsafe value is refused; replace it with one safe line using [auth configuration](#custom-subject-lines) or [template updates](#update-template). Delivery still uses the default subject when the rendered legacy value is unsafe.

## Deliverability Best Practices

### HTML Structure

**Do:**

- Use simple table-based layouts
- Inline CSS (no external stylesheets)
- Keep under 100KB total size
- Use web-safe fonts
- Include alt text for images

**Don't:**

- Complex JavaScript
- External resources
- Form elements
- Too many images

### Content

**Do:**

- Clear call-to-action
- Plain text alternative
- Unsubscribe info (for marketing)
- Proper headers
- Simple language

**Don't:**

- Spam trigger words (FREE!, BUY NOW!)
- All caps
- Excessive punctuation!!!
- Misleading subject lines

### Text Alternative

Always include plain text version:

```json
{
  "html_body": "<!DOCTYPE html>...",
  "text_body": "Plain text version without HTML tags..."
}
```

**Why:**

- Some clients show text-only
- Improves deliverability
- Accessibility
- Spam filter expects both

## Example Custom Template

### Minimalist Confirmation

**HTML:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>{{.ProjectName}}</h1>
    <p>Confirm your email address:</p>
    <p>
      <a
        href="{{.ConfirmationURL}}"
        style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 3px;"
      >
        Confirm Email
      </a>
    </p>
    <p style="color: #666; font-size: 12px;">If you didn't sign up, ignore this email.</p>
  </body>
</html>
```

**Text:**

```text
{{.ProjectName}}

Confirm your email address by visiting:
{{.ConfirmationURL}}

If you didn't sign up, ignore this email.
```

### Branded Template

**HTML:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body style="background: #f4f4f4; padding: 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">{{.ProjectName}}</h1>
      </div>
      <div style="padding: 30px;">
        <h2>Welcome!</h2>
        <p>Thanks for joining {{.ProjectName}}. Click below to confirm your email:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a
            href="{{.ConfirmationURL}}"
            style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;"
          >
            Confirm Email
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: <br />
          <span style="word-break: break-all;">{{.ConfirmationURL}}</span>
        </p>
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; color: #999; font-size: 12px;">
        © {{.ProjectName}} - Automated Email
      </div>
    </div>
  </body>
</html>
```

## Managing Templates

### Create Template

Only needed for a type the project has no row for — a project created with all
four types answers `409` here, so use the update below instead.

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/email-templates \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "template_type": "confirmation",
    "subject": "Welcome!",
    "html_body": "...",
    "text_body": "..."
  }'
```

### Update Template

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/email-templates/confirmation \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "subject": "Updated subject",
    "html_body": "..."
  }'
```

### Delete Template (Revert to Default)

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID/email-templates/confirmation \
  -H "Authorization: Bearer TOKEN"
```

### List Templates

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/email-templates \
  -H "Authorization: Bearer TOKEN"
```

## Testing Templates

### Preview Template

Before sending to users, test with your own email:

```bash
# 1. Create template
# 2. Sign up with your email
# 3. Check inbox
# 4. Verify rendering in multiple clients:
#    - Gmail (web + mobile)
#    - Outlook
#    - Apple Mail
#    - Mobile clients
```

### Template Validation

**Check:**

- All variables render correctly
- Links work
- Renders well on mobile
- Text version is readable
- No broken images
- Unsubscribe info (if applicable)

## Security

### Template Injection Prevention

**Templates use Go's html/template package:**

- Automatic HTML escaping
- XSS prevention
- No code execution

**Example:**

```text
Input: {{.ProjectName}} = "<script>alert(1)</script>"
Output: &lt;script&gt;alert(1)&lt;/script&gt;
```

**Result:** Safe - scripts are escaped

### Variable Validation

**All template variables are sourced from:**

- Database (project name)
- System (confirmation URL, reset URL)
- Never from user input directly

**Tokens are:**

- Cryptographically random
- Project-scoped
- One-time use
- Time-limited

## See Also

- [Email Verification](../email-verification.md)
- [SMTP Configuration](email-smtp.md)
- [Password Reset](../password-reset.md)
