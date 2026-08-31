---
title: "Backups and restore"
description: "Back up a database, restore it from a backup or to a point in time, and schedule automated backups."
---

A backup is a copy of one of your databases as it was at a moment in time. You
can take one whenever you like, restore one in place, or roll the database back
to any point inside your plan's history window without having taken a backup at
all.

Backups are a Pro capability. On the Free plan every endpoint on this page
returns `403`, including the read-only ones. See [Limits](#limits).

Take one before anything you might want to undo:

```bash
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/backups \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "before_migration"}'
```

```json
{
  "name": "before_migration",
  "source": "manual",
  "expires_at": "2024-01-31T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

The backup exists as soon as the call returns — there is nothing to poll.
`size_bytes` appears a few minutes later, once the storage provider has costed
it; a backup without one is not an empty backup.

## Listing backups

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/backups \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "name": "before_migration",
      "source": "manual",
      "size_bytes": 41943040,
      "expires_at": "2024-01-31T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "name": "daily-2023-12-31-03-00",
      "source": "scheduled",
      "size_bytes": 41932288,
      "expires_at": "2024-01-30T03:00:00Z",
      "created_at": "2023-12-31T03:00:00Z"
    }
  ],
  "restore_window": {
    "earliest_restore_at": "2023-12-25T00:00:00Z",
    "latest_restore_at": "2024-01-01T00:00:00Z"
  }
}
```

Backups come back newest first. `source` tells apart the ones you asked for from
the ones your schedule produced — only `manual` backups count against your
plan's allowance. `restore_window` is the span a point-in-time restore can
target right now; it is absent on a plan without point-in-time restore, and for
a short while after an upgrade to one, until the window is in place at the
storage provider. Read it rather than assuming your plan's full window: it is
what a restore is actually checked against.

Listing works while a restore runs. It answers `409`, rather than an empty list,
on a database that has no storage behind it yet — a database still
`provisioning`. So does reading the schedule.

Delete one you no longer need, and its storage goes with it:

```bash
curl -X DELETE https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/backups/before_migration \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## Restoring

A restore replaces the database's data in place. Everything written after the
point you restore to is discarded — that is the point — so it is the one
operation here you cannot undo by repeating it.

```bash
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/restores \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backup_name": "before_migration"}'
```

```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database_id": "abc-123-456-789",
  "project_id": "11111111-1111-1111-1111-111111111111",
  "kind": "snapshot",
  "status": "pending",
  "backup_name": "before_migration",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

The response is `202`: rolling a database back takes longer than a request. The
database reports `restoring` and stops accepting connections until the restore
finishes. Poll it:

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/restores/$RESTORE_ID \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "kind": "snapshot",
  "status": "completed",
  "backup_name": "before_migration",
  "completed_at": "2024-01-01T12:03:20Z",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:03:20Z"
}
```

A restore that fails carries the reason in `error`, and `status` says whether
Volcano is still retrying. See [Restore statuses](#restore-statuses).

Restores are always in place. There is no way to restore into a second database,
and the database's connection string, username, and password are unchanged
throughout — anything holding that string starts working again on its own once
the restore completes. Expect a few minutes of downtime, longer for a large
database.

Nothing reaches the data while the restore runs: direct Postgres connections are
refused, and so are the REST query endpoints. Treat both as expected downtime
rather than a transient provider error, and read the database's `status` to tell
them apart.

Realtime Postgres-changes subscriptions on the database are dropped when the
restore finishes, and a new one is refused while it runs: a restore replaces the
data the triggers sit on and rotates the credential the listener authenticates
with. Clients resubscribe once the database reports `active` again.

`GET /restores` returns the database's restore history, newest first, capped at
the 50 most recent. It keeps working while a restore runs, and while the storage
provider is unreachable, because it is the record of what you asked for rather
than provider state.

### Restoring to a point in time

Send a timestamp instead of a backup name. No backup has to exist at that
moment; what makes it possible is the history your plan keeps.

```bash
curl -X POST https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/restores \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restore_to": "2024-01-01T09:30:00Z"}'
```

Send exactly one of `backup_name` and `restore_to`; both or neither returns
`400`. A timestamp outside the `restore_window` is refused with `400` and the
response names the span you can choose from, rather than failing partway through
a destructive operation.

The window moves forward continuously as history ages out, so read it just
before you use it rather than caching it.

### What a restore refuses

A database being restored is one nothing else may touch. While a restore is in
flight, these return `409`:

| Request | Why |
|---|---|
| A second restore | The first one is still moving the data |
| A new backup | There is no coherent state to capture yet |
| Deleting a backup | The restore may still need the one it is pinned to |
| A schedule change | The restore is moving the data to a new branch, and that is where the schedule has to live |
| Deleting the database | The restore would race the teardown |
| Resizing the database's compute | The compute is being moved |
| Resetting the database password | The restore rewrites credentials on its way out |
| Creating or resetting a branch | A branch forks from the parent the restore is replacing |

Deleting, resizing, and resetting the password ask whether a restore is running
before they act. If Volcano cannot get an answer, they return `503` rather than
act on a guess: retry, and expect a `409` if a restore turns out to be running.

It holds the other way round too: starting a restore is refused with `409` while
the database has branch work in flight, since a branch being provisioned or reset
forks from the data the restore is about to replace. Wait for the branch to settle
and retry.

Wait for the restore to report `completed` and retry. Volcano retries a failed
attempt on its own, and the restore reads `pending` between tries; `failed` or
`exhausted` means it gave up, and the database is left `failed` rather than
half-restored — unless the restore never got as far as touching it, in which case
it goes back to `active` unchanged. That is what happens to a restore whose backup
is no longer at the provider: nothing was replaced, so there is nothing to leave
broken.

## Automated backups

A schedule has the provider take backups for you. Replace it wholesale:

```bash
curl -X PUT https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/backup-schedule \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      { "frequency": "daily", "hour": 3 },
      { "frequency": "weekly", "hour": 4, "day": 6, "retention_seconds": 1209600 }
    ]
  }'
