---
title: Photo sharing with Storage
description: A Next.js photo sharing app on Volcano with email sign-in, uploads to a storage bucket, browser-made thumbnails, and owner-only delete.
tags:
  - storage
  - auth
  - database
  - row-level-security
  - nextjs
cover: /cookbooks/photo-sharing-cover.webp
---

Tested on Volcano CLI 0.66.0, SDK 2.2.0, Node 26.11.1, next 16.4.5, react 19.3.1; last verified 2026-11-04 on CLI 0.66.0.

## What it does

A shared photo wall for a group. People sign up with an email and password, upload images, and see everyone's photos as a grid of thumbnails. Clicking one opens the full-size original. Only the person who uploaded a photo can delete it, and nobody can replace a file or make it public.

The files live in a Volcano Storage bucket, and each photo's caption, size and uploader live in a Postgres table. Bucket policies decide who can view, upload and delete each file. Row-level security does the same for the table. Neither depends on the app code getting it right.

![ada's gallery: five photos from ada and sam, and a lava photo chosen and captioned, ready to upload](/cookbooks/photo-sharing-gallery.png)

![sam opens ada's "Lava at dusk" at its full 1600×1067 size. There's a Close button but no Delete, because the photo isn't sam's](/cookbooks/photo-sharing-viewer.png)

## What you need

- A Volcano account. Tested on SUPERAGENT. The app uses email and password sign-in, one storage bucket, one database and one frontend. No functions and no third-party services.
- Claude Code, Codex or Cursor with the Volcano skills (`volcano setup`), or Node.js 24+ and the [Volcano CLI](/get-started/install) to build it yourself.

New Volcano projects start with email confirmation off, so anyone can sign up with any address. See [Notes app with per-user data](./notes-app-with-login.md#why-its-built-this-way) for turning it on.

## Build it with your coding agent

Paste this into Claude Code, Codex or Cursor in an empty folder:

```text
Build a photo sharing app in this empty folder with Next.js and deploy it to Volcano.

- People sign up and sign in with email and password.
- A signed-in person uploads JPEG, PNG, WebP or GIF images up to 10 MB to a Volcano
  Storage bucket and sees a shared gallery of thumbnails. Make the thumbnails in the
  browser before uploading.
- Everyone signed in can view every photo. Only the uploader can delete a photo,
  nobody can overwrite a file or make it public, and people can only upload into
  their own folder. Enforce this with bucket policies, not app code.
- Keep photo metadata in Postgres with row-level security: anyone signed in can read,
  people can only add rows for files in their own folder, and only the owner can delete.
- Signed-out visitors can't download photos or read the metadata.
- Only the anon key goes to the browser, with no more storage permissions than it needs.

Create a new Volcano project named volcano-photos, deploy to production and give me
the URL. Before you finish, test the live project with two throwaway users: A uploads
and sees a photo; B can see it but can't delete it, overwrite it or upload into A's
folder; and a signed-out request with the anon key gets nothing.
```

Tested with a fresh Claude Code agent (claude-opus-5-5) in an empty folder. It had only this prompt, Volcano CLI 0.66.0 and `volcano docs`, without the Volcano plugin, and the project was renamed so it didn't collide with an existing one. It worked on the first try in about 12 minutes. It worked out that the browser key needs no storage permissions, kept the project's auth-only key, and replaced the bucket's default policies with four of its own, including an `UPDATE` policy of `false`. Its two-user test reported 38 passing checks. Afterwards, the 19-check script from [Check that it works](#check-that-it-works) passed against its project. Two headless Chrome windows also signed up, uploaded, viewed and deleted through its UI with no console errors. It chose 480-pixel WebP thumbnails, and it labels other people's photos "Someone" rather than naming the uploader.

## Build it yourself

Scaffold a Next.js project, then add a database and a bucket:

```bash
volcano init nextjs
npm install
volcano login
volcano projects create volcano-photos
volcano use volcano-photos
volcano cloud databases create photos --region us-east-1 --pg-version 16
volcano cloud storage bucket create photos
```

`volcano init nextjs` puts `package.json` at the root, the app in `web/`, and the migrations in `volcano/migrations/`. It also writes `.volcano/source-layout.json`, which tells `volcano cloud deploy` where the app is.

### Who can do what with a file

A new bucket comes with four owner-only policies (`default-auth-select-own` and so on): each person can read, replace and delete only their own files. A shared gallery needs different rules, so declare the bucket in `volcano/volcano-config.yaml`. The deploy applies it, and because the entry lists `policies`, it replaces the defaults with these four:

```yaml
buckets:
  - name: photos
    file_size_limit: 10485760
    allowed_mime_types:
      - image/jpeg
      - image/png
      - image/webp
      - image/gif
    policies:
      - name: members-view
        operation: SELECT
        definition: auth.role() = 'authenticated'
      - name: upload-own-folder
        operation: INSERT
        definition: auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
      - name: owner-delete
        operation: DELETE
        definition: auth.uid() = owner_id
      - name: no-overwrite
        operation: UPDATE
        definition: "false"
```

- **View:** any registered user. `auth.role() = 'authenticated'` leaves out anonymous sessions, so the gallery stays private even if you later turn on anonymous sign-in for something else.
- **Upload:** only into a folder named after your own user id, so every file lives at `<user id>/<photo id>/…`.
- **Delete:** only the uploader. Volcano sets `owner_id` to whoever uploaded the file.
- **Overwrite and visibility:** an upload to a path that already exists is an `UPDATE`, and so is making a file public. A bucket with no `UPDATE` policy still lets the owner change visibility, so `false` is there to block both, for everyone. See [storage policies](/platform/storage/policies).

The manifest never creates buckets, which is why `volcano cloud storage bucket create` runs first. The bucket enforces the size and type limits whatever the policies say: a `text/plain` upload gets `400 MIME type text/plain is not allowed`, and a file over 10 MB gets a `400` too.

### The browser key needs no storage permissions

Anon keys have [storage permissions](/platform/authentication/security/anon-keys) (`storage.upload`, `storage.download`, `storage.list`, `storage.delete`), but those only apply to requests the anon key makes on its own, with nobody signed in. Once someone signs in, the SDK sends their access token, and the bucket policies decide. In testing, every upload, view and delete worked with an auth-only key. A signed-out request with that key got `401 anon key missing required permission: storage.download`.

So the least-privilege key for this app is the auth-only key every new project starts with. `volcano projects keys anon create` makes more like it. Add `storage.download` only if signed-out visitors should see something, and then write a `SELECT` policy that allows `auth.role() = 'anon'` for those files.

### Photo metadata and row-level security

Volcano runs each migration file as one query, so every statement below goes in its own numbered file, from `001_create_photos.sql` to `012_photos_policy_delete_create.sql`. Each one is safe to re-run: `IF NOT EXISTS`, and a `DROP POLICY IF EXISTS` file before each `CREATE POLICY` file.

```sql
CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  uploader_email text NOT NULL DEFAULT auth.email() CHECK (char_length(uploader_email) BETWEEN 3 AND 320),
  storage_path text NOT NULL UNIQUE,
  thumb_path text NOT NULL UNIQUE,
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 140),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 20000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photos_paths_in_owner_folder CHECK (
    storage_path ~ ('^' || user_id::text || '/' || id::text || '/original\.(jpg|png|webp|gif)$')
    AND thumb_path = user_id::text || '/' || id::text || '/thumb.jpg'
  )
);
CREATE INDEX IF NOT EXISTS photos_created_idx ON public.photos (created_at DESC);
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photos FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.photos TO authenticated;
GRANT INSERT (id, storage_path, thumb_path, caption, width, height) ON public.photos TO authenticated;
DROP POLICY IF EXISTS photos_read ON public.photos;
CREATE POLICY photos_read ON public.photos FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS photos_insert_own ON public.photos;
CREATE POLICY photos_insert_own ON public.photos FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());
DROP POLICY IF EXISTS photos_delete_own ON public.photos;
CREATE POLICY photos_delete_own ON public.photos FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

The column-level `INSERT` grant leaves out `user_id` and `uploader_email`, so the database fills them in from the session and a client can't claim to be someone else. The `CHECK` constraint ties both paths to that `user_id`, so nobody can add a row that points at another person's files. With no `UPDATE` grant, a row can't change after it's written.

### Upload a photo

Create one client for the page, and restore the session with `volcano.initialize()` before showing the gallery:

```javascript
import { VolcanoClient } from '@volcano.dev/sdk';

const volcano = new VolcanoClient({
  apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL,
  anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY,
});
volcano.database(process.env.NEXT_PUBLIC_VOLCANO_DATABASE);
const { user } = await volcano.initialize(); // null until someone signs in
```

Make the thumbnail in the browser. `createImageBitmap` applies the photo's EXIF orientation, so phone photos come out upright:

```javascript
async function makeThumbnail(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, 640 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; // JPEG has no transparency
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a thumbnail'))), 'image/jpeg', 0.82);
  });
  return { blob, width, height };
}
```

Upload both files, then save the row. The gallery lists rows, so a photo only shows up once both files exist. A file whose row never lands is an orphan nobody sees, but a row whose files were deleted is a broken photo. So clean up only when an upload fails, and remove every path you tried, since a failed upload may still have stored its file. Once the insert is sent, keep the files: a lost response can hide a row that committed, or one that's still committing.

```javascript
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

