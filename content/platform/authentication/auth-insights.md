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
  hard deletion. A new account using a released email is a separate signup.
- `net_growth`: signups minus deletions in the bucket. Unlike signup and deletion
  counts, net growth can be negative.
- `signins`: successful session creations during the bucket across email,
  OAuth, anonymous, and device flows. Failed authentication and token refresh do
  not count. Sign-ins by users deleted later still count. Historical sign-in
  counts begin when collection is deployed.

The existing `Auth Requests` metric remains separate because it also includes
refreshes and other auth operations.

Deletion history begins with deployment of deletion-history collection. Existing
soft-deleted records are included using their recorded update timestamp. Accounts
already hard-deleted, and signup counts previously subtracted by the old deletion
policy, cannot be reconstructed. Retained deletion metrics contain only account
and project identifiers, timestamps and flags needed for aggregation. The account
identifier is also removed on hard deletion. Email addresses and OAuth credentials
are not retained in these metrics.
