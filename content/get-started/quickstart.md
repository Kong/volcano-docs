---
title: Quickstart
description: Install the CLI, sign up, create a project, and start building.
order: 3
---

This gets you an account and an active project. From there, follow the
surface-specific quickstart for what you are building.

## 1. Install the CLI

```bash
npm install -g @volcano.dev/cli
```

See [install](./install.md) for other methods.

## 2. Sign up and create a project

```bash
volcano connect --signup
```

This opens the browser signup page with your git email filled in. When you
finish, the CLI is signed in, creates a cloud project, and sets up a directory
linked to it. Already have an account? Use the log-in link on the signup page,
or run `volcano connect` instead. See [connect](/cli/connect) for the details.

To have a coding agent do it, paste this prompt:

```text
Run `npm i -g @volcano.dev/cli && volcano connect --signup` and keep it running while I sign up.
```

## 3. Build

Pick your path:

- [Deploy a function](/cli) with the CLI.
- [Call Volcano from your app](/sdk/js) with the JavaScript SDK.
- [Understand the platform](/platform) and its API.
