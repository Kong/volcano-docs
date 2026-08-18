---
title: "Node.js Hello World Example"
description: "This is a simple function that demonstrates the Volcano Hosting platform."
---

# Node.js Hello World Example

This is a simple function that demonstrates the Volcano Hosting platform.

## Deploy

1. Create a ZIP file:
   ```bash
   zip function.zip index.js
   ```

2. Base64 encode it:
   ```bash
   CODE=$(base64 -i function.zip)
   ```

3. Deploy using the API:
   ```bash
   curl -X POST http://localhost:8000/projects/{project-id}/functions \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"helloWorld\",\"code\":\"$CODE\",\"runtime\":\"nodejs24.x\",\"handler\":\"index.handler\"}"
   ```

## Invoke

```bash
curl -X POST http://localhost:8000/functions/{function-id}/invoke \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"name":"Volcano"}}'
```

## Expected Response

```json
{
  "status_code": 200,
  "payload": {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "{\"message\":\"Hello, Volcano!\",\"environment\":\"production\",\"timestamp\":\"2024-01-01T00:00:00.000Z\"}"
  }
}
```
