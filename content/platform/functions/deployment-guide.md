---
title: "Function Deployment Guide"
description: "Upload a focused ZIP or tar.gz archive containing the source files needed to build and run the function."
---

## Source Bundle Size

Upload a focused ZIP or tar.gz archive containing the source files needed to build and run the function. Volcano stores a normalized source bundle and builds a runtime container image for deployment.

## Availability and Concurrency

Updating an existing function does not remove its current runtime while the new
image builds and provisions. Traffic continues to use the last known-good
runtime until the update succeeds. Failed updates remain visible in deployment
history without taking that runtime offline.

Volcano serializes deployments per function. A newer deploy supersedes any
older queued deploy and starts after the running deployment. Delete is terminal:
it supersedes queued deploys, and later deploys return `409 Conflict` until
deletion completes. Deployments for different functions and projects run
concurrently.

Latest-wins queueing applies to cloud deployments. Local mode executes
deployments synchronously and returns `409 Conflict` for overlap.

### Regional runtime repair

After propagation retries, Volcano treats a regional runtime as missing only
when its invocation path receives a provider-confirmed not-found response for
the deployed runtime or its invocation URL. Volcano first verifies that the same
deployment is still serving and that the region is still expected, then queues durable repair
of that immutable generation. Repair does not rebuild source, create a new
deployment, or change what `active` and `degraded` mean.

Volcano does not repair application errors, ambiguous provider failures such as
timeouts, throttling, or network errors, user deletion, regional convergence,
or resources removed by a non-preserved staging purge. The invocation that
detects drift can still fail while repair runs; Volcano does not replay it in
another region. Repair is request-driven and does not proactively audit idle
functions.

## Best Practices

### DO: Exclude Installed Dependencies

**Don't include installed dependencies** in your cloud deployment package:

```bash
# Bad - includes everything
zip -r function.zip .

# Good - exclude installed dependencies and caches
zip -r function.zip . -x "node_modules/*" -x "python_deps/*" -x "vendor/*" -x ".venv/*" -x "venv/*"
```

Volcano installs Node.js, Python, and Ruby dependencies during the cloud compile build from manifests such as `package.json`, `requirements.txt`, and `Gemfile`.

Cloud deployments enforce two separate limits: 256 MB for the uploaded source archive, and 4096 MB for the final function image the build produces, dependencies included.

The API enforces the source archive limit. The CLI does not enforce a local source archive size limit, so a server-side limit change does not require updating the CLI. The image limit is checked in the cloud build, after dependencies are installed and the final image is built.

### DO: Keep Build Inputs Focused

Include source files, lockfiles, dependency manifests, and any generated runtime output your handler needs, such as `dist/` or `build/`. Exclude installed dependency directories, dependency caches, local test artifacts, and files that are only useful during development.

### DO: Declare Your Package Manager

For Node.js functions, declare the manager in `package.json` and ship its lockfile:

```json
{
  "packageManager": "pnpm@9.15.0"
}
```

`packageManager` decides which manager installs your dependencies, even when a lockfile from another one is still checked in — a stale `pnpm-lock.yaml` cannot pull a project that declares `npm@10` onto pnpm. Without it, Volcano goes by the lockfile you shipped, and **more than one lockfile family fails the build**:

```text
multiple lockfile families found: pnpm:/src/pnpm-lock.yaml npm:/src/package-lock.json
add packageManager to package.json or remove extra lockfiles
```

The lockfile has to belong to the manager that ends up selected. If it does not — none shipped, or `packageManager` names one whose lockfile is missing — dependencies resolve fresh during the build instead of from your lockfile, so a deployment can pick up versions you never tested.

### DO: Bundle Your Code

Use tools like esbuild to minimize package size:

```bash
# Install esbuild
npm install -D esbuild

# Bundle your code
npx esbuild index.js \
  --bundle \
  --platform=node \
  --target=node22 \
  --minify \
  --outfile=dist/index.js

# Package the bundle
cd dist && zip function.zip index.js
```

**Result**: Typically reduces from 50MB+ to under 1MB.

## Size Recommendations

| Source Bundle Size | Status | Notes |
|-------------|--------|-------|
| < 1MB | Excellent | Fast deployments |
| 1-10MB | Good | Acceptable for most functions |
| 10-50MB | Large | Consider optimization |
| Larger bundles | Very Large | Bundle/minimize before upload |
| Above upload limit | Rejected | Split or reduce the source bundle |

## Common Errors

### "Function code too large"

**Error message**:
```text
Error: function code too large (max 256 MB, got 312475648 bytes from file 'function.tar.gz')
```

**Solutions**:

1. **Remove installed dependencies**:
   ```bash
   zip -r function.zip . -x "node_modules/*" -x "python_deps/*" -x "vendor/*" -x ".git/*" -x "*.md"
   ```

2. **Remove dependency caches and development-only files** from the upload bundle

3. **Bundle your code** with esbuild or webpack

4. **Split into multiple functions** if your app is too large

### Function image too large

A deployment fails after its build when the final function image, dependencies included, is larger than 4096 MB. Remove unnecessary runtime files, reduce dependency size, or split the function into smaller deployable units.

## Quick Start

**Minimal function** (recommended):

```javascript
// index.js
exports.handler = async (event, context) => {
  // Your logic here
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success!' })
  };
};
```

Package and deploy:
```bash
zip function.zip index.js
# Upload via Volcano dashboard
```

**Package size**: < 1KB

## Advanced: Monorepo Projects

If your function is part of a monorepo:

**Don't** zip the entire monorepo:
```bash
# Bad - includes everything
cd mymonorepo/
zip -r function.zip .  # Not recommended - includes everything
```

**Do** zip only what's needed:
```bash
# Good - only function code
cd mymonorepo/functions/api/
zip -r function.zip index.js lib/ -x "*.test.js"
```

Or use a build tool to bundle:
```bash
# Bundle with dependencies resolved
npx esbuild functions/api/index.js \
  --bundle \
  --platform=node \
  --outfile=dist/index.js

cd dist && zip function.zip index.js
```

## Tips for Small Packages

1. **Tree-shaking**: Use esbuild or webpack to remove unused code
2. **Minification**: Compress your JavaScript
3. **External dependencies**: Bundle only the dependencies you need
4. **Avoid large files**: Store data in Volcano Storage, not in function code
5. **Development dependencies**: Don't include test files or dev tools

## Example: Real-World API

```javascript
// api/index.js
const db = require('./database');
const auth = require('./auth');

exports.handler = async (event) => {
  const user = await auth.verify(event.headers.authorization);
  const data = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
```

**Package**: Just this file (< 1KB)  
**Dependencies**: Bundled with only the modules the function uses  
**Total system**: Works perfectly, no size issues  

## Summary

**Exclude unnecessary files** from deployment packages
**Bundle dependencies** to keep uploads small
**Bundle your code** to minimize size
**Keep functions focused** - single responsibility
**Respect the configured upload limit** - split or reduce bundles if needed

Following these practices ensures fast, reliable deployments!
