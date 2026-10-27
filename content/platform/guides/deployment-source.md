---
title: 'Deployment source'
description: 'Identify what initiated each deployment — a Git push, the CLI, the dashboard, the API, or the platform itself.'
---

Every deployment records a **`deploy_source`**: what initiated it. Use it to tell an automated Git push apart from a manual CLI deploy, or to filter a project's deployment history by origin.

`deploy_source` is returned on Function and Frontend deployments and on the project deployment feed.

## Values

| Value     | Meaning                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------- |
| `git`     | A Git push to the connected repository's production branch (auto-deploy).                           |
| `cli`     | A deploy from the Volcano CLI.                                                                      |
| `web`     | A deploy from the dashboard.                                                                        |
| `api`     | A deploy from a direct API call with a platform token.                                              |
| `system`  | Platform-initiated work with no user actor, such as region convergence or a project-delete cascade. |
| `unknown` | Origin not recorded — historical deployments created before this field existed.                     |

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
      "resource": { "type": "function", "id": "fn_…", "name": "api", "kind": "standard" },
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

The feed lists functions and frontends together. Standard and
[durable](../functions/durable-functions.md) functions both appear as
`"type": "function"`, and `resource.kind` tells them apart. Narrow the feed with
`resource_type=function` or `resource_type=frontend`, and with
`function_kind=standard` or `function_kind=durable`:

```bash
curl -H "Authorization: Bearer $VOLCANO_TOKEN" \
  "https://api.volcano.dev/projects/$PROJECT_ID/deployments?function_kind=durable&limit=20"
```

`function_kind` implies function deployments, so frontends drop out. Combining
it with `resource_type=frontend` answers `400`.

## Commit

A deploy client can report the commit its upload came from. Volcano records it on the deployment as `commit`, separate from `deploy_source`. Send it as a JSON-encoded `commit` field on a function, durable function, or frontend upload, or as `commit` on each entry of a batch upload's `functions` manifest:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -F name=web \
  -F archive=@web.tar.gz \
  -F 'commit={"repository":"acme/app","sha":"4f1c2b7d9e0a8b3c6d5e4f3a2b1c0d9e8f7a6b5c","dirty":false,"root":"apps/web"}'
```

| Field        | Value                                                                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repository` | `owner/name`, or a github.com remote URL such as `https://github.com/acme/app.git` or `git@github.com:acme/app.git`. Stored as `owner/name`, without credentials. An SSH host alias such as `github.com-work` isn't recognized; send `owner/name` instead. |
| `sha`        | The full 40-character commit ID.                                                                                                                                                                                                                           |
| `dirty`      | `true` when the uploaded files differ from the commit.                                                                                                                                                                                                     |
| `root`       | The uploaded directory's path from the repository root, such as `apps/web`, or `""` for the repository root. Optional.                                                                                                                                     |

`repository`, `sha`, and `dirty` are required. Fields Volcano doesn't know are ignored. A malformed commit, or a repository not on GitHub, answers `400` and deploys nothing.

Volcano then checks a frontend's commit through the project's [GitHub connection](../projects/git-deploy.md). It is `verified` when:

- `repository` is the project's connected repository, matched by repository ID so a rename still matches;
- `sha` is on its production branch;
- every uploaded file is the commit's file at `root` plus its path in the archive, with the same executable bit. A file matches byte for byte, after Git's CRLF-to-LF conversion, or as its Git LFS pointer where the commit's `.gitattributes` files apply `filter=lfs` to its path;
- the upload holds every file the commit has under `root`, except ones deploy clients leave out: a path with a segment named `.git`, `.gitignore`, `node_modules`, `.next`, `dist`, `build`, `.vscode`, `.idea`, `.DS_Store`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.bundle`, `.env.local`, or `volcano.env`, or matching `.env*.local`, `*.log`, `*.pyc`, `*.pyo`, `*.rbc`, `*.swp`, or `*.swo`, and `volcano/*.env` at `root`.

`root` must be the project's root directory, a directory inside it, or one of its parents. An upload from a parent must name an app inside the project's root directory by its path from `root`: in `app_root`, or else on the first line of a `.volcano/frontend-app-path` file at the archive root, which the CLI writes when it uploads a monorepo app from the workspace root. An uploaded file the commit doesn't hold sets `dirty: true`, even when another file can't be checked. A file under a symlink or submodule, a file whose executable bit differs, or one whose match depends on an attribute or attribute pattern Volcano doesn't read leaves the commit unverified without setting `dirty`.

A commit Volcano can't verify is still recorded with `verified: false`, and the deploy goes ahead. That covers a commit from another branch or repository, an upload without `root`, a `root` or archive path longer than 4,096 bytes or 128 directories deep, an upload with no file to compare, an upload that leaves out another file, symlink, or submodule the commit holds under `root`, an upload from a parent without a `package.json` at its archive root whose only top-level directory, counting dot-directories, has one, a project with no connection, an archive whose global header sets anything but a comment, an archive entry behind more than one extended header, an extended or long-name header with anything but NULs after its data, a directory entry with a `.` or `..` segment, a directory entry the commit holds no file under, a sparse or pre-POSIX archive entry, a tar header with a number that isn't plain octal digits or with a name prefix outside a POSIX ustar header, and a check GitHub doesn't answer in time. Volcano doesn't check a commit reported with `dirty: true`; it's recorded with `verified: false`. Function and durable function deployments record their commit with `verified: false`.

Function and frontend deployment listings return the commit:

```bash
curl -H "Authorization: Bearer $VOLCANO_TOKEN" \
  "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$FRONTEND_ID/deployments"
```

```json
{
  "data": [
    {
      "id": "7c2e…",
      "status": "active",
      "deploy_source": "cli",
      "commit": {
        "repository": "acme/app",
        "sha": "4f1c2b7d9e0a8b3c6d5e4f3a2b1c0d9e8f7a6b5c",
        "dirty": false,
        "verified": true
      }
    }
  ]
}
```

A frontend deployed from another frontend's build carries the commit of the deployment it publishes. A redeploy reports no commit; it serves the code of the deployment that built its artifact.

[LavaFlow](lavaflow.md) reads source and opens pull requests for a deployment built by a Git push, or for one whose commit is verified and has `dirty: false`. Any other deployment still gets a diagnosis, without a pull request.

## Attribution

Request-initiated deployments (`cli`, `web`, `api`) also record `initiated_by`, the platform user that triggered them. `git` and `system` deployments have no user actor, so `initiated_by` is absent.

## Declaring the dashboard client

Authentication is authoritative for the `cli` classification. A non-CLI client that is the dashboard should send the `X-Volcano-Client: web` request header so its deployments are recorded as `web` rather than `api`.
