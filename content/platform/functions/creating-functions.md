---
title: "Creating functions"
description: "Deploy serverless functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes."
---

Deploy serverless functions to Volcano. Volcano supports Node.js, Python, and Ruby runtimes.

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

Local mode does not run the cloud build job, so local functions still rely on dependencies installed in your local project.

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

Cloud uploads are limited by `SOURCE_ARCHIVE_SIZE_LIMIT_MB`, and that limit is enforced by the API only. The CLI does not reject function archives based on local file or archive size. After the cloud build installs dependencies, the publish build rejects final Lambda container images larger than `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB`.

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
  "created_at": "2024-01-01T00:00:00Z"
}
```

Status transitions: `provisioning` → `active` (usually 5-10 seconds).

## Function visibility

Functions are private by default (`is_public: false`).

- `private`: can be invoked with a service key or auth user access token
- `public`: can also be invoked with anon keys that include `functions.invoke`

In the GUI (`Functions` table), use the lock toggle to switch between private/public:
- closed lock = private
- open lock = public

When making a function public, treat it as internet-facing if your anon key is exposed in frontend code.

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
| [Examples](../examples/README.md) | Complete working examples |
