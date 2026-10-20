---
title: When to use realtime broadcast
description: Understand when live broadcast messages fit your application and when you need stored data and database change subscriptions.
tags: [realtime, application-design]
author: Volcano team
published: "2026-10-19"
---

A typing indicator and a chat message can both appear instantly, but they have different storage needs.
Someone who opens the application tomorrow may need to see yesterday's messages.
They do not need yesterday's typing indicators.

## Broadcast fits temporary events

Volcano broadcast sends messages to currently connected channel subscribers.
It works well for temporary signals such as typing activity, cursor movement, or a live demo room.
It does not persist events or replay missed messages to a returning client.

The [realtime chat recipe](/cookbooks/realtime-chat) demonstrates this behavior with a shared broadcast room.
Reloading the page starts a new view without chat history.
That makes the recipe useful for learning message delivery, while leaving persistence as a separate design decision.

## Store information that must survive a disconnect

If users need history, write messages to a database with appropriate access policies.
Load the current state when the view opens and use database change subscriptions to keep it up to date.
Fetch the current state again after reconnecting so the interface can recover changes it missed.

Realtime notifications are not a durable record of every database change.
Design the interface so it can reconstruct its state from stored data.
See [Postgres changes](/sdk/js/realtime#postgres-changes) for subscription behavior and access constraints.

## Plan the connection lifecycle

Disable sending until the connection and subscription are ready.
Show connection errors and let users retry failed actions.
When the user leaves the view or signs out, disconnect the realtime client.
Create a new client when switching accounts so the connection uses the new credentials.

Choose channel access rules alongside your data model.
A channel name organizes traffic; it does not by itself establish private room membership.
The [realtime reference](/sdk/js/realtime) covers channel setup, cleanup, and token refresh for longer sessions.
