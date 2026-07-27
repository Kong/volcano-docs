---
title: "CORS Configuration"
description: "Restrict which domains can call your auth endpoints."
---

Restrict which domains can call your auth endpoints.

## What is CORS?

Cross-Origin Resource Sharing controls which websites can make requests to your API.

**Without CORS:**
```text
Any website can use your anon key to call signup/signin
(Even with valid anon key, attackers can embed forms on their sites)
```

**With CORS:**
```text
Only YOUR websites can use your anon key
Attackers blocked even with valid anon key
```

## Enable CORS

**Setting:** `cors_enabled`  
**Default:** false

```json
{
  "cors_enabled": true,
  "cors_allowed_origins": ["https://myapp.com", "http://localhost:3000"]
}
```

## Allowed Origins

**Setting:** `cors_allowed_origins`  
**Type:** Array of strings

List of origins that can call your auth endpoints.

**Examples:**
```json
{
  "cors_allowed_origins": [
    "https://myapp.com",
    "https://app.mycompany.com",
    "http://localhost:3000",
    "http://localhost:5000"
  ]
}
```

**Wildcard subdomains:**
```json
{
  "cors_allowed_origins": [
    "https://*.myapp.com"  // Matches app.myapp.com, api.myapp.com, etc.
  ]
}
```

## How It Works

Request from allowed origin:
```http
POST /auth/signup
Origin: https://myapp.com
Authorization: Bearer ANON_KEY

Response: 201 Created
Access-Control-Allow-Origin: https://myapp.com
```

Request from blocked origin:
```http
POST /auth/signup
Origin: https://evil.com
Authorization: Bearer ANON_KEY

Response: 403 Forbidden
{"error": "origin not allowed by CORS policy"}
```

## Important Notes

**Protocol matters:**
```text
Allowed: https://myapp.com
Blocked: http://myapp.com  (different protocol)
```

**Case sensitive:**
```text
Allowed: https://myapp.com
Blocked: https://MyApp.com  (different case)
```

**Exact match:**
```text
Allowed: https://myapp.com
Blocked: https://www.myapp.com  (different subdomain)
```

## Development Setup

Allow both production and local development:

```json
{
  "cors_enabled": true,
  "cors_allowed_origins": [
    "https://myapp.com",           // Production
    "https://staging.myapp.com",   // Staging
    "http://localhost:3000",       // Local dev
    "http://localhost:5173"        // Vite dev server
  ]
}
```

## Configuration

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "cors_enabled": true,
    "cors_allowed_origins": ["https://myapp.com", "http://localhost:3000"]
  }'
```

## Troubleshooting

**Error: "origin not allowed by CORS policy"**
- Add your domain to `cors_allowed_origins`
- Check protocol (HTTP vs HTTPS)
- Check for typos
- No trailing slashes

**Preflight requests failing:**
- Browser sends OPTIONS request first
- Make sure CORS is configured
- Check browser console for details

## See Also

- [Anon Keys](../security/anon-keys.md) - First layer of security
- [Configuration Overview](overview.md)




