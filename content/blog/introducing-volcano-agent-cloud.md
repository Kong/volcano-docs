---
title: Introducing Volcano, a self-healing agent cloud by Kong
description: One place to build, host, and run agents and applications, with a platform that finds and fixes bugs on its own.
category: product
tags: [launch, ai-agents, lavaflow]
author: Marco Palladino
cover: /blog/introducing-volcano-agent-cloud/hero.png
published: "2026-11-19"
---

Building agents and applications in the AI era requires new primitives that we simply didn't need a few years ago. And even then, the pace of building has increased exponentially beyond what humans can do with traditional workflows. To make this worse, building agents became more of an exercise of composing together different services and platforms which compounds the complexity and maintenance requirements in the long run.

**There must be a better way.**

![Before and after. Before: your agent or app plus the glue code, wired to a separate service for backend hosting, Next.js hosting, database, user management, file storage, realtime, workflows, approvals, sandboxes, and locks, and bugs wait for a person to find the issue and ship a fix. After: your agent or app, built with Cursor, Codex, or Claude Code, runs on Volcano, which includes all of those services, with LavaFlow finding and fixing bugs with no human intervention.](/blog/introducing-volcano-agent-cloud/before-after.png)

And this is why today we are announcing Volcano, a new self-healing agent cloud that provides in one place everything developers need to build agents and applications at scale. Volcano hosts all applications, agents, data storage and other capabilities that can be used seamlessly from your favorite coding harness (Cursor, Codex, Claude Code, and more) — or online via the easy-to-use builder experience — to go from idea to production in a fully automated way.

And then — once your agents, backends and frontends are running in Volcano — Volcano kicks in and works for you to continuously identify issues and provide resolutions to bugs so that your codebase gets better over time autonomously with no human intervention. By offering everything you need in one platform, you can also enormously simplify your implementations, which will be self-healing along the way.

![Your coding agent (Claude Code, Codex, Cursor, OpenCode, Pi) or the AI Builder deploys to Volcano. LavaFlow finds and fixes bugs on its own, so your apps and agents keep getting better over time. Hosting: serverless backend hosting and CDN-accelerated Next.js hosting. Agent primitives: year-long durable functions, human-in-the-loop approvals, resumable sandboxes, and self-renewing distributed locks. App backend: branchable Postgres, unlimited user management, private-by-default file storage, and one-connection realtime.](/blog/introducing-volcano-agent-cloud/platform.png)

We decided to build Volcano as a result of our experience at Kong building agents for ourselves, and what we learned from the 1000+ largest enterprise organizations that we work with. Kong processed more than a quadrillion requests for its customers in the last 12 months, and today we are finally enabling everyone to build in the AI era the way it's supposed to be.

Give it a try and let us know what you think, at [volcano.dev](https://volcano.dev/).
