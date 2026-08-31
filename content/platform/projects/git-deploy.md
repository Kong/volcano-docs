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

Already running on Volcano and want your code in Git? [Export your
source](export-to-git.md) can initialize a new empty repository and push the
project directly to its production branch.

## If you do not have a repository yet

Volcano never creates a repository for you. Commit your project locally, create
a repository on your own account or organization, push to it, then connect it.

Start with a local commit — both routes below push existing commits, so neither
works without one:

```bash
git init && git add -A && git commit -m "Initial commit"
git branch -M main
```

Then create the remote and push. With the [GitHub CLI](https://cli.github.com):

```bash
gh repo create my-app --private --source=. --push
```

Or create it in the GitHub UI and add the remote by hand. Create it **empty** —
no README, `.gitignore`, or license — so the first commit is the one you just
made:

```bash
git remote add origin https://github.com/<owner>/my-app.git
git push -u origin main
```

Either way you keep your own Git credentials — Volcano never mints, stores, or
asks for a push credential. With the repository pushed, continue below.

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
    { "id": 812345678, "full_name": "acme/storefront", "default_branch": "main", "private": true, "is_empty": false }
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
- `production_branch` is the branch a push must land on to deploy. Omit it and
  the project follows the repository's GitHub default branch, which Volcano keeps
  in step when you rename it on GitHub — so omitting it is also how a project
  goes back to following the default. Any other branch deploys from that branch
  instead. See [Deploy from a different
  branch](#deploy-from-a-different-branch).

  Sending back the branch the project **already deploys from**, when that is the
  repository's default — which is what you get by reading the connection,
  changing one field and sending it back — changes nothing either way, so a
  branch you pinned earlier stays pinned. Editing the root directory this way is
  safe. Sending the default branch when the project deploys from something else
  returns it to following the default.

  Changing `repository_id` and naming a branch other than the new repository's
  default in the same request returns `400`: the branch is almost always the old
  repository's, sent back unchanged. Reconnect first, then set the branch.

Several projects may bind the same repository. Binding never creates or deletes
anything on GitHub; `DELETE` on the same path only unbinds the project.

### Deploy from a different branch

A project can deploy from any branch. Change it without touching the binding:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-connection/production-branch" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "production_branch": "release" }'
```

```json
{
  "repo_installation_id": 52001234,
  "repo_id": 812345678,
  "repo_full_name": "acme/storefront",
  "root_directory": "apps/api",
  "production_branch": "release",
  "updated_at": "2026-08-11T17:09:03Z"
}
```

**The branch does not have to exist yet.** It is validated as a Git branch name
and nothing more, so you can point a project at a branch you are about to push —
which is what makes this work for a repository you created empty and are
about to push into.

Once you set the branch here, it is yours: renaming the repository's default
branch on GitHub no longer moves it. This holds even when the branch you set is
the current default — use this endpoint, not the connect call, when you want to
pin a project to the default branch it already deploys from.

Projects that never set a branch keep following the default. To return one to
following it, reconnect with `PUT /projects/{id}/git-connection` omitting
`production_branch`.

Pushes to any other branch are ignored — there is one deployment branch per
project, and nothing else deploys.

## 4. Turn on auto-deploy

**Connecting a repository already turned this on.** Step 3 set
`auto_deploy_enabled` and `deploy_functions` to `true`, so pushes deploy your
functions without any call here.

Use this endpoint to deploy a frontend as well, to change the build roots, or
to turn auto-deploy off. It is a full replace, so send every field you want to
keep — including the two that are already on:

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
| `auto_deploy_enabled` | Master switch, on from the first connect. A push that arrives while this is off is never deployed, and turning it on later does not deploy that push retroactively. Once you save settings here they are never defaulted over again — rebinding, disconnecting and reconnecting all leave them as you set them. |
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
| Function invocation settings (`public`, modes, OpenAPI metadata) | Yes, from `volcano-config.yaml` | Push, or `volcano config deploy` |
| Variables, buckets, auth, OAuth, email templates, schedulers, databases | No | `volcano config deploy` — see the [configuration manifest](configuration.md) |

Variables are read at build and run time from the project, so a variable you
change through the API or the dashboard applies to the next deployment without a
code change.

### volcano-config.yaml

If your repository has a `volcano-config.yaml` at the build root, auto-deploy
reads it and applies the per-resource settings that belong to the resources it
deploys: function visibility, invocation/auth modes, and OpenAPI metadata:

```yaml
version: 1
functions:
  - name: hello
    public: true
    invocation_mode: http
    http_auth_mode: none
    openapi_spec:
      openapi: 3.1.0
      info: { title: Hello webhook, version: 1.0.0 }
      paths: {}
```

Invocation settings are current function state, not properties of a code version:
the declared values take effect when Volcano processes the push, before any code
deploys and regardless of whether that code deploy later succeeds. That is the
same behavior as `volcano config deploy` and
`volcano functions update <name> --public`, which also flip it immediately. A
function the commit creates gets its declared settings as the function is
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

Projects that [export source to GitHub](export-to-git.md) pin the production
branch confirmed at export time. A later GitHub default-branch change does not
move production. After handover, set a different production branch explicitly
before pushing it; branch changes are frozen while export is in progress.

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

## Deploying directly while connected

Connecting a repository does not disable the CLI or the dashboard. A connected
project still accepts `volcano cloud functions deploy` and every other direct
deploy, and those deploys take effect immediately.

They are not durable, though, and the two ways they can go are opposite:

- **A resource that also exists in the repository is reverted by the next
  push.** The push redeploys it from the commit, discarding what you uploaded.
  Nothing warns you at upload time, and the revert looks like an ordinary
  deployment.
- **A resource that does not exist in the repository survives.** Pushes never
  delete resources that are missing from the commit, so a function you only
  ever deployed directly keeps running — and keeps not being in your repo.

Treat the repository as the source of truth for anything you want to keep. Use
direct deploys for throwaway iteration, and commit the change once you want it
to stick.

**Telling them apart after the fact.** Every deployment records
`deploy_source`, so a project's history distinguishes a push (`git`) from a
direct deploy (`cli`, `web`, `api`). Read it on each item in the
[deployment feed](../guides/deployment-source.md) when a resource is not what you
expect — the endpoint has no `deploy_source` query filter:

```bash
curl -H "Authorization: Bearer $VOLCANO_TOKEN" \
  "https://api.volcano.dev/projects/$PROJECT_ID/deployments?limit=20"
```

A `git` entry after your direct deploy is the revert.

## Make Git the only source of truth

An ordinary production-branch push deploys the repository but does not disable
direct platform deploys. To move source ownership to Git, follow [Export your
source to GitHub](export-to-git.md). Export initializes a new empty repository,
observes its root push, and disables direct source deploys only after that push
or a newer production push deploys successfully.

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

**Nothing happened after a push.** Check that the push targeted the project's
`production_branch` — read it back, don't assume it is the repository's default —
that `auto_deploy_enabled` is `true`, and that the project is still bound to that
repository (`GET /projects/{id}/git-connection`).

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
