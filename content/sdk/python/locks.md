---
title: Distributed locks
description: Coordinate Python workers with project-scoped lock leases, renewal, and fencing tokens.
order: 7
---

Acquire a project-scoped lease from trusted server code using a service key.
Set `VOLCANO_ANON_KEY` and `VOLCANO_SERVICE_KEY` for the same project.

```python
import os

from volcano_sdk import VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    service_key=os.environ["VOLCANO_SERVICE_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
)
lease = client.locks.acquire("daily-report", ttl=30)
try:
    print("Lease acquired", lease.fencing_token)
finally:
    client.locks.release("daily-report", lease)
```

`acquire()` returns an immutable `LockLease` containing the key, ownership token, expiration, and fencing token.
Release and renew using that lease; the ownership token identifies the holder.
TTLs are integer seconds from 5 seconds through 90 days.
A competing owner can cause `ConflictError`.

## Renew or inspect a lease

```python
state = client.locks.get("daily-report")
print(state.held, state.expires_at, state.fencing_token)

lease = client.locks.acquire("daily-report", ttl=30)
try:
    lease = client.locks.renew("daily-report", lease, ttl=60)
finally:
    client.locks.release("daily-report", lease)
```

`get()` reports availability without acquiring the lock.
`renew()` returns a new immutable lease, so retain its return value.

## Renew for the duration of a block

```python
with client.locks.with_lock("daily-report", ttl=30) as guard:
    print("Current fence", guard.lease.fencing_token)
    if guard.lost:
        raise RuntimeError("Lock ownership was lost")
```

The context manager renews in the background and attempts to release its latest lease on exit.
`guard.lease` reads the latest lease; `guard.lost` checks ownership loss, and `guard.wait_lost(timeout=1.0)` waits up to one second for it.
Stop protected work when ownership is lost.
Use fencing tokens in the protected data store so an expired worker cannot overwrite work performed by a newer holder.
Lease renewal alone cannot stop application code that is already running.

If the block succeeds, a renewal failure is raised after cleanup.
An exception from the block takes precedence.

## Recover an abandoned lock

`client.locks.force_release("daily-report")` removes the current lease without its ownership token.
Use this only for administrative recovery with fencing enforced by the protected resource.

## Recover an uncertain acquisition

Acquisition retries a transport failure or HTTP 503 once with the same ownership
token, request ID, key, TTL, and credential. Other HTTP errors are not retried.
For recovery after that retry also fails, generate and retain identifiers before
acquiring, then reuse them for the same acquisition attempt:

```python
from uuid import uuid4

owner_token = str(uuid4())
request_id = str(uuid4())
lease = client.locks.acquire(
    "daily-report", ttl=30, token=owner_token, request_id=request_id
)
```

Caller-supplied UUID strings retain their exact spelling across retries and lease operations.
Every lock method accepts `request_id`. `with_lock()` also accepts `token` and
`request_id` for acquisition; its renewal and release calls use new request IDs.

Use a new ownership token for a new lease after release or expiry. Keep ownership
tokens private. A failed response does not prove the server failed to acquire;
reuse the original token to recover the outcome rather than starting a new owner.
