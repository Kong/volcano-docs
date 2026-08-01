---
title: "Project Locks JavaScript SDK"
description: "Coordinate backend workers with renewable project lock leases using the Volcano JavaScript SDK."
---

Project locks coordinate backend functions in the same Volcano project. Use a
service-role key; never expose it in browser code.

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const volcano = new VolcanoAuth({
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.ANON_KEY,
  accessToken: process.env.SERVICE_ROLE_KEY
});
```

## Run work while leader

```javascript
const result = await volcano.locks.withLock(
  'daily-rollup',
  { ttl: 30 },
  async ({ signal }) => {
    await runRollup({ signal });
  }
);

if (result.error) {
  throw result.error;
}
if (!result.acquired) {
  return { skipped: true };
}
```

`withLock` generates an ownership token, renews near one-third of the TTL with
jitter, and releases in `finally`. If renewal fails, it aborts `signal` and
returns an ownership error. The callback must stop when the signal is aborted.

## Function handler example

```javascript
export const handler = async () => {
  const result = await volcano.locks.withLock(
    'scheduled-cleanup',
    { ttl: 60 },
    async ({ signal }) => {
      const deleted = await deleteExpiredRecords({ signal });
      return { deleted };
    }
  );

  if (result.error) {
    throw result.error;
  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      result.acquired
        ? { leader: true, ...result.data }
        : { leader: false, skipped: true }
    )
  };
};
```

When several functions run this handler concurrently, only the lease owner runs
`deleteExpiredRecords`. The others return `leader: false`.

## Manage a lease directly

```javascript
const acquired = await volcano.locks.acquire('migration', { ttl: 10 });

if (acquired.error) throw acquired.error;
if (!acquired.acquired) return;

try {
  const renewed = await volcano.locks.renew('migration', acquired.lease, { ttl: 10 });
  if (renewed.error) throw renewed.error;
  await runMigration();
} finally {
  const released = await volcano.locks.release('migration', acquired.lease);
  if (released.error) console.error('release failed', released.error);
}
```

Contention returns `{ acquired: false, error: null }`. That covers both `409`
codes: another live holder (`lock_held`) and a lapsed lease of your own that is
not yet reclaimable (`lock_ownership_lost`). Authentication, validation,
rate-limit, and availability failures return an error. Keep the lease object
private; its token proves ownership.

## Reject writes from a displaced holder

`lease.fencingToken` rises whenever the lock changes hands and stays the same
across renewals. Pass it to whatever the lock protects and refuse writes that
carry a lower token than the highest already seen:

```javascript
const result = await volcano.locks.withLock('rollup', { ttl: 30 }, async ({ lease }) => {
  const { rowCount } = await sql`
    update rollup_state
    set    cursor = ${next}, fencing_token = ${lease.fencingToken}
    where  id = ${id} and fencing_token <= ${lease.fencingToken}
  `;
  if (rowCount === 0) {
    throw new Error('another holder took over');
  }
});
```

Without this, a holder whose renewal is delayed past `expires_at` can still write
after another process has taken the lock. The lease alone cannot prevent that.

## Inspect or recover a lock

```javascript
const { state } = await volcano.locks.get('migration');
// { held: true, expiresAt: '2026-07-20T14:00:10Z', fencingToken: 4503599627370497 }
```

`get` needs no lock token, so a monitor or an operator script can read the holder
without owning the lease. `held: false` means an acquire would succeed now.

`forceRelease` drops the lease whatever token holds it, for a holder that died
without releasing. It breaks mutual exclusion by itself — the old holder keeps
working until its next renewal fails — so only use it where the protected
resource checks the fencing token.

After stopping the holder and confirming recovery is safe:

```javascript
await volcano.locks.forceRelease('migration');
```

For `lock_rate_limited`, `error.retryAfter` contains the number of seconds until
the fixed-minute window resets. A project gets 600 lock requests per minute —
reads and force releases included — and each holder spends `180 / ttl` of them on
renewals, so a 30-second TTL supports roughly 100 concurrent holders. Increase the
TTL to raise that ceiling.

TTL may be 5 seconds through 90 days. For work that may outlive its requested
TTL, use `withLock` or renew explicitly. Renewing sets the new expiry outright
rather than adding to the current one, so passing a smaller TTL shortens the
lease. Renewal never extends the absolute 90-day lifetime of an acquisition;
acquire a new lease after that deadline. An unreleased lease still expires.
See the [REST reference](../api-reference/locks.md) for guarantees and error
codes.
