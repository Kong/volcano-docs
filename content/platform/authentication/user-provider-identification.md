---
title: "User Provider Identification"
description: "How to identify which authentication method(s) each user is using in your Volcano project."
---

How to identify which authentication method(s) each user is using in your Volcano project.

## Overview

Every user in Volcano's `auth_users` table can be clearly identified by their authentication method(s). Users can have:

1. **Email/Password only** - Traditional authentication
2. **OAuth only** - Social login (Google, GitHub, etc.)
3. **Hybrid** - Both email/password AND OAuth provider(s)
4. **Anonymous** - Guest users

---

## Database Schema

### auth_users Table

Key fields for identification:

```sql
auth_users:
  - id (UUID)
  - project_id (UUID)
  - email (VARCHAR) - Regular email OR auto-generated for anonymous
  - encrypted_password (VARCHAR) - NULL for OAuth-only/anonymous users
  - raw_user_meta_data (JSONB) - May contain 'provider' key
```

### auth_providers Table

OAuth provider links:

```sql
auth_providers:
  - id (UUID)
  - user_id (UUID) → References auth_users.id
  - provider (VARCHAR) - 'google', 'github', 'microsoft', 'apple'
  - provider_user_id (VARCHAR) - User ID in external system
  - provider_data (JSONB) - Additional provider information
```

---

## How to Identify Users

### Method 1: Email/Password User

Markers:
- `encrypted_password` IS NOT NULL and not empty
- No entries in `auth_providers`

**SQL Query:**

```sql
-- Find all email/password users
SELECT id, email, created_at
FROM auth_users
WHERE project_id = 'your-project-id'
  AND encrypted_password IS NOT NULL
  AND encrypted_password != ''
  AND id NOT IN (SELECT user_id FROM auth_providers);
```

**Programmatic Check:**

```go
user, _ := db.GetAuthUser(userID)
providers, _ := db.ListOAuthProviders(userID)

if user.EncryptedPassword != "" && len(providers) == 0 {
    fmt.Println("Email/password user")
}
```

---

### Method 2: OAuth-Only User

Markers:
- `encrypted_password` IS NULL or empty
- Has entries in `auth_providers`
- `raw_user_meta_data` often contains `"provider": "google"` etc.

**SQL Query:**

```sql
-- Find all OAuth-only users
SELECT u.id, u.email, ap.provider, ap.provider_user_id
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND (u.encrypted_password IS NULL OR u.encrypted_password = '');
```

**Programmatic Check:**

```go
user, _ := db.GetAuthUser(userID)
providers, _ := db.ListOAuthProviders(userID)

if user.EncryptedPassword == "" && len(providers) > 0 {
    fmt.Println("OAuth-only user")
    for _, p := range providers {
        fmt.Printf("  Provider: %s (ID: %s)\n", p.Provider, p.ProviderUserID)
    }
}
```

---

### Method 3: Hybrid User (Password + OAuth)

Markers:
- `encrypted_password` IS NOT NULL
- Has entries in `auth_providers`

**SQL Query:**

```sql
-- Find all hybrid users
SELECT u.id, u.email, 
       COUNT(ap.id) as provider_count,
       STRING_AGG(ap.provider, ', ') as providers
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND u.encrypted_password IS NOT NULL
  AND u.encrypted_password != ''
GROUP BY u.id, u.email;
```

**Programmatic Check:**

```go
user, _ := db.GetAuthUser(userID)
providers, _ := db.ListOAuthProviders(userID)

if user.EncryptedPassword != "" && len(providers) > 0 {
    fmt.Println("Hybrid user - can authenticate with:")
    fmt.Println("  - Email + password")
    for _, p := range providers {
        fmt.Printf("  - %s OAuth\n", p.Provider)
    }
}
```

---

### Method 4: Anonymous User

Markers:
- `encrypted_password` IS NULL or empty
- No entries in `auth_providers`
- `email` contains `@anonymous.volcano.internal`

**SQL Query:**

