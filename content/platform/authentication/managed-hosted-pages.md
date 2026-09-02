---
title: "Managed Hosted Auth Pages"
description: "Managed hosted auth pages let you serve customizable authentication pages directly from Volcano for each project."
---

Managed hosted auth pages let you serve customizable authentication pages directly from Volcano for each project.

## Configuration

Use `PUT /projects/{projectId}/auth/config` to control managed pages:

- `managed_auth_enabled`: enables public render endpoints
- `allowed_redirect_urls`: strict allowlist for post-auth and logout redirects
- `post_auth_redirect_url`: must be present in `allowed_redirect_urls`
- `post_logout_redirect_url`: must be present in `allowed_redirect_urls`

## Page types and URLs

Six page types can store appearance and legacy HTML/CSS independently:

- `PUT /projects/{projectId}/auth/hosted-pages/{pageType}` updates HTML/CSS
- `GET /projects/{projectId}/auth/hosted-pages/{pageType}` returns the current saved content
- Supported `pageType`: `login`, `signup`, `forgot-password`, `device`, `verify-email`, `reset-password`

## Public Rendering

Hosted pages are served from:

- `GET /projects/{projectId}/auth/hosted` (sign in)
- `GET /projects/{projectId}/auth/hosted/signup`
- `GET /projects/{projectId}/auth/hosted/forgot-password`
- `GET /projects/{projectId}/auth/hosted/device?user_code=<user_code>`
- `GET /projects/{projectId}/auth/hosted/verify-email?token=<token>`
- `GET /projects/{projectId}/auth/hosted/reset-password` (dedicated reset-password page)

Every URL also needs `anon_key=<anon_key>`. Old sign-in links using
`?action=signup|forgot-password|device` remain supported.

The endpoint only serves HTML (`Accept: text/html`) and applies strict security
headers. Invalid or unavailable hosted pages return a branded HTML error page
with the original HTTP error status.

To start managed auth from your app, redirect users to:

- `GET /projects/{projectId}/auth/hosted?anon_key=<anon_key>`

Built-in pages call the auth API from Volcano's API origin, so they do not need
an entry in `cors_allowed_origins`. Custom auth pages run cross-origin and must
register their application origin in the project's CORS configuration.

## Built-in Smart Login Experience

When no custom `login` page is configured, hosted login uses an email-first flow:

- Ask for email first
- If email exists, prompt for password and sign in
- If email does not exist, switch to signup fields (`full name`, `password`, `password confirmation`) and create account
- Show configured OAuth providers if present
- If email confirmation is required, show confirmation-pending UX after signup/signin conflict until verified
- If confirmation is not required and `post_auth_redirect_url` is configured, redirect there after successful authentication
- `action=signup` starts directly in signup UI
- `action=forgot-password` starts directly in forgot-password UI
- `action=device&user_code=ABCD-EFGH&anon_key=<anon_key>` starts device authorization approval UX (requires login in the hosted page)

### Device Authorization Approval

Device-code login (RFC 8628) is approved entirely within the managed pages — the
API serves the approval UI itself, with no dependency on any external app.

- `POST /auth/device/authorize` returns a `verification_uri` /
  `verification_uri_complete` that point at this project's managed page:
  `GET /projects/{projectId}/auth/hosted/device?user_code=<user_code>&anon_key=<anon_key>`.
- The project's default anon key is embedded in that URL automatically so the
  page can sign the user in; managed auth must be enabled for the project.
- The page signs the user in (email/password or OAuth) and calls
  `POST /auth/device/verify` to approve or deny the `user_code`. The device then
  receives its session by polling `POST /auth/device/token`.

#### Custom verification page

Projects that host their own RFC 8628 approval page can set
`device_verification_url` on the auth config (`PATCH /auth/config`). When set,
`POST /auth/device/authorize` returns that URL instead of the managed page, with
the `user_code` appended to `verification_uri_complete`
(e.g. `https://app.acme.com/device?user_code=ABCD-EFGH`). The custom page is
responsible for authenticating the end user and calling `POST /auth/device/verify`.