async function uploadPhoto(file, caption) {
  const extension = EXTENSIONS[file.type];
  if (!extension) throw new Error('Choose a JPEG, PNG, WebP or GIF image.');
  const id = crypto.randomUUID();
  const folder = `${volcano.auth.user().id}/${id}`;
  const storagePath = `${folder}/original.${extension}`;
  const thumbPath = `${folder}/thumb.jpg`;
  const thumb = await makeThumbnail(file);
  const bucket = volcano.storage.from('photos');
  const attempted = [];

  async function uploadOrCleanUp(path, body, contentType) {
    attempted.push(path);
    const { error } = await bucket.upload(path, body, { contentType });
    if (error) {
      await bucket.remove(attempted); // paths that were never stored come back 404
      throw error;
    }
  }

  await uploadOrCleanUp(storagePath, file, file.type);
  await uploadOrCleanUp(thumbPath, thumb.blob, 'image/jpeg');
  const { data, error } = await volcano.insert('photos', {
    id, storage_path: storagePath, thumb_path: thumbPath,
    caption: caption.trim().slice(0, 140), width: thumb.width, height: thumb.height,
  });
  if (!error) return data[0];
  // The row may have committed anyway; if so, carry on as if the insert succeeded.
  const saved = await volcano.from('photos')
    .select('id,user_id,uploader_email,storage_path,thumb_path,caption,width,height,created_at')
    .eq('id', id).limit(1);
  if (saved.data?.length) return saved.data[0];
  throw error;
}
```

`volcano.insert()` resolves to `{ data, error }` with the created rows, including the `user_id` and `uploader_email` the database filled in. Put the returned row at the top of the gallery. If orphan files ever add up, a signed-in user can `list()` their own folder and remove the paths that have no row.

### Show the gallery

Read the rows, newest first, then download each thumbnail. The files are private, and an `<img src>` can't send the user's token, so download each one and show it from an object URL:

```javascript
const { data: photos, error } = await volcano.from('photos')
  .select('id,user_id,uploader_email,storage_path,thumb_path,caption,width,height,created_at')
  .order('created_at', { ascending: false }).limit(60);
