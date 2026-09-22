---
title: Realtime
description: Send broadcasts, observe presence, and receive database changes with Python async channels.
order: 8
---

Subscribe to a broadcast channel and send a JSON publication using Python's async lifecycle.
Sign in with the [quickstart credentials](./README.md) and enable the project's realtime capabilities and access policies.

```python
import asyncio
import os

from volcano_sdk import VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
)
client.auth.sign_in(
    email=os.environ["VOLCANO_USER_EMAIL"],
    password=os.environ["VOLCANO_USER_PASSWORD"],
)


async def main():
    channel = client.realtime.channel("updates")
    channel.on("message", lambda message: print(message))
    try:
        await channel.subscribe()
        await channel.send({"event": "message", "value": "hello"})
        await asyncio.sleep(2)
    finally:
        await client.realtime.disconnect()


asyncio.run(main())
```

`subscribe()` waits for the server acknowledgement; a presence subscription also waits for its initial roster.
Channel names receive their type prefix, so `updates` becomes `broadcast:updates`.
Use the same event loop for a client's realtime operations.
The following channel examples belong inside an async function with an authenticated `client`.

## Pause or remove channels

```python
channel = client.realtime.channel("updates")
channel.on("message", print)
await channel.subscribe()
await channel.unsubscribe()
await channel.subscribe()
await client.realtime.remove_channel("updates")
```

Unsubscribe pauses delivery while retaining handlers and the in-memory broadcast recovery position.
Subscribe resumes and requests missed broadcasts when retained history is available.
Pausing discards queued callbacks; a callback already running may finish.
Removal forgets the channel and its recovery position.
`remove_all_channels()` removes all channels while leaving the shared connection available; `disconnect()` closes it.
Application code owns any work its callbacks start and should await that work during shutdown.

## Observe presence

```python
lobby = client.realtime.channel("lobby", channel_type="presence")
stop_sync = lobby.on_presence_sync(lambda state: print("Online", len(state)))
lobby.on("join", lambda info: print("Joined", info.user))
lobby.on("leave", lambda info: print("Left", info.user))
await lobby.subscribe()
await lobby.track({"status": "online"})
print(lobby.tracked_state)
print(lobby.get_presence_state())
await client.realtime.remove_channel("lobby", channel_type="presence")
stop_sync()
```

Presence identity and metadata come from the authenticated user.
`track()` stores optional local application state; it does not replace server-managed presence metadata.
The roster maps connection IDs to immutable client identity and user metadata snapshots.
One user can have several connections. The original sync callback observes connections joining and leaving.
The roster is refreshed after reconnection; a failed roster query reports an error and clears the snapshot.

## Subscribe to database changes

Use an existing `app` database and `public.messages` table with realtime and suitable Row-Level Security policies configured:

```python
client.realtime.set_database_name("app")
changes = client.realtime.channel("public:messages", channel_type="postgres")
stop_changes = changes.on_postgres_changes(
    "INSERT",
    schema="public",
    table="messages",
    callback=lambda change: print(change.record),
)
await changes.subscribe()
await asyncio.sleep(30)
stop_changes()
await client.realtime.remove_channel("public:messages", channel_type="postgres")
```

Insert a row from another client during the listening period.
Automatic row lookup requires a primary key named `id`. It reads the current row after the notification; rapid updates may have already changed that row.
Matching insert and update notifications can fetch full rows using the subscription's user token.
Compatible row lookups are batched while publication order is preserved.
Defaults are a 20 millisecond window and 50 rows; set `fetch_batch_window_ms` and `fetch_max_batch_size` on the channel to change them.
Set `auto_fetch=False` when first creating the channel or `set_database_name(None)` to retain lightweight notifications without row lookups.
For a custom schema, use its `schema:table` channel name and matching schema/table filters; row lookups preserve that schema.
Missing rows and failed lookups retain the lightweight notification.
Deletes use `old_record` or the row ID and do not query the database.

## Handle connection changes

```python
stop_errors = client.realtime.on_error(lambda context: print(context.message))
stop_connected = client.realtime.on_connect(lambda context: print(context.client))
stop_disconnected = client.realtime.on_disconnect(lambda context: print(context.reason))
```

Each registration returns an idempotent unsubscribe function.
Callbacks receive immutable contexts and run outside connection processing.
Broadcast recovery stays within one client lifetime and one authenticated session lineage; it is not persisted across processes.
After signing in again or changing users, disconnect before subscribing for the new session.
Do not use realtime delivery as a durable record of every database change.
