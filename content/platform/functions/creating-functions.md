---
title: 'Creating functions'
description: 'Deploy functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes.'
---

Deploy functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes.

## Supported runtimes

| Language | Runtimes                                                   | Default handler |
| -------- | ---------------------------------------------------------- | --------------- |
| Node.js  | nodejs24.x, nodejs22.x                                     | `handler`       |
| Python   | python3.14, python3.13, python3.12, python3.11, python3.10 | `handler`       |
| Ruby     | ruby4.0, ruby3.4, ruby3.3                                  | `handler`       |

`python3.10` is deprecated: Python 3.10 reached end of life in October 2026. It still deploys, and Volcano will remove it before 2027-08-31. Move functions to a newer Python runtime.

Your code is automatically packaged with a standard filename (`index.js`, `main.py`, or `main.rb`). You only need to specify the function name.

## Writing functions

### Node.js

```javascript
// index.js
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hello from Node.js!',
      data: event,
    }),
  };
};
```

### TypeScript

Write a Node.js function in TypeScript by putting its handler in `index.ts`,
`index.mts`, `index.cts`, or `index.tsx`. Volcano compiles it to JavaScript
during the build, after it installs dependencies.

```typescript
// index.ts
type Event = { name?: string };

export const handler = async (event: Event) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: `Hello, ${event.name ?? 'TypeScript'}!` }),
});
```

How the build compiles it:

- It removes types without checking them, so a type error doesn't fail the
  deploy. Run `tsc --noEmit` in your own CI to catch type errors.
- It bundles the files the handler imports, including imports through `paths`
  in a `tsconfig.json` deployed with the function. Packages from `package.json`
  aren't bundled; they load from the dependencies the build installs.
- `.mts` compiles to an ES module and `.cts` to CommonJS. `.ts` and `.tsx`
  follow Node.js: an ES module when the nearest `package.json`, looking up to
  the one the function's dependencies install from, sets `"type": "module"`,
  CommonJS otherwise. Top-level `await` and `import.meta` need an ES module.
