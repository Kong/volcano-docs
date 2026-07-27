---
title: "Components"
description: "Reusable React components for the Volcano Auth example."
---

# Components

Reusable React components for the Volcano Auth example.

## ConfigPrompt

Dynamic configuration prompt that appears when Volcano credentials are not set in environment variables.

Features:
- Validates UUID format for project ID
- Saves credentials to localStorage
- Clear configuration option
- Helpful setup instructions

Used automatically by all pages via the `useVolcano` hook.
