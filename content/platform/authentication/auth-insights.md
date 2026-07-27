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
    "active_users_30d": 418
  },
  "series": [
    {
      "bucket_start": "2026-07-20",
      "signups": 12,
      "signins": 97,
      "is_partial": true
    }
  ]
}
```

Metric definitions:

- `total_users`: current auth-user inventory. It matches the total returned by
  the auth-user list.
- `active_users_30d`: distinct current users whose latest successful session
  creation or token refresh occurred within the trailing 30 days. Activity
  history begins when collection is deployed.
- `signups`: accounts created during the bucket. Duplicate signup responses,
  OAuth linking/reclaim, anonymous conversion, debug users, and provisioned seed
  users do not count. Provisioning sets a server-owned exclusion flag; user
  metadata cannot suppress analytics. Historical counts are backfilled from
  accounts present when collection is deployed, using their creation date.
- `signins`: successful session creations during the bucket across email,
  OAuth, anonymous, and device flows. Failed authentication and token refresh do
  not count. Historical sign-in counts begin when collection is deployed.

The existing `Auth Requests` metric remains separate because it also includes
refreshes and other auth operations.