- JSX compiles as [JSX in `.tsx` handlers](#jsx-in-tsx-handlers) describes.
- JavaScript wins. With the [upload API](./upload-api.md), when Node.js can
  load the handler without compiling, the function deploys that and its
  TypeScript isn't compiled: an `index.js`, `index.mjs`, or `index.cjs` file, an
  extensionless `index` file, an `index/` directory holding a `package.json`
  or an `index.js`, `index.json`, or `index.node`, an installed package named
  `index`, or an `index` module in a `NODE_PATH` directory inside the function.
  Any `package.json` counts, whatever its `main` names. An empty `index/`
  directory, or one with none of these, doesn't count, and neither does a
  `NODE_PATH` directory outside the function. Commit compiled JavaScript when
  you need a compiler feature the build skips, such as decorator metadata.
- [Git deploy](../projects/git-deploy.md#repository-layout) reads only `index.js`
  or `index.mjs` as a JavaScript entry beside `index.ts`. A shipped `index.cjs`,
  extensionless `index` file or `index/` directory that counts beside it
  deploys neither, and the push fails with `typescript_not_compiled`.
- Keep one of `index.ts`, `index.mts` and `index.cts`. A function with more
  than one fails to deploy. `index.tsx` compiles only when none of them is
  there, so beside `index.ts` the `.ts` file deploys.
- TypeScript never changes what a function directory already deploys in
  [Git deploy](../projects/git-deploy.md#repository-layout): a JavaScript file,
  `main.py` or `main.rb` beside `index.ts` stays the entry, with its runtime.

Errors name your TypeScript. The build writes a source map beside the compiled
handler and turns on Node.js source maps before the handler loads, so a stack
trace in your function's logs, in [Issues](../guides/issues.md), and in your
own `error.stack` names the `.ts` or `.tsx` file and line, such as
`lib/billing.ts:4`, by its path under the function's root. Frames in installed
packages stay as the package ships them.

- The compiled handler is `index.cjs` or `index.mjs`, and it loads
  `index.bundle.cjs` or `index.bundle.mjs`, which holds your code. Your code's
  `__dirname` and `import.meta.url` stay the directory `index.ts` is in.
- Source maps cost CPU when a stack trace is read; a stack nothing reads costs
  nothing. The first one in each running instance parses the map, and later
  ones cost about three times an unmapped stack. Measured on Node.js 24 with a
  98 KiB map, the first stack took about 0.6 s at 128 MB of memory and 0.05 s
  at 1024 MB, and the parsed map used about 12 to 17 MB more memory. The cost
  grows with the map, so a map over 256 KiB isn't
  written; a map at that limit costs about 1 s at 128 MB, extrapolated from
  measurements of 98 KiB and 1.9 MiB maps.
- Set `NODE_OPTIONS=--no-enable-source-maps` to turn source maps off, or
  `NODE_OPTIONS=--enable-source-maps` to turn them on for installed packages
  too; Volcano leaves your setting as it is.
- A handler compiles without a source map, so its frames name `index.cjs` or
  `index.mjs`, when its map would pass 256 KiB, when a file in the function
  already has the bundle's or the
  map's name, when it bundles a file from outside the function's directory or
  a JavaScript file whose own source map points outside it or to a URL, or
  when an ES module handler re-exports everything from an installed package,
  as `export * from "package"` does. The build log says which.

Volcano compiles TypeScript deployed with [Git deploy](../projects/git-deploy.md),
the [upload API](./upload-api.md) or the [CLI](/cli/functions), in the cloud and
in local mode. The CLI uploads TypeScript handlers from version 0.76.0; older
versions skip `.ts` files, so upgrade first. See
[CLI project layout](#cli-project-layout) for the TypeScript files it finds.

#### JSX in `.tsx` handlers

A handler in `index.tsx` can render JSX, such as an HTML page or email. The
build compiles JSX with React's automatic runtime, so a component needs no
`import React`. Add `react`, and any renderer you call, to the function's
`package.json`: the build doesn't bundle them.

```tsx
// index.tsx
import { renderToStaticMarkup } from 'react-dom/server';

const Greeting = ({ name }: { name: string }) => <h1>Hello, {name}!</h1>;

export const handler = async (event: { name?: string }) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/html' },
  body: renderToStaticMarkup(<Greeting name={event.name ?? 'TSX'} />),
});
```

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  }
}
```

- A `tsconfig.json` or `jsconfig.json` in the handler's directory or above it
  sets how JSX compiles for the files it covers, including through `extends`.
  Set `"jsx": "react"` for `React.createElement`, `"jsx": "react"` with
  `"jsxFactory": "h"` for a custom factory, or `"jsxImportSource": "preact"`
  for Preact's runtime.
- In a `.tsx` handler, `"jsx": "preserve"` and `"jsx": "react-native"` compile
  with the automatic runtime, because Node.js can't run raw JSX. A
  `jsxFactory` takes effect only with `"jsx": "react"`.
- In a `.tsx` handler, a `/** @jsx h */` or `/** @jsxFrag Frag */` comment
  needs a `/** @jsxRuntime classic */` comment before it, or a tsconfig
  `"jsx": "react"`. A JSX comment the build would ignore fails the build.
- A `.ts`, `.mts` or `.cts` handler compiles JSX in the `.tsx` files it
  imports as it always has: `React.createElement`, unless a tsconfig or a
  comment says otherwise.

### Python

```python
# main.py
import json

def handler(event, context):
    print(f'Event: {json.dumps(event)}')

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'message': 'Hello from Python!',
            'data': event
        })
    }
```

### Ruby

```ruby
# main.rb
require 'json'

def handler(event:, context:)
  puts "Event: #{event.to_json}"

  {
    statusCode: 200,
    headers: { 'Content-Type' => 'application/json' },
    body: {
      message: 'Hello from Ruby!',
      data: event
    }.to_json
  }
