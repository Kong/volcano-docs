---
title: "Deploy from GitHub"
description: "Connect a GitHub repository to a Volcano project so every push to the production branch deploys your functions and frontend automatically."
---

Connect a GitHub repository to a project and Volcano deploys it on every push to
the production branch — no CLI step in your pipeline.

```http
PUT /projects/{id}/git-deploy-settings
Authorization: Bearer <platform_token>
Content-Type: application/json

{
  "auto_deploy_enabled": true,
  "deploy_functions": true,
  "frontend_name": "web"
}
```

With that saved and a repository connected, `git push origin main` builds and
deploys the functions under `volcano/functions/` and the frontend at the
configured app root.

## Repository layout

Volcano discovers what to deploy from the file tree. Nothing is generated for
you and there is no separate build config.

```text
my-repo/
├── volcano/
│   └── functions/
│       ├── hello.js              # single-file function -> "hello"
│       ├── checkout/             # directory function   -> "checkout"
│       │   ├── index.ts
│       │   └── tax.ts
│       └── _shared/              # shared code, packaged into every function
│           └── db.js
├── web/                          # frontend app root (package.json here)
│   ├── package.json
│   └── app/
└── package.json                  # dependency manifest for functions
```

**Functions** are the entries directly under `volcano/functions/` in your build
root:

| Entry | Function name | Entry file |
|-------|---------------|------------|
| `hello.js` | `hello` | the file itself |
| `checkout/` | `checkout` | `index.*`, else the runtime's handler file (`index.js`, `main.py`, `main.rb`), else the first source file by name |

Names must be DNS-safe: lowercase letters, digits, and internal hyphens, 1–63
characters. `batch`, `invocations`, and `logs` are reserved. Entries that do not
qualify — an unsupported file type, a hidden entry, a name Volcano cannot
deploy — are **skipped silently** so one stray file cannot fail the whole push.
Two entries resolving to the same name (`foo.js` and `foo/`) fail the run.

**Shared code** is any `_`-prefixed file or directory under `volcano/` or
`volcano/functions/`. Each one is copied into every function archive under its
own name, so `volcano/functions/_shared/db.js` is importable as `_shared/db.js`.

**Dependency manifests** (`package.json`, `requirements.txt`, `Gemfile`, and
their lockfiles) are taken from the function's own directory when it has any,
otherwise from the build root. The two sets are never mixed — a function with
its own `package.json` is not paired with the build root's lockfile.

**The frontend** is detected by a `package.json` at the app root. Its archive
excludes `node_modules`, `vendor`, `.git`, and `.volcano`. Function archives
exclude those plus the Python artifact directories `.venv`, `venv`,
`site-packages`, `__pycache__`, and `python_deps` — a frontend build root
carrying those still packages them, which counts against the size limits below.

## 1. Connect GitHub

Start the connection flow and send the user to the returned URL to install the
Volcano GitHub App:

```bash
curl -X POST "https://api.volcano.dev/user/git/connect?provider=github" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{ "authorization_url": "https://github.com/apps/volcano/installations/new?state=..." }
```

After the callback completes, the connection is stored against your user and is
reusable across projects:

```bash
curl "https://api.volcano.dev/user/git/connections" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "connections": [
    {
      "id": "9f1c2b7e-1f34-4a0d-9c7a-5b2f1d0e8a11",
      "provider": "github",
      "provider_login": "acme-dev",
      "status": "active",
      "last_authenticated_at": "2026-08-11T16:58:02Z"
    }
  ]
}
```

## 2. Pick an installation and repository

Both calls proxy GitHub live and persist nothing:

```bash
curl "https://api.volcano.dev/user/git/connections/$CONNECTION_ID/installations" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"

curl "https://api.volcano.dev/user/git/connections/$CONNECTION_ID/installations/$INSTALLATION_ID/repositories" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "repositories": [
    { "id": 812345678, "full_name": "acme/storefront", "default_branch": "main", "private": true }
  ]
}
```

## 3. Bind the repository to a project

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-connection" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "'"$CONNECTION_ID"'",
    "installation_id": '"$INSTALLATION_ID"',
    "repository_id": 812345678,
    "root_directory": "apps/api"
  }'
```

```json
{
  "repo_installation_id": 52001234,
  "repo_id": 812345678,
  "repo_full_name": "acme/storefront",
  "root_directory": "apps/api",
  "production_branch": "main",
  "updated_at": "2026-08-11T17:04:22Z"
}
```

- `repository_id` is GitHub's stable numeric repository id. It survives renames,
  which is why it — not `repo_full_name` — is the binding.
- `root_directory` is the **build root** for a monorepo. Function discovery,
  dependency manifests, and the frontend app root are all resolved beneath it.
  Omit it for the repository root.
- `production_branch` is read-only: it always follows the repository's GitHub
  default branch, and Volcano refreshes it when you change the default on GitHub.

Several projects may bind the same repository. Binding never creates or deletes
anything on GitHub; `DELETE` on the same path only unbinds the project.

## 4. Turn on auto-deploy

Deploy settings are separate from the binding, and everything is off by default:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-deploy-settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_deploy_enabled": true,
    "deploy_functions": true,
    "frontend_name": "web",
    "frontend_app_root": "web"
  }'
```

