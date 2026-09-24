---
title: "Plans and limits"
description: "HOBBY vs SUPERAGENT limits for functions, frontends, databases, storage, realtime, and your account on Volcano."
---

Volcano has two plans, **HOBBY** and **SUPERAGENT**. Metered allowances apply to your combined usage across every project you own. Allowances reset each month at your account's anniversary time. HOBBY accounts use their signup time. A new SUPERAGENT subscription uses its subscription billing anchor. Days 29–31 move to the last day of a short month and return to the original day when possible. Annual subscriptions still receive twelve monthly allowance windows. Deleting a project does not remove its usage from the account total. Concurrent function and frontend requests share the same allowance, including requests that are still completing. "Unavailable" means a feature is not offered on that plan.

An allowance is one plan's worth of usage for the current cycle. Unused allowance is forfeited; it does not carry forward or stack. HOBBY accounts stop shortly after they reach the allowance, as described in [How HOBBY allowances are enforced](#how-hobby-allowances-are-enforced), and never incur overage debt. While a SUPERAGENT account is not in debt, traffic continues beyond the allowance: that usage is overage, and requests are not gated on the credit balance at request time. Overage is bought in whole blocks at the resource's own price for the current cycle. Unused capacity in a purchased block carries forward across allowance windows and plan changes.

Purchased credits are spent on overage and can settle arrears. Unfunded overage is recorded as arrears, and Volcano requests `read_only` account status. After the cached traffic decision refreshes, `read_only` blocks new project traffic and connections across every project while the dashboard remains reachable. Existing sessions are force-disconnected; a session that was already establishing when status changed can escape that teardown and keep working, with no re-check on later requests, until the connection ends for an unrelated reason and the next reconnect is refused. The allowance still resets but does not restore access while the account is restricted. The next monthly grant or purchased credits settle arrears before any credits become spendable. Once sufficient credits clear the arrears, Volcano requests `active` status; the cached traffic decision refreshes eventually after the status change.

A resource Volcano adds after your contract starts is not covered by it: your contract fixes the terms for what it prices, and a new resource has none. Start using one and it is served at the allowance and overage rate of the current offer, alongside everything your contract still fixes.

## How HOBBY allowances are enforced

Usage is counted after the request it belongs to, so no request waits on a
usage lookup. Volcano checks each HOBBY account against its allowances every few
seconds, and blocks the resource across every project the account owns once it
reaches one. Requests served in between are counted like any other, so a HOBBY
account can end a cycle slightly over an allowance. The block lasts until the
next allowance window, an upgrade, or, for storage, until you free enough space.

Some usage is counted when the work finishes rather than when it starts: a
build's minutes when the build ends, a durable execution's operations and
compute when it finishes. Those allowances refuse the next build or start.

## Account

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Projects | 1 | 1,000 | Per account (creation cap) |
| Bandwidth allowance | 10 GB / month | 20 GB / month | Aggregate ingress + egress across all your projects |