if (error) throw error;

async function objectUrl(path) {
  const { data, error } = await volcano.storage.from('photos').download(path);
  if (error) throw error;
  return URL.createObjectURL(data); // revoke it when the image leaves the page
}
```

Download each thumbnail once and keep its URL until the gallery unmounts. Fetch the original only when someone opens the photo. Each read takes a second or two, so if an upload or delete lands while the list is loading, load it again. Otherwise the stale result hides the photo that was just added.

### Delete a photo

Show the Delete button only on your own photos (`photo.user_id === volcano.auth.user().id`). The policies refuse everyone else anyway. Remove the files first, then the row, so a failure leaves the photo listed and the owner can try again:

```javascript
async function deletePhoto(photo) {
  const removed = await volcano.storage.from('photos').remove([photo.storage_path, photo.thumb_path]);
  // On a retry the files may already be gone; a 404 counts as deleted.
  const failures = removed.error?.failures ?? (removed.error ? [{ error: removed.error }] : []);
  if (failures.some((f) => f.error.status !== 404)) throw removed.error;
  const { error } = await volcano.delete('photos').eq('id', photo.id);
  if (error) throw error;
}
```

### Configure and deploy

Add the rest of `volcano/volcano-config.yaml` around the `buckets` section:

```yaml
version: 1
auth:
  signup:
    enable_signup: true
    enable_anonymous_signins: false
  cors:
    enabled: true
    allowed_origins:
      - http://localhost:3000
frontends:
  - name: web
    variable_scope: scoped
    variables:
      - NEXT_PUBLIC_VOLCANO_API_URL
      - NEXT_PUBLIC_VOLCANO_ANON_KEY
      - NEXT_PUBLIC_VOLCANO_DATABASE