| Field | Effect |
|-------|--------|
| `auto_deploy_enabled` | Master switch. A push that arrives while this is off is never deployed, and turning it on later does not deploy that push retroactively. |
| `deploy_functions` | Deploy every function discovered under `volcano/functions/`. |
| `frontend_name` | Frontend to deploy. Omit or leave empty to deploy no frontend. The frontend does not have to exist yet — it is created on the first deploy. |
| `frontend_app_root` | App root the frontend builds from, relative to `root_directory`. Requires `frontend_name`; omit for the build root itself. |

This is a full replace: send every field you want to keep.

## 5. Push

```bash
git push origin main
```

Volcano receives the webhook, records a deployment run for the commit, downloads
that exact commit, builds one archive per function plus one for the frontend,
and dispatches the deploys. Functions and the frontend deploy concurrently;
traffic stays on the live version until each new deployment is ready.

Watch the result through the project's deployment feed:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/deployments?limit=20" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## What a push deploys

A push deploys **code**: the functions under `volcano/functions/` and the
configured frontend. It does not apply the rest of your project configuration.

| Concern | Applied on push? | How to change it |
|---------|------------------|------------------|
| Function source | Yes | Push |
| Frontend source | Yes | Push |
| Function visibility (`public`) | Yes, from `volcano-config.yaml` | Push, or `volcano config deploy` |
| Variables, buckets, auth, OAuth, email templates, schedulers, databases | No | `volcano config deploy` — see the [configuration manifest](configuration.md) |

Variables are read at build and run time from the project, so a variable you
change through the API or the dashboard applies to the next deployment without a
code change.

### volcano-config.yaml

If your repository has a `volcano-config.yaml` at the build root, auto-deploy
reads it and applies the per-resource settings that belong to the resources it
deploys — today that is `functions[].public`:

```yaml
version: 1
functions:
  - name: hello
    public: true
```

Visibility is the function's current state, not a property of a code version:
the declared value takes effect when Volcano processes the push, before any code
deploys and regardless of whether that code deploy later succeeds. That is the
same behavior as `volcano config deploy` and
`volcano functions update <name> --public`, which also flip it immediately. A
function the commit creates gets its declared visibility as the function is
created.

Precedence is fixed: the project's deploy settings decide **whether** a resource
deploys, and the manifest fills in **details** for the resources that do. A
function listed in the manifest but absent from `volcano/functions/` is not
created, and the manifest cannot switch on a frontend that `frontend_name` does
not name.

Every other section of the manifest is ignored by auto-deploy and still requires
`volcano config deploy` — those sections sync destructively (entries absent from
the file are deleted) and can carry secrets, which is not something a `git push`
should do implicitly.

`volcano-config.yaml` must be a regular file at the build root. Symbolic and
hard links are not followed.

A manifest that is present but unusable fails the run without retrying, rather
than deploying with its settings silently dropped: malformed YAML, an empty
file, an unsupported `version`, a function entry with no `name` or a duplicate
one, a file over 4 MiB, or a link rather than a regular file.
`volcano config deploy` rejects the same file.

## Deployment behavior

**Only the production branch deploys.** Pushes to other branches, tag pushes,
and branch deletions are ignored. Preview deployments for branches and pull
requests are not available yet.

**Latest wins.** While a run is pending, a newer push to the same branch
supersedes it — the older run is marked `superseded` and never deploys a commit
you have already moved past. A run that is already executing is allowed to
finish.

**Same commit, once.** Re-delivering the same webhook, or pushing the same
commit while a run for it is still pending or running, does not create a second
deployment. Pushing that commit again after the earlier run reached a terminal
state does deploy again, so you can retry a failed deploy by re-pushing.

**Every configured resource redeploys on every push.** There is no per-file
change detection yet: a commit that touches only the frontend still redeploys
the functions, and vice versa.

**Runs are skipped, not failed,** when there is nothing to do: auto-deploy is
off, the project was disconnected or its binding changed before execution, the
project was deleted, or the commit contains no deployable resource.

## Limits

Per deployment run:

| Limit | Value |
|-------|-------|
| Downloaded repository tarball | 256 MiB compressed |
| Extracted repository | 512 MiB total, 256 MiB per file |
| Repository entries | 50,000 |
| Functions per commit | 1,000 |
| Each generated deploy archive | 256 MiB by default (operator-configured) |
| Total bytes packaged into archives | 1 GiB |

Exceeding any of these fails the run without retrying — they are properties of
the commit, not transient conditions.

## Troubleshooting

**Nothing happened after a push.** Check that the push targeted the repository's
default branch, that `auto_deploy_enabled` is `true`, and that the project is
still bound to that repository (`GET /projects/{id}/git-connection`).

**A function is missing.** It is probably being skipped by discovery. Confirm it
sits directly under `volcano/functions/` inside `root_directory`, that its name
is DNS-safe and not reserved, and that a directory function contains at least one
supported source file.

**The frontend did not deploy.** `frontend_name` must be set, and there must be a
`package.json` at `root_directory` + `frontend_app_root`. A configured frontend
that is not found in the source is skipped, not failed.

**A function deployed private.** Add it to `volcano-config.yaml` with
`public: true`, or set visibility through the API. New functions default to
private.

## Related

- [Configuration manifest](configuration.md) — the declarative
  `volcano-config.yaml` reference
- [Creating functions](../functions/creating-functions.md) — the same
  `volcano/functions/` layout, deployed from the CLI
- [Deploy a frontend](../frontends/deploy.md) — deploying a frontend without git
