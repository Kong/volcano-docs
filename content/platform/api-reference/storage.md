---
title: "Storage API Reference"
description: "REST API endpoints for Volcano Storage operations."
---

REST API endpoints for Volcano Storage operations.

## Authentication

Storage endpoints accept three types of authentication:

| Type | Header | Access |
|------|--------|--------|
| User token | `Authorization: Bearer <access_token>` | Subject to RLS policies |
| Anon key | `Authorization: Bearer <anon_key>` | Subject to RLS policies (role: anon) |
| Service key | `Authorization: Bearer <service_key>` | Bypasses all policies |

## Bucket management

### Create bucket

Creates a new storage bucket.

```http
POST /projects/{project_id}/storage/buckets
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request body:**

```json
{
  "name": "user-uploads",
  "file_size_limit": 10485760,
  "allowed_mime_types": ["image/jpeg", "image/png"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Bucket name (1-64 chars, alphanumeric with hyphens/underscores) |
| `file_size_limit` | integer | No | Max file size in bytes (null = unlimited) |
| `allowed_mime_types` | string[] | No | Allowed MIME types (empty = all) |

**Response: 201 Created**

```json
{
  "id": "bucket-abc123",
  "name": "user-uploads",
  "project_id": "project-xyz",
  "file_size_limit": 10485760,
  "allowed_mime_types": ["image/jpeg", "image/png"],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### List buckets

```http
GET /projects/{project_id}/storage/buckets
Authorization: Bearer <platform_token>
```

**Response: 200 OK**

```json
{
  "buckets": [
    {
      "id": "bucket-abc123",
      "name": "avatars",
      "file_size_limit": 2097152,
      "allowed_mime_types": ["image/jpeg", "image/png"],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get bucket

```http
GET /projects/{project_id}/storage/buckets/{bucket_name}
Authorization: Bearer <platform_token>
```

**Response: 200 OK**

```json
{
  "id": "bucket-abc123",
  "name": "avatars",
  "project_id": "project-xyz",
  "file_size_limit": 2097152,
  "allowed_mime_types": ["image/jpeg", "image/png"],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Update bucket

```http
PATCH /projects/{project_id}/storage/buckets/{bucket_name}
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request body:**

```json
{
  "file_size_limit": 5242880,
  "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]
}
```

**Response: 200 OK**

Returns the updated bucket object.

### Delete bucket

Deletes a bucket and all its contents.

```http
DELETE /projects/{project_id}/storage/buckets/{bucket_name}
Authorization: Bearer <platform_token>
```

**Response: 200 OK**

```json
{
  "message": "bucket deleted"
}
```

## Policy management

### Create policy

```http
POST /storage/buckets/{bucket_id}/policies
Authorization: Bearer <service_key>
Content-Type: application/json
```

**Request body:**

```json
{
  "name": "owner-access",
  "operation": "SELECT",
  "definition": "auth.uid() = owner_id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Policy name (unique per bucket) |
| `operation` | string | Yes | `SELECT`, `INSERT`, `UPDATE`, or `DELETE` |
| `definition` | string | Yes | Policy expression |

**Response: 201 Created**

```json
{
  "id": "policy-xyz789",
  "bucket_id": "bucket-abc123",
  "name": "owner-access",
  "operation": "SELECT",
  "definition": "auth.uid() = owner_id",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### List policies

```http
GET /storage/buckets/{bucket_id}/policies
Authorization: Bearer <service_key>
```

**Response: 200 OK**

```json
{
  "policies": [
    {
      "id": "policy-xyz789",
      "name": "owner-access",
      "operation": "SELECT",
      "definition": "auth.uid() = owner_id"
    }
  ]
}
```

### Delete policy

```http
DELETE /storage/buckets/{bucket_id}/policies/{policy_id}
Authorization: Bearer <service_key>
```

**Response: 200 OK**

```json
{
  "message": "policy deleted"
}
```

## Object operations

### Upload file

Upload a file to storage.

```http
POST /storage/{bucket_name}/{path}
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request body:**

Multipart form with a `file` field containing the file data.

```bash
curl -X POST "https://api.yourapp.com/storage/avatars/user/profile.jpg" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

**Response: 201 Created**

```json
{
  "id": "obj-123",
  "bucket_id": "bucket-abc",
  "name": "user/profile.jpg",
  "owner_id": "user-xyz",
  "size": 102400,
  "mime_type": "image/jpeg",
  "etag": "\"abc123\"",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Metadata limits:**

Files can include custom metadata (key-value pairs) with the following limits:
- Maximum 50 keys per file
- Maximum 10KB total serialized size
- Exceeding limits returns `400 Bad Request`

**Error responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid MIME type, invalid path, or metadata exceeds limits |
| 401 | Not authenticated |
| 403 | Access denied by policy |
| 404 | Bucket not found |
| 413 | File size exceeds bucket limit, plan-based limit, or project storage quota |

### Download file

Download a file from storage.

```http
GET /storage/{bucket_name}/{path}
Authorization: Bearer <token>
```

**Response: 200 OK**

Binary file content with appropriate `Content-Type` header.

**Headers:**

| Header | Description |
|--------|-------------|
| `Content-Type` | MIME type of the file |
| `Content-Length` | File size in bytes |
| `ETag` | File ETag for caching |
| `Accept-Ranges` | `bytes` (supports range requests) |

**Range requests:**

```http
GET /storage/{bucket_name}/{path}
Authorization: Bearer <token>
Range: bytes=0-1023
```

Returns `206 Partial Content` with `Content-Range` header.

**Range header format:**
- Valid format: `bytes=start-end` or `bytes=start-`
- Examples: `bytes=0-1023`, `bytes=1000-`, `bytes=500-1500`
- Invalid formats return `400 Bad Request`

### Delete file

```http
DELETE /storage/{bucket_name}/{path}
Authorization: Bearer <token>
```

**Response: 200 OK**

```json
{
  "message": "object deleted"
}
```

### List files

List files in a bucket.

```http
GET /storage/{bucket_name}
Authorization: Bearer <token>
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `prefix` | string | Filter by path prefix |
| `limit` | integer | Max results (default: 50, max: 1000) |
| `cursor` | string | Pagination cursor |

**Example:**

```http
GET /storage/documents?prefix=reports/&limit=50
Authorization: Bearer <token>
```

**Response: 200 OK**

```json
{
  "objects": [
    {
      "id": "obj-123",
      "bucket_id": "bucket-abc",
      "name": "reports/q1-2024.pdf",
      "owner_id": "user-xyz",
      "size": 524288,
      "mime_type": "application/pdf",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "next_cursor": "cursor-abc123"
}
```

### Move file

Move or rename a file within a bucket.

```http
POST /storage/{bucket_name}/move
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "from": "drafts/report.docx",
  "to": "published/report.docx"
}
```

**Response: 200 OK**

Returns the updated object.

**Policies required:**
- DELETE on source path
- INSERT on destination path

### Copy file

Create a copy of a file.

```http
POST /storage/{bucket_name}/copy
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "from": "templates/invoice.pdf",
  "to": "invoices/2024-001.pdf"
}
```

**Response: 201 Created**

Returns the new object.

**Policies required:**
- SELECT on source path
- INSERT on destination path

### Update file visibility

Change whether a file is public or private. Only the file owner or a service key can change visibility.

```http
PATCH /storage/{bucket_name}/{path}/visibility
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "is_public": true
}
```

**Response: 200 OK**

```json
{
  "id": "obj-123",
  "bucket_id": "bucket-abc",
  "name": "document.pdf",
  "owner_id": "user-xyz",
  "is_public": true,
  "size": 102400,
  "mime_type": "application/pdf",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T12:00:00Z"
}
```

**Error responses:**

| Status | Description |
|--------|-------------|
| 403 | Not the file owner |
| 404 | File not found |

**Notes:**
- Files are **private by default** when uploaded
- Public files can be downloaded with just an anon key (no user authentication)
- Private files require authentication and must pass policy checks
- All downloads (public and private) go through the Volcano API - no direct S3 access

## Error responses

All endpoints return errors in this format:

```json
{
  "error": "Error message describing the issue"
}
```

### Common error codes

| Status | Description |
|--------|-------------|
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (policy denied access) |
| 404 | Not found (bucket or object doesn't exist) |
| 413 | Payload too large (storage limit exceeded) |
| 500 | Internal server error |

### Policy errors

```json
{
  "error": "access denied by storage policy"
}
```

This occurs when:
- No policies exist for the operation
- No policy's conditions are met

### Limit errors

```json
{
  "error": "file size exceeds bucket limit of 5242880 bytes"
}
```

```json
{
  "error": "file size exceeds plan limit of 100 MB"
}
```

```json
{
  "error": "storage limit exceeded (used: 450.00 MB, limit: 512 MB)"
}
```

### Path validation errors

```json
{
  "error": "invalid or missing object path"
}
```

Paths cannot contain:
- `..` (path traversal)
- Null bytes
- Absolute paths (starting with `/`)
- Control characters

## Resumable uploads

For large files, use the resumable upload feature via the unified endpoint. This allows:
- Uploading files in parts (chunks)
- Resuming interrupted uploads
- Better handling of network issues
- Memory-efficient uploads for very large files

**Note:** Both simple and resumable uploads use the same base endpoint (`POST /storage/{bucket}/{path}`). The upload type is determined by the `Content-Type` header.

### Create upload session

Initiates a new resumable upload session by sending JSON to the upload endpoint.

```http
POST /storage/{bucket_name}/{path}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "content_type": "video/mp4",
  "total_size": 5368709120,
  "part_size": 26214400
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content_type` | string | Yes | MIME type of the file |
| `total_size` | integer | Yes | Total file size in bytes (limited by plan storage quota) |
| `part_size` | integer | No | Part size in bytes (default: 25MB, min: 5MB, max: 25MB) |

**Response: 201 Created**

```json
{
  "id": "session-abc123",
  "part_size": 26214400,
  "total_parts": 205,
  "expires_at": "2024-01-22T10:30:00Z"
}
```

**Notes:**
- Sessions expire after 7 days
- Subject to INSERT policy checks
- Part size is automatically adjusted to meet S3 requirements

### Get upload session status

Retrieves the status of an upload session using the `X-Upload-Session` header.

```http
GET /storage/{bucket_name}/{path}
Authorization: Bearer <token>
X-Upload-Session: session-abc123
```

**Response: 200 OK**

```json
{
  "id": "session-abc123",
  "status": "uploading",
  "object_path": "videos/large-file.mp4",
  "content_type": "video/mp4",
  "total_size": 5368709120,
  "part_size": 26214400,
  "total_parts": 205,
  "parts_uploaded": 100,
  "bytes_uploaded": 2621440000,
  "parts": [
    {"part_number": 1, "etag": "\"abc123\"", "size": 26214400},
    {"part_number": 2, "etag": "\"def456\"", "size": 26214400}
  ],
  "expires_at": "2024-01-22T10:30:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Upload part

Uploads a single part using PUT with session headers.

```http
PUT /storage/{bucket_name}/{path}
Authorization: Bearer <token>
X-Upload-Session: session-abc123
X-Part-Number: 1
Content-Type: application/octet-stream
```

**Request body:** Binary part data

**Response: 200 OK**

```json
{
  "part_number": 1,
  "etag": "\"abc123\"",
  "size": 26214400
}
```

**Notes:**
- Part numbers start at 1
- All parts except the last must be at least 5MB
- Parts can be uploaded in any order
- Re-uploading a part overwrites the previous upload

### Complete upload session

Completes a resumable upload using POST with session headers.

```http
POST /storage/{bucket_name}/{path}
Authorization: Bearer <token>
X-Upload-Session: session-abc123
X-Upload-Complete: true
```

**Response: 200 OK**

```json
{
  "object": {
    "id": "obj-xyz789",
    "bucket_id": "bucket-abc123",
    "name": "videos/large-file.mp4",
    "size": 5368709120,
    "mime_type": "video/mp4",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Abort upload session

Aborts a resumable upload using DELETE with session header.

```http
DELETE /storage/{bucket_name}/{path}
Authorization: Bearer <token>
X-Upload-Session: session-abc123
```

**Response: 200 OK**

```json
{
  "message": "upload session aborted"
}
```

### Resumable upload example

```bash
# 1. Create upload session for a 500MB file
curl -X POST "https://api.yourapp.com/storage/videos/movie.mp4" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "video/mp4",
    "total_size": 524288000
  }'

# Response: {"id": "session-123", "part_size": 26214400, "total_parts": 20, ...}

# 2. Upload parts (can be done in parallel)
curl -X PUT "https://api.yourapp.com/storage/videos/movie.mp4" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Upload-Session: session-123" \
  -H "X-Part-Number: 1" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @part1.bin

# 3. Check progress (optional)
curl "https://api.yourapp.com/storage/videos/movie.mp4" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Upload-Session: session-123"

# 4. Complete upload after all parts are uploaded
curl -X POST "https://api.yourapp.com/storage/videos/movie.mp4" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Upload-Session: session-123" \
  -H "X-Upload-Complete: true"
```

### Resumable upload limits

| Limit | Value |
|-------|-------|
| Maximum file size | Limited by plan-based file size limit and storage quota |
| Minimum part size | 5MB |
| Maximum part size | 25MB |
| Default part size | 25MB |
| Maximum parts | 10,000 |
| Session expiry | 7 days |

**Plan-based file size limits:**
- **FREE tier**: Maximum file size is configured per deployment (e.g., 100MB)
- **PRO tier**: Higher limits available (e.g., 1GB or more)

Files exceeding the plan-based limit will be rejected with HTTP 413 at upload time (for simple uploads) or when creating a resumable upload session.

**Note:** The 25MB maximum part size is a memory safety limit. Each part is buffered in memory to support retries and error recovery. With a 25MB limit, even 100 concurrent uploads use at most ~2.5GB of memory.

### When to use resumable uploads

Use **simple upload** (`POST /storage/{bucket}/{path}` with `multipart/form-data`) for:
- Small files (under 100MB)
- Simple uploads that don't need resume capability
- Direct uploads from forms

Use **resumable upload** (`POST /storage/{bucket}/{path}` with `application/json`) for:
- Large files (over 100MB)
- Uploads over unreliable networks
- Files that need resume capability if interrupted
- Very large files (up to 5TB with sufficient plan quota)

### Session expiry

Upload sessions expire after 7 days. This is independent of token expiry - if your authentication token expires, you can re-authenticate and continue uploading to the same session using the session ID. The session is tied to the user who created it, so only that user (or a service key) can continue the upload.

## Rate limits

Storage operations are subject to rate limiting:

| Operation | Limit |
|-----------|-------|
| Upload | 100 requests/minute |
| Download | 1000 requests/minute |
| List | 100 requests/minute |
| Delete | 100 requests/minute |

Exceeding limits returns `429 Too Many Requests`.

## Examples

### Upload with curl

```bash
curl -X POST "https://api.yourapp.com/storage/avatars/profile.jpg" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@./profile.jpg"
```

### Download with curl

```bash
curl "https://api.yourapp.com/storage/documents/report.pdf" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o report.pdf
```

### List with pagination

```bash
# First page
curl "https://api.yourapp.com/storage/uploads?limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Response includes next_cursor
# Next page
curl "https://api.yourapp.com/storage/uploads?limit=50&cursor=abc123" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Admin endpoints

These endpoints are for platform administrators and require a platform user token (not anon/service keys).

### List all objects in project

Returns a paginated list of all storage objects across all buckets in the project.

```http
GET /projects/{projectId}/storage/objects
Authorization: Bearer <platform_token>
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner_id` | uuid | Filter by owner user ID |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 50, max: 100) |

**Response: 200 OK**

```json
{
  "data": [
    {
      "id": "obj-abc123",
      "bucket_id": "bucket-xyz",
      "bucket_name": "avatars",
      "name": "users/123/profile.jpg",
      "owner_id": "user-456",
      "is_public": false,
      "size": 102400,
      "mime_type": "image/jpeg",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 150,
  "has_more": true
}
```

### Get storage statistics

Returns aggregate storage statistics for the project.

```http
GET /projects/{projectId}/storage/stats
Authorization: Bearer <platform_token>
```

**Response: 200 OK**

```json
{
  "bucket_count": 3,
  "object_count": 1250,
  "total_size": 5368709120
}
```

| Field | Description |
|-------|-------------|
| `bucket_count` | Number of storage buckets |
| `object_count` | Total number of stored files |
| `total_size` | Total storage used in bytes |
