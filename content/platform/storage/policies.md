---
title: "Storage Policies"
description: "Storage policies provide RLS-style access control for files. Policies are evaluated at request time to determine whether an operation is allowed."
---

Storage policies provide RLS-style access control for files. Policies are evaluated at request time to determine whether an operation is allowed.

For declarative CLI management with `volcano config deploy`, including full `volcano-config.yaml` examples, see [Buckets](./buckets.md#volcano-configyaml-format).

## How policies work

1. Each bucket can have multiple policies
2. Policies are defined per-operation (SELECT, INSERT, UPDATE, DELETE)
3. If **any** policy for an operation returns true, access is granted (OR semantics)
4. If **no** policies exist for an operation, access is **denied** (secure by default)
5. Service keys bypass all policies

## Policy operations

| Operation | Description | Applies to |
|-----------|-------------|------------|
| `SELECT` | Read/download files | `download`, `list` |
| `INSERT` | Upload new files | `upload` (new files) |
| `UPDATE` | Overwrite existing files | `upload` (existing files) |
| `DELETE` | Remove files | `remove`, `move` (source) |

> Note: `move` requires DELETE on the source path and INSERT on the destination path.

## Policy context

Policies have access to these variables:

| Variable | Type | Description |
|----------|------|-------------|
| `auth.uid()` | UUID | Current user's ID (null if anonymous) |
| `auth.role()` | TEXT | User's role: `'anon'`, `'authenticated'`, or `'service_role'` |
| `auth.email()` | TEXT | Current user's email |
| `owner_id` | UUID | The user who uploaded the file |
| `name` | TEXT | The file path/name |
| `bucket.name` | TEXT | The bucket name |
| `bucket.id` | UUID | The bucket ID |

### Helper functions

| Function | Description | Example |
|----------|-------------|---------|
| `storage.foldername(name)` | Returns array of folder parts | `"a/b/file.txt"` → `["a", "b"]` |
| `storage.filename(name)` | Returns the filename without path | `"a/b/file.txt"` → `"file.txt"` |
| `storage.extension(name)` | Returns the file extension (lowercase, no dot) | `"photo.PNG"` → `"png"` |

## Creating policies

Policies are created via the REST API:

```bash
curl -X POST "https://api.yourapp.com/storage/buckets/my-bucket/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "owner-access",
    "operation": "SELECT",
    "definition": "auth.uid() = owner_id"
  }'
```

## Common policy patterns

### Owner-only access

Users can only access files they uploaded:

```sql
-- SELECT: Read own files
auth.uid() = owner_id

-- UPDATE: Update own files
auth.uid() = owner_id

-- DELETE: Delete own files
auth.uid() = owner_id
```

Object visibility changes always require ownership. When a bucket has one or
more `UPDATE` policies, the owner must also satisfy one of them. Service roles
bypass this check. Use an `UPDATE` policy with the definition `false` to reserve
visibility changes for a trusted backend.

### Authenticated users

Any signed-in user can perform the operation:

```sql
auth.uid() IS NOT NULL
-- or
auth.role() = 'authenticated'
```

### Allow all authenticated users

Any signed-in user can read files:

```sql
-- For SELECT operation
auth.uid() IS NOT NULL
```

> **Note:** For truly public access (no authentication required), mark individual files as public using `updateVisibility()`. Public files are accessible via `/public/{projectId}/{bucket}/{path}`.

### Folder-based access

Users can only access files in their own folder:

```sql
-- Files must be in {user_id}/... path
(storage.foldername(name))[1] = auth.uid()::text
```

This matches paths like:
- `abc123/profile.jpg` (where `abc123` is the user ID)
- `abc123/documents/report.pdf`

### Public and private folders

Public files in `public/` folder, private files elsewhere:

```sql
-- SELECT for anonymous users (public folder only)
auth.role() = 'anon' AND name LIKE 'public/%'

-- SELECT for authenticated users (all files)
auth.role() = 'authenticated'
```

### Prefix-based access

Files matching a specific prefix:

```sql
-- Only files in the 'shared/' folder
name LIKE 'shared/%'

-- Only PDF files
name LIKE '%.pdf'
```

### File type restrictions

Restrict uploads by file extension:

```sql
-- Only allow image uploads
storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp')

-- Only allow document uploads
storage.extension(name) IN ('pdf', 'doc', 'docx', 'txt')

-- Block executable files
storage.extension(name) NOT IN ('exe', 'bat', 'sh', 'ps1', 'cmd')

-- Only allow PDF files
storage.extension(name) = 'pdf'
```

### Filename pattern matching

Match specific filename patterns:

```sql
-- Only allow files starting with 'report_'
storage.filename(name) LIKE 'report_%'

-- Only allow files with specific naming convention
storage.filename(name) LIKE 'user_%.pdf'

-- Match exact filename
storage.filename(name) = 'readme.txt'
```

### Combined conditions

Use AND/OR for complex rules:

```sql
-- Authenticated users can only upload images
auth.uid() IS NOT NULL AND storage.extension(name) IN ('jpg', 'png', 'gif')

-- Owner access OR any authenticated user
auth.uid() = owner_id OR auth.uid() IS NOT NULL

-- User's folder AND valid file types
(storage.foldername(name))[1] = auth.uid()::text AND storage.extension(name) IN ('jpg', 'png', 'pdf')
```

## Complete examples

### Private user storage

Each user has their own isolated storage:

```bash
# Create bucket
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "user-files"}'

# Policy: Users can upload to their folder
curl -X POST "https://api.yourapp.com/storage/buckets/user-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "user-insert",
    "operation": "INSERT",
    "definition": "(storage.foldername(name))[1] = auth.uid()::text"
  }'

# Policy: Users can read their folder
curl -X POST "https://api.yourapp.com/storage/buckets/user-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "user-select",
    "operation": "SELECT",
    "definition": "(storage.foldername(name))[1] = auth.uid()::text"
  }'

# Policy: Users can delete their files
curl -X POST "https://api.yourapp.com/storage/buckets/user-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "user-delete",
    "operation": "DELETE",
    "definition": "(storage.foldername(name))[1] = auth.uid()::text"
  }'
```

Usage in SDK:

```javascript
// Upload to user's folder
await volcano.storage
  .from('user-files')
  .upload(`${userId}/avatar.png`, file);

// List user's files
const { data } = await volcano.storage
  .from('user-files')
  .list(`${userId}/`);
```

### Shared team storage

Files owned by users but readable by all team members:

```bash
# Create bucket
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "team-files"}'

# Anyone authenticated can upload
curl -X POST "https://api.yourapp.com/storage/buckets/team-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "auth-insert",
    "operation": "INSERT",
    "definition": "auth.uid() IS NOT NULL"
  }'

# Anyone authenticated can read
curl -X POST "https://api.yourapp.com/storage/buckets/team-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "auth-select",
    "operation": "SELECT",
    "definition": "auth.uid() IS NOT NULL"
  }'

# Only owner can delete
curl -X POST "https://api.yourapp.com/storage/buckets/team-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "owner-delete",
    "operation": "DELETE",
    "definition": "auth.uid() = owner_id"
  }'

# Only owner can update/overwrite
curl -X POST "https://api.yourapp.com/storage/buckets/team-files/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "owner-update",
    "operation": "UPDATE",
    "definition": "auth.uid() = owner_id"
  }'
```

### Public assets with admin control

Public read access, but only admins can write:

```bash
# Create public bucket
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "public-assets"}'

# Anyone can read (public bucket)
curl -X POST "https://api.yourapp.com/storage/buckets/public-assets/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "public-read",
    "operation": "SELECT",
    "definition": "true"
  }'

# No INSERT/UPDATE/DELETE policies = only service keys can modify
```

### Image gallery with file type validation

Only allow image uploads, anyone can view:

```bash
# Create bucket
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "gallery"}'

# Authenticated users can upload images only
curl -X POST "https://api.yourapp.com/storage/buckets/gallery/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "upload-images-only",
    "operation": "INSERT",
    "definition": "auth.uid() IS NOT NULL AND storage.extension(name) IN ('\''jpg'\'', '\''jpeg'\'', '\''png'\'', '\''gif'\'', '\''webp'\'')"
  }'

# All authenticated users can view
curl -X POST "https://api.yourapp.com/storage/buckets/gallery/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "view-all",
    "operation": "SELECT",
    "definition": "auth.uid() IS NOT NULL"
  }'

# Only owner can delete their images
curl -X POST "https://api.yourapp.com/storage/buckets/gallery/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "owner-delete",
    "operation": "DELETE",
    "definition": "auth.uid() = owner_id"
  }'
```

### Secure document storage (block dangerous files)

Allow documents but block executables:

```bash
# Create bucket
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "documents"}'

# Block dangerous file types
curl -X POST "https://api.yourapp.com/storage/buckets/documents/policies" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "name": "block-executables",
    "operation": "INSERT",
    "definition": "auth.uid() IS NOT NULL AND storage.extension(name) NOT IN ('\''exe'\'', '\''bat'\'', '\''sh'\'', '\''ps1'\'', '\''cmd'\'', '\''msi'\'', '\''dll'\'')"
  }'
```

## Multiple policies (OR logic)

When multiple policies exist for an operation, access is granted if **any** policy passes:

```bash
# Policy 1: Owners can read their files
curl -X POST ".../policies" -d '{
  "name": "owner-select",
  "operation": "SELECT",
  "definition": "auth.uid() = owner_id"
}'

# Policy 2: Anyone can read shared folder
curl -X POST ".../policies" -d '{
  "name": "shared-select",
  "operation": "SELECT",
  "definition": "name LIKE 'shared/%'"
}'
```

A user can read a file if:
- They own it (policy 1), OR
- It's in the `shared/` folder (policy 2)

## Service key bypass

Service keys (used server-side) bypass all policies:

```javascript
// Server-side with service key
const volcanoAdmin = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: process.env.ANON_KEY,
  accessToken: process.env.SERVICE_KEY // sk-...
});

// Can read any file regardless of policies
const { data } = await volcanoAdmin.storage
  .from('private-bucket')
  .download('any-file.txt');
```

> Warning: Never expose service keys in client-side code.

## Managing policies

### List policies

```bash
curl "https://api.yourapp.com/storage/buckets/my-bucket/policies" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

### Delete a policy

```bash
curl -X DELETE "https://api.yourapp.com/storage/buckets/my-bucket/policies/policy-id" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

## Debugging policies

If access is unexpectedly denied:

1. Check that policies exist for the operation
2. Verify the user is authenticated (if required)
3. Check the file owner matches the user (for owner-based policies)
4. Verify the file path matches pattern policies
5. Use a service key to verify the file exists

```javascript
// Check if any policies allow access
const { data, error } = await volcano.storage
  .from('bucket')
  .download('file.txt');

if (error?.message.includes('denied')) {
  console.log('No matching policy for this operation');
}
```
