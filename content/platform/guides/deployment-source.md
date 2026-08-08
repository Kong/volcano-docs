---
title: "Deployment source"
description: "Identify what initiated each deployment — a Git push, the CLI, the dashboard, the API, or the platform itself."
---

Every deployment records a **`deploy_source`**: what initiated it. Use it to tell an automated Git push apart from a manual CLI deploy, or to filter a project's deployment history by origin.

`deploy_source` is returned on Function and Frontend deployments and on the project deployment feed.

## Values

| Value | Meaning |
| --- | --- |
| `git` | A Git push to the connected repository's production branch (auto-deploy). |
| `cli` | A deploy from the Volcano CLI. |
| `web` | A deploy from the dashboard. |
| `api` | A deploy from a direct API call with a platform token. |
| `system` | Platform-initiated work with no user actor, such as region convergence or a project-delete cascade. |
| `unknown` | Origin not recorded — historical deployments created before this field existed. |

A deployment correlated to a Git deployment run is always `git`, regardless of how the request reached the API.

## Reading the deployment feed

The project deployment feed returns `deploy_source` on each attempt:

```bash
curl -H "Authorization: Bearer $VOLCANO_TOKEN" \
  "https://api.volcano.dev/projects/$PROJECT_ID/deployments?limit=20"
```

```json
{
  "data": [
    {
      "id": "d1f8…",
      "resource": { "type": "function", "id": "fn_…", "name": "api" },
      "operation": "deploy",
      "status": "active",
      "deploy_source": "git",
      "created_at": "2026-08-06T17:04:11Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "has_more": false
}
```

## Attribution

Request-initiated deployments (`cli`, `web`, `api`) also record `initiated_by`, the platform user that triggered them. `git` and `system` deployments have no user actor, so `initiated_by` is absent.

## Declaring the dashboard client

Authentication is authoritative for the `cli` classification. A non-CLI client that is the dashboard should send the `X-Volcano-Client: web` request header so its deployments are recorded as `web` rather than `api`.