```sql
-- Find all anonymous users
SELECT id, email, created_at
FROM auth_users
WHERE project_id = 'your-project-id'
  AND (encrypted_password IS NULL OR encrypted_password = '')
  AND email LIKE '%@anonymous.volcano.internal';
```

**Programmatic Check:**

```go
user, _ := db.GetAuthUser(userID)
providers, _ := db.ListOAuthProviders(userID)

if user.EncryptedPassword == "" && 
   len(providers) == 0 && 
   strings.Contains(user.Email, "@anonymous.volcano.internal") {
    fmt.Println("Anonymous user (guest)")
}
```

---

## Complete Identification Function

```go
func GetUserAuthMethods(db *database.DB, userID string) ([]string, error) {
    user, err := db.GetAuthUser(userID)
    if err != nil {
        return nil, err
    }

    methods := []string{}

    // Check for email/password
    if user.EncryptedPassword != "" {
        methods = append(methods, "email_password")
    }

    // Check for OAuth providers
    providers, err := db.ListOAuthProviders(userID)
    if err != nil {
        return nil, err
    }

    for _, p := range providers {
        methods = append(methods, fmt.Sprintf("oauth_%s", p.Provider))
    }

    // Check for anonymous
    if user.EncryptedPassword == "" && 
       len(providers) == 0 && 
       strings.Contains(user.Email, "@anonymous.volcano.internal") {
        methods = append(methods, "anonymous")
    }

    return methods, nil
}

// Usage:
methods, _ := GetUserAuthMethods(db, userID)
// Returns: ["email_password", "oauth_google", "oauth_github"]
```

---

## Query Examples

### Find All Users by Specific Provider

```sql
-- Find all Google users
SELECT u.id, u.email, ap.provider_user_id
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND ap.provider = 'google';

-- Find all GitHub users
SELECT u.id, u.email, ap.provider_user_id
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND ap.provider = 'github';
```

### Count Users by Authentication Method

```sql
-- Count by method
SELECT 
    CASE
        WHEN encrypted_password IS NOT NULL AND encrypted_password != '' 
             AND EXISTS (SELECT 1 FROM auth_providers WHERE user_id = auth_users.id)
            THEN 'hybrid'
        WHEN encrypted_password IS NOT NULL AND encrypted_password != ''
            THEN 'email_password'
        WHEN email LIKE '%@anonymous.volcano.internal'
            THEN 'anonymous'
        ELSE 'oauth_only'
    END as auth_method,
    COUNT(*) as user_count
FROM auth_users
WHERE project_id = 'your-project-id'
GROUP BY auth_method;
```

**Example Result:**

```text
auth_method      | user_count
-----------------|-----------
email_password   | 150
oauth_only       | 75
hybrid           | 50
anonymous        | 25
```

### Find Users with Multiple Providers

```sql
-- Users with multiple OAuth providers
SELECT u.email, COUNT(ap.id) as provider_count,
       STRING_AGG(ap.provider, ', ') as providers
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
GROUP BY u.id, u.email
HAVING COUNT(ap.id) > 1;
```

---

## User Metadata

### OAuth User Metadata

When a user signs up via OAuth, metadata contains provider info:

```json
{
  "raw_user_meta_data": {
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "provider": "google",
    "email_verified": true
  }
}
```

**Access in code:**

```go
user, _ := db.GetAuthUser(userID)

if provider, ok := user.RawUserMetaData["provider"].(string); ok {
    fmt.Printf("User signed up via: %s\n", provider)
}
```

### Provider Data

The `auth_providers` table stores additional provider-specific data:

```json
{
  "provider_data": {
    "email": "user@gmail.com",
    "verified_email": true,
    "name": "John Doe",
    "picture": "https://...",
    "locale": "en"
  }
}
```

---

## Admin Queries

### Get User's Full Auth Profile

