---
title: "Plans and limits"
description: "Free vs Pro limits for functions, frontends, databases, storage, realtime, and your account on Volcano."
---

Volcano has two plans, **Free** and **Pro**. Limits apply per project unless the
scope column says otherwise. "Unlimited" means there is no fixed cap (Pro usage
may be metered); "Unavailable" means the feature is not offered on that plan.

## Account

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Projects | 1 | 1,000 | Per account (creation cap) |
| Bandwidth | 10 GB / month | Unlimited | Aggregate ingress + egress across all your projects |

## Functions

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Timeout | 30 s | 180 s | Per invocation |
| Memory | 128 MB | 256 MB | Per runtime |
| Ephemeral disk | 512 MB | 1 GB | Per runtime |
| Functions per project | 10,000 | 10,000 | Absolute hard cap |

## Functions and frontends (shared)

Functions and frontends share these counters.

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Requests per month | 100,000 | Unlimited | Combined: every function invocation **and** proxied frontend request, including static assets and `/_next/image` |
| Rate limit (per resource) | 10 req/s | Unlimited | Each function or frontend |
| Rate limit (per project) | 60 req/s | Unlimited | Across all functions and frontends |
| Build timeout | 30 min | 60 min | Per build |
| Build minutes / month | 60 | Unlimited | New builds are blocked once used up |

## Databases

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Requests / month | 100,000 | Unlimited | All queries (eventual enforcement) |
| Databases per project | 1 | 10,000 | Creation cap |
| Storage per database | 1 GB | Unlimited | Over-limit databases become read-only |

## Object storage

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Total storage per project | 512 MB | Unlimited | Stored bytes |
| Max object size | 100 MB | 10 GB | Per uploaded file |
| Buckets per project | 20 | Unlimited | Creation cap |

## Realtime

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Concurrent connections | 200 | 100,000 | Per project |
| Messages / month | 100,000 | Unlimited | Counts fan-out recipients, not just publishes |
| Max message size | 256 KB | 1 MB | Per message |
| Channels per connection | 100 | 500 | Per WebSocket connection |

## Frontends

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Frontend sites per project | 1 | Unlimited | Plan quota |
| Absolute frontend hard cap | 10,000 | 10,000 | Safety hard cap |
| Custom domains | Unavailable | 1 per frontend | Plan gate |

## Scheduling and logs

| Limit | Free | Pro | Scope |
|---|---|---|---|
| Scheduled functions | Unavailable | 5 | Per project |
| Runtime log retention | 1 day | 30 days | Search / retention window |

## Enforcement

How a limit is enforced depends on the limit — you may see an HTTP `403`
(Forbidden), `413` (Payload Too Large), or `429` (Too Many Requests), a Realtime
protocol error or disconnect, or a PostgreSQL error (SQLSTATE `53400`).
