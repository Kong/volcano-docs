---
title: "Python Data Processing Example"
description: "A function that processes data arrays and demonstrates environment variable usage."
---

# Python Data Processing Example

A function that processes data arrays and demonstrates environment variable usage.

## Deploy

1. Create a ZIP file:
   ```bash
   zip function.zip handler.py
   ```

2. Base64 encode it:
   ```bash
   CODE=$(base64 -i function.zip)
   ```

3. Deploy using the API:
   ```bash
   curl -X POST http://localhost:8000/projects/{project-id}/functions \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"dataProcessor\",\"code\":\"$CODE\",\"runtime\":\"python3.11\",\"handler\":\"handler.handler\"}"
   ```

## Set Environment Variables

```bash
curl -X POST http://localhost:8000/projects/{project-id}/variables \
  -H "Content-Type: application/json" \
  -d '{"name":"API_KEY","value":"my-secret-key"}'
```

## Invoke

```bash
curl -X POST http://localhost:8000/functions/{function-id}/invoke \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"data":["item1","item2","item3"]}}'
```
