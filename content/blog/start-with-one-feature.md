---
title: Start with one feature
description: Take a Volcano application from an idea to a working user flow by building one feature at a time.
tags: [getting-started, application-design]
author: Volcano team
published: "2026-10-19"
---

A photo-sharing application can involve accounts, uploads, feeds, notifications, and moderation.
Trying to build every part at once makes it harder to tell whether the basic user experience works.
Start with one flow: a user signs in, uploads a photo, and sees the result.

## Make the first milestone observable

Choose a result you can check in the browser.
For this application, a useful first milestone is a signed-in user seeing a preview of their uploaded image.
That milestone connects identity, storage, and the interface without requiring a complete social feed.

The [signup and login recipe](/cookbooks/user-signup-and-login) establishes the authenticated client.
The [photo upload recipe](/cookbooks/photo-uploads) extends that client with storage operations.
Keep the same client within the browser application so these operations use the current user's session.

## Include access rules in the first flow

A successful upload confirms that data can reach storage.
It does not confirm that another account is prevented from reading it.
Configure ownership policies while building the upload flow, then check the same file path with a second user.

This gives you two concrete outcomes to verify: the owner can preview their image, and another account cannot download it.
See the [storage access model](/sdk/js/storage#access-policies) for the policy concepts behind that behavior.

## Expand from a working baseline

Once uploading works, choose the next feature based on what the application needs.
A gallery needs stored metadata and queries.
A live activity view may need realtime updates.
A shared album needs rules for membership and access.

Add one of these flows, including its loading and error states, before taking on the next.
Use the [Cookbooks](/cookbooks) for implementation examples and the [SDK guides](/sdk) for the underlying APIs.
