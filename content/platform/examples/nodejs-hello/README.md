---
title: "Node.js Hello World Example"
description: "This is a simple function that demonstrates the Volcano platform."
---

# Node.js Hello World Example

This is a simple function that demonstrates the Volcano platform.

## Deploy

From `volcano/functions`, zip the handler and upload it. New functions are
`private`, so only service keys could call this one; `visibility=authenticated`
lets your project's signed-in users invoke it too.

```bash
zip function.zip index.js
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -F "name=hello-world" \
  -F "code=@function.zip" \
  -F "runtime=nodejs24.x" \
  -F "handler=index.handler" \
  -F "visibility=authenticated"
```

## Invoke

Call it with a signed-in user's access token:

```bash
curl -X POST https://api.volcano.dev/functions/FUNCTION_ID/invoke \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
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
