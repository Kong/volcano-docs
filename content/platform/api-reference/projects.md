---
title: "Projects API"
description: "Manage projects via REST API."
---

Manage projects via REST API.

**Authentication:** Platform user token

## List Projects

```http
GET /projects
Authorization: Bearer <platform_token>
```

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `cursor` - Opaque `next_cursor` value for forward pagination
- `ending_before` - Opaque `prev_cursor` value for backward pagination
- `offset` - Rows to skip after a cursor anchor for hybrid page jumps
- `search` - Case-insensitive project name search (max 256 characters)

Requests without pagination parameters use offset mode. Supplying `limit`
without `page`, or supplying either cursor parameter, uses cursor mode. Do not
combine `page` with `cursor` or `ending_before`.

The endpoint excludes projects whose status is `deleting` or `deleted`.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "my-app",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "has_more": false
}
```

To continue in cursor mode, send the returned cursor with the same `limit` and
`search` values:

```http
GET /projects?limit=10&search=my-app&cursor=<next_cursor>
Authorization: Bearer <platform_token>
```

Cursor responses include `next_cursor` and `prev_cursor` when another page
exists in that direction. They also include the filtered `total`.

## Get Project

```http
GET /projects/{id}
Authorization: Bearer <platform_token>
```

**Response:**
```json
{
  "id": "uuid",
  "name": "my-app",
  "status": "active",
  "all_regions": true,
  "selected_regions": ["us-east-1", "us-west-2"],
  "aws_application_name": "volcano-uuid",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

## Create Project

```http
POST /projects
Authorization: Bearer <platform_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "my-app",
  "all_regions": true
}
```

To restrict a project to specific regions (PRO plan):

```json
{
  "name": "my-app",
  "all_regions": false,
  "selected_regions": ["us-east-1"]
}
```

**Response:** 201 Created
```json
{
  "id": "uuid",
  "name": "my-app",
  "status": "active",
  "all_regions": true,
  "selected_regions": ["us-east-1", "us-west-2"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Limit:** Each user can create up to 1,000 projects. Requests over this cap return `403 Forbidden`.

## Update Project

```http
PATCH /projects/{id}
Authorization: Bearer <platform_token>
Content-Type: application/json
```

Update only the fields you need.

**Name-only update (keeps existing region policy):**
```json
{
  "name": "my-renamed-app"
}
```

**Switch to single-region deployment policy:**
```json
{
  "all_regions": false,
  "selected_regions": ["us-east-1"]
}
```

**Response:** 200 OK with updated project.

## Delete Project

```http
DELETE /projects/{id}
Authorization: Bearer <platform_token>
```

**Response:** 202 Accepted

Project deletion is asynchronous. After the request is accepted, the project is
removed from `GET /projects`. `GET /projects/{id}` continues to show
`status: "deleting"` while cleanup runs. When cleanup finishes,
`GET /projects/{id}` returns `404`.

**Warning:** Deletes all frontends, functions, databases, auth users, tokens, and variables in the project.

## Export Project Configuration

```http
GET /projects/{id}/config
Authorization: Bearer <platform_token>
```

Exports the project's current user-facing configuration as a declarative
manifest (see the [configuration manifest reference](../projects/configuration.md)).
Returns JSON by default; request the canonical `volcano-config.yaml` rendering
with `Accept: application/yaml` or `?format=yaml`. Write-only secrets (SMTP
password, OAuth client secrets, TLS material) are omitted.

**Response:** 200 OK with the manifest.

## Apply Project Configuration

```http
PUT /projects/{id}/config
Authorization: Bearer <platform_token>
Content-Type: application/json
```

Validates and applies a configuration manifest, reconciling each declared
section server-side. Add `?dry_run=true` to get the projected report without
changing anything.

**Response:** 200 OK with a per-resource report:

```json
{
  "results": [
    {"section": "variables", "name": "STRIPE_SECRET_KEY", "action": "created"},
    {"section": "realtime", "action": "updated", "notice": "disabling realtime drops active websocket connections"}
  ],
  "skipped": [{"type": "function", "name": "hello", "reason": "not deployed"}],
  "missing": [{"type": "bucket", "name": "avatars"}],
  "summary": {"created": 1, "updated": 1, "deleted": 0, "unchanged": 0, "errors": 0, "skipped": 1, "missing": 1}
}
```

- `skipped` / `missing` are coverage warnings for functions, frontends,
  databases, and buckets (the manifest never creates or deletes them).
- Validation failures return **422** with the full error list; nothing is applied.
- A concurrent apply for the same project returns **409**.
- Apply-phase failures surface as per-entry `action: "error"` with
  `summary.errors > 0`; applied changes are not rolled back.
- The request body is capped at **4 MiB** (hosted pages, template bodies, and
  TLS PEMs fit comfortably; larger bodies are rejected with 400).

## Query Project Runtime Metrics

```http
POST /projects/{id}/metrics/query
Authorization: Bearer <platform_token>
Content-Type: application/json

{
  "time_range": {"window": "1h"},
  "queries": [
    {"id": "requests", "metric": "request_count"},
    {"id": "availability_by_region", "metric": "availability", "group_by": "region"}
  ]
}
```

Query up to 10 named metrics over a trailing `30m`, `1h`, `24h`, or `7d` window.
Supported metrics are `request_count`, `server_error_count`, `availability`, and `p95_latency`.
Group results by `region` or `resource_type` when needed.

**Response:**

```json
{
  "observed_at": "2026-07-10T12:00:00Z",
  "fresh_through": "2026-07-10T11:58:00Z",
  "window": {
    "from": "2026-07-10T11:00:00Z",
    "to": "2026-07-10T12:00:00Z"
  },
  "results": [
    {
      "id": "requests",
      "metric": "request_count",
      "unit": "count",
      "data_status": "partial",
      "values": [{"dimensions": {}, "value": 1842}]
    },
    {
      "id": "availability_by_region",
      "metric": "availability",
      "unit": "ratio",
      "data_status": "partial",
      "values": [
        {"dimensions": {"region": "us-east-1"}, "value": 0.998},
        {"dimensions": {"region": "us-west-2"}, "value": 0.995}
      ]
    }
  ]
}
```

Use each result's `data_status` when presenting the values:

- `complete` means the requested window was evaluated from all available data.
- `partial` means the durable values are available, but the newest live samples may be missing. Use `fresh_through` to show the data boundary and retry before treating the window as complete.
- `no_data` means no samples were found for that result.

The endpoint returns `503` when no metrics backend can serve the query.

## Get Project Usage

```http
GET /projects/{id}/usage
Authorization: Bearer <platform_token>
```

Returns the current-month total, the lifetime (all-time) total, and recent daily/hourly series for each tracked metric, plus a per-frontend request breakdown for the current usage period.

**Response:**
```json
{
  "project_id": "uuid",
  "month": "2026-04",
  "metrics": [
    {
      "metric": "Function Invocations",
      "total": 1234,
      "all_time": 98765,
      "daily": [{ "timestamp": "2026-04-26T00:00:00Z", "value": 42 }],
      "hourly": [{ "timestamp": "2026-04-27T20:00:00Z", "value": 3 }]
    },
    {
      "metric": "Frontend Requests",
      "total": 9876,
      "all_time": 543210,
      "daily": [{ "timestamp": "2026-04-26T00:00:00Z", "value": 321 }],
      "hourly": [{ "timestamp": "2026-04-27T20:00:00Z", "value": 18 }]
    }
  ],
  "frontends": [
    {
      "frontend_id": "uuid",
      "frontend_name": "marketing-site",
      "requests": 6200
    },
    {
      "frontend_id": "uuid",
      "frontend_name": "docs-site",
      "requests": 3676
    }
  ]
}
```

## Project Status

- `active` - Ready to use
- `deleting` - Deletion accepted; cleanup is still running
- `failed` - Asynchronous deletion cleanup failed and can be retried

## Region Policy Notes

- `all_regions: true` deploys functions to all configured regions.
- `all_regions: false` + `selected_regions` limits function deployments to that subset.
- Changing region policy is asynchronous; function deployments converge to the new region set.

## See Also

- [Functions API](functions.md)
- [Databases API](databases.md)
- [Auth Endpoints](auth-endpoints.md)