```go
func GetUserAuthProfile(db *database.DB, userID string) (*AuthProfile, error) {
    user, err := db.GetAuthUser(userID)
    if err != nil {
        return nil, err
    }

    providers, err := db.ListOAuthProviders(userID)
    if err != nil {
        return nil, err
    }

    profile := &AuthProfile{
        UserID:           user.ID,
        Email:            user.Email,
        HasPassword:      user.EncryptedPassword != "",
        IsAnonymous:      strings.Contains(user.Email, "@anonymous.volcano.internal"),
        LinkedProviders:  []string{},
        AvailableMethods: []string{},
    }

    if profile.HasPassword {
        profile.AvailableMethods = append(profile.AvailableMethods, "email_password")
    }

    for _, p := range providers {
        profile.LinkedProviders = append(profile.LinkedProviders, p.Provider)
        profile.AvailableMethods = append(profile.AvailableMethods, "oauth_"+p.Provider)
    }

    if profile.IsAnonymous {
        profile.AvailableMethods = append(profile.AvailableMethods, "anonymous")
    }

    return profile, nil
}

type AuthProfile struct {
    UserID           string
    Email            string
    HasPassword      bool
    IsAnonymous      bool
    LinkedProviders  []string
    AvailableMethods []string
}
```

**Example Output:**

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "has_password": true,
  "is_anonymous": false,
  "linked_providers": ["google", "github"],
  "available_methods": ["email_password", "oauth_google", "oauth_github"]
}
```

---

## Identification Matrix

| User Type | encrypted_password | auth_providers | email pattern | Auth Methods |
|-----------|-------------------|----------------|---------------|--------------|
| Email/Password | NOT NULL | 0 records | normal email | email_password |
| OAuth Only | NULL | 1+ records | normal email | oauth_google, oauth_github, etc. |
| Hybrid | NOT NULL | 1+ records | normal email | email_password, oauth_google, etc. |
| Anonymous | NULL | 0 records | *@anonymous.volcano.internal | anonymous |

---

## API Response

When you get user info, you can see auth methods:

```javascript
// GET /auth/user
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "encrypted_password": "[hidden]",  // Presence indicates has password
    "raw_user_meta_data": {
      "provider": "google"  // Signup provider (if OAuth)
    }
  }
}

// GET /auth/oauth/providers
{
  "providers": [
    {"provider": "google", "linked_at": "..."},
    {"provider": "github", "linked_at": "..."}
  ]
}
```

---

## Use Cases

### Use Case 1: Show "Set Password" Option

```javascript
async function shouldShowSetPassword(userId) {
  const user = await getUser(userId);
  const providers = await getLinkedOAuthProviders(userId);

  // If OAuth-only user (no password), show "Set Password" option
  if (!user.encrypted_password && providers.length > 0) {
    showSetPasswordButton();
  }
}
```

### Use Case 2: Show "Link Provider" Options

```javascript
async function getAvailableProvidersToLink(userId) {
  const linkedProviders = await getLinkedOAuthProviders(userId);
  const allProviders = ['google', 'github', 'microsoft', 'apple'];
  
  const linkedNames = linkedProviders.map(p => p.provider);
  const availableToLink = allProviders.filter(p => !linkedNames.includes(p));
  
  return availableToLink;  // ['microsoft', 'apple']
}
```

### Use Case 3: Prevent Last Method Removal

```javascript
async function canUnlinkProvider(userId, provider) {
  const user = await getUser(userId);
  const providers = await getLinkedOAuthProviders(userId);

  const hasPassword = !!user.encrypted_password;
  const linkedProviderCount = providers.length;

  // If user has password OR other OAuth providers, can unlink
  if (hasPassword || linkedProviderCount > 1) {
    return true;
  }

  // Cannot unlink if it's the only auth method
  return false;
}
```

---

## Admin Analytics

### Query Authentication Method Distribution

```sql
-- Get breakdown of auth methods
WITH user_methods AS (
  SELECT 
    u.id,
    CASE
      WHEN u.encrypted_password IS NOT NULL AND u.encrypted_password != '' 
           AND EXISTS (SELECT 1 FROM auth_providers WHERE user_id = u.id)
        THEN 'hybrid'
      WHEN u.encrypted_password IS NOT NULL AND u.encrypted_password != ''
        THEN 'email_password_only'
      WHEN u.email LIKE '%@anonymous.volcano.internal'
        THEN 'anonymous'
      WHEN EXISTS (SELECT 1 FROM auth_providers WHERE user_id = u.id)
        THEN 'oauth_only'
      ELSE 'unknown'
    END as primary_method,
    (SELECT STRING_AGG(provider, ', ') FROM auth_providers WHERE user_id = u.id) as oauth_providers
  FROM auth_users u
  WHERE u.project_id = 'your-project-id'
)
SELECT primary_method, COUNT(*) as user_count, 
       COUNT(DISTINCT oauth_providers) as unique_provider_combos
