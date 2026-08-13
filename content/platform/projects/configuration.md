---
title: "Project configuration manifest"
description: "volcano-config.yaml is the declarative manifest for a project's user-facing configuration."
---

`volcano-config.yaml` is the declarative manifest for a project's user-facing
configuration. The CLI uploads it with `volcano config deploy`, downloads the
current state with `volcano config pull`, and the dashboard offers the same
download on the Projects page. All reconciliation happens server-side through
two endpoints:

- `GET /projects/{id}/config` — export current configuration (JSON, or
  canonical YAML with `Accept: application/yaml` / `?format=yaml`)
- `PUT /projects/{id}/config` — validate and apply a manifest
  (`?dry_run=true` reports projected actions without changing anything)

The manifest applies to the currently selected project (`volcano use <name>` /
`VOLCANO_PROJECT_ID`). Creating or selecting a project is not part of the
manifest.

[GitHub auto-deploy](git-deploy.md) reads the same file from your repository,
but applies only `functions[].public` — the per-resource settings that belong to
the code a push deploys. Every other section still needs `volcano config
deploy`.

## Full schema (version 1)

```yaml
version: 1

project:
  name: my-app                              # optional rename
  all_regions: false
  selected_regions: [us-east-1, us-west-2]  # bare AWS names; subset requires PRO

databases:                                  # must already exist; assertion-only
  - name: appdb                             # required, matches deployed database
    region: aws-us-east-1                   # required; mismatch => error
    pg_version: "16"                        # required; mismatch => error
    database_type: volcano-db-xs            # asserted; tier changes are NOT
                                            #   allowed via config

variables:                                  # ALWAYS fully synced when declared
  - name: STRIPE_SECRET_KEY
    value: ${STRIPE_SECRET_KEY}             # ${ENV} interpolated by the CLI

buckets:                                    # must already exist (never created here)
  - name: avatars
    file_size_limit: 5242880                # bytes, optional
    allowed_mime_types: [image/png, image/jpeg]
    policies:                               # fully synced when declared;
      - name: public-read                   #   omit the key => policies untouched
        operation: SELECT                   # SELECT|INSERT|UPDATE|DELETE
        definition: "true"

realtime:
  enabled: true
  broadcast_enabled: true
  presence_enabled: true
  postgres_changes_enabled: true

auth:
  tokens:
    access_token_lifetime: 3600
    refresh_token_lifetime: 2592000
    refresh_token_reuse_interval: 10
    platform_token_ttl: 2592000
  sessions:
    inactivity_timeout: 0
    max_session_duration: 0
  signup:
    enable_signup: true
    enable_anonymous_signins: false
    allowed_email_domains: []                 # empty = any domain may sign up
    allowed_email_domains_mode: signup        # signup | signup_and_signin | disabled
  rate_limits:                              # per hour
    signup: 100
    signin: 100
    token_refresh: 1000
    password_reset: 10
  password:
    min_length: 8
    require_uppercase: true
    require_lowercase: true
    require_numbers: true
    require_special_chars: false
  password_reset:
    allow: true
    timeout: 3600
    max_history: 0
  email_verification:
    require_confirmation: true
    confirmation_timeout: 86400
  cors:
    enabled: true
    allowed_origins: [https://myapp.com, http://localhost:3000]
    allow_credentials: true
    max_age: 86400
  providers:
    email_password:
      enabled: true
    oauth:                                  # fully synced when declared
      - provider: google                    # google|github|microsoft|apple|device
        enabled: true
        client_id: ${GOOGLE_CLIENT_ID}
        client_secret: ${GOOGLE_CLIENT_SECRET}   # write-only
        redirect_url: https://api.myapp.com/auth/oauth/google/callback
        scopes: [openid, email, profile]
      - provider: device                    # client_id/secret server-generated
        enabled: true
  email:
    enabled: true
    from:
      address: no-reply@myapp.com
      name: My App
    smtp:
      host: smtp.sendgrid.net
      port: 587
      username: ${SMTP_USERNAME}
      password: ${SMTP_PASSWORD}            # write-only
      use_tls: true
    templates:                              # fully synced when declared
      confirmation:
        subject: "Confirm your email"
        html_body: "<p>Confirm: {{.Token}}</p>"   # bodies require PRO
        text_body: "Confirm: {{.Token}}"
      password_reset:
        subject: "Reset your password"      # subject-only works on FREE
      password_changed:
        subject: "Your password was changed"
      welcome:
        subject: "Welcome"
        html_body: "<p>Welcome {{.Email}}</p>"
        text_body: "Welcome"
  managed_pages:
    enabled: true
    redirects:
      allowed: [https://myapp.com/welcome, https://myapp.com/login]
      post_auth: https://myapp.com/welcome
      post_logout: https://myapp.com/goodbye
      device_verification: https://myapp.com/device
    pages:                                  # PRO; upsert-only (omission => untouched)
      login:
        html: "<html>...</html>"            # required, <=256 KiB
        css: "body{}"                       # optional, <=256 KiB
      reset_password:                       # maps to page type "reset-password"
        html: "<html>...</html>"

functions:                                  # must already be deployed
  - name: hello
    public: true                            # anon-key invocation
    schedulers:                             # fully synced when declared
      - name: nightly
        cron: "0 3 * * *"                   # 5-field UTC cron
        enabled: true
        payload: { source: cron }

frontends:                                  # must already be deployed
  - name: web
    custom_domain:                          # PRO; BYOC TLS only
      domain: app.myapp.com
      tls:                                  # optional for an existing domain
        mode: byoc
        certificate_pem: ${TLS_CERT_PEM}          # write-only
        private_key_pem: ${TLS_KEY_PEM}           # write-only
        certificate_chain_pem: ${TLS_CHAIN_PEM}   # optional, write-only
```