```

```json
{
  "entries": [
    { "frequency": "daily", "hour": 3, "retention_seconds": 2592000 },
    { "frequency": "weekly", "hour": 4, "day": 6, "retention_seconds": 1209600 }
  ]
}
```

- `hour` is UTC, `0`-`23`.
- `day` is the day of the week (`1`-`7`, Monday to Sunday) for a weekly entry, or
  the day of the month (`1`-`28`) for a monthly one. It is required for both and
  ignored for a daily entry. Monthly stops at 28 so the schedule fires in
  February too.
- `retention_seconds` is how long each backup from that entry is kept. It
  defaults to your plan's retention and is clamped to it.

Scheduled backups do not count against your backup allowance, so a schedule
cannot lock you out of taking one by hand. They are ordinary backups otherwise:
listed alongside yours, restorable, and deletable.

A schedule survives a restore: automated backups resume on the restored data
without you setting it again.

Send an empty list to turn automated backups off:

```bash
curl -X PUT https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/backup-schedule \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entries": []}'
```

## Backups and branches

Backups and restores are about the database itself. A [branch](branching.md) is
never backed up and never restored, but a parent restore is visible to its
branches:

- **Branches keep their own data.** Restoring the parent does not roll a branch
  back. Each branch keeps serving what it had, on its own connection string.
- **Branch reset is unavailable for up to 24 hours** after the parent is
  restored, and returns `409` for that period. The branch stays up and usable
  the whole time; only the rewind is refused.
- **A reset after that rewinds to the restored data**, because a reset re-forks
  the branch from the parent as it is now.
- **The pre-restore state is preserved.** Volcano keeps the state the database
  was in before a restore for seven days, which is what lets your branches
  survive one. It does not count toward your storage allowance and does not
  appear in your database's stats.

A database holds at most three preserved states at once, so a fourth restore
inside the same seven days returns `409`. The oldest is released as soon as its
seven days are up, unless branches forked before that restore are still using
it — deleting those branches, or letting them expire, releases it sooner.

## What backups cost

**Backup storage counts toward your database's storage.** A backup you take is
charged as a full copy of the database as it was at that moment — not as the
difference from the database today. Two backups of a 2 GB database are 4 GB of
backup storage, whether or not you have written a byte since.

Scheduled backups are cheaper than that after the first. The first snapshot a
schedule takes is a full copy; each one after it is charged only the storage it
adds on top of the previous one. A daily schedule on a database that barely
changes stays close to the size of one copy. That is why a schedule's backups
each report a `size_bytes` of roughly the whole database while adding far less
than that between them: `size_bytes` is how much data the backup holds, not what
it costs to keep.

Deleting a backup releases its storage, and takes effect immediately.

The point-in-time history behind `restore_window` is not charged to you at all.
Volcano covers it, because you did not choose it: it comes with your plan.

Pro databases have no storage cap, so backups add to your storage figure rather
than putting a limit at risk. Free databases are never counted for backup
storage, so the figure is zero there — including on one that still holds a
scheduled backup from a plan it has since left.

Read the current figure from your database's stats:

```bash
curl https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/stats \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "current_storage_bytes": 2040109465,
  "current_storage_mb": 1945.6,
  "backup_storage_bytes": 966367641,
  "branches": []
}
```

`backup_storage_bytes` is the part of `current_storage_bytes` your backups
account for — here, one backup of a database that was 0.9 GB when it was taken.
It is sampled from the provider rather than measured live. Deleting a backup
releases its share straight away, so a database blocked at its storage allowance
can delete one and carry on writing; a backup you have just taken appears in the
figure once the provider has costed it, within the hour.

Watch this figure on a database with a schedule: a schedule keeps taking backups
whether or not you are looking, and retention is what bounds how many it holds.

## Limits

| | Free | Pro |
|---|---|---|
| Backups per database | Not included | 50 |
| Backup retention | Not included | 30 days |
| Point-in-time restore window | Not included | 7 days |

Backups, scheduled backups, and point-in-time restore are all Pro. A Free
project gets `403` from every endpoint here, with nothing to configure and
nothing to turn on.

The allowance counts only the backups you took; scheduled ones are free of it.
Taking one over the allowance returns `403` — delete one first. Backups are
rate-limited to one per minute per database, so a retried create that timed out
cannot silently consume two slots.

Retention is applied when a backup is taken: `expires_at` is when it will be
deleted for you.

Downgrading to Free deletes the backups you took, turns off any schedule, and
closes the point-in-time window. Backups your schedule had already taken are left
to expire on their own retention — you cannot list, restore, or delete them
meanwhile, and they are not charged to you. Backup storage stops counting toward
your database's storage with the downgrade itself, so a database whose data fits
Free is not held over backups you can no longer reach. Upgrading gives the capability
back immediately, but it starts from that moment: there is nothing to restore from
until you take a backup, and the point-in-time window fills as the database
writes.

## Naming

Backup names you create are lowercase letters, numbers, underscores, and hyphens,
up to 63 characters, starting with a letter or number, and unique within the
database. An uppercase letter is rejected rather than folded. Names beginning with
`volcano-` are reserved: Volcano takes its own snapshots during a point-in-time
restore, and they are neither listed as your backups nor counted against your
allowance.

Reading, deleting, or restoring a backup accepts any name a backup can have, not
just the ones you can create, because a schedule names its own backups.

Creating a backup with a name that already exists returns `409` rather than a
second backup. Deleting or reading a name that does not exist returns `404`,
whether it never existed or was already deleted.

## Restore statuses

- `pending` — accepted, not started; the database is already out of service. An
  attempt that fails with tries left comes back here
- `running` — in progress
- `completed` — the database is back in service with the restored data
- `failed` — the last attempt failed and the retry budget is out
- `exhausted` — terminal; Volcano stopped retrying

`failed` and `exhausted` both mean Volcano gave up. The database is left `failed`
if its data may already have been replaced, and `active` if the restore never
started, as when the backup it named is gone from the provider. Read `error` on
the restore for the reason. A restore cannot be cancelled once it starts.

## See Also

- [Databases API](../api-reference/databases.md) — full endpoint reference
- [Branching](branching.md)
- [Plans and limits](../guides/plans-and-limits.md)