```

Put the three variables in `volcano/cloud.env`, and the same values in `web/.env.local` for `npm run dev`. Both paths are gitignored. `volcano projects keys anon list` shows the project's auth-only key:

```dotenv
NEXT_PUBLIC_VOLCANO_API_URL=https://api.volcano.dev
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-your-photos-key
NEXT_PUBLIC_VOLCANO_DATABASE=photos
```

Deploy everything in one command:

```bash
volcano cloud deploy --env-file volcano/cloud.env --with-migrations -d photos
```

It saves the variables, runs the migrations, builds the frontend and applies the manifest, then prints the frontend URL. The first run reports `buckets.policies: 4 created, 4 deleted` as it swaps out the defaults. Add the frontend's HTTPS origin to `auth.cors.allowed_origins` and run the same command again. See [CORS configuration](/platform/authentication/configuration/cors).

## Check that it works

Open the URL in a normal window and a private window, and create an account in each with a made-up address. The default password rule is at least 15 characters. Upload a photo in the first window, then click **Refresh** in the second. The thumbnail appears with the first user's name under it. Open it there: the original loads, and there's no Delete button. Delete it from the first window, refresh the second, and it's gone.

To check the rules and not just the page, write a Node script that signs up two users against the live project with the same SDK calls. For the signed-out checks, call the API with only the anon key, because the SDK refuses before sending anything when nobody is signed in. In testing, that script passed all 19 checks:

```text
PASS two distinct signed-in users
PASS A uploads to their own folder — no error
PASS A saves the photo row — no error
PASS A sees the photo and downloads the thumbnail — no error
PASS B sees A's photo in the gallery — no error
PASS B can view A's original — no error
PASS B can't delete A's file — 403 access denied by storage policy
PASS B can't overwrite A's file — 403 access denied by storage policy
PASS B can't upload into A's folder — 403 access denied by storage policy
PASS A can't overwrite their own file either — 403 access denied by storage policy
PASS nobody can make a photo public — B: 403 access denied by storage policy; A: 403 access denied by storage policy
PASS B can't delete A's row — RLS matched 0 rows
PASS B can't add a row pointing at A's folder — Query failed: ERROR: new row for relation "photos" violates check constraint "photos_paths_in_owner_folder" (SQLSTATE 23514)
PASS B can't set user_id on a row — Query failed: ERROR: permission denied for table photos (SQLSTATE 42501)
PASS a signed-out visitor can't download photos — 401 {"error":"anon key missing required permission: storage.download"}
PASS a signed-out visitor can't list the bucket — 401 {"error":"anon key missing required permission: storage.list"}
PASS a signed-out visitor can't read photo rows — 401 {"error":"Invalid or expired token"}
PASS the bucket refuses non-images — 400 MIME type text/plain is not allowed
PASS A deletes their photo and B no longer sees it — no error
```

A run in two headless Chrome windows also passed: thumbnails came back at 640 pixels on the long edge, the other user's original opened at full size with no Delete button, a deleted photo disappeared for the other user, and there were no console errors. Signing up and reaching the gallery took about 5 seconds.

## Why it's built this way

- **Two layers, each enforcing its own rules.** Bucket policies guard the files and RLS guards the rows. A client can skip the app and call either API directly, so each has to hold up alone. The path constraint is what ties them together: a row can only point at files in its owner's folder, and only the owner can put files there.
- **One folder per user.** Putting the user id first in the path gives the `INSERT` policy something to check, since `owner_id` doesn't exist until the file does. Delete checks `owner_id`, the uploader Volcano recorded, not the path.
- **Thumbnails made in the browser.** Volcano Storage stores and serves files as they are, with no resizing. A 640-pixel JPEG is usually tens of kilobytes, against several megabytes for a phone photo, so the grid stays fast and the original loads only when someone opens it. To resize on the server, run a [function](/platform/functions/overview) after upload.
- **Private files and object URLs.** The files are never made public, so every download goes through a policy check with the viewer's token. That costs one authenticated download per thumbnail, and in return there's never a link that works for someone who isn't signed in. An object URL is a temporary reference to bytes already in the browser. It works in that browser until the page revokes it or closes, and showing it again doesn't repeat the check.
- **Members see each other's email addresses.** `uploader_email` is readable by everyone signed in, so anyone with an account can read every uploader's address through the database API, even though the page only shows the part before the `@`. That suits a group that already knows each other. Otherwise, store a display name the person chooses and leave the email out of the table.
- **A shared wall, not private albums.** For per-person photos, change `members-view` to `auth.uid() = owner_id` and `photos_read` to `user_id = auth.uid()`. Storage policies see the path, the owner and the session, not your tables, so sharing with chosen people needs the path to carry the rule (for example a folder per album) or a [function](/platform/functions/overview) that checks a shares table before serving the file.
- **No moderation.** Anyone who signs up can upload, and there's no rate limit or report flow. Before opening it beyond a trusted group, turn on email confirmation (see [Email SMTP configuration](/platform/authentication/configuration/email-smtp)) and add an admin delete path. Restricting sign-up with `allowed_email_domains` only keeps outsiders out once confirmation is on. Without it, anyone can register a made-up address in an allowed domain.
