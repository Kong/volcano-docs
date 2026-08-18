---
title: "Environment Variables"
description: "Share configuration across all functions and frontends in a project."
---

Share configuration across all functions and frontends in a project.

## What are Variables?

Variables are key-value pairs injected into your deployed functions and frontend server runtimes as environment variables.

Project variables are also made available during cloud build/compile jobs so dependency installers and build commands can read configuration such as package registry URLs or tokens. Today there is no separate build-only variable store, and a few names are reserved by the build itself (see [Names reserved during builds](#names-reserved-during-builds)). For Next.js frontends, `NEXT_PUBLIC_*` variables are the exception: Next.js inlines them into the client bundle during the build, and Volcano excludes them from the server runtime environment.

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

### Names reserved during builds

The build that compiles your function or frontend uses environment variables of its
own to locate your source, select a runtime, and reach the registry it publishes to.
A project variable that collides with one of those names is dropped from the build
environment and the build log says so:

```text
warning: ignoring reserved build env var SOURCE_URL
```

The variable is still stored and still delivered to your deployed function and
frontend server runtimes; only the build does not see it. Names the function runtime
reserves for itself, such as `AWS_REGION`, cannot be used as runtime environment
variables at all.

| Reserved | Examples |
| --- | --- |
| Build inputs | `SOURCE_URL`, `SOURCE_BUCKET`, `SOURCE_KEY`, `SOURCE_VERSION`, `SOURCE_SHA256`, `OUTPUT_BUNDLE_URL`, `PROJECT_ID`, `FUNCTION_ID`, `FRONTEND_ID`, `DEPLOYMENT_ID`, `RUNTIME`, `HANDLER`, `TARGET_ARCH` |
| Interpreter and loader hooks | `PATH`, `HOME`, `SHELL`, `NODE_OPTIONS`, `NODE_PATH`, `NODE_ENV`, `PYTHONPATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH` |
| Whole prefixes | `AWS_`, `CODEBUILD_`, `GITHUB_`, `DOCKER_`, `VOLCANO_`, `NPM_CONFIG_`, `YARN_`, `PIP_`, `BUNDLE_`, `COREPACK_` |

Registry credentials are the exception. They match a reserved prefix but are passed
through so private registries keep working:

- Both function and frontend builds: `NODE_AUTH_TOKEN`, `NPM_TOKEN`,
  `NPM_CONFIG_REGISTRY`, `npm_config_registry`, `YARN_NPM_AUTH_TOKEN`,
  `YARN_NPM_REGISTRY_SERVER`.
- Function builds only: `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `PIP_TRUSTED_HOST`,
  `BUNDLE_GEMS__…`. Frontend builds are Node-only and reject these.

For frontend server runtimes, Volcano also owns the cache and revalidation wiring
(`CACHE_*`, `FRONTEND_REVALIDATION_*`, `MAX_REVALIDATE_CONCURRENCY`) and sets those
values itself, so a project variable of the same name does not take effect there
either.

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

## Common Variables

```bash
# API Keys
API_KEY=sk_live_...
THIRD_PARTY_KEY=key_test_...

# Service URLs
API_BASE_URL=https://api.example.com
WEBHOOK_URL=https://hooks.example.com

# Database
DATABASE_URL=postgresql://...  # Set this yourself from GET /databases/{id}

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

For maximum security, fetch secrets from a dedicated secrets manager inside your functions.

## See Also

- [Creating Functions](creating-functions.md)
- [Databases](../databases/creating-databases.md) - set DATABASE_URL as a project variable


