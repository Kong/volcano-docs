---
title: "Export your source to GitHub"
description: "Initialize an empty GitHub repository with the source Volcano stores for your project, then deploy it from Git."
---

Export creates the first commit in an empty GitHub repository. It pushes the
complete project directly to the configured production branch, which triggers
the normal Git deployment flow.

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/source-export" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"production_branch":"main"}'
```

```json
{
  "repo_full_name": "acme/storefront",
  "branch": "main",
  "commit_sha": "6f2b1c9a4e8d3f7b0a5c2e9d1f4b8a6c3e7d0b25",
  "file_count": 12,
  "skipped": [],
  "omitted": [
    { "kind": "migrations", "resource": "", "path": "volcano/migrations" }
  ]
}
```

## Prepare the repository

1. Create a GitHub repository without a README, license, `.gitignore`, or any
   other initial commit.
2. In the export dialog, select that repository. Because an empty repository
   has no branch yet, Volcano proposes `main` as the production branch. Change
   the name if needed.
3. Review the branch and select **Export**. Volcano uses the confirmed name to
   connect the repository, configure the Git deployment path, and create its
   first branch.

For API clients, connect the repository and configure Git auto-deploy first.
Read `production_branch` from `GET /projects/{id}/git-connection`, show it for
confirmation, then send the same value to the export endpoint. If it changed in
the meantime, export returns `409` without writing the repository. Read the
connection again and ask the user to confirm the new branch.

Export also returns `409` while a function or frontend deployment is queued or
provisioning. Wait for that deployment to finish, then export again. Volcano
checks this before creating or pushing the root commit.

Volcano does not create the repository. Export refuses any repository that
already has a commit or branch. This avoids merges, conflict resolution, and
overwriting existing history.

If your repository already contains the project, do not export. Push the
complete project to its configured production branch instead. Git auto-deploy
will deploy it, but it does not disable direct platform deploys. Source
ownership changes only through the one-time export flow.

## What export writes

The root commit uses the layout [Git auto-deploy](git-deploy.md#repository-layout)
discovers:

```text
volcano/
├── .gitignore
└── functions/
    ├── hello.js
    └── checkout/
        ├── index.js
        └── tax.js
volcano-config.yaml
package.json
web/
```

Export takes source from each function and frontend's latest successful
deployment. A resource that has never deployed successfully appears in
`skipped` and is not written.

Export refuses to push when a currently serving resource has no readable stored
source or cannot be represented in the repository layout. This keeps the first
Git deployment from waiting on source that the commit does not contain.

Stored `.gitignore` files are committed as ordinary files. Their patterns do
not remove other stored files from the export commit.

The `omitted` list reports content Volcano cannot or should not publish:

| Kind | Why |
|------|-----|
| `migrations` | Volcano does not retain the migration files. |
| `variable_values` | Secret values are never committed. Configure them through Volcano. |
| `ignored_secret` | Credential-shaped files such as `.env` are excluded. |
| `dependency_cache` | Generated dependency directories such as `node_modules` are rebuilt. |
| `unsupported_entry` | Symlinks and other unsupported archive entries are excluded. |

Export fails and names the path when stored source contains a file that should
never be committed, such as a private key or credential store.

## How ownership changes

Export is a one-time transition:

1. Volcano verifies the confirmed production branch still matches the project,
   pins it, and changes the project to `git_exporting`. Direct source deploys
   and Git connection changes are frozen.
2. Volcano creates one root commit and pushes it to the production branch.
3. GitHub's signed push event confirms that the root commit reached the
   production branch. That commit or a newer production push starts the
   ordinary Git deployment and changes the mode to `git_pending`.
4. After a complete production deployment succeeds, the mode becomes `git`.

The project stays locked if the deployment fails. Fix the repository and push
the production branch again. The latest complete successful deployment
finishes the transition; the exported root commit does not need to deploy if a
newer push supersedes it.

The pinned branch does not follow later GitHub default-branch changes. This
keeps a repository rename from moving production during or after handover.

To stop an incomplete transition and restore direct platform deploys:

```bash
curl -X DELETE "https://api.volcano.dev/projects/$PROJECT_ID/source-export" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

Cancellation does not delete the repository or a commit that already reached
it. If Volcano reserved the initial commit before cancellation, the one-time
export remains consumed and cannot be run again. The confirmed production
branch remains pinned. If the repository now has a default branch, reconnect it
without choosing a branch to make a platform-managed project follow that
default again.

Check the state at any time:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/source-export" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "mode": "git_pending",
  "transition_started_at": "2026-08-25T09:14:02Z",
  "exported_at": "2026-08-25T09:14:04Z",
  "handed_over_at": null
}
```

After handover, push to the production branch to change or deploy source.
Direct function and frontend deploys return `409`. Variables, databases,
storage, domains, and resource settings remain manageable through Volcano.

To deploy from another branch after handover, set it explicitly, then push it:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-connection/production-branch" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"production_branch":"release"}'
```

Branch changes are refused while the project is `git_exporting` or
`git_pending` so the initial push and deployment always use the branch the user
confirmed.

## Retry an uncertain push

If GitHub does not confirm whether the initial push succeeded, the endpoint
returns a retryable error and the project remains `git_exporting`. Call the
endpoint again. Volcano builds the same commit: it adopts that commit if it is
already on the production branch, or retries the initial push while the
repository is still empty.

If the commit reached GitHub but its push event never reaches Volcano, the
project remains `git_exporting`. Cancel the transition with `DELETE
/projects/{id}/source-export` to restore platform deploys. The root commit stays
in the repository and the one-time export remains consumed.

## Related

| Guide | Description |
|-------|-------------|
| [Deploy from GitHub](git-deploy.md) | Connect a repository and deploy on every push |
| [Configuration manifest](configuration.md) | `volcano-config.yaml` reference |