FROM user_methods
GROUP BY primary_method;
```

---

## Provider-Specific Information

### Google Users

```sql
SELECT u.email, ap.provider_user_id, ap.provider_data
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND ap.provider = 'google';
```

**Provider Data Contains:**
- `email` - User's Google email
- `verified_email` - Email verification status
- `name` - Full name
- `picture` - Profile picture URL

### GitHub Users

```sql
SELECT u.email, ap.provider_user_id, ap.provider_data->>'login' as github_username
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND ap.provider = 'github';
```

**Provider Data Contains:**
- `login` - GitHub username
- `avatar_url` - Profile picture
- `name` - Display name

### Microsoft Users

```sql
SELECT u.email, ap.provider_user_id, ap.provider_data->>'displayName' as display_name
FROM auth_users u
INNER JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = 'your-project-id'
  AND ap.provider = 'microsoft';
```

**Provider Data Contains:**
- `id` - Microsoft user ID (UUID)
- `displayName` - Full name
- `mail` or `userPrincipalName` - Email

---

## Examples

### Example 1: List All Auth Methods for User

```javascript
// Frontend using Volcano SDK
async function getUserAuthMethods() {
  // Get user info
  const { user } = await volcano.auth.getUser();
  
  // Get linked OAuth providers
  const providers = await volcano.auth.getLinkedOAuthProviders();
  
  const methods = [];
  
  // Check for password
  // Note: encrypted_password is never returned in API
  // Check metadata instead
  if (user.raw_user_meta_data?.has_password !== false) {
    methods.push('Email & Password');
  }
  
  // Add OAuth providers
  providers.forEach(p => {
    methods.push(`${p.provider.charAt(0).toUpperCase() + p.provider.slice(1)} OAuth`);
  });
  
  // Check for anonymous
  if (user.email?.includes('@anonymous.volcano.internal')) {
    methods.push('Anonymous');
  }
  
  return methods;
  // Example: ["Email & Password", "Google OAuth", "GitHub OAuth"]
}
```

### Example 2: Admin Dashboard - User List with Auth Methods

```javascript
async function loadUserList() {
  const users = await fetch('/auth/users').then(r => r.json());
  
  for (const user of users.data) {
    // Get providers for each user
    const providers = await getProvidersForUser(user.id);
    
    user.authMethods = [];
    
    if (user.has_password) {  // Assuming API returns this
      user.authMethods.push('Email/Password');
    }
    
    providers.forEach(p => {
      user.authMethods.push(p.provider);
    });
    
    console.log(`${user.email}: ${user.authMethods.join(', ')}`);
  }
}

// Output:
// user1@example.com: Email/Password
// user2@example.com: google, github
// user3@example.com: Email/Password, google
// anon-123@anonymous.volcano.internal: anonymous
```

---

## Migration Scenarios

### Find Users to Migrate

**Scenario:** You want to migrate all email/password users to OAuth.

```sql
-- Find email/password only users (no OAuth linked yet)
SELECT id, email, created_at
FROM auth_users
WHERE project_id = 'your-project-id'
  AND encrypted_password IS NOT NULL
  AND encrypted_password != ''
  AND id NOT IN (SELECT user_id FROM auth_providers)
