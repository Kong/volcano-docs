---
title: "Storage JavaScript SDK"
description: "The Volcano JavaScript SDK provides a Supabase-like interface for storage operations."
---

The Volcano JavaScript SDK provides a Supabase-like interface for storage operations. All methods return promises with `{ data, error }` patterns for consistent error handling.

## Installation

```bash
npm install @volcano.dev/sdk
# or
yarn add @volcano.dev/sdk
```

## Setup

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

// Sign in to access storage
await volcano.auth.signIn({ email: 'user@example.com', password: 'password' });
```

## Selecting a bucket

All storage operations start by selecting a bucket:

```javascript
const bucket = volcano.storage.from('my-bucket');
```

The returned object provides all file operations for that bucket.

## Upload

Upload files to storage. Supports `File`, `Blob`, and `ArrayBuffer` inputs.

### Basic upload

```javascript
// From file input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const { data, error } = await volcano.storage
  .from('avatars')
  .upload('user/avatar.png', file);

if (error) {
  console.error('Upload failed:', error.message);
} else {
  console.log('Uploaded:', data);
  // { id, name, size, mime_type, created_at, ... }
}
```

### Upload with custom content type

```javascript
const blob = new Blob([jsonData], { type: 'application/json' });

const { data, error } = await volcano.storage
  .from('data')
  .upload('config.json', blob, {
    contentType: 'application/json'
  });
```

### Upload from ArrayBuffer

```javascript
const buffer = await file.arrayBuffer();

const { data, error } = await volcano.storage
  .from('files')
  .upload('binary.dat', buffer, {
    contentType: 'application/octet-stream'
  });
```

### Drag and drop upload

```javascript
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  
  for (const file of e.dataTransfer.files) {
    const { data, error } = await volcano.storage
      .from('uploads')
      .upload(file.name, file);
    
    if (error) {
      console.error(`Failed to upload ${file.name}:`, error.message);
    }
  }
});
```

## Download

Download files as `Blob` objects.

### Basic download

```javascript
const { data, error } = await volcano.storage
  .from('documents')
  .download('report.pdf');

if (error) {
  console.error('Download failed:', error.message);
  return;
}

// data is a Blob
const url = URL.createObjectURL(data);
window.open(url);
```

### Download and display image

```javascript
const { data, error } = await volcano.storage
  .from('avatars')
  .download('user/profile.jpg');

if (!error) {
  const img = document.getElementById('avatar');
  img.src = URL.createObjectURL(data);
}
```

### Download and save

```javascript
const { data, error } = await volcano.storage
  .from('exports')
  .download('data.csv');

if (!error) {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'data.csv';
  link.click();
  URL.revokeObjectURL(url);
}
```

### Partial download (Range requests)

```javascript
// Download first 1KB of a file
const { data, error } = await volcano.storage
  .from('large-files')
  .download('video.mp4', { range: 'bytes=0-1023' });
```

## List files

List files in a bucket with optional prefix filtering and pagination.

### List all files

```javascript
const { data: files, error, nextCursor } = await volcano.storage
  .from('uploads')
  .list();

if (!error) {
  files.forEach(file => {
    console.log(`${file.name} - ${file.size} bytes - ${file.mime_type}`);
  });
}
```

### List with prefix (folder)

```javascript
const { data: files, error } = await volcano.storage
  .from('uploads')
  .list('user/documents/');

// Returns only files starting with "user/documents/"
```

### Pagination

```javascript
// First page
const { data: files, nextCursor } = await volcano.storage
  .from('uploads')
  .list('', { limit: 100 });

// Next page
if (nextCursor) {
  const { data: moreFiles } = await volcano.storage
    .from('uploads')
    .list('', { limit: 100, cursor: nextCursor });
}
```

### File object properties

Each file in the list includes:

```typescript
interface StorageObject {
  id: string;           // Unique identifier
  bucket_id: string;    // Parent bucket ID
  name: string;         // Full path/name
  owner_id?: string;    // User who uploaded the file
  size: number;         // Size in bytes
  mime_type: string;    // MIME type
  etag?: string;        // Entity tag for caching
  metadata?: object;    // Custom metadata
  created_at: string;   // ISO timestamp
  updated_at: string;   // ISO timestamp
}
```

## Delete

Delete one or more files.

### Delete single file

```javascript
const { data, error } = await volcano.storage
  .from('uploads')
  .remove('old-file.txt');

if (!error) {
  console.log('Deleted:', data.deleted);
}
```

### Delete multiple files

```javascript
const { data, error } = await volcano.storage
  .from('uploads')
  .remove(['file1.txt', 'file2.txt', 'folder/file3.txt']);

