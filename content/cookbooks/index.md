---
title: Cookbook
description: Build working agents and apps with compact Volcano recipes, each with a tested coding-agent prompt.
---

Build agents and apps with Volcano using focused code, a coding-agent prompt, and commands to deploy and check the result.

## Agents

- [Agent evals in Volcano sandboxes](./agent-evals-in-volcano-sandboxes.md): Harbor runs six coding agents on the same task, one Volcano sandbox per trial, grades them with hidden tests, and a scoreboard on the same project shows the results live.
- [Support agent](./support-agent.md): a Claude agent in a durable function triages each ticket with tools that run under row-level security, retries failed model calls, and streams its progress to the page.
- [Finance agent for budget requests](./spend-request-agent.md): a chat agent checks each figure in a budget request against company data and scores the case, and a durable function holds it until a reviewer approves, pushes back or denies it.
- [Remote MCP server with Postgres tools](./mcp-server.md): an MCP server on a public HTTPS URL, with bookmark tools behind a bearer token, called from Insomnia or Claude Code.

## Apps

- [Pixelboard](./pixel-board.md): a shared canvas with anonymous sign-in, persistent pixels, and live updates.
- [Real-time chat](./realtime-chat.md): anonymous sign-in, rooms, messages saved in Postgres, live delivery, an online count and typing indicators.
- [Photo sharing with Storage](./photo-sharing.md): email sign-in, uploads to a storage bucket, browser-made thumbnails, and bucket policies that let only the uploader delete.
- [Ecommerce store](./ecommerce-store.md): a public catalog, carts in Postgres, and a function that prices each order and takes the stock in one transaction, so two shoppers can't buy the last unit.
- [Notes app with per-user data](./notes-app-with-login.md): email and password sign-in, and a notes table where row-level security keeps each person's notes private.
- [Petstore API from its OpenAPI spec](./petstore-api.md): the Swagger Petstore spec as a live API on Postgres, with public reads, signed-in writes, and row-level security, tested from Insomnia.

For platform concepts and API references, explore the [Docs](/).
