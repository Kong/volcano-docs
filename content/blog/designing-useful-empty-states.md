---
title: Designing useful empty states
description: Help users take the next step when a new application, filtered list, or search result has no content yet.
tags: [application-design]
author: Volcano team
published: "2026-10-19"
---

An empty screen is often a user's first experience of an application.
Use it to explain what belongs there and give them a clear next action.

## Explain why the view is empty

A new project with no files needs a different message from a search that found no matches.
For a new project, explain what users can create.
For a filtered view, show the active filter and offer a way to clear it.

Keep a failed request separate from an empty result.
When loading fails, show an error and a retry action so users do not mistake a connection problem for missing data.

## Offer one useful next step

A photo library can offer an upload action.
A project list can offer a create action.
A filtered list can offer to show all items again.

Choose the action that moves the current task forward, and keep its label specific.
An empty state should help users continue without sending them through unrelated setup screens.

## Check the transition

After the user creates the first item, replace the empty state with the normal list.
Keep the new item visible and confirm what happened.
Test the view with no content, no matching results, and a failed request.

See [Start with one feature](./start-with-one-feature.md) for an approach to building and checking a complete user flow.