Because approval no longer goes through the managed page, **device login works
even with managed auth disabled** when a custom URL is set, and the anon key is
not embedded (the page brings its own). The custom page runs on a different
origin, so add that origin to the project's auth CORS allowlist
(`cors_allowed_origins`) — otherwise the cross-origin `POST /auth/device/verify`
call is rejected with `403 CORS: origin not allowed`. Clear the field (empty
string) to fall back to the managed device page.

Helper endpoints used by the built-in login:

- `GET /projects/{projectId}/auth/hosted/login/options?anon_key=<anon_key>`
- `POST /projects/{projectId}/auth/hosted/login/check-email` with `Authorization: Bearer <anon_key>`
- Both endpoints are rate limited per project + client IP and apply exponential backoff before returning `429 Too Many Requests` with `Retry-After`.

## Configure built-in appearance

Use the appearance API when a page should keep Volcano's managed markup and
runtime while taking on your brand:

- `GET /projects/{projectId}/auth/pages/appearance` returns the saved theme,
  per-page layouts, accepted options, defaults, and per-page parked state.
- `PUT /projects/{projectId}/auth/pages/theme` saves the project-wide colours,
  font, scale, density, and radius. `DELETE` restores the live default.
- `PUT /projects/{projectId}/auth/pages/{pageType}/layout` saves `centered`,
  `split-left`, or `split-right`. `DELETE` restores default tracking.
- `POST /projects/{projectId}/auth/pages/{pageType}/preview` renders an unsaved
  theme and layout without running real authentication requests.

Theme and layout customisation requires PRO. A downgrade parks saved values:
the public page uses defaults and Volcano branding, while the appearance GET
and preview endpoints remain available. Upgrading restores the saved values.

The same configuration round-trips through `volcano-config.yaml`:

```yaml
auth:
  managed_pages:
    appearance:
      theme:
        version: 1
        colors:
          background: "#f7f5f2"
          surface: "#ffffff"
          text: "#1a1a1a"
          accent: "#1d4ed8"
          accent_text: "#ffffff"
        font: humanist
        scale: large
        density: spacious
        radius: large
      layouts:
        login: split-left
        signup: split-right
        reset_password: centered
```

## Built-in branding

The built-in pages render a modern, self-contained
dark theme (a centered card with the project brand in a top navbar). Each step
of the smart login flow reuses this layout.

- **Project name** is shown as the brand label in the navbar.
- **Project logo** is shown next to the brand when one has been uploaded for the
  project. It is loaded same-origin from `GET /projects/{projectId}/logo`, so no
  extra configuration is required — upload a logo and it appears automatically.
- Styling is fully inline (no external stylesheets or web fonts) so the pages
  stay within the strict managed-page Content-Security-Policy. System font
  stacks are used.
- The "Powered by Volcano" badge is shown only on the FREE plan; it is omitted
  on paid plans.

Custom hosted pages (configured via `PUT /projects/{projectId}/auth/hosted-pages/{pageType}`)
are rendered as-is and are not affected by the built-in branding.

## Security Guardrails

- HTML validation rejects `<script>` tags
- `javascript:` URLs are rejected
- Inline event handlers are rejected
- Embedded content tags (`iframe`, `object`, `embed`) are rejected
- Head tags (`meta`, `link`) are rejected
- CSS cannot include closing `</style` or `</head` tag patterns
- HTML and CSS are each limited to 256 KiB
- Redirect URLs are validated as HTTP/HTTPS and must pass allowlist checks

Response headers include:

- `Content-Security-Policy` with `default-src 'none'`. `script-src` is `'none'`
  for custom pages (which cannot contain scripts) and a single
  `'sha256-<hash>'` for the built-in pages' inline script. `style-src` is
  `'unsafe-inline'`, `img-src` is `'self' data:` (so the same-origin project
  logo can render), `connect-src` is `'self'`, and `form-action` is `'self'`.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store, no-cache, must-revalidate`
