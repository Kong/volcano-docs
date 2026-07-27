---
title: "Error Handling"
description: "How the Volcano API reports errors, with status codes and JSON error bodies."
---

## Error Response Format

All errors return JSON:

```json
{
  "error": "descriptive error message"
}
```

## HTTP Status Codes

**2xx Success:**
- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `204 No Content` - Success (no response body)

**4xx Client Errors:**
- `400 Bad Request` - Invalid input or validation failed
- `401 Unauthorized` - Missing, invalid, or expired token
- `403 Forbidden` - Valid token but no permission
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource state conflicts with the request (for example, a duplicate resource or deletion already in progress)
- `429 Too Many Requests` - Rate limit exceeded

**5xx Server Errors:**
- `500 Internal Server Error` - Server-side error
- `503 Service Unavailable` - Function still provisioning

## Common Errors

### Authentication Errors

**401 - Missing Token:**
```json
{"error": "authorization header required"}
```

**401 - Invalid Token:**
```json
{"error": "invalid token"}
```

**401 - Expired Token:**
```json
{"error": "invalid or expired token"}
```

**403 - Wrong Project:**
```json
{"error": "token does not have access to this project"}
```

**403 - Account Banned:**
```json
{"error": "account is banned"}
```

### Anon Key Errors

**401 - Missing Anon Key:**
```json
{"error": "anon key required"}
```

**401 - Invalid Authorization Header:**
```json
{"error": "invalid authorization header"}
```

**401 - Invalid/Tampered Anon Key:**
```json
{"error": "invalid anon key"}
```

**401 - Wrong Project:**
```json
{"error": "anon key does not match project"}
```

**401 - Revoked (old key after regeneration):**
```json
{"error": "anon key has been revoked"}
```

This occurs when using an old anon key JWT after the key has been regenerated. The key ID still exists but the JWT value no longer matches.

**401 - Not Found in Database:**
```json
{"error": "anon key not found"}
```

**403 - Missing Permission:**
```json
{"error": "anon key does not have auth.signup permission"}
```

**403 - CORS Blocked:**
```json
{"error": "origin not allowed by CORS policy"}
```

### Rate Limiting

**429 - Rate Limited:**
```json
{"error": "rate limit exceeded, try again later"}
```

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704128400
```

### Validation Errors

**400 - Invalid Email:**
```json
{"error": "invalid email format"}
```

**400 - Weak Password:**
```json
{"error": "password must be at least 15 characters"}
```

**400 - Missing Field:**
```json
{"error": "name is required"}
```

### Resource Errors

**404 - Not Found:**
```json
{"error": "project not found"}
```

**409 - Duplicate:**
```json
{"error": "user with this email already exists"}
```

**409 - Deletion in progress:**
```json
{"error": "frontend deletion already pending"}
```

Deployments are serialized per resource and coalesced using latest-wins
queueing. A deploy returns `409` only after deletion has been requested; wait
for deletion to finish before creating the resource again.

**503 - Still Provisioning:**
```json
{"error": "function is still provisioning, please try again in a few seconds"}
```

## Error Handling

### JavaScript/TypeScript

```javascript
try {
  const response = await fetch('https://api.volcano.dev/projects', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error
}
```

### With Volcano SDK

```javascript
try {
  await volcano.auth.signIn({...});
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Show rate limit message
  } else if (error.message.includes('invalid')) {
    // Show invalid credentials
  }
}
```

### Retry Logic

```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const resetTime = response.headers.get('X-RateLimit-Reset');
        await sleep(calculateWaitTime(resetTime));
        continue;
      }
      
      if (response.status === 503) {
        // Still provisioning - wait and retry
        await sleep(2000);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}
```

## See Also

- [Authentication](authentication.md) - Auth headers and tokens

