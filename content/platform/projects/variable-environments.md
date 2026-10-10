---
title: "Variable Environments"
description: "Create and manage Project-owned variable Environment identities."
---

Create stable Environment identities for a Project. Every Project starts with a
reserved `Global` Environment. Global cannot be renamed or deleted. Environment
values and deployment Target assignments are not part of this release.

```bash
curl -X POST https://api.volcano.dev/projects/PROJECT_ID/variable-environments \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Staging"}'
```

A Project may have up to 100 custom Environments. This safety limit bounds the
unpaginated collection; Global does not count toward it. Creating another
Environment returns `409` with code `variable_environment_limit_reached`.
Creating, renaming, or deleting an Environment while its Project is being
deleted returns `409` with code `project_deleting`.

## Name an Environment

Names contain 1–64 ASCII letters, digits, underscores, or hyphens. Volcano
preserves display case but compares names without case, so `Staging` and
`staging` conflict. Name conflicts return `409` with code
`variable_environment_conflict`. Invalid names return the generic `400`
invalid-request error. Every case variant of the reserved `Global` name passes
schema validation and returns `400` with code `invalid_variable_environment`.

Each Environment has a stable UUID. Renaming it does not change its identity.

## List Environments

```bash
curl https://api.volcano.dev/projects/PROJECT_ID/variable-environments \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Global is first. Custom Environments follow in case-insensitive name order.

```json
{
  "data": [
    {
      "id": "0199e90e-2e5c-7a0e-a72a-221f1cf48d33",
      "project_id": "0199e90d-9e8f-7596-801e-f298f6cc5066",
      "name": "Global",
      "is_global": true,
      "created_at": "2026-10-07T18:00:00Z",
      "updated_at": "2026-10-07T18:00:00Z"
    }
  ]
}
```

## Rename an Environment

```bash
curl -X PATCH \
  https://api.volcano.dev/projects/PROJECT_ID/variable-environments/ENVIRONMENT_ID \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Production"}'
```

A missing Environment returns `404`. A case-insensitive conflict returns `409`
with code `variable_environment_conflict`. Renaming Global returns `409` with
code `variable_environment_immutable`.

## Delete an Environment

```bash
curl -X DELETE \
  https://api.volcano.dev/projects/PROJECT_ID/variable-environments/ENVIRONMENT_ID \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Deleting Global returns `409` with code `variable_environment_immutable`.
Custom Environment deletion is Project-scoped and returns `404` when the ID
belongs to another Project.