## Functions

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Timeout | 30 s | 180 s | Per invocation |
| Memory | 128 MB | 256 MB | Per runtime |
| Ephemeral disk | 512 MB | 1 GB | Per runtime |
| Functions per project | 10,000 | 10,000 | Absolute hard cap |
| [Schedulers](../functions/scheduled-invocations.md) | Unavailable | 5 | Per project, counted across standard and durable functions together |
| [Runtimes kept ready](../functions/overview.md#response-time-on-the-first-invocation) | 1 per region, for 2 days after each deploy and 1 day after the most recent invocation | Same | Not counted as invocations or bandwidth |

## Durable functions

[Durable functions](../functions/durable-functions.md) are available on both plans and metered on their own allowances. Starting one does not spend the shared request allowance below.

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Execution allowance | 5,000 / month | 10,000 / month | Combined across all your projects; every start, including a retry you start yourself |
| Operation allowance | 100,000 / month | 200,000 / month | Combined across all your projects; the execution itself plus every step, retry, wait, condition poll, parallel branch and nested invocation it begins |
| Compute allowance | 10,000 GB-s / month | 100,000 GB-s / month | Combined across all your projects; memory × time your code is actually running, summed over every resume. Time suspended in a wait is not charged |
| Memory | 128 MB | 1 GB | Per execution, and the size its compute is charged at. Set by your plan, not per function |
| Step timeout | 300 s | 900 s | One attempt between checkpoints, not the whole execution |
| Execution timeout | 366 days | 366 days | A whole execution, including time suspended in a wait |
| Result retention | 30 days | 30 days | After an execution finishes |
| Concurrent executions | 10 | 100 | In flight at once, per project |
| Durable functions per project | 10,000 | 10,000 | Absolute hard cap, counted separately from standard functions |
| Schedulers | Unavailable | 5 | Per project, shared with standard function schedulers |
| Runtimes kept ready | Not kept ready | Same | Durable functions are started, not called |

Execution timeout and retention are the same on both plans on purpose: they are fixed when the function is created, so a plan change never leaves an existing function configured for limits its plan no longer allows. The timeout is set as high as it goes for the same reason — what actually bounds an execution is its 3,000 operations and your concurrent-execution cap, not the clock.

A durable function gets more memory than a standard one on SUPERAGENT because it orchestrates — it holds the state of a workflow across resumes, and on SUPERAGENT that is where agent and fan-out work runs. Memory comes from your plan, and it is applied on a function's next deploy, so a plan change reaches an existing function when you next deploy it. More memory also means proportionally more CPU, and it is the size your compute allowance is charged at: the same work costs 8× more compute on SUPERAGENT's 1 GB than on HOBBY's 128 MB, against an allowance 10× larger.

Operations and compute are both counted from a finished execution, so those allowances are enforced on the next start rather than by stopping an execution already running: whatever is in flight finishes and is billed. On HOBBY that means a project can end a cycle slightly over them, bounded by how many executions it may run at once.

## Functions and frontends (shared)

Functions and frontends share these counters.

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Request allowance | 100,000 / month | 1,000,000 / month | Combined across all your projects: every function invocation **and** proxied frontend request, including static assets and `/_next/image`. Durable executions have their own allowances above. HOBBY enforcement is eventual |
| Rate limit (per resource) | 100 requests / 10s | Unlimited | Each function or frontend |
| Rate limit (per project) | 600 requests / 10s | Unlimited | Across all functions and frontends |
| Build timeout | 30 min | 60 min | Per build |
| Build-minute allowance | 60 / month | 60 / month | Combined across all your projects; HOBBY blocks new builds once finished builds reach the allowance, SUPERAGENT bills overage |


## Databases

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Request allowance | 100,000 / month | 200,000 / month | Combined across all your projects; HOBBY enforcement is eventual |
| Databases per project | 1 | 10,000 | Creation cap |
| Database-storage allowance | 1 GB / month | 10 GB / month | Peak combined storage across every database you own; HOBBY makes all owned databases read-only at the allowance |
| [Branches](../databases/branching.md) per database | 10 | 25 | Counts branches in every state |
| [Backups](../databases/backups.md) per database | Not included | 50 | Backups you take; scheduled ones do not count |
| Backup retention | Not included | 30 days | Applied when the backup is taken |
| Point-in-time restore window | Not included | 7 days | How far back a restore can reach without a backup |

Backup storage counts against the storage allowance — a backup you take is
charged as a full copy of the database — and the point-in-time history window
does not. Only a plan that includes backups is charged for them, so a downgrade
never leaves a database paying for backups it can no longer reach. See
[what backups cost](../databases/backups.md#what-backups-cost).

## Object storage

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| File-storage allowance | 512 MB / month | 10 GB / month | Peak combined object bytes across all your projects; HOBBY blocks new uploads once the account holds the allowance. Deleting objects makes room again |
| Max object size | 100 MB | 10 GB | Per uploaded file |
| Buckets per project | 20 | Unlimited | Creation cap |

## Realtime

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Concurrent connections | 200 | 100,000 | Per project |
| Message allowance | 100,000 / month | 1,000,000 / month | Across all your projects; each direct message costs one publish plus one unit for each subscriber delivery |
| Max message size | 256 KB | 1 MB | Per message |
| Channels per connection | 100 | 500 | Per WebSocket connection |

Postgres change notifications generated by Volcano do not count toward the message allowance. When a HOBBY account reaches its message allowance, Volcano closes its Realtime connections across all owned projects and rejects new connections, subscriptions, and publishes until the next allowance window.

## Frontends

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Frontend sites per project | 1 | Unlimited | Plan quota |
| Absolute frontend hard cap | 10,000 | 10,000 | Safety hard cap |
| Custom domains | Unavailable | 1 per frontend | Plan gate |
| [Runtimes kept ready](../frontends/overview.md#response-time-on-the-first-request) | 1 per region, for 2 days after each deploy and 1 day after the most recent request | 2 per region, same windows | Not counted as requests or bandwidth |

## API access tokens

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| [Project access tokens](../api-reference/using-the-api.md) per project | 100 | 100 | Safety hard cap, counts only tokens that can still authenticate |

Revoked and expired tokens do not count against it, so cycling short-lived tokens never fills the allowance.

## Authentication

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| [Email domain allowlist](../authentication/configuration/email-domain-allowlist.md) | Unavailable | Available | Per project; a downgrade parks the list — the domains are kept and stop being enforced — and an upgrade puts it back in force |
| Custom email templates | Unavailable | Available | Per project; HOBBY projects send the default templates |
| Custom managed auth pages | Unavailable | Available | Per project |

## Scheduling and logs

| Limit | HOBBY | SUPERAGENT | Scope |
|---|---|---|---|
| Scheduled functions | Unavailable | 5 | Per project |
| Runtime log retention | 1 day | 30 days | Search / retention window |

## Enforcement

How a limit is enforced depends on the limit — you may see an HTTP `403`
(Forbidden), `413` (Payload Too Large), or `429` (Too Many Requests), a Realtime
protocol error or disconnect, or a PostgreSQL error (SQLSTATE `53400`).

## Moving from SUPERAGENT to HOBBY

A downgrade splits your account in two: settings are kept but stop applying,
while resources have to be removed by you.

### Settings are parked, not deleted

These stay in the database, stop taking effect on HOBBY, and take effect again the
moment you upgrade. You do not have to set them up twice.

| Setting | On HOBBY |
|---|---|
| [Email domain allowlist](../authentication/configuration/email-domain-allowlist.md) | Kept, not enforced: anyone can sign up and sign in again |
| Custom email templates | Kept; the default templates are sent |
| Custom managed auth pages | Kept; the built-in pages are served, with Volcano branding |
| Scheduled functions | Kept; they stop running, and their next run time keeps advancing |
| Frontend custom domains | Kept; the domain stops serving and returns `404`. Your `*.frontends.volcano.run` URL keeps working |
| Database query logs | Kept; new queries stop being recorded, and query insights stop being readable |
| Database compute size | Shrunk to the HOBBY size, and restored when you upgrade. No downtime, no data loss |

Five things are not parked:

- **Region selection.** A project pinned to a subset of regions keeps that
  subset, because widening it would copy your data into regions you excluded.
  Select all regions yourself before you downgrade.
- **[Database backups](../databases/backups.md).** Backups are a SUPERAGENT capability.
  Downgrading deletes the backups you took, turns off any backup schedule, closes
  the point-in-time restore window, and stops backup storage counting toward your
  database's storage. Backups your schedule already took are left to expire on
  their own retention, unreachable and uncharged. Upgrading gives the capability
  straight back, but it starts from that moment: there is nothing to restore from
  until you take a backup, and the point-in-time window fills as the database
  writes.
- **Function and frontend sizing.** Memory, timeout, and ephemeral disk change to
  the HOBBY values on the resource's next deploy. A [durable
  function](../functions/durable-functions.md)'s own sizing is part of this: its
  step timeout drops from 900 seconds to 300 and its memory from 1 GB to 128 MB on
  its next deploy, so a step that ran close to the SUPERAGENT limits has to fit in the
  HOBBY ones afterwards. Until you deploy it, it keeps running at the SUPERAGENT size and
  its compute is charged at that size.
- **Log history.** Log search and streaming immediately narrow to HOBBY's
  retention window, so logs older than that stop being readable even if they were
  written while you were on SUPERAGENT. Nothing is deleted, and upgrading brings the
  window back.
- **[Runtimes kept ready](../frontends/overview.md#response-time-on-the-first-request).**
  Each frontend goes from two ready runtimes per region to one, within minutes and
  without a redeploy, so two visitors arriving at once may see one startup between
  them. Functions keep one on both plans, and both windows are the same on both
  plans, so neither changes.

Rate limits, monthly quotas, and realtime limits switch to the HOBBY values right
away. Requests already served and usage already recorded are kept, so an account
that has passed a HOBBY quota is over it until its next allowance window starts.

Durable executions already running are the same: nothing stops them. The
concurrent-execution cap drops to the HOBBY value immediately, so a project that
was running more than that keeps them to completion and cannot start another
until enough have finished. Executions are not cancelled and no work is lost —
ending one early to fit a new cap would throw away a job midway rather than
merely delay it. An execution can run for a long time, so use `stop` on the ones
you no longer need if you want slots back sooner.

Database compute is the one thing Volcano resizes for you, because it bills by the
hour whether or not anything connects. Each database drops to the HOBBY compute size
shortly after the downgrade, and goes back to the size you were on when you upgrade
— you do not have to resize anything by hand. Neither change interrupts connections
or touches your data.

### Resources have to fit first

Nothing can park a project, a database, a frontend, a bucket, or the bytes inside
them, so bring the account under HOBBY's limits before you downgrade:

1. Delete projects down to 1.
2. Delete databases down to 1 per project, and reclaim space until each one is
   under 1 GB on disk.
3. Delete frontends down to 1 per project.
4. Delete buckets down to 20 per project, and files until each project stores
   under 512 MB.
5. Select all regions for every project.

Database size is measured as on-disk size, so use `DROP`, `TRUNCATE`, or
`VACUUM FULL` to reclaim it:

```sql
-- Drop what you no longer need, or empty a table outright.
DROP TABLE old_events;
TRUNCATE audit_log;

-- After deleting rows, return the pages to the operating system.
VACUUM FULL events;
```

A `DELETE` on its own does not shrink a database — the rows go, but the pages
stay until autovacuum reuses them — so deleting rows and nothing else will not
lift a hold. `VACUUM FULL` takes an exclusive lock on the table and needs room
for a second copy of it while it runs.

A downgrade you ask for is refused until the account fits, and the refusal lists
exactly what to delete or reset. Nothing changes in the meantime — you stay on SUPERAGENT
until the cleanup is done.

If a downgrade happens without that cleanup — a subscription that lapses, for
example — it still goes through, and the account is held **read-only** until it
fits. Reads keep working, creating and updating anything returns `403`, and
**deleting is always allowed**, so you can shrink your way back. The account
returns to normal on its own once it is under the limits.

A hold is not an outage: your deployed apps keep serving, and your own users keep
signing up, signing in, and using them throughout. It is your account's
administrative writes that stop, not your project's traffic.