ORDER BY created_at DESC;

-- Email these users: "Link your Google account for easier sign-in!"
```

---

## Security Considerations

### Don't Expose in Public API

The `encrypted_password` field is **never** returned in public APIs for security reasons.

Never return encrypted_password in API responses:

```javascript
// Don't return encrypted_password
{
  "user": {
    "encrypted_password": "$2a$10$..."  // Never expose this
  }
}
```

Instead, use a boolean flag:

```javascript
// Return metadata or separate check
{
  "user": {
    "has_password": true  // Boolean flag
  }
}
```

### Provider user ID security

The `provider_user_id` is sensitive. It's the user's ID in the external system (Google, GitHub, etc.).

| Allowed | Avoid |
|---------|-------|
| Store in database for linking | Expose in public APIs |
| Use for user lookups | Log in plaintext |

---

## Troubleshooting

### "I can't identify OAuth users"

**Check:**

```sql
SELECT u.email, ap.provider, ap.provider_user_id
FROM auth_users u
LEFT JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.id = 'user-id';
```

If `auth_providers` is NULL, user is not OAuth (or OAuth link failed).

### "User has both password and OAuth?"

**This is normal!** Hybrid users have both:

```sql
SELECT 
    u.email,
    (u.encrypted_password IS NOT NULL) as has_password,
    COUNT(ap.id) as oauth_provider_count
FROM auth_users u
LEFT JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.id = 'user-id'
GROUP BY u.id, u.email, u.encrypted_password;
```

Result:
```text
email             | has_password | oauth_provider_count
------------------|--------------|--------------------- 
user@example.com  | true         | 2
```

This user can sign in with password OR either OAuth provider.

---

## Best Practices

### Always check both fields

```go
// Recommended: Check both password and OAuth
user, _ := db.GetAuthUser(userID)
providers, _ := db.ListOAuthProviders(userID)

hasPassword := user.EncryptedPassword != ""
hasOAuth := len(providers) > 0

// Not recommended: Only checking one field
hasPassword := user.EncryptedPassword != ""
// Missing OAuth check
```

### Handle all user types

```go
switch {
case hasPassword && hasOAuth:
    return "hybrid"  // Can use password OR OAuth
case hasPassword:
    return "email_password"
case hasOAuth:
    return "oauth_only"
case isAnonymous:
    return "anonymous"
default:
    return "unknown"  // Shouldn't happen
}
```

### Use joins for efficient queries

```sql
-- Recommended: Single query with JOIN
SELECT u.*, COUNT(ap.id) as provider_count
FROM auth_users u
LEFT JOIN auth_providers ap ON u.id = ap.user_id
WHERE u.project_id = $1
GROUP BY u.id;

-- Not recommended: N+1 queries
-- SELECT * FROM auth_users;
-- For each user: SELECT * FROM auth_providers WHERE user_id = ?
```

---

## Summary

### Clear Identification Markers

| User Type | Identification |
|-----------|----------------|
| **Email/Password** | `encrypted_password != NULL` AND no `auth_providers` |
| **OAuth Only** | `encrypted_password = NULL` AND has `auth_providers` |
| **Hybrid** | `encrypted_password != NULL` AND has `auth_providers` |
| **Anonymous** | `encrypted_password = NULL` AND `email` contains `@anonymous.volcano.internal` |

### Provider Information

For each OAuth provider link:
- `auth_providers.provider` - Provider name (google, github, etc.)
- `auth_providers.provider_user_id` - User's ID in external system
- `auth_providers.provider_data` - Full profile data from provider

### Available queries

| Query | Supported |
|-------|-----------|
| Find all users by auth method | Yes |
| Find all users by specific provider | Yes |
| Count users by auth method | Yes |
| Find hybrid users | Yes |
| Find users with multiple providers | Yes |
| Get user's full auth profile | Yes |




