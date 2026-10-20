---
title: Making long-running actions clear
description: Design feedback for uploads and background work so users can understand progress, failures, and completion.
tags: [application-design]
author: Volcano team
published: "2026-10-19"
---

An action that takes more than a moment needs feedback beyond a button click.
Users need to know whether work started, whether it is still running, and what to do if it fails.

## Acknowledge the action immediately

Show a loading state as soon as the application accepts the request.
Prevent accidental duplicate submissions while the request is being sent.
For work that continues in the background, show a persistent status the user can return to.

Distinguish sending a request from the server accepting the job.
If the connection fails before confirmation, the application may need to check the job's status before offering another submission.

## Report progress honestly

Use a percentage only when the application has enough information to calculate one.
For work with unknown duration, use named stages such as queued, processing, and complete.

Keep useful status text visible alongside any animation.
Explain whether users can leave the page and return later without interrupting the operation.

## Design the failure and completion states

When work fails, retain enough context to explain what happened and offer a useful next step.
Make retry behavior clear, especially when a partial operation may already have completed.

On success, link to the result instead of leaving the user on a finished progress indicator.
The [photo upload recipe](/cookbooks/photo-uploads) provides a small flow for exploring upload feedback and previews.