end
```

## CLI project layout

When you deploy with the Volcano CLI, functions are discovered under:

```text
volcano/functions/
```

The CLI supports both single-file and directory-based functions.

### Single-file functions

These are the simplest option. The filename becomes the function name.

```text
volcano/functions/hello.js
volcano/functions/greet.ts
volcano/functions/notes.py
volcano/functions/worker.rb
```

Examples:

- `volcano/functions/hello.js` -> function name `hello`
- `volcano/functions/greet.ts` -> function name `greet` (also `.mts` and `.cts`)
- `volcano/functions/notes.py` -> function name `notes`
- `volcano/functions/worker.rb` -> function name `worker`

### Directory-based functions

Use a directory when a function needs multiple files.

```text
volcano/functions/api/index.js
volcano/functions/checkout/index.ts
volcano/functions/jobs/main.py
volcano/functions/reports/main.rb
```

The directory name becomes the function name.

Discovery rules:

- The entry is the runtime's handler file at the top of the directory:
  `index.js`, `main.py` or `main.rb`. A directory with none of them, and no
  TypeScript index, isn't a function.
- A TypeScript directory function needs its handler at the top of the
  directory as `index.ts`, `index.mts` or `index.cts`. An `index.js`, `main.py`
  or `main.rb` beside it deploys instead; other files, such as `helpers.js`,
  don't.

Examples:

- `volcano/functions/api/index.js` -> function name `api`
- `volcano/functions/checkout/index.ts` -> function name `checkout`
- `volcano/functions/jobs/main.py` -> function name `jobs`

TypeScript needs CLI 0.76.0 or later. The CLI doesn't find `.tsx` files or
declaration files such as `types.d.ts`. It doesn't find a handler nested below
the function's directory, such as `volcano/functions/checkout/src/index.ts`.

### Shared code

Any file or directory whose basename starts with `_` is treated as shared code and
packaged automatically for every function.

Examples:

```text
volcano/_shared.js
volcano/functions/_helpers/
```

This is useful for shared utilities without requiring each function to duplicate them.

Once deployed, shared code sits next to the function's entry file under its own
name, whether it came from `volcano/` or `volcano/functions/`. Import it from
there in every function, including directory functions. From the entry file:

| Runtime | Import `volcano/functions/_helpers/db.*` as             |
| ------- | ------------------------------------------------------- |
| Node.js | `require('./_helpers/db')` or `from './_helpers/db.js'` |
| Python  | `from _helpers.db import connect`                       |
| Ruby    | `require_relative '_helpers/db'`                        |

A file in a subdirectory of a directory function, such as
`volcano/functions/api/lib/orders.js`, adds one `../` per level in Node.js and
Ruby: `require('../_helpers/db')`. Python's import is the same from any file.

A directory function's entry file that imports `../_helpers/db` works in your
repository but fails once deployed, in Node.js with `Cannot find module`. A
[Git deploy](../projects/git-deploy.md) warns about it in the function's
[build log](logs.md#deployment-logs), with the file, the line, and the import
to use instead.

The same goes for a single-file function and shared code directly under
`volcano/`: `volcano/functions/hello.js` imports `volcano/_shared/utils.js` as
`./_shared/utils`, and `../_shared/utils` fails once deployed. Keep shared code
under `volcano/functions/` instead, and a single-file function's `./_shared`
import resolves in your repository too.

To make your tests resolve the same imports in your repository, link the
shared directory into the function's directory:

```bash
ln -s ../_helpers volcano/functions/api/_helpers
```

For shared code directly under `volcano/`, link `../../_name` instead. Node.js
and Ruby then resolve `./_helpers/db` from `volcano/functions/api/`. Python
resolves `_helpers.db` once the function's directory is on `sys.path`, as it is
for a test file in that directory run with pytest or `python`. Deploys skip
symbolic links, so the function still gets the real `_helpers/`.

### Dependencies

Cloud deployments upload source plus dependency manifests. Volcano installs dependencies during the function compile build using the selected runtime. Do not include installed dependency directories in cloud uploads.

Do not include the top-level `.volcano-dependencies` path. Volcano reserves it
for dependency staging, and the asynchronous compile build fails when uploaded
source contains it.

A common Node.js layout looks like:

```text
package.json
volcano/
  functions/
    hello.js
    api/
      index.js
  _shared/
    utils.js
```

For Python:

```text
requirements.txt
volcano/
  functions/
    jobs.py
```

For Ruby:

```text
Gemfile
Gemfile.lock
volcano/
  functions/
    worker.rb
