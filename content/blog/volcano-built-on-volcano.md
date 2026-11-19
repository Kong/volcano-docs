---
title: Volcano, built on Volcano
description: The volcano.dev app, docs, APIs, and billing all run on the same Volcano primitives you get on day one.
category: engineering
tags: [frontends, functions, database]
author: Mark Kim
published: "2026-11-19"
---

Every screen you see on volcano.dev runs on Volcano. The sign-up page, the dashboard, the docs, the API behind them, and the billing system that charges your card all live on the platform you're about to use.

We've been building that application, which makes us Volcano's first users. Before any customer deployed a frontend or wrote a function, we did, and we run our own business on it every day.

Here's what that stack looks like, piece by piece.

![Diagram: every part of volcano.dev runs on a Volcano primitive. Frontend hosts the web app (Next.js) and the docs site. Function hosts the REST API, the billing API, the support API, and the Stripe webhook, which receives events from Stripe. Database holds billing data. Scheduler runs billing operations.](/blog/volcano-built-on-volcano/stack.png)

*Four primitives carry the whole product. Stripe is the only outside piece, and it talks to us through a Volcano Function.*

## Two frontends, shipped on their own schedules

The volcano.dev web app is a Next.js application, hosted by [Volcano Frontend](/platform/frontends/overview). We build it and deploy it the same way you would.

The docs site is a second, separate frontend, also hosted on Volcano. It deploys independently, so a docs fix ships without waiting on an app release, and an app release never takes the docs down with it.

## Every API is a Volcano Function

The REST API behind volcano.dev is built and hosted on Volcano's [Function](/platform/functions/overview) primitive. So is everything else that keeps the business running:

- **Billing API**
- **Support API**
- **Stripe webhook** — billing runs on Stripe, and a function bridges Stripe's events into our system

That's the same primitive you get on day one. When it has a bad day, our revenue has a bad day, so it gets our full attention.

## Billing data lives in a Volcano database

Some of volcano.dev's most critical data sits in Volcano's own [database](/platform/databases/overview). Billing is the part where a mistake costs real money.

The Volcano scheduler runs our critical billing operations. Those jobs don't run on an outside cron service. They run on the same scheduler you'd use for your own jobs.

## Why we run on it first

Frontends, Functions, the database, and the scheduler. Everything you touch on volcano.dev runs on the same four primitives we hand to you.

That matters for one plain reason: we feel every rough edge before you do. A slow deploy slows down our releases. A flaky function breaks our billing. When we fix those things for ourselves, we've fixed them for you too.

So when you sign up, you're starting where we started.

[Start building with Volcano →](https://volcano.dev)