Not in the manifest: project logo, anon/service keys, auth users (no end-user
creation, bans, or sessions), scheduler regions, code artifacts
(function/frontend deploys), and one-shot actions (password reset, key
regenerate, test email, redeploy).

## Reconciliation semantics

- **Omitted sections are untouched.** Only what you declare is reconciled.
- **Patch semantics within entries.** An omitted optional field keeps its
  current server value (for example a bucket entry with only
  `file_size_limit` leaves `allowed_mime_types` alone).
- **Fully synced when declared (destructive by design):** `variables`,
  `buckets[].policies`, `auth.providers.oauth`, `auth.email.templates`, and
  `functions[].schedulers`. The declared list is the source of truth: entries
  absent from the manifest are deleted; an explicit empty list deletes
  everything. Run `volcano config pull` before your first deploy and check the
  `--dry-run` report to see what a partial list would remove.
- **Email templates and built-in defaults.** Template content that still
  matches the built-in defaults is not a customization: exports omit the
  default bodies, and a declared `templates` map treats them as absent, so a
  subject-only entry works on FREE without touching the default content. A
  template type absent from a declared map reverts to the built-in default.
- **Never created, never deleted:** functions, frontends, databases, and
  buckets. The manifest only updates their configuration. Databases are
  assertion-only — `region`, `pg_version`, and `database_type` are compared,
  never written; a `database_type` mismatch is an explicit error because tier
  changes must go through `volcano databases` or the dashboard.
- **Custom domains** belong to their declared frontend entry: omitting
  `custom_domain` on a declared frontend deletes an existing domain. The same
  domain with new TLS material rotates the certificate **in place with zero
  downtime** — the frontend proxies pick up the new certificate within seconds
  (cache invalidation, 5-minute TTL backstop) while the old still-valid
  certificate keeps serving handshakes. A different domain name is a
  detach-and-recreate: the new domain serves after provisioning/verification.
- **Hosted pages are upsert-only.** There is no delete API for hosted pages,
  so pages omitted from `managed_pages.pages` are left untouched.
- **`auth.signup.allowed_email_domains` replaces the stored list** when
  declared. `[]` removes the restriction; omitting the key keeps the current
  allowlist. Entries are normalized to bare lowercase domains, so
  `["@Acme.com"]` is stored as `["acme.com"]`. `allowed_email_domains_mode`
  follows the same rule — omit it to keep the stored mode. Declaring
  `signup_and_signin`, or narrowing the list while it is already set, signs out
  every account whose domain the list no longer admits. See
  [Email domain allowlist](../authentication/configuration/email-domain-allowlist.md).

## Coverage warnings: skipped and missing

Because the manifest can never create functions, frontends, databases, or
buckets, the apply report tells you when your file and your deployed resources
disagree:

- `skipped` — the manifest configures a resource that does not exist. Deploy
  or create it first, then re-run `volcano config deploy`.
- `missing` — a deployed resource has no entry in its declared manifest
  section.

Both are warnings: the rest of the manifest still applies and the CLI exits 0.

## Validation, plan limits, and partial failures

- Validation failures (bad cron expressions, invalid policy definitions,
  database assertion mismatches, plan-gate violations) return `422` with the
  full error list and **nothing is applied**.
- Plan gates are change-aware: they only fire when the manifest would change a
  gated value. Re-applying an export of a project downgraded from PRO stays a
  no-op.
- PRO-gated surfaces: region subsets, email template bodies, hosted pages, and
  custom domains. Scheduler counts and storage policy counts respect plan caps.
- Apply-phase failures (a provider call failing mid-apply) return `200` with
  per-entry `action: error`; already-applied changes are not rolled back.
  Re-running the deploy is safe — unchanged entries are no-ops.
- Applies are serialized per project; a concurrent apply returns `409`.

## Secrets

Write-only secrets — `auth.email.smtp.password`, OAuth `client_secret`, and
custom domain TLS material — are omitted from exports and stay unchanged
unless you set them explicitly. The CLI interpolates `${ENV_VAR}` references
before upload, so keep secrets in your environment, not in the file. Variable
values are included in exports (they are readable through the API).

## Asynchronous side effects

Apply starts long-running work and returns immediately: variable changes
propagate to functions and frontends through one batched workflow, region
changes trigger function redeploys, and new custom domains provision
asynchronously. Check convergence with the usual commands (`volcano variables
list`, `volcano frontends domain get`, ...).