if (error) {
  // Note: error is set if ANY file failed, but data.deleted still
  // contains the list of successfully deleted files
  console.error('Some files failed to delete:', error.message);
}

// Always check data.deleted for successfully removed files
console.log('Successfully deleted:', data?.deleted || []);
```

> **Partial success:** When deleting multiple files, `error` is set if any file fails, but `data.deleted` still contains the paths of successfully deleted files. Always check both.

## Move / Rename

Move or rename a file within the same bucket.

```javascript
const { data, error } = await volcano.storage
  .from('documents')
  .move('drafts/report.docx', 'published/report.docx');

if (!error) {
  console.log('Moved to:', data.name);
}
```

## Copy

Create a copy of a file.

```javascript
const { data, error } = await volcano.storage
  .from('templates')
  .copy('invoice-template.pdf', 'invoices/2024-001.pdf');

if (!error) {
  console.log('Copied to:', data.name);
}
```

## File visibility

Files are **private by default**. You can make individual files public so they can be downloaded with just an anon key (no user authentication required).

### Make a file public

```javascript
const { data, error } = await volcano.storage
  .from('documents')
  .updateVisibility('report.pdf', true);

if (!error) {
  console.log('File is now public:', data.is_public);
}
```

### Make a file private

```javascript
const { data, error } = await volcano.storage
  .from('documents')
  .updateVisibility('report.pdf', false);

if (!error) {
  console.log('File is now private');
}
```

### Who can change visibility

- **File owner**: The user who uploaded the file
- **Service key**: Has admin access to all files

Other users cannot change a file's visibility, even if they can read or write the file.
If the bucket defines `UPDATE` policies, the file owner must also satisfy one
of them. Service keys bypass policy checks.

### Public vs private download

```javascript
// Private file - requires user authentication + policy check
const userToken = 'user-access-token';
volcano.accessToken = userToken;
const { data } = await volcano.storage.from('files').download('private.pdf');

// Public file - only needs anon key (identifies project, no user auth)
volcano.accessToken = anonKey;
const { data: publicData } = await volcano.storage.from('files').download('public.pdf');
```

## Public URLs (Shareable Links)

Get a truly shareable URL for public files. The URL requires **no authentication** - it can be shared anywhere.

```javascript
// First, make the file public
await volcano.storage
  .from('avatars')
  .updateVisibility('profile.jpg', true);

// Then get the shareable URL
const { data, error } = volcano.storage
  .from('avatars')
  .getPublicUrl('profile.jpg');

if (!error) {
  console.log(data.publicUrl);
  // https://api.yourapp.com/public/{projectId}/avatars/profile.jpg
}
```

### URL format

```text
https://api.yourapp.com/public/{projectId}/{bucketName}/{filePath}
```

### Usage examples

```javascript
// In HTML (no SDK needed)
<img src="https://api.yourapp.com/public/proj-123/avatars/profile.jpg" />

// Share via email, embed in external sites, etc.
const shareUrl = data.publicUrl;
```

### Key points

- **No authentication required** - Works in any browser, can be embedded anywhere
- **Only for public files** - Returns 403 for files with `is_public: false`
- **All requests go through Volcano** - No direct access to the underlying store, all security enforced
- **Project isolation** - Each project has separate namespacing

## Error handling

All methods return `{ data, error }`. Always check for errors:

```javascript
const { data, error } = await volcano.storage
  .from('files')
  .upload('document.pdf', file);

if (error) {
  switch (true) {
    case error.message.includes('not found'):
      console.error('Bucket does not exist');
      break;
    case error.message.includes('denied'):
      console.error('Access denied by storage policy');
      break;
    case error.message.includes('size'):
      console.error('File too large');
      break;
    case error.message.includes('MIME'):
      console.error('File type not allowed');
      break;
    default:
      console.error('Upload failed:', error.message);
  }
  return;
}

console.log('Success:', data);
```

## TypeScript

The SDK includes full TypeScript definitions:

```typescript
import { VolcanoAuth, StorageObject, StorageUploadResponse } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key'
});

async function uploadFile(file: File): Promise<StorageObject | null> {
  const { data, error }: StorageUploadResponse = await volcano.storage
    .from('uploads')
    .upload(file.name, file);
  
  if (error) {
    console.error(error);
    return null;
  }
  
  return data;
}
```

## Resumable uploads (large files)

For files over 100MB or when you need resume capability for unreliable networks, use resumable uploads.

### Quick method: uploadResumable()

The simplest way to upload large files with progress tracking:

```javascript
const { data, error } = await volcano.storage
  .from('uploads')
  .uploadResumable('large-video.mp4', file, {
    onProgress: (uploaded, total) => {
      const percent = Math.round(uploaded / total * 100);
      console.log(`Uploading: ${percent}%`);
      progressBar.style.width = `${percent}%`;
    }
  });

