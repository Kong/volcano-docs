---
title: "Environment Variables"
description: "Share configuration across all functions and frontends in a project."
---

Share configuration across all functions and frontends in a project.

## What are Variables?

Variables are key-value pairs injected into your deployed functions and frontend server runtimes as environment variables.

Project variables are also made available during cloud build/compile jobs so dependency installers and build commands can read configuration such as package registry URLs or tokens. Today there is no separate build-only variable store. For Next.js frontends, `NEXT_PUBLIC_*` variables are the exception: Next.js inlines them into the client bundle during the build, and Volcano excludes them from the server runtime environment.

For private npm registry access, prefer `NODE_AUTH_TOKEN` together with `NPM_CONFIG_REGISTRY` when needed. `NPM_TOKEN` is accepted, but npm does not use it by itself unless your project includes an `.npmrc` that maps it into an auth token entry.

**Use for:**
- API keys
- Database connections
- Service URLs
- Feature flags
- Any shared config

## Creating Variables

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/variables \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"API_KEY","value":"sk_live_12345"}'
```

### Variable name rules

- Must start with a letter or underscore
- Can contain only letters, digits, and underscores
- Maximum length: 256 characters

## Using in Functions and Frontends

```javascript
exports.handler = async (event) => {
  const apiKey = process.env.API_KEY;
  const dbUrl = process.env.DATABASE_URL;
  
  // Variables available as environment variables
};
```

## List Variables

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/variables \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

List responses include the latest project variable propagation status. During
propagation, variables report `status: "provisioning"` and include
`current_sync_id` plus `provisioning_started_at`; after propagation completes the
status becomes `active` or `failed`.

## Get a Variable

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/variables/API_KEY \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "name": "API_KEY",
  "value": "sk_live_12345",
  "status": "active",
  "current_sync_id": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Note:** Values are always visible (not masked). Don't store secrets you can't regenerate.

## Update a Variable

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/variables/API_KEY \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"sk_live_67890"}'
```

Functions and frontend server runtimes pick up new values after variable propagation completes (no restart needed). A changed `NEXT_PUBLIC_*` value is included in the next frontend build and therefore requires a redeploy.

## Delete a Variable

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID/variables/API_KEY \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

## Automatic Variables

Volcano automatically provides:

**DATABASE_URL** - Set when you create a database

```javascript
process.env.DATABASE_URL
// postgresql://user:pass@host:5432/db
```

## Common Variables

```bash
# API Keys
API_KEY=sk_live_...
THIRD_PARTY_KEY=key_test_...

# Service URLs
API_BASE_URL=https://api.example.com
WEBHOOK_URL=https://hooks.example.com

# Database
DATABASE_URL=postgresql://...  # Auto-set by Volcano

# Feature Flags
FEATURE_NEW_UI=true
MAINTENANCE_MODE=false
```

## Security

**Variables are visible** to anyone with project access.

Private registry credentials such as `NODE_AUTH_TOKEN`, `NPM_TOKEN`, `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, or Bundler `BUNDLE_GEMS__...` values can be used during dependency installation, but they are also runtime variables. Only use credentials that are scoped narrowly and can be rotated.

Don't store:
- Passwords you can't rotate
- Extremely sensitive data

Do store:
- API keys (rotatable)
- Service URLs
- Configuration
- Feature flags

For maximum security, use AWS Secrets Manager in your functions.

## See Also

- [Creating Functions](creating-functions.md)
- [Databases](../databases/creating-databases.md) - DATABASE_URL auto-set


