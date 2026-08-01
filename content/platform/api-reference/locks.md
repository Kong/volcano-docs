---
title: "Project Locks API Reference"
description: "REST API endpoints for acquiring, renewing, inspecting, and releasing project lock leases."
---

Project locks are short-lived leases for coordinating backend workers. They are
scoped to the project in the service-role key, so two projects may use the same
lock name independently.

Only service-role keys may call these endpoints. Scoped keys require
`locks.manage`; anon keys, auth-user access tokens, and platform tokens are
rejected.

## Acquire

```http
POST /locks/{key}/lease
Authorization: Bearer SERVICE_ROLE_KEY
X-Volcano-Lock-Token: 4f83efc2-8fe7-42e8-8347-43493dc5bd8f
X-Volcano-Request-Id: 139241af-f4e8-4bdb-8494-dc0804c380a7
Content-Type: application/json

{"ttl_seconds": 10}
```

The token must be a random UUID generated once by the caller and retained for
the lease lifetime. A successful request returns:

```json
{"expires_at":"2026-07-20T14:00:10Z","fencing_token":4503599627370497}
```

Repeating acquire with the same token is safe and resets that lease to the
requested TTL. The new expiry is absolute, not additive, so acquiring again with
a shorter TTL shortens the lease.

A `409` distinguishes the two ways an acquire can fail:

| Code | Meaning |
| --- | --- |
| `lock_held` | Another live lease owns the lock. |
| `lock_ownership_lost` | Your own lease already lapsed and is not yet reclaimable. Stop protected work, then acquire again. |

## Renew

```http
PATCH /locks/{key}/lease
Authorization: Bearer SERVICE_ROLE_KEY
X-Volcano-Lock-Token: 4f83efc2-8fe7-42e8-8347-43493dc5bd8f
X-Volcano-Request-Id: 38795528-9ab7-48ea-85fa-33833460717a
Content-Type: application/json

{"ttl_seconds": 10}
```

Renew more than one second before `expires_at`. The one-second safety margin
prevents clock skew between regional API instances from resurrecting an
expired lease. A stale or late owner receives `409` with code
`lock_ownership_lost` and must stop protected work.

Renewal sets `expires_at` to `ttl_seconds` from when the request is served
rather than adding to the current expiry, so a smaller TTL than the original
shortens the lease.

## Release

```http
DELETE /locks/{key}/lease
Authorization: Bearer SERVICE_ROLE_KEY
X-Volcano-Lock-Token: 4f83efc2-8fe7-42e8-8347-43493dc5bd8f
X-Volcano-Request-Id: 58481ef8-ae31-40bd-a9d6-19a61f063866
```

Release succeeds for the current owner and is idempotent when the lock is
already absent. A stale token cannot release a newer lease.

## Read

```http
GET /locks/{key}
Authorization: Bearer SERVICE_ROLE_KEY
X-Volcano-Request-Id: 8a1c2d90-4a2e-4bb2-bb46-8f4a4a0e2f11
```

No lock token is needed, so monitoring and recovery tooling can call this
without owning the lease:

```json
{"held":true,"expires_at":"2026-07-20T14:00:10Z","fencing_token":4503599627370497}
```

A free lock returns `{"held":false}` with no other fields. `held` follows
takeover eligibility rather than raw expiry, so `held: false` means an acquire
would succeed now.

## Force release

```http
DELETE /locks/{key}
Authorization: Bearer SERVICE_ROLE_KEY
X-Volcano-Request-Id: 4d0d1b7c-6b09-4a8e-9b7c-30f3a2f1c8e2
```

Drops the lease whatever token holds it, for recovering a lock whose holder died
without releasing. Use `DELETE /locks/{key}/lease` for a normal release.

This breaks mutual exclusion on its own: the previous holder keeps working until
its next renewal fails. Guard the protected resource with `fencing_token` first,
so the displaced holder's writes are rejected. Returns `204` even when the lock
is already absent.

## Constraints

- Keys are 1–128 characters and may contain letters, digits, `.`, `_`, `:`, and
  `-`.
- TTL is 5 seconds through 90 days (7,776,000 seconds).
- Every acquisition has an absolute 90-day deadline. Acquire retries and
  renewals cannot move that deadline; callers must acquire a new lease after it.
- An unreleased lock expires at its requested TTL, or at the absolute deadline,
  whichever comes first.
- Takeover waits one additional second after expiry to tolerate bounded clock
  skew between regional API instances. Owners must still stop at `expires_at`.
- The API returns `429` after 600 lock operations per project in one minute.
  `Retry-After` reports the remaining seconds in that fixed-minute window. Every
  request counts, including reads, force releases, and a retry that reuses
  `X-Volcano-Request-Id`.
- Lock operations fail closed with `503` when the control-plane DynamoDB region
  is unavailable.

### Planning around the request quota

The 600-per-minute quota bounds how many holders a project can keep alive at
once, because each holder spends requests on renewals. Renewing at a third of
the TTL, as `withLock` does, costs `180 / ttl_seconds` requests per minute per
holder:

| TTL | Renewals per holder per minute | Approximate concurrent holders |
| --- | --- | --- |
| 10s | 18 | 33 |
| 30s | 6 | 100 |
| 60s | 3 | 200 |

Contended acquires also consume quota, so leave headroom below these numbers.
Longer TTLs buy more concurrency at the cost of a longer wait before a crashed
holder's lock can be taken over.

## Fencing token

`fencing_token` rises whenever the lock changes hands and stays the same across
renewals of one lease. Pass it to whatever the lock protects and reject any write
carrying a token lower than the highest already seen:

```sql
update job_state
set    payload = $1, fencing_token = $2
where  id = $3 and fencing_token <= $2;
```

An update that changes no rows means another holder has taken over, and the
caller must stop. This is what makes stale writes safe to reject, since a lease
cannot stop a process that has already lost the lock.

Tokens are comparable only within one lock key. Treat them as opaque increasing
integers rather than counters. Acquisitions of other keys in the project may
leave gaps. Release, force release, and expiry do not reset the sequence.

## Lease guarantees

DynamoDB conditional writes serialize lease ownership in one control-plane
region. The lease alone cannot stop a process after expiry, so renew
continuously, stop work when renewal fails, and use `fencing_token` when stale
writes would be unsafe.

`X-Volcano-Request-Id` correlates one logical HTTP operation across client and
server logs. Generate a new UUID for each acquire, renew, or release, and reuse
it when retrying that same operation so both sides can match the attempts. Repeat
safety comes from the lock token, not from this header: a retry under a reused ID
is processed normally and counts against the quota.

The JavaScript SDK `withLock` helper renews automatically and aborts its signal
after ownership loss. Callback code must honor that signal.

For complete leader-election and manual lease examples, see
[Project locks with JavaScript](../locks/javascript-sdk.md).
