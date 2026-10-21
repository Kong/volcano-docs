---
title: Introducing Volcano Sandbox
description: An isolated workspace for AI agents to run code, work with files, and carry out tasks.
tags: [sandbox, ai-agents]
author: Volcano team
published: "2026-10-19"
---

Today, we're introducing Volcano Sandbox: a managed execution environment for developers building AI applications. Sandbox gives your agent a place to run commands, inspect results, and continue working across multiple steps.

An agent analyzing a dataset needs somewhere to execute Python. A coding assistant needs to edit files and run tests. Volcano Sandbox brings that execution environment into your Volcano project.

Run a single command in a temporary sandbox, or create a session for work that spans multiple steps. An agent can inspect a spreadsheet, run an analysis, and save a chart—then use the same files and intermediate results to answer a follow-up question. Sessions can also run HTTP services, with authenticated access for application previews and interactive tools.

Start with a published preset or deploy a custom template with your dependencies and startup command. Volcano builds and validates the template before activating it. When work pauses, suspend the session to preserve its processes and files without consuming runtime allowance or credits, then resume within its retention and lifetime limits.

Hosted sandboxes run in isolated virtual machines, with project-scoped access and short-lived credentials for connecting to services. Use the API, CLI, JavaScript, Python, and Ruby SDKs, or Volcano's MCP tools. You can also develop locally with Docker-backed sandboxes.

Runtime usage is based on configured baseline memory multiplied by running time. A 1 GiB session running for half an hour uses 0.5 GB-hours, regardless of how many commands it runs. Snapshots used for suspend and resume, including retained suspended storage, are included.

The free Hobby plan includes 5 GB-hours per account per monthly billing cycle. Superagent includes 20 GB-hours per account, with additional runtime purchased in 5 GB-hour blocks for 25 credits. See [Volcano pricing](https://volcano.dev/pricing) for plan limits and details.

We built Sandbox to make execution a natural part of an AI application. Developers provide the task, tools, and application logic. Volcano manages the environment where that work happens.

[Start building with Volcano](https://volcano.dev).
