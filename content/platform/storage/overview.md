---
title: "Storage"
description: "Volcano Storage provides S3-compatible file storage with RLS-style access control policies."
---

Volcano Storage provides S3-compatible file storage with RLS-style access control policies. Store user files, images, documents, and any binary data with automatic per-user isolation.

## Features

| Feature | Description |
|---------|-------------|
| S3-backed | Files stored in AWS S3 with high durability |
| RLS policies | Fine-grained access control per object |
| Per-project | Each project has isolated storage namespaces |
| Buckets | Organize files into logical buckets |
| File limits | Set per-bucket file size and MIME type restrictions |
| SDK support | Full JavaScript/TypeScript SDK for browser and Node.js |

## Quick example

### Upload a file

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Sign in first
await volcano.auth.signIn({ email: 'user@example.com', password: 'password' });

// Upload a file
const file = document.querySelector('input[type="file"]').files[0];
const { data, error } = await volcano.storage
  .from('avatars')
  .upload('profile.jpg', file);

if (error) {
  console.error('Upload failed:', error.message);
} else {
  console.log('Uploaded:', data.name);
}
```

### Download a file

```javascript
const { data, error } = await volcano.storage
  .from('avatars')
  .download('profile.jpg');

if (!error) {
  // data is a Blob
  const url = URL.createObjectURL(data);
  img.src = url;
}
```

### List files

```javascript
const { data: files, error } = await volcano.storage
  .from('documents')
  .list('user/reports/');

files.forEach(file => {
  console.log(`${file.name} - ${file.size} bytes`);
});
```

## Access control

Storage uses RLS-style policies to control access. By default, without policies, all access is denied.

### Common policies

```sql
-- Users can only access their own files
CREATE POLICY "owner_access" ON storage_objects
  FOR ALL USING (auth.uid() = owner_id);

-- Anyone can view files in the public folder
CREATE POLICY "public_read" ON storage_objects
  FOR SELECT USING (name LIKE 'public/%');

-- Users can only upload to their own folder
CREATE POLICY "user_folder" ON storage_objects
  FOR INSERT USING ((storage.foldername(name))[1] = auth.uid()::text);
```

Policies are defined per-bucket and support:
- `SELECT` - Read/download files
- `INSERT` - Upload new files
- `UPDATE` - Overwrite existing files
- `DELETE` - Remove files

See [Storage Policies](policies.md) for complete examples.

## Buckets

Buckets organize your files into logical groups. Each bucket can have:

- **File size limit** - Maximum file size in bytes
- **Allowed MIME types** - Restrict to specific file types
- **Access policies** - Control who can read, write, update, and delete files

```javascript
// Create a bucket via API
const response = await fetch('/storage/buckets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'user-uploads',
    file_size_limit: 10 * 1024 * 1024, // 10MB
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/gif']
  })
});
```

See [Buckets](buckets.md) for more details.
For CLI workflows, see the [Volcano CLI docs](https://github.com/Kong/volcano-cli/tree/main/docs).

## Storage limits

Storage limits are enforced per-project based on your plan. Limits are configured via environment variables:

- `FREE_STORAGE_LIMIT` - Storage limit for free plans (in MB)
- `PRO_STORAGE_LIMIT` - Storage limit for pro plans (in MB)

**Error codes for file size violations:**
- `413` - Plan-based storage quota exceeded or plan-based file size limit exceeded
- `400` - Bucket-level `file_size_limit` exceeded, MIME type not allowed, or file exceeds the global 10 GB limit

## Bandwidth

Upload and download traffic (including public file serving) counts toward your
platform user's monthly bandwidth cap (aggregate ingress + egress across owned
projects), configured via `FREE_BANDWIDTH_CAP` / `PRO_BANDWIDTH_CAP` (in GB;
`0` = unlimited). Once the platform user is over the cap, storage requests are
rejected with `429` until the cap increases (plan/override) or the monthly meter
resets.

## File visibility

Files are **private by default**. You can make individual files public:

```javascript
// Make a file public
await volcano.storage
  .from('files')
  .updateVisibility('report.pdf', true);

// Get a shareable public URL (no authentication required)
const { data } = volcano.storage
  .from('files')
  .getPublicUrl('report.pdf');

console.log(data.publicUrl);
// https://api.yourapp.com/public/{projectId}/files/report.pdf
// This URL can be shared anywhere - no SDK needed!
```

Public and private files can coexist in the same bucket. Only the file owner
(or a service key) can change visibility. Configured `UPDATE` policies also
apply to owner visibility changes.

Authenticated downloads use `Cache-Control: private, no-store`.
Public downloads can be cached by browsers and shared caches for up to five
minutes. Visibility changes and deletions can therefore take up to five minutes
to propagate to clients that already cached the file.

## SDK methods

The JavaScript SDK provides these methods:

| Method | Description |
|--------|-------------|
| `from(bucket)` | Select a bucket for operations |
| `upload(path, file)` | Upload a file (private by default) |
| `download(path)` | Download a file as Blob |
| `list(prefix)` | List files with optional prefix |
| `remove(paths)` | Delete one or more files |
| `move(from, to)` | Move/rename a file |
| `copy(from, to)` | Copy a file |
| `updateVisibility(path, isPublic)` | Make file public or private |
| `getPublicUrl(path)` | Get shareable public URL (no auth needed) |

See [JavaScript SDK](javascript-sdk.md) for the complete reference.

## REST API

All storage operations are also available via REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/storage/{bucket}/{path}` | Upload file |
| `GET` | `/storage/{bucket}/{path}` | Download file |
| `DELETE` | `/storage/{bucket}/{path}` | Delete file |
| `GET` | `/storage/{bucket}` | List files |
| `POST` | `/storage/{bucket}/move` | Move file |
| `POST` | `/storage/{bucket}/copy` | Copy file |
| `PATCH` | `/storage/{bucket}/{path}/visibility` | Set public/private |
| `GET` | `/public/{projectId}/{bucket}/{path}` | Download public file (no auth) |

See [Storage API Reference](../api-reference/storage.md) for complete documentation.

## What's next

| Guide | Description |
|-------|-------------|
| [JavaScript SDK](javascript-sdk.md) | Complete SDK reference |
| [Storage Policies](policies.md) | Access control with RLS-style policies |
| [Buckets](buckets.md) | Creating and managing buckets |
| [API Reference](../api-reference/storage.md) | REST API endpoints |
