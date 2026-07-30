---
title: "Storage Buckets"
description: "Buckets are containers for organizing files in Volcano Storage. Each project can have multiple buckets with different configurations and access policies."
---

Buckets are containers for organizing files in Volcano Storage. Each project can have multiple buckets with different configurations and access policies.

## Bucket properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | string | Bucket name (unique per project) |
| `project_id` | UUID | Parent project |
| `file_size_limit` | integer | Maximum file size in bytes (null = unlimited) |
| `allowed_mime_types` | string[] | Allowed MIME types (empty = all types) |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last modification time |

> **Note:** Public access is controlled at the individual file level using `is_public`, not at the bucket level. See [Policies](./policies.md) for controlling access.

## Managing buckets with the CLI

### Cloud

```bash
volcano storage buckets create user-uploads
volcano storage buckets list
volcano storage buckets get user-uploads
volcano storage buckets update user-uploads --file-size-limit 20971520
volcano storage buckets update user-uploads --allowed-mime image/*
volcano storage buckets update user-uploads --clear-allowed-mimes
volcano storage buckets delete user-uploads
```

### Local mode

```bash
volcano local storage buckets create user-uploads
volcano local storage buckets list
volcano local storage buckets get user-uploads
volcano local storage buckets update user-uploads --file-size-limit 20971520
volcano local storage buckets update user-uploads --allowed-mime image/*
volcano local storage buckets update user-uploads --clear-allowed-mimes
volcano local storage buckets delete user-uploads
```

### Declarative bucket and policy config

```bash
volcano config deploy
volcano config deploy -f volcano-config.yaml
volcano local config deploy
volcano local config deploy -f volcano-config.yaml
```

`volcano config deploy` applies the full project configuration manifest — see
the [project configuration manifest reference](../projects/configuration.md)
for the complete schema. The storage-related sections look like this:

```yaml
version: 1
buckets:
  - name: user-files
    file_size_limit: 10485760
    allowed_mime_types:
      - image/*
      - application/pdf
    policies:
      - name: auth-insert
        operation: INSERT
        definition: auth.uid() IS NOT NULL
      - name: owner-select
        operation: SELECT
        definition: auth.uid() = owner_id
      - name: owner-update
        operation: UPDATE
        definition: auth.uid() = owner_id
      - name: owner-delete
        operation: DELETE
        definition: auth.uid() = owner_id
```

If `-f` is omitted, the CLI auto-discovers in this order:
- `volcano/volcano-config.yaml`
- `./volcano-config.yaml`

Sync behavior:

- Buckets are never created or deleted by the manifest. Create them first
  (`volcano storage buckets create`); a manifest entry for a bucket that does
  not exist is skipped with a warning.
- Existing bucket settings are updated for the fields you provide; omitted
  fields keep their current values.
- When a bucket entry declares `policies`, the list is fully synchronized by
  name: policies in YAML are created or updated (a changed definition is
  replaced atomically, with no authorization gap), and existing policies not
  present in YAML are deleted. An explicit `policies: []` deletes all
  policies.
- Omitting the `policies` key leaves the bucket's policies untouched.

Example: authenticated users can read/write only their own files:

```yaml
version: 1
buckets:
  - name: private-docs
    policies:
      - name: auth-insert
        operation: INSERT
        definition: auth.uid() IS NOT NULL
      - name: owner-select
        operation: SELECT
        definition: auth.uid() = owner_id
      - name: owner-update
        operation: UPDATE
        definition: auth.uid() = owner_id
      - name: owner-delete
        operation: DELETE
        definition: auth.uid() = owner_id
```

Example: any authenticated user can download files in a shared bucket:

```yaml
version: 1
buckets:
  - name: shared-files
    policies:
      - name: auth-insert
        operation: INSERT
        definition: auth.uid() IS NOT NULL
      - name: auth-select
        operation: SELECT
        definition: auth.uid() IS NOT NULL
      - name: auth-delete-owner
        operation: DELETE
        definition: auth.uid() = owner_id
```

Apply with:

```bash
volcano config deploy
volcano local config deploy
```

## Creating buckets

Buckets are created via the REST API using a service key:

```bash
curl -X POST "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-uploads"
  }'
```

Response:

```json
{
  "id": "bucket-abc123",
  "name": "user-uploads",
  "project_id": "project-xyz",
  "file_size_limit": null,
  "allowed_mime_types": [],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Bucket naming rules

- 1-64 characters
- Lowercase letters, numbers, hyphens, and underscores only
- Must be unique within the project

Valid names:
- `avatars`
- `user-uploads`
- `public_assets`
- `files-2024`

Invalid names:
- `My Bucket` (spaces and uppercase)
- `bucket.name` (periods not allowed)
- `a` (too short for meaningful names, but technically valid)

## Access control

Buckets use **policies** to control access. All buckets are private by default - you must create policies to allow access.

### Private files (default)

Files are private by default. Use policies to control who can access them:

```bash
# Create bucket
curl -X POST ".../storage/buckets" \
  -d '{"name": "user-files"}'

# Add owner-only read policy
curl -X POST ".../storage/buckets/user-files/policies" \
  -d '{
    "name": "owner-read",
    "operation": "SELECT",
    "definition": "auth.uid() = owner_id"
  }'
