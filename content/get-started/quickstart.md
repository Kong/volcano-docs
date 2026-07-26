---
title: Quickstart
description: Sign up, create a project, and pick a surface to build on.
order: 3
---

This gets you an account and an active project. From there, follow the
surface-specific quickstart for what you are building.

## 1. Install the CLI

```bash
npm install -g @volcano.dev/cli
```

See [install](./install.md) for other methods.

## 2. Sign up

```bash
volcano signup
```

This prefills your email, opens the browser signup flow, and saves your
credentials to `~/.volcano/config.json` — one command signs you up and logs
you in.

## 3. Create and select a project

```bash
volcano projects create my-first-project
volcano use my-first-project
```

## 4. Build

Pick your path:

- [Deploy a function](/cli) with the CLI.
- [Call Volcano from your app](/sdk/js) with the JavaScript SDK.
- [Understand the platform](/platform) and its API.