if (!error) {
  console.log('Upload complete:', data.name, data.size);
}
```

### Manual control

For full control over the upload process (parallel uploads, custom retry logic):

#### 1. Create upload session

```javascript
const { data: session, error } = await volcano.storage
  .from('uploads')
  .createUploadSession('large-video.mp4', {
    totalSize: file.size,
    contentType: 'video/mp4'
  });

if (error) {
  console.error('Failed to create session:', error.message);
  return;
}

console.log('Session created:', session.session_id);
console.log(`Will upload in ${session.total_parts} parts of ${session.part_size} bytes`);
```

#### 2. Upload parts

Parts can be uploaded in any order and even in parallel:

```javascript
const { total_parts, part_size, session_id } = session;

for (let partNumber = 1; partNumber <= total_parts; partNumber++) {
  const start = (partNumber - 1) * part_size;
  const end = Math.min(start + part_size, file.size);
  const partData = file.slice(start, end);

  const { error } = await volcano.storage
    .from('uploads')
    .uploadPart('large-video.mp4', session_id, partNumber, partData);

  if (error) {
    console.error(`Part ${partNumber} failed:`, error.message);
    // Can retry this part later
  } else {
    console.log(`Part ${partNumber}/${total_parts} uploaded`);
  }
}
```

#### 3. Complete the upload

```javascript
const { data, error } = await volcano.storage
  .from('uploads')
  .completeUploadSession('large-video.mp4', session_id);

if (!error) {
  console.log('Upload complete:', data.name, data.size);
}
```

### Resume interrupted uploads

If an upload is interrupted, you can check progress and resume:

```javascript
// Get session status
const { data: status, error } = await volcano.storage
  .from('uploads')
  .getUploadSession('large-video.mp4', savedSessionId);

if (error) {
  console.error('Session not found or expired');
  return;
}

console.log(`Progress: ${status.uploaded_parts}/${status.total_parts} parts`);
console.log(`${status.uploaded_bytes} of ${status.total_size} bytes uploaded`);
console.log('Missing parts:', status.missing_parts);

// Upload only the missing parts
for (const partNumber of status.missing_parts) {
  const start = (partNumber - 1) * status.part_size;
  const end = Math.min(start + status.part_size, file.size);
  const partData = file.slice(start, end);

  await volcano.storage
    .from('uploads')
    .uploadPart('large-video.mp4', savedSessionId, partNumber, partData);
}

// Complete the upload
await volcano.storage
  .from('uploads')
  .completeUploadSession('large-video.mp4', savedSessionId);
```

### Abort an upload

To cancel an upload and clean up uploaded parts:

```javascript
const { error } = await volcano.storage
  .from('uploads')
  .abortUploadSession('large-video.mp4', sessionId);

if (!error) {
  console.log('Upload aborted and cleaned up');
}
```

### Resumable upload limits

| Limit | Value |
|-------|-------|
| Minimum part size | 5MB |
| Maximum part size | 25MB |
| Default part size | 25MB |
| Maximum parts | 10,000 |
| Maximum file size | Limited by plan storage quota (up to 5TB per object) |
| Session expiry | 7 days |

### When to use resumable uploads

| Scenario | Recommended method |
|----------|-------------------|
| Files under 100MB | `upload()` - simple, single request |
| Files over 100MB | `uploadResumable()` - automatic chunking |
| Unreliable network | `uploadResumable()` with `onProgress` to save state |
| Need to pause/resume | Manual methods with `createUploadSession()` |
| Very large files (1GB+) | Manual methods for better control |

## Complete example

See the [Next.js example](../examples/frontend-auth-nextjs/README.md) for a complete implementation with:

- File upload with drag-and-drop
- File listing with icons
- Download functionality
- Delete with confirmation
- Error handling

```typescript
// From examples/frontend-auth-nextjs/app/files/page.tsx

const handleUpload = async (files: FileList) => {
  for (const file of Array.from(files)) {
    const { error } = await volcano.storage
      .from('user-files')
      .upload(file.name, file);
    
    if (error) {
      console.error(`Failed to upload ${file.name}:`, error.message);
    }
  }
  
  // Refresh file list
  loadFiles();
};

const handleDownload = async (file: StorageObject) => {
  const { data, error } = await volcano.storage
    .from('user-files')
    .download(file.name);
  
  if (!error && data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
};
```
