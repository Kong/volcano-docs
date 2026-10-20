---
title: Designing private photo uploads
description: Design an image upload flow around ownership, access policies, and temporary browser previews.
tags: [storage, authentication]
author: Volcano team
published: "2026-10-19"
---

An image upload has several separate decisions: who owns the file, who can read it, and how the browser displays it.
Treating those decisions explicitly makes the feature easier to extend when private photos become shared albums or public profiles.

## Use paths to express ownership

An object path such as `USER_ID/PHOTO_ID.jpg` gives each user a clear namespace.
Generate a unique photo ID so repeated uploads do not all target the same name.
Keep the storage path if you need to retrieve the image later.

The path itself does not authorize access.
Configure storage policies to require the signed-in user to match the owner represented by that prefix.
Check both upload and download permissions; a private file still needs an explicit access model for its intended users.

The [photo uploads recipe](/cookbooks/photo-uploads) combines this path structure with an authenticated client.

## Separate storage identity from preview URLs

A storage path identifies the file in your bucket.
A browser object URL lets an image element display a downloaded blob for the current page.
Store the path for future downloads and create a new preview URL when you need one.

Release object URLs with `URL.revokeObjectURL()` when replacing a preview or removing its image.
This keeps the page from retaining blobs it no longer uses.
An object URL does not make the underlying storage object public.

## Validate where it matters

Checking file size and MIME type in the browser helps users correct mistakes before uploading.
Those checks are part of the interface, and a different client can bypass them.
Enforce required limits and content validation on the server as well.

Test the whole flow with a valid image, an unsupported format, an oversized file, and another user's credentials.
The [storage reference](/sdk/js/storage) covers the operations you can add next, including listing and deleting files.