```

Local mode installs these manifests too, using the runtime's own package manager
(`npm`, `pip`, or `bundler`) on the interpreter the function's runtime names. You
do not need to install dependencies into your project first, and you should not
commit installed directories: `node_modules`, `.venv`, and `vendor/bundle` are
excluded from the upload either way.

## Packaging

Functions can be uploaded to the API as ZIP or `tar.gz` source bundles. The Volcano CLI packages cloud functions as `tar.gz`. Include source files and dependency manifests/lockfiles, not installed dependency directories.

Uploaded function source archives cannot contain symlink entries. Package-manager symlinks created during the cloud build are materialized safely before publish.

### Node.js

```bash
# Include source and dependency manifests
zip -r function.zip index.js package.json
```

### Python

```bash
zip -r function.zip main.py requirements.txt
```

### Ruby

```bash
zip -r function.zip main.rb Gemfile Gemfile.lock
```

> **Note:** Upload focused source bundles. Include generated runtime output if your handler needs it, such as `dist/` or `build/`, but exclude installed dependency directories, dependency caches, and files that are only useful during development.

Cloud uploads are limited to 256 MB per source archive, and that limit is enforced by the API only. The CLI does not reject function archives based on local file or archive size. After the cloud build installs dependencies, it rejects a final function image larger than 4096 MB.

`functions deploy --all` uploads functions in API batches of up to 100 functions. Larger projects are split into multiple batch requests automatically by the CLI.

`volcano deploy` (or `volcano cloud deploy`) deploys every function in `volcano/functions/` along with the project's variables, durable functions, frontends, and `volcano-config.yaml`, then waits until the deployments are live. See the [CLI deploy reference](/cli/deploy).

## Deploying

Upload as binary file via multipart/form-data:

```bash
# Node.js function
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=my-node-function" \
  -F "code=@function.zip" \
  -F "runtime=nodejs24.x" \
  -F "handler=handler"

# Python function (handler defaults to "handler" if not specified)
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=my-python-function" \
  -F "code=@function.zip" \
  -F "runtime=python3.12"

# Ruby function (handler defaults to "handler" if not specified)
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=my-ruby-function" \
  -F "code=@function.zip" \
  -F "runtime=ruby3.4"
