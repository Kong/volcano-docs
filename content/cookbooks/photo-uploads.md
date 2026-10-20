---
title: Photo uploads
description: Upload private photos to Volcano Storage and download them for a browser preview.
---

Let a signed-in user upload a photo and preview it without publishing a public file URL.

## Prepare storage

Complete [user signup and login](./user-signup-and-login.md) and reuse its `volcano.js` client.
Create a bucket named `photos` in the Volcano dashboard.
Configure storage policies so authenticated users can upload and download only paths under their own user ID, such as `USER_ID/photo.jpg`.
A path prefix organizes files; the storage policy enforces ownership.
See [storage access policies](/sdk/js/storage#access-policies) for the access model.

## Upload a selected photo

Create `photos.js` next to `volcano.js`.
Pass a browser `File` from your file input to `uploadPhoto()`.
This example accepts JPEG and PNG images up to 5 MiB and gives each upload a unique name.

```javascript
import { volcano } from './volcano.js';

export async function uploadPhoto(file) {
  if (!(file instanceof File)) throw new Error('Choose a photo first');
  const extensions = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
  ]);
  const extension = extensions.get(file.type);
  if (!extension) throw new Error('Choose a JPEG or PNG image');
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MiB');
  }

  const { user, error: authError } = await volcano.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in before uploading');

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await volcano.storage.from('photos').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}
```

Client validation gives quick feedback; enforce any required file limits and content validation on the server as well.
Catch errors in your upload handler and keep the selected file available for retry.

## Download and preview

Add this function to `photos.js` and pass it the path returned by `uploadPhoto()`:

```javascript
export async function createPhotoPreview(path) {
  const { data: blob, error } = await volcano.storage.from('photos').download(path);
  if (error) throw error;
  if (!blob) throw new Error('No image was returned');
  return URL.createObjectURL(blob);
}
```

Set your image element's `src` to the returned URL.
Call `URL.revokeObjectURL(url)` when replacing the preview or removing the image from the page.
Keep the storage path if the application needs to download the file again; the browser object URL is temporary.

## Check the result

1. Sign in, choose a small JPEG or PNG, and upload it.
2. Download the returned path and confirm the preview displays.
3. Try an unsupported file type and a file over 5 MiB; confirm both are rejected.
4. Sign in as a different user and try downloading the first user's path; confirm your storage policy denies access.

See the [storage reference](/sdk/js/storage) for listing files, deletion, and resumable uploads.
