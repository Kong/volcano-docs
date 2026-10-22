---
title: 'Components'
description: 'Reusable React components for the Volcano Auth example.'
---

# Components

Reusable React components for the Volcano Auth example.

## ConfigPrompt

Dynamic configuration prompt that appears when Volcano credentials are not set in environment variables.

Features:

- Checks the anon key format and rejects service keys (see `lib/anonKey.ts`)
- Saves credentials to localStorage
- Clear configuration option
- Helpful setup instructions

Used automatically by all pages via the `useVolcano` hook.

## FormField

A labeled input. Passes any other props through to the `<input>`.

## LoadingScreen

Full-page spinner shown while the SDK or the page's data loads.

## PageNav

Top navigation bar with the page title and its links.

## TabButton

One tab of a two-tab toggle, highlighted while active.
