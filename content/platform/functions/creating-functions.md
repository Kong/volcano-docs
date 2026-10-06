---
title: "Creating functions"
description: "Deploy functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes."
---

Deploy functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes.

## Supported runtimes

| Language | Runtimes | Default handler |
|----------|----------|-----------------|
| Node.js | nodejs24.x, nodejs22.x | `handler` |
| Python | python3.14, python3.13, python3.12, python3.11, python3.10 | `handler` |
| Ruby | ruby4.0, ruby3.4, ruby3.3 | `handler` |

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
      data: event
    })
  };
};
```

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
volcano/functions/notes.py
volcano/functions/worker.rb
```

Examples:
- `volcano/functions/hello.js` -> function name `hello`
- `volcano/functions/notes.py` -> function name `notes`
- `volcano/functions/worker.rb` -> function name `worker`

### Directory-based functions

Use a directory when a function needs multiple files.

```text
volcano/functions/api/index.js
volcano/functions/jobs/main.py
volcano/functions/reports/main.rb
```

The directory name becomes the function name.

Discovery rules:
- The CLI first looks for `index.*` inside the directory.
- If no `index.*` file exists, it falls back to the first supported runtime file it finds.

Examples:
- `volcano/functions/api/index.js` -> function name `api`
- `volcano/functions/jobs/main.py` -> function name `jobs`

### Shared code

Any file or directory whose basename starts with `_` is treated as shared code and
packaged automatically for every function.

Examples:

```text
volcano/_shared.js
volcano/functions/_helpers/
```

This is useful for shared utilities without requiring each function to duplicate them.

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

## Deploying

Upload as binary file via multipart/form-data:

```bash
# Node.js function
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -F "name=my-node-function" \
  -F "code=@function.zip" \
  -F "runtime=nodejs24.x" \
  -F "handler=index.handler"

# Python function (handler defaults to "handler" if not specified)
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -F "name=my-python-function" \
  -F "code=@function.zip" \
  -F "runtime=python3.12"

# Ruby function (handler defaults to "handler" if not specified)
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
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
  "handler": "index.handler",
  "visibility": "private",
  "is_public": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

Status transitions: `provisioning` → `active` (usually 5-10 seconds).

## Choose who can invoke it

A function's `visibility` decides which credentials can invoke it. New functions
are `private`.

| Visibility | Service keys and schedulers | Your project's signed-in users | Anon keys with `functions.invoke` |
| --- | --- | --- | --- |
| `private` (default) | Yes | No | No |
| `authenticated` | Yes | Yes | No |
| `public` | Yes | Yes | Yes |

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
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility":"authenticated"}'
```

Or with the CLI:

```bash
volcano cloud functions update notes-summary --visibility authenticated
```

The function does not run for a caller its level does not admit:

| Caller | Response |
| --- | --- |
| Signed-in user, `private` function | `404` `function not found` |
| Anon key, `private` function | `404` `function not found` |
| Anon key, `authenticated` function, by id | `403` `function is not public; anon keys can only invoke public functions` |
| Anon key, `authenticated` function, by name through an SDK | `404` `function not found` |
| Anon key without `functions.invoke`, any function | `403` `anon key does not have functions.invoke permission` |

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
  connectionString: process.env.DATABASE_URL
});

exports.handler = async (event) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM posts');
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
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
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

### Get function details

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/functions/FUNC_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

### Delete a function

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID/functions/FUNC_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

This permanently removes the function.

## What's next

| Guide | Description |
|-------|-------------|
| [Invoking functions](invoking-functions.md) | Call your deployed functions |
| [Function logs](logs.md) | View function execution logs |
| [Deploy from GitHub](../projects/git-deploy.md) | Deploy `volcano/functions/` automatically on every push |
| [Examples](../examples/README.md) | Complete working examples |
