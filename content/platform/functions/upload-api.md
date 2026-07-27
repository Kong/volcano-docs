---
title: "Function Upload API"
description: "Upload a serverless function as a ZIP or tar.gz archive; the API normalizes it to tar.gz and starts the cloud build."
---

## Endpoint

```text
POST /projects/{project_id}/functions
```

Upload a serverless function as a ZIP or `tar.gz` source archive. The API accepts either format, injects build metadata, and stores a normalized `tar.gz` source archive before starting the cloud build.

## Request Format

**Content-Type**: `multipart/form-data`

### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Function name (unique within project) |
| `code` | file (binary) | Yes | ZIP or `tar.gz` archive containing function source code plus dependency manifests/lockfiles |
| `runtime` | string | Yes | Runtime environment |
| `handler` | string | No | Function name to invoke (default: `handler`) |

### Supported Runtimes

- `nodejs22.x`
- `nodejs24.x`
- `python3.10`
- `python3.11`
- `python3.12`
- `python3.13`
- `python3.14`
- `ruby3.3`
- `ruby3.4`
- `ruby4.0`

## Examples

### cURL

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=my-api" \
  -F "code=@function.zip" \
  -F "runtime=nodejs24.x" \
  -F "handler=index.handler"
```

### JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append('name', 'my-api');
formData.append('code', fileInput.files[0]); // File from <input type="file">
formData.append('runtime', 'nodejs24.x');
formData.append('handler', 'index.handler');

const response = await fetch(
  `https://api.volcano.dev/projects/${projectId}/functions`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  }
);

const result = await response.json();
console.log('Function created:', result);
```

### JavaScript (Node.js with form-data)

```javascript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('name', 'my-api');
form.append('code', fs.createReadStream('./function.zip'));
form.append('runtime', 'nodejs24.x');
form.append('handler', 'index.handler');

const response = await fetch(
  `https://api.volcano.dev/projects/${projectId}/functions`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  }
);
```

### Python (requests)

```python
import requests

files = {
    'name': (None, 'my-api'),
    'code': ('function.tar.gz', open('function.tar.gz', 'rb'), 'application/gzip'),
    'runtime': (None, 'python3.12'),
    'handler': (None, 'lambda_function.lambda_handler')
}

response = requests.post(
    f'https://api.volcano.dev/projects/{project_id}/functions',
    headers={'Authorization': f'Bearer {token}'},
    files=files
)

print(response.json())
```

### Go

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
)

func uploadFunction(projectID, token string) error {
	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Add form fields
	writer.WriteField("name", "my-api")
	writer.WriteField("runtime", "nodejs24.x")
	writer.WriteField("handler", "index.handler")
	
	// Add file
	file, _ := os.Open("function.zip")
	defer file.Close()
	
	part, _ := writer.CreateFormFile("code", "function.zip")
	io.Copy(part, file)
	writer.Close()
	
	// Make request
	url := fmt.Sprintf("https://api.volcano.dev/projects/%s/functions", projectID)
	req, _ := http.NewRequest("POST", url, body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	return nil
}
```

You may upload either ZIP or `tar.gz` source archives. The Volcano CLI always uploads `tar.gz`, but direct API clients can use either format.

## Response

### Success (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-api",
  "status": "provisioning",
  "runtime": "nodejs24.x",
  "handler": "index.handler",
  "aws_function_arn": "arn:aws:lambda:us-east-1:...",
  "created_at": "2024-01-05T10:30:00Z",
  "updated_at": "2024-01-05T10:30:00Z"
}
```

### Error (400 Bad Request)

```json
{
  "error": "function code too large"
}
```

## Size Limits

Function uploads must fit within `SOURCE_ARCHIVE_SIZE_LIMIT_MB`. This source archive limit is enforced by the API only, both before storage and after ZIP-to-`tar.gz` normalization. The CLI does not enforce this limit locally.

After upload, the cloud compile build installs dependencies from manifests such as `package.json`, `requirements.txt`, and `Gemfile`. The publish build then checks the final Lambda container image against `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB` before pushing it.

**Recommendations**:

| Package Size | Status |
|-------------|--------|
| < 1MB | Excellent |
| 1-10MB | Good |
| 10-50MB | Large (consider optimization) |
| Above the configured upload limit | Rejected |

## File Requirements

1. **Must be a ZIP or tar.gz file** - Other formats rejected
2. **Include handler file** - e.g., `index.js` for `index.handler`
3. **Include dependency manifests/lockfiles** - Do not include installed dependency directories for cloud deploys
4. **No symlink entries** - Uploaded source archives cannot contain symlinks. Safe symlinks created during the cloud build, such as package-manager workspace links, are materialized before publish.
5. **Valid archive structure** - The archive must be readable by Volcano

## Direct Upload Layout Inference

When you upload directly to the API, Volcano generates `.volcano/function-build.json` automatically. You do not need to create this file.

Volcano infers build roots deterministically:

- `function_root` is the directory containing the single runtime entry file when exactly one is found: `index.js`/`index.mjs` for Node.js, `main.py` for Python, or `main.rb` for Ruby.
- If there is no root-level file and all files are under one top-level directory, that top-level directory becomes `function_root`.
- Otherwise, `function_root` is the archive root (`.`).
- `install_root` is the closest dependency manifest directory that contains `function_root`. If no manifest applies, it falls back to `function_root`.

Recommended direct-upload layouts:

```text
# Simple function
index.js
package.json
package-lock.json

# Nested function
apps/api/index.js
apps/api/package.json

# Monorepo function with root install
package.json
package-lock.json
apps/api/index.js
```

## Common Errors

### "code file is required"

You forgot to include the `code` field:

```bash
# Bad - missing code
curl -F "name=my-func" ...

# Good - includes code
curl -F "name=my-func" -F "code=@function.zip" ...
```

### "code must be a valid .tar.gz or .zip archive"

The file you uploaded isn't a supported archive:

```bash
# Check file type
file function.zip
# Should output: "Zip archive data"
```

### "function code too large"

Your source archive exceeds `SOURCE_ARCHIVE_SIZE_LIMIT_MB`. Common solutions:
1. Remove unnecessary files
2. Bundle and minify application code
3. Exclude installed dependencies, dependency caches, and development-only files

### "Lambda target container image is too large"

The cloud publish build created a final Lambda image larger than `LAMBDA_TARGET_CONTAINER_SIZE_LIMIT_MB`. Remove unnecessary runtime files, reduce dependency size, or split the function into smaller functions.

## Updating a Function

Use the same endpoint with the same function name:

```bash
# First deployment
curl -F "name=my-api" -F "code=@v1.zip" ...

# Update (same name, new code)
curl -F "name=my-api" -F "code=@v2.zip" ...
```

Returns `200 OK` for updates (not `201 Created`).

## Batch Deployments

`POST /projects/{project_id}/functions/batch` accepts multiple ZIP or `tar.gz` source archives in one multipart request. Each function still gets its own compile/publish workflow.

A single batch request can include up to 100 functions. Use multiple batch requests for larger projects.

If one function fails before its workflow starts, successful functions are left running. Failed new functions are deleted, and failed updates are rolled back to their previous metadata/status where possible. Partial failures are returned in the response `failed` array.

## Benefits of Binary Upload

**No base64 overhead** - 33% more efficient
**Faster uploads** - Direct binary transfer
**Simpler** - Standard file upload
**Works with standard tooling** - Any client that can send multipart form data can upload functions
**Browser compatible** - Works with `<input type="file">`  