```

**Parameters:**

- `name` (required) - Function name (unique per project, DNS-safe, max 63 characters)
  Allowed characters: lowercase letters, numbers, and hyphens (`-`), without leading/trailing hyphen.
- `code` (required) - ZIP or `tar.gz` file containing the function source bundle
- `runtime` (required) - Runtime environment (see table above)
- `handler` (optional) - Entry point; defaults based on runtime
- `visibility` (optional) - `private`, `authenticated`, or `public`; a new function defaults to `private`, and a redeploy without it keeps the current level. See [Choose who can invoke it](#choose-who-can-invoke-it)

**Handler format:**
You only need to specify the function name (e.g., `handler`). Volcano automatically packages your code with the standard filename for your language:

- Node.js: `exports.handler` in `index.js`
- Python: `def handler()` in `main.py`
- Ruby: `def handler()` in `main.rb`

**Response:**

```json
{
  "id": "func-uuid",
  "name": "my-function",
  "status": "provisioning",
  "runtime": "nodejs24.x",
  "handler": "handler",
  "visibility": "private",
  "is_public": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

Status transitions: `provisioning` → `active` (usually 5-10 seconds).

## Choose who can invoke it

A function's `visibility` decides which credentials can invoke it. New functions
are `private`.

| Visibility          | Service keys and schedulers | Your project's signed-in users | Anon keys with `functions.invoke` |
| ------------------- | --------------------------- | ------------------------------ | --------------------------------- |
| `private` (default) | Yes                         | No                             | No                                |
| `authenticated`     | Yes                         | Yes                            | No                                |
| `public`            | Yes                         | Yes                            | Yes                               |

[Anonymous sign-ins](../authentication/anonymous-users.md) count as signed-in
users for `authenticated`. If your project allows them, anyone can get a token
that invokes an `authenticated` function. Check `event.__volcano_auth.role`
before acting for a registered account; see [user context](user-context.md).

Set it in `volcano-config.yaml` and run `volcano cloud config deploy`:

```yaml
# volcano-config.yaml
version: 1
functions:
  - name: nightly-report
    visibility: private
  - name: notes-summary
    visibility: authenticated
  - name: contact-form
    visibility: public
```

Or update one function through the API:

```bash
curl -X PATCH https://api.volcano.dev/projects/PROJECT_ID/functions/FUNCTION_ID \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"authenticated"}'
```

Or with the CLI:

```bash
volcano cloud functions update notes-summary --visibility authenticated
```

The function does not run for a caller its level does not admit:

| Caller                                                     | Response                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Signed-in user, `private` function                         | `404` `function not found`                                                 |
| Anon key, `private` function                               | `404` `function not found`                                                 |
| Anon key, `authenticated` function, by id                  | `403` `function is not public; anon keys can only invoke public functions` |
| Anon key, `authenticated` function, by name through an SDK | `404` `function not found`                                                 |
| Anon key without `functions.invoke`, any function          | `403` `anon key does not have functions.invoke permission`                 |

A `private` function answers exactly like one that doesn't exist, so signed-in
users and visitors can't discover its name or id. If your app gets `404` from a
function you deployed, check its visibility. The JavaScript, Python, and Ruby
SDKs report it as a not-found error, and they remember a name that wasn't found
for about 30 seconds, so a running client can keep getting not-found for that
long after you widen the level.

Treat a `public` function as internet-facing: anon keys ship in browser code.
A [Frontend Function route](../frontends/function-routes.md) can only target a
`public` function. While a route targets it, an update or redeploy that would
take the function out of `public` or HTTP mode is refused with `409`, before
anything deploys.

`is_public` is a deprecated alias that requests and responses still carry:
`true` means `public` and `false` means `authenticated`, not `private`. Functions
created before `visibility` existed kept their behavior: `is_public: false`
became `authenticated`, and functions targeted by a Frontend Function route
became `public`. A manifest that still says `public: false` applies
`authenticated` on every deploy; see
[project configuration](../projects/configuration.md#reconciliation-semantics).

## Using environment variables

Access project variables in your function:

### Node.js

```javascript
exports.handler = async (event) => {
  const apiKey = process.env.API_KEY;
  const dbUrl = process.env.DATABASE_URL;
  // Use them
};
```

### Python

```python
import os

def handler(event, context):
    api_key = os.environ.get('API_KEY')
    db_url = os.environ.get('DATABASE_URL')
    # Use them
```

### Ruby

```ruby
def handler(event:, context:)
  api_key = ENV['API_KEY']
  db_url = ENV['DATABASE_URL']
  # Use them
end
```

See [Environment Variables](environment-variables.md) for details.

## Using databases

> **Note:** `DATABASE_URL` carries `application_name=volcano_full_access` (admin access, bypasses
> row-level security) by default. The examples below use it as-is for simplicity. To scope a query
> to the invoking user under RLS, rewrite `application_name` to `volcano_user_access:{user_id}`
> before connecting — see
> [Direct connection](../databases/direct-connection.md#authentication--user-impersonation).

### Node.js

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

exports.handler = async (event) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM posts');
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows),
    };
  } finally {
    client.release();
  }
};
```

### Python

```python
import os
import psycopg2
import json

def handler(event, context):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute('SELECT * FROM posts')
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'body': json.dumps(rows)
    }
```

### Ruby

```ruby
require 'pg'
require 'json'

def handler(event:, context:)
  conn = PG.connect(ENV['DATABASE_URL'])
  result = conn.exec('SELECT * FROM posts')
  rows = result.map { |row| row }
  conn.close

  {
    statusCode: 200,
    body: rows.to_json
  }
end
```

## Managing functions

### List functions

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### Get function details

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/functions/FUNC_ID \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

### Delete a function

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID/functions/FUNC_ID \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

This permanently removes the function.

## What's next

| Guide                                           | Description                                             |
| ----------------------------------------------- | ------------------------------------------------------- |
| [Invoking functions](invoking-functions.md)     | Call your deployed functions                            |
| [Function logs](logs.md)                        | View function execution logs                            |
| [Deploy from GitHub](../projects/git-deploy.md) | Deploy `volcano/functions/` automatically on every push |
| [Examples](../examples/README.md)               | Complete working examples                               |
