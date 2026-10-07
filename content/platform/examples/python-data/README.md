---
title: "Python Data Processing Example"
description: "A function that processes data arrays and demonstrates environment variable usage."
---

# Python Data Processing Example

A function that processes data arrays and demonstrates environment variable usage.

## Deploy

Zip the handler and upload it. New functions are `private`, so only service
keys could call this one; `visibility=authenticated` lets your project's
signed-in users invoke it too.

```bash
zip function.zip main.py
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/functions \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -F "name=data-processor" \
  -F "code=@function.zip" \
  -F "runtime=python3.12" \
  -F "visibility=authenticated"
```

## Set Environment Variables

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/variables \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"API_KEY","value":"my-secret-key"}'
```

## Invoke

Call it with a signed-in user's access token:

```bash
curl -X POST https://api.volcano.dev/functions/FUNCTION_ID/invoke \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"data":["item1","item2","item3"]}}'
```
