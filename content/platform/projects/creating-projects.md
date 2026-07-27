---
title: "Creating Projects"
description: "Projects organize your functions, databases, and auth users."
---

Projects organize your functions, databases, and auth users.

## Create a Project

```bash
curl -X POST https://api.volcano.dev/projects \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app"}'
```

Create a project restricted to one region (PRO plan):

```bash
curl -X POST https://api.volcano.dev/projects \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","all_regions":false,"selected_regions":["us-east-1"]}'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-app",
  "status": "active",
  "all_regions": true,
  "selected_regions": ["us-east-1","us-west-2"],
  "aws_application_name": "volcano-550e8400",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Fields:**
- `id` - Unique project identifier (use in all API calls)
- `status` - `active`, `provisioning`, or `failed`
- `aws_application_name` - Internal AWS resource name

Save the `id` - you'll need it for all project operations.

## Update project name or region policy

```bash
curl -X PATCH https://api.volcano.dev/projects/PROJECT_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app-renamed"}'
```

Switch to a single-region policy:

```bash
curl -X PATCH https://api.volcano.dev/projects/PROJECT_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"all_regions":false,"selected_regions":["us-east-1"]}'
```

## List Your Projects

```bash
curl https://api.volcano.dev/projects \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

With pagination:
```bash
curl "https://api.volcano.dev/projects?page=1&limit=20" \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

## Get Project Details

```bash
curl https://api.volcano.dev/projects/PROJECT_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

## Delete a Project

```bash
curl -X DELETE https://api.volcano.dev/projects/PROJECT_ID \
  -H "Authorization: Bearer PLATFORM_TOKEN"
```

**Warning:** This deletes:
- All functions in the project
- All databases in the project
- All auth users in the project
- All tokens
- All variables
- All anon keys
- All sessions and related data

This action cannot be undone.

## Next Steps

- [Deploy a Function](../functions/creating-functions.md)
- [Create a Database](../databases/creating-databases.md)
- [Add Authentication](../authentication/quickstart.md)