```

### Public files

To share files publicly (without authentication), mark individual files as public:

```javascript
// Make a specific file public
await volcano.storage
  .from('assets')
  .updateVisibility('logo.png', true);

// The file now has a public_url for sharing
console.log(file.public_url);
// https://api.yourapp.com/public/{projectId}/assets/logo.png
```

Public and private files can coexist in the same bucket. Only the file owner
(or a service key) can change file visibility. If the bucket defines `UPDATE`
policies, the owner must also satisfy one of them.

## File size limits

Restrict maximum file size per bucket:

```bash
curl -X POST ".../storage/buckets" \
  -d '{
    "name": "thumbnails",
    "file_size_limit": 1048576
  }'
```

The limit is in bytes:

| Size | Bytes |
|------|-------|
| 1 KB | 1024 |
| 1 MB | 1048576 |
| 10 MB | 10485760 |
| 100 MB | 104857600 |
| 1 GB | 1073741824 |

Uploads exceeding the limit receive a `400 Bad Request` response:

```json
{
  "error": "file size exceeds bucket limit of 1048576 bytes"
}
```

## MIME type restrictions

Restrict allowed file types:

```bash
curl -X POST ".../storage/buckets" \
  -d '{
    "name": "images",
    "allowed_mime_types": ["image/jpeg", "image/png", "image/gif", "image/webp"]
  }'
```

Common MIME types:

| Type | MIME |
|------|------|
| JPEG image | `image/jpeg` |
| PNG image | `image/png` |
| GIF | `image/gif` |
| WebP | `image/webp` |
| PDF | `application/pdf` |
| JSON | `application/json` |
| Plain text | `text/plain` |
| CSV | `text/csv` |
| ZIP | `application/zip` |
| MP4 video | `video/mp4` |
| MP3 audio | `audio/mpeg` |

Uploads with disallowed MIME types receive a `400 Bad Request`:

```json
{
  "error": "MIME type application/pdf is not allowed"
}
```

## Updating buckets

Modify bucket settings:

```bash
curl -X PUT "https://api.yourapp.com/storage/buckets/bucket-id" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "file_size_limit": 5242880,
    "allowed_mime_types": ["image/jpeg", "image/png"]
  }'
```

## Listing buckets

Get all buckets in a project:

```bash
curl "https://api.yourapp.com/storage/buckets" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

Response:

```json
[
  {
    "id": "bucket-abc",
    "name": "avatars",
    "project_id": "project-xyz",
    "file_size_limit": 5242880,
    "allowed_mime_types": ["image/jpeg", "image/png"],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": "bucket-xyz",
    "name": "documents",
    "project_id": "project-xyz",
    "file_size_limit": null,
    "allowed_mime_types": [],
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
]
```

## Getting bucket details

```bash
curl "https://api.yourapp.com/storage/buckets/bucket-id" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

Or by name:

```bash
curl "https://api.yourapp.com/storage/buckets?name=avatars" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

## Deleting buckets

Delete a bucket and all its contents:

```bash
curl -X DELETE "https://api.yourapp.com/storage/buckets/bucket-id" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

> Warning: This permanently deletes all files in the bucket. This operation cannot be undone.

## Example configurations

### Avatar bucket

Small images only:

```bash
curl -X POST ".../storage/buckets" \
  -d '{
    "name": "avatars",
    "file_size_limit": 2097152,
    "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]
  }'
```

### Document storage

PDFs and office documents, larger size:

```bash
curl -X POST ".../storage/buckets" \
  -d '{
    "name": "documents",
    "file_size_limit": 52428800,
    "allowed_mime_types": [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]
  }'
```

### Public website assets

No restrictions, public access:

```bash
curl -X POST ".../storage/buckets" \
  -d '{"name": "public-assets"}'

# Add policy allowing all authenticated users to read
curl -X POST ".../storage/buckets/public-assets/policies" \
  -d '{
    "name": "auth-read",
    "operation": "SELECT",
    "definition": "auth.uid() IS NOT NULL"
  }'

# For truly public access, mark individual files as public
# They will then be accessible at /public/{projectId}/public-assets/{path}
```

### Temporary uploads

User uploads that will be processed:

```bash
curl -X POST ".../storage/buckets" \
  -d '{
    "name": "temp-uploads",
    "file_size_limit": 104857600
  }'

# Users can upload
curl -X POST ".../storage/buckets/temp-uploads/policies" \
  -d '{
    "name": "auth-insert",
    "operation": "INSERT",
    "definition": "auth.uid() IS NOT NULL"
  }'

# Users can read their own uploads
curl -X POST ".../storage/buckets/temp-uploads/policies" \
  -d '{
    "name": "owner-select",
    "operation": "SELECT",
    "definition": "auth.uid() = owner_id"
  }'
```

## Best practices

1. **Use descriptive names** - Choose bucket names that reflect their purpose
2. **Set appropriate limits** - Configure file size and MIME type restrictions
3. **Private by default** - Only mark files as public when they need to be shared without authentication
4. **Separate concerns** - Use different buckets for different file types
5. **Apply policies** - Always configure access policies for security

## Related

- [Storage Overview](overview.md)
- [Storage Policies](policies.md)
- [JavaScript SDK](javascript-sdk.md)
