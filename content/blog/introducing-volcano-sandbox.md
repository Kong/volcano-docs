---
title: Introducing Volcano Sandbox
description: An isolated workspace for AI agents to run code, work with files, and carry out tasks.
tags: [sandbox, ai-agents]
author: Volcano Team
cover: /blog/introducing-volcano-sandbox/hero.png
published: "2026-10-19"
---

![Introducing Volcano Sandbox: an isolated workspace for AI agents to run code, work with files, and carry out tasks.](/blog/introducing-volcano-sandbox/hero.png)

Today, we're introducing Volcano Sandbox: a managed execution environment for developers building AI applications. Sandbox gives your agent a place to run commands, inspect results, and continue working across multiple steps.

An agent analyzing a dataset needs somewhere to execute Python. A coding assistant needs to edit files and run tests. Volcano Sandbox brings that execution environment into your Volcano project.

![Terminal: running print(6 * 7) in a temporary python3.12 sandbox prints 42, and console.log(process.version) in a node22 sandbox prints v22.22.0.](/blog/introducing-volcano-sandbox/one-off.gif)

*One command, one temporary sandbox. Volcano cleans it up when the command exits.*

Run a single command in a temporary sandbox, or create a session for work that spans multiple steps. An agent can inspect a spreadsheet, run an analysis, and save a chart—then use the same files and intermediate results to answer a follow-up question. Sessions can also run HTTP services, with authenticated access for application previews and interactive tools.

![Terminal: a session starts from the data-analyst template, sales.xlsx and analyze.py are uploaded, the analysis prints revenue by region and saves a chart, then a follow-up script reads the saved monthly results and reports which region grew fastest in Q3.](/blog/introducing-volcano-sandbox/agent-session.gif)

*A multi-step session: upload a spreadsheet, run the analysis, then answer a follow-up from the saved intermediate results. Real output, sped up.*

Start with a published preset or deploy a custom template with your dependencies and startup command. Volcano builds and validates the template before activating it.

![Volcano Dashboard: deploying the data-analyst custom template from a tar.gz build context, watching the deployment build and validate, then the template showing Ready.](/blog/introducing-volcano-sandbox/deploy-template.gif)

*Deploying a custom template from the Dashboard. The build is sped up.*

When work pauses, suspend the session to preserve its processes and files without consuming runtime allowance or credits, then resume within its retention and lifetime limits.

![Terminal: the session is suspended and reports state suspended, then resumes; listing /workspace still shows the files, and the HTTP server started earlier still answers on port 8080.](/blog/introducing-volcano-sandbox/suspend-resume.gif)

*After resume, the files are still in /workspace and the HTTP server is still running.*

Hosted sandboxes run in isolated virtual machines, with project-scoped access and short-lived credentials for connecting to services. Use the API, CLI, JavaScript, Python, and Ruby SDKs, or Volcano's MCP tools. You can also develop locally with Docker-backed sandboxes.

![Diagram: agents (MCP tools), your app (SDKs and API), and developers (CLI and Dashboard) reach sessions in your Volcano project with project-scoped access. Each session runs in its own isolated VM. Preview URLs and signed-in users connect with short-lived credentials.](/blog/introducing-volcano-sandbox/security.png)

Runtime usage is based on configured baseline memory multiplied by running time. A 1 GiB session running for half an hour uses 0.5 GB-hours, regardless of how many commands it runs. Snapshots used for suspend and resume, including retained suspended storage, are included.

![Pricing: 1 GiB times 30 minutes equals 0.5 GB-hours. Hobby includes 5 GB-hours per month. Superagent includes 20 GB-hours per month, then 5 GB-hour blocks for 25 credits.](/blog/introducing-volcano-sandbox/pricing.png)

The free Hobby plan includes 5 GB-hours per account per monthly billing cycle. Superagent includes 20 GB-hours per account, with additional runtime purchased in 5 GB-hour blocks for 25 credits. See [Volcano pricing](https://volcano.dev/pricing) for plan limits and details.

We built Sandbox to make execution a natural part of an AI application. Developers provide the task, tools, and application logic. Volcano manages the environment where that work happens.

[Start building with Volcano →](https://volcano.dev)
