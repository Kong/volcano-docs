---
title: "Auth user insights"
description: "Query authentication insights and metrics for a project over a time range."
---

Use:

```http
GET /projects/{id}/auth/insights?from=2026-06-21&to=2026-07-20&interval=day
Authorization: Bearer <platform-token>
```

`from` and `to` are inclusive UTC dates. The default window is the latest 30
days including today. The maximum window is 366 days. Supported intervals are
`day`, `week`, and `month`; weeks start Monday. Missing buckets are returned
with zero counts, and `is_partial` identifies a bucket clipped by the requested
window or the current observation time.

```json
{
  "project_id": "4f165080-a931-4e03-b3bd-41c45c3f0058",
  "observed_at": "2026-07-20T18:00:00Z",
  "window": {
    "from": "2026-06-21",
    "to": "2026-07-20",
    "interval": "day"
  },
  "summary": {
    "total_users": 1234,
    "deleted_users": 42,
    "active_users_1d": 83,
    "active_users_30d": 418
  },
  "series": [
    {
      "bucket_start": "2026-07-20",
      "signups": 12,
      "signins": 97,
      "deletions": 3,
      "banned_users": 2,
      "deleted_users": 3,
      "available_users": 7,
      "net_growth": 9,
      "is_partial": true
    }
  ]
}
```

Metric definitions:

- `total_users`: current auth-user inventory, excluding deleted accounts.
- `deleted_users`: recorded deleted accounts, counted once even if a soft-deleted
  account is later permanently removed. Internal test identities are excluded.
- `active_users_1d` and `active_users_30d`: distinct users whose latest successful
  session creation or refresh occurred in the trailing 24 hours or 30 days.
  Activity before deletion still counts until it leaves that window. These are
  rolling DAU/MAU snapshots, not historical daily active-user series.
- `signups`: registrations during the bucket. Deleting an account does not
  rewrite its signup bucket. Duplicate signup responses, OAuth linking,
  anonymous conversion, debug users and provisioned seed users do not count.
- `deletions`: accounts deleted during the bucket, counted once across soft and
  hard deletion. This remains grouped by deletion date.
- `net_growth`: registrations minus deletions during the bucket. Bans and unbans
  do not change this activity metric. It can be negative.
- `deleted_users`: users registered in the bucket who are now deleted, counted
  once across soft and hard deletion. A new account using a released email is a
  separate signup.
- `banned_users`: users registered in the bucket who are currently banned.
  Deleted users, lifted bans, expired temporary bans, and internal test identities
  are excluded. Repeating or extending a ban does not increase the count.
- `available_users`: currently available users from the bucket's registrations:
  `signups - banned_users - deleted_users`. Deleting a banned user moves one
  account from `banned_users` to `deleted_users`, leaving availability unchanged.
  Unban or expiry restores availability in the original signup bucket.
  `total_users` remains all non-deleted accounts, including banned accounts.
- `signins`: successful session creations during the bucket across email,
  OAuth, anonymous, and device flows. Failed authentication and token refresh do
  not count. Sign-ins by users deleted later still count. Historical sign-in
  counts begin when collection is deployed.

The existing `Auth Requests` metric remains separate because it also includes
refreshes and other auth operations.

Deletion history begins with deployment of deletion-history collection. Existing
soft-deleted accounts are included in their signup bucket for `deleted_users`;
`deletions` uses their recorded update timestamp as the deletion date. Accounts
already hard-deleted, and signup counts previously subtracted by the old deletion
policy, cannot be reconstructed. Retained deletion metrics contain only account
and project identifiers, timestamps and flags needed for aggregation. The account
identifier is also removed on hard deletion. Email addresses and OAuth credentials
are not retained in these metrics.

The `banned_users`, `deleted_users`, and `available_users` series show **current account
retention by registration date**, not the number of operations on each date.
For example, a user registered last Monday and banned today appears in Monday's
ban count. Deleting that user switches Monday's count from banned to deleted.
Historical buckets therefore change as account states change. This measures
account availability, not whether users returned to use the application.

Ban counts read current account status directly and need no separate ban-history
collection. Existing deletion history preserves the signup date after account
removal. Project deletion removes the retained history.
