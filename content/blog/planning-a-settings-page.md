---
title: Planning a settings page
description: Organize settings around user tasks and make saving, validation, and permissions easy to understand.
tags: [application-design]
author: Volcano team
published: "2026-10-19"
---

A settings page brings together changes with different consequences.
Updating a display name, changing notification preferences, and deleting a project should each have a clear place in the interface.

## Group controls by purpose

Start with the tasks people expect to complete: updating a profile, managing access, and configuring a project.
Give each group a descriptive heading and explain any setting whose effect is not obvious.

Keep the initial view focused on common changes.
Place less frequent configuration in separate sections so users can scan the page without reading every control.

## Make saving predictable

Choose a consistent save behavior for each group.
For an explicit Save button, show when there are unsaved changes, indicate progress, and confirm success.
If saving fails, preserve the user's input and explain how to retry.

Show validation beside the field that needs attention.
Avoid requiring users to reconstruct their edits after an unrelated field fails validation.

## Match controls to permissions

Explain when a setting is restricted to a project owner or administrator.
The server must enforce those permissions even when the interface hides or disables a control.

Give destructive actions their own section with a clear description of what will be removed.
Ask for confirmation when the action cannot easily be reversed.

For the identity side of a profile screen, see the [signup and login recipe](/cookbooks/user-signup-and-login).
