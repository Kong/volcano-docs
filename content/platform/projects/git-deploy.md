---
title: 'Deploy from GitHub'
description: 'Connect a GitHub repository to a Volcano project so every push to the production branch deploys your functions and frontend automatically.'
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

For repositories you connect directly, Volcano discovers functions from the
file tree and deploys the frontend selected in Git deploy settings.

```text
my-repo/
├── volcano/
│   ├── functions/
│   │   ├── hello.js              # single-file function -> "hello"
│   │   ├── checkout/             # directory function   -> "checkout"
│   │   │   ├── index.mjs
│   │   │   └── tax.mjs
│   │   └── _shared/              # shared code, packaged into every function
│   │       └── db.js
│   └── migrations/               # applied first when apply_migrations is on
│       └── 001_create_orders.sql
├── web/                          # frontend app root (package.json here)
│   ├── package.json
│   └── app/
└── package.json                  # dependency manifest for functions
```

**Functions** are the entries directly under `volcano/functions/` in your build
root:

| Entry       | Function name | Entry file                                                                                                        |
| ----------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `hello.js`  | `hello`       | the file itself                                                                                                   |
| `checkout/` | `checkout`    | `index.*`, else the runtime's handler file (`index.js`, `main.py`, `main.rb`), else the first source file by name |

Node.js functions deploy `.js` and `.mjs` files. Volcano doesn't compile
TypeScript yet, so compile it first and commit the output, such as
`checkout/index.mjs`. A function that holds only TypeScript, such as a
`checkout.ts` file or a `checkout/` directory with no `.js` or `.mjs` file at its
top, isn't deployed; the push deploys everything else. Commit its compiled
JavaScript to deploy it. Keep shared TypeScript that isn't a function under a
`_`-prefixed name, such as `_lib/`, so it isn't taken for one.

Names must be DNS-safe: lowercase letters, digits, and internal hyphens, 1–63
characters. `batch`, `invocations`, and `logs` are reserved. Other entries that
do not qualify — an unsupported file type, a hidden entry, a name Volcano cannot
deploy — are **skipped silently** so one stray file cannot fail the whole push.
Two entries resolving to the same name (`foo.js` and `foo/`) fail the run.

**Shared code** is any `_`-prefixed file or directory under `volcano/` or
`volcano/functions/`. Each one is copied into every function archive under its
own name, so `volcano/functions/_shared/db.js` is importable as `_shared/db.js`.

**Dependency manifests** (`package.json`, `requirements.txt`, `Gemfile`, and
their lockfiles) are taken from the function's own directory when it has any,
otherwise from the build root. The two sets are never mixed — a function with
its own `package.json` is not paired with the build root's lockfile.

**The frontend** is detected by a `package.json` at the app root, or by the
nearest `package.json` above it when its `build` script runs `next build <dir>`
on the app root, as `volcano init nextjs` sets up for `web/`. Its archive
excludes `node_modules`, `vendor`, `.git`, and `.volcano`. Function archives
exclude those plus the Python artifact directories `.venv`, `venv`,
`site-packages`, `__pycache__`, and `python_deps` — a frontend build root
carrying those still packages them, which counts against the size limits below.

**Frontend dependencies** install from the outermost directory in the frontend's
archive that has a lockfile or declares workspaces. With the layout above, a
lockfile beside the root `package.json` makes the root the install root. Its
install covers `web/` only when the root is a workspace that includes it, through
`pnpm-workspace.yaml` or a `workspaces` field. Otherwise the build fails because
`web/`'s dependencies aren't installed.

Already running on Volcano and want your code in Git? [Export your
source](export-to-git.md) can initialize a new empty repository and push the
project directly to its production branch.

### Exported projects with multiple frontends

[Source export](export-to-git.md) places each frontend in `frontends/<name>/`
and writes `.volcano/source-layout.json` with its name and app root. When that
file is present, every listed frontend deploys on each production-branch push.
The single frontend selection applies to repositories without that file.
Functions continue to deploy from `volcano/functions/` when Deploy functions is
on. These pushes deploy all configured resources; they do not filter by changed
paths.

### Choose frontend workspaces

To move an exported frontend, move its files and update
`.volcano/source-layout.json` in the same commit:

```json
{
  "version": 1,
  "frontends": [
    { "name": "web", "workspace": "apps/web", "app_root": "" },
    { "name": "admin", "workspace": "apps/admin", "app_root": "" }
  ]
}
```

`workspace` is relative to the configured project root. `app_root` is relative
to that workspace. Volcano packages the entire workspace, including shared
packages and dependency manifests, subject to the normal source exclusions.
Both paths must be clean relative paths contained within their parent. A
missing workspace, or an app root the frontend is not detected at, fails
deployment.

Omitting `workspace` keeps `frontends/<name>`. An explicit `"workspace": ""`
selects the project root. For a shared monorepo, give both frontends an empty
workspace and set their app roots to `apps/web` and `apps/admin`; both builds
then receive the shared dependencies. Each retry uses the layout from the same
commit.

Initial export always uses `frontends/<name>`; custom paths are configured in
Git after export. This layout belongs to the source commit, not
`volcano-config.yaml`.

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

The curl command illustrates the direct API flow. To complete it interactively,
the same browser client must make the start request and open the returned URL so
its binding cookie is available at the API callback. For a cookie-backed web
app, start through its same-origin edge function instead:

```js
const redirect = `${location.origin}/settings/git`;
const response = await fetch(`/api/web/user/git/connect?provider=github&redirect=${encodeURIComponent(redirect)}`, {
  method: 'POST',
  credentials: 'include',
});
const { authorization_url } = await response.json();
location.assign(authorization_url);
```

The edge function forwards the request with `callback_url` set to its
same-origin provider callback, rewrites the binding cookie path for that route,
and returns the cookie to the browser.
The callback URL must share an origin with `redirect` and cannot contain a query
string or fragment. Do not send `callback_url` directly from browser code to
`api.volcano.dev`; that would store the binding cookie on the API origin instead
of the application origin.

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

### Installing from GitHub

You can also install the Volcano GitHub App from GitHub itself: from the App's
page, by changing which repositories it can access in your GitHub settings, or
by asking an organization owner to install it. GitHub then sends your browser
to Volcano without a connect flow behind it. Volcano connects nothing: it
creates no connection, binds no repository, and sets no cookie. It sends you
to the Git settings page in the dashboard:

```http
GET /github/callback?installation_id=52001234&setup_action=install
```

```http
HTTP/1.1 302 Found
Location: https://volcano.dev/dashboard/project-settings/git?github_install=1
Cache-Control: no-store
Referrer-Policy: no-referrer
```

From there, pick the project and connect the repository. The dashboard starts
the connect flow above, which finds the installation you just made. If you
asked an organization owner to install the App, connect after they approve it.

## 2. Pick an installation and repository

`volcano git repos` lists every installation and repository your connection
reaches. Through the API, both calls proxy GitHub live and persist nothing:

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

From a checkout, `volcano git connect` binds the repository its remote names;
pass a URL to name one explicitly. Through the API:

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
  "production_branch_follows_default": true,
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
  repository's, sent back unchanged. Reconnect first, then set the branch. A
  repository that reports no default branch, as one with no commits can,
  accepts any branch, including on a rebind.

- `production_branch_follows_default` is `true` while the branch tracks the
  repository's default and `false` once you pin one. Before you re-run the
  connect call for the same repository, read the connection; if this is
  `false`, send `production_branch` back, or omitting it discards the pin.

Several projects may bind the same repository. Binding never creates or deletes
anything on GitHub; `DELETE` on the same path only unbinds the project.

**A person chooses the repository.** Binding or changing it needs a platform
token or the dashboard. A [project access
token](../api-reference/using-the-api.md) gets `403`:

```json
{
  "error": "project access tokens cannot change a project's repository; a person changes it in the dashboard or with a platform token"
}
```

CI and agents holding a project access token can still [change the root
directory](#change-the-root-directory) and [the production
branch](#deploy-from-a-different-branch), which stay within the repository a
person chose.

### Change the root directory

Move a project to another directory of the same repository without touching the
binding:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-connection/root-directory" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "root_directory": "apps/storefront" }'
```

```json
{
  "repo_installation_id": 52001234,
  "repo_id": 812345678,
  "repo_full_name": "acme/storefront",
  "root_directory": "apps/storefront",
  "production_branch": "main",
  "production_branch_follows_default": true,
  "updated_at": "2026-08-11T17:12:40Z"
}
```

- The path is relative to the repository root. `""`, `.` and `/` mean the root
  itself.
- The response shows the path the way a deploy reads it, so `./apps/storefront/`
  comes back as `apps/storefront`.
- An absolute path, or one that climbs out of the repository with `..`, returns
  `400`.
- A project with no repository connected returns `404`.
- Once the project's source is [exported to Git](export-to-git.md), the root
  directory is fixed and this returns `409`.

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
  "production_branch_follows_default": false,
  "updated_at": "2026-08-11T17:09:03Z"
}
```

**The branch does not have to exist yet.** It is validated as a Git branch name
and nothing more, so you can point a project at a branch you are about to push —
which is what makes this work for a repository you created empty and are
about to push into.

Once you set the branch here, it is yours: renaming the repository's default
branch on GitHub no longer moves it, and `production_branch_follows_default`
reads `false`. This holds even when the branch you set is
the current default — use this endpoint, not the connect call, when you want to
pin a project to the default branch it already deploys from.

Projects that never set a branch keep following the default. To return one to
following it, send an empty branch:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-connection/production-branch" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "production_branch": "" }'
```

The response carries the repository's current default branch with
`production_branch_follows_default: true`, and later default-branch renames on
GitHub move the project again. Volcano reads the default through the project
owner's GitHub connection:

| Status | When                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | The repository has no commits yet. Push one first; until then a pin stays as it was.   |
| `400`  | Code `feature_unavailable`: GitHub is not configured for this Volcano deployment.      |
| `409`  | The owner's GitHub connection needs reconnecting or has lost access to the repository. |
| `429`  | GitHub rate limited the read. Try again shortly.                                       |

Volcano reads the default once more after switching the project over, to catch
a rename that landed in between. If that read fails, the switch has already
happened. Send the same request again to confirm the branch.

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

| Field                 | Effect                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto_deploy_enabled` | Master switch, on from the first connect. A push that arrives while this is off is never deployed, and turning it on later does not deploy that push retroactively. Once you save settings here they are never defaulted over again — rebinding, disconnecting and reconnecting all leave them as you set them. |
| `deploy_functions`    | Deploy every function discovered under `volcano/functions/`.                                                                                                                                                                                                                                                    |
| `frontend_name`       | Frontend to deploy. Omit or leave empty to deploy no frontend. The frontend does not have to exist yet — it is created on the first deploy.                                                                                                                                                                     |
| `frontend_app_root`   | App root the frontend builds from, relative to `root_directory`. Requires `frontend_name`; omit for the build root itself.                                                                                                                                                                                      |
| `apply_migrations`    | Apply the commit's pending migrations before anything deploys. Off until you turn it on. Omitting it keeps the saved value. See [Apply migrations on push](#apply-migrations-on-push).                                                                                                                          |

This is a full replace, except `apply_migrations`: send every other field you
want to keep.

## 5. Push

```bash
git push origin main
```

Volcano receives the webhook, records a deployment run for the commit, downloads
that exact commit, applies its migrations when `apply_migrations` is on, builds
one archive per function plus one for the frontend, and dispatches the deploys. Functions and the frontend deploy concurrently;
traffic stays on the live version until each new deployment is ready.

Watch the result through the project's deployment feed:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/deployments?limit=20" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

### Check deployment runs

Each push records a deployment run, which says whether the push deployed and,
when it did not, why. List the runs, newest push first:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/git-deployment-runs?limit=10" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "3c9e7b1a-4f2d-4e8a-9b6c-1d0e2f3a4b5c",
      "status": "failed",
      "branch": "main",
      "commit_sha": "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
      "apply_migrations": true,
      "migration_runs": [
        {
          "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
          "database": { "type": "database", "id": "0b9c3f5e-2a41-4d7e-9f0a-6c8e1d2b3a45", "name": "main_db" }
        }
      ],
      "error": {
        "code": "migration_failed",
        "message": "migration run failed: run 7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73 on database main_db (migration_failed): migration 002_add_notes_pinned.sql failed at line 1 (SQLSTATE 42601); it failed in rehearsal, so production was not changed"
      },
      "created_at": "2024-01-01T00:00:00Z",
      "started_at": "2024-01-01T00:00:02Z",
      "completed_at": "2024-01-01T00:01:10Z"
    }
  ],
  "limit": 10,
  "has_more": false
}
```

Filter with `status` or `branch`, and page with `cursor` set to the previous
response's `next_cursor`. Get one run at
`GET /projects/{id}/git-deployment-runs/{runId}`. Project access tokens can read
runs, including read-only ones.

| `status`     | Meaning                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `pending`    | Waiting for a worker, or for the project's previous run to finish                          |
| `running`    | Applying migrations or deploying                                                           |
| `succeeded`  | Every deployment the run dispatched succeeded, or the commit only had migrations to apply  |
| `failed`     | Stopped; `error` says why                                                                  |
| `superseded` | A newer push replaced the run before it started                                            |
| `skipped`    | Nothing to deploy; `error` says why, such as `nothing_to_deploy` or `auto_deploy_disabled` |

Other runs have no `error`. A failed run's `error.code` is one of the
following. The five migration codes stop the push before anything deploys.

| Code                       | Cause                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration_failed`         | A migration run failed for any reason, such as a file or `connection_failed`, or refused the commit's files. `message` names the run, its database, and its own code, or the refused file.                                                                                                                                                                  |
| `migration_invalid_layout` | `volcano/migrations/` does not map onto the project's databases. `message` names the directory or file.                                                                                                                                                                                                                                                     |
| `migration_timeout`        | The commit's migrations had not finished two hours after the push arrived.                                                                                                                                                                                                                                                                                  |
| `feature_unavailable`      | The run applies migrations where they are not available. Turn `apply_migrations` off to deploy without them.                                                                                                                                                                                                                                                |
| `owner_not_active`         | The project owner's account is not `active`, so the push started no new migration run. Push again once the account is `active`; see [Apply migrations on push](#apply-migrations-on-push).                                                                                                                                                                  |
| `source_invalid`           | Volcano refused the commit's source or `volcano-config.yaml`, such as a repository over a [limit](#limits). `message` says what to fix. Pushing the same commit again fails the same way.                                                                                                                                                                   |
| `child_deploy_failed`      | A function, frontend, or Sandbox deployment failed. The deployment feed has a function's or frontend's error; `GET /projects/{id}/sandboxes/{sandboxId}/deployments` has a Sandbox's.                                                                                                                                                                       |
| `child_deploy_not_started` | A function or frontend deploy failed before it recorded a deployment, such as a frontend whose previous deployment was still in progress, or a first deploy that failed and removed what it created. `message` names it and, when Volcano has one, the reason. Push again to retry.                                                                         |
| `deploy_refused`           | Volcano refused to deploy the commit for a reason a retry cannot fix, such as a function or frontend over a plan limit, a function whose kind changed, invocation settings a function cannot have, or a Sandbox it cannot run. `message` names the function, frontend, or Sandbox and the reason when Volcano has them. Push again once the cause is fixed. |
| `typescript_not_compiled`  | A function holds only TypeScript, which Volcano doesn't compile. The rest of the push deployed. `message` names the functions; commit their compiled JavaScript and push again. When a deployment also failed, the run reports `child_deploy_failed` instead.                                                                                               |
| `deploy_failed`            | A temporary failure outlasted Volcano's retries, or Volcano could not deploy the commit for a reason of its own. Push again to retry.                                                                                                                                                                                                                       |
| `max_attempts_exhausted`   | The deployment failed after repeated attempts. Push again to retry.                                                                                                                                                                                                                                                                                         |

A Vercel project import that fails reports its deployment run's code as its own `error_code`.

## What a push deploys

A push deploys **code**: the functions under `volcano/functions/` and the
configured frontend. With `apply_migrations` on, it applies the database
migrations under `volcano/migrations/` first. It does not apply the rest of your
project configuration.

| Concern                                                                 | Applied on push?                                             | How to change it                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Function source                                                         | Yes                                                          | Push                                                                               |
| Frontend source                                                         | Yes                                                          | Push                                                                               |
| Function invocation settings (`visibility`, modes, OpenAPI metadata)    | Yes, from `volcano-config.yaml`                              | Push, or `volcano cloud config deploy`                                             |
| Function kind (`standard` or `durable`)                                 | Yes, from `volcano-config.yaml`, on the push that creates it | Fixed once created                                                                 |
| Function variable scope (`variable_scope`, `variables`)                 | Yes, from `volcano-config.yaml`                              | Push, or `volcano cloud config deploy`                                             |
| Database migrations (`volcano/migrations/`)                             | With `apply_migrations` on, before anything deploys          | Push, or a [tracked migration run](../guides/migrations.md)                        |
| Variables, buckets, auth, OAuth, email templates, schedulers, databases | No                                                           | `volcano cloud config deploy` — see the [configuration manifest](configuration.md) |

Variables are read at build and run time from the project, so a variable you
change through the API or the dashboard applies to the next deployment without a
code change.

A function that declares a variable the project does not have, or whose
environment exceeds the size limit, fails the run on the first attempt without
retrying. Define the variable or shrink the environment, then push the commit again.

### volcano-config.yaml

If your repository has a `volcano-config.yaml` at the build root, auto-deploy
reads it and applies the per-resource settings that belong to the resources it
deploys: function kind, visibility, invocation/auth modes, and OpenAPI metadata:

```yaml
version: 1
functions:
  - name: hello
    visibility: public
    invocation_mode: http
    http_auth_mode: none
    openapi_spec:
      openapi: 3.1.0
      info: { title: Hello webhook, version: 1.0.0 }
      paths: {}
  - name: order-workflow
    kind: durable
```

### Deploying durable functions from a repository

Durable functions live under `volcano/functions/` alongside standard ones and
are declared with `kind: durable`. Omitting `kind` means `standard`, so a
manifest written before durable functions existed keeps deploying unchanged.

A function's kind is fixed when it is created. The declared kind therefore
applies on the push that creates the function, and on every later push it is
checked rather than applied — a manifest that changes `kind` for a function that
already exists fails the run instead of silently deploying the wrong kind. To
change a kind, delete the function and let the next push create it again.

An unrecognised `kind` fails the run without retrying, the same as any other
unusable manifest. That is deliberate: defaulting it would create a resource
your repository does not describe, and no later push could correct it.

Invocation settings are current function state, not properties of a code version:
the declared values take effect when Volcano processes the push, before any code
deploys and regardless of whether that code deploy later succeeds. That is the
same behavior as `volcano cloud config deploy` and
`volcano cloud functions update <name> --visibility <level>`, which also flip it
immediately. A function the commit creates gets its declared settings as the
function is created. A push that would take a function with
[Frontend Function routes](../frontends/function-routes.md) out of `public` or
HTTP mode is refused before anything deploys; remove the routes first.

Precedence is fixed: the project's deploy settings decide **whether** a resource
deploys, and the manifest fills in **details** for the resources that do. A
function listed in the manifest but absent from `volcano/functions/` is not
created, and the manifest cannot switch on a frontend that `frontend_name` does
not name.

Every other section of the manifest is ignored by auto-deploy and still requires
`volcano cloud config deploy` — those sections sync destructively (entries
absent from the file are deleted) and can carry secrets, which is not something
a `git push` should do implicitly.

`volcano-config.yaml` must be a regular file at the build root. Symbolic and
hard links are not followed.

A manifest that is present but unusable fails the run without retrying, rather
than deploying with its settings silently dropped: malformed YAML, an empty
file, an unsupported `version`, a function entry with no `name` or a duplicate
one, a function `variables` key with no value, such as a bare `variables:` or
`variables: null`, a file over 4 MiB, or a link rather than a regular file.
`volcano cloud config deploy` rejects the same file.

## Apply migrations on push

Turn on `apply_migrations` and each push applies the commit's pending
migrations before it deploys anything, so new code never runs against the old
schema.

Turning it on lets anyone who can push to the production branch run any SQL on
your databases as the database owner. A migration file can read, change, or
delete data as well as the schema, and row-level security does not stop it.
Before you turn it on,
[protect the production branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
and require pull request reviews, so every migration is reviewed before it
reaches that branch.

The settings `PUT` is a full replace, except `apply_migrations`: a field you
leave out is cleared, so leaving out `frontend_name` stops the frontend from
deploying. Read the saved settings first:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/git-deploy-settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

Then send them back with `apply_migrations` on. With the settings from step 4:

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/git-deploy-settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_deploy_enabled": true,
    "deploy_functions": true,
    "frontend_name": "web",
    "frontend_app_root": "web",
    "apply_migrations": true
  }'
```

If the database already holds these migrations, applied with the CLI or by
hand, [record a baseline](../guides/migrations.md#adopt-an-existing-database-with-a-baseline)
of those files before you turn `apply_migrations` on. The CLI does not track
the files it runs, so without a baseline the first push treats every file as
pending: DDL that already ran fails its rehearsal, and a file that succeeds
again, such as an `INSERT`, applies a second time.

Each push then:

1. Reads the `.sql` files under `volcano/migrations/` in your build root. Lay
   them out as for any [tracked run](../guides/migrations.md#write-migration-files):
   at the top level for a project with one database, or in a directory named
   for each database.
2. Starts a [tracked migration run](../guides/migrations.md#what-a-run-does)
   for each database the commit has files for, with `source: git_deploy` and
   the commit's `commit_sha`. Files the database already applied are skipped;
   the pending ones are rehearsed, backed up, and applied.
3. Deploys the functions and frontend once every run has succeeded. A commit
   that changes only migrations ends there, as a successful deploy.

If a run fails, nothing from the push deploys and the live version keeps
serving. The push's [deployment run](#check-deployment-runs) fails with code
`migration_failed` whatever the migration run's own code, which its message
names, and lists the migration run it started on each database in
`migration_runs`. Get the one that failed for the
[reason](../guides/migrations.md#why-a-run-failed) and, when a file failed,
which one:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/databases/main_db/migration-runs/7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "id": "7f3a1c2e-5d4b-4a91-8c6f-2b1e9d0a4c73",
  "database": { "type": "database", "id": "0b9c3f5e-2a41-4d7e-9f0a-6c8e1d2b3a45", "name": "main_db" },
  "status": "failed",
  "phase": "rehearse",
  "source": "git_deploy",
  "commit_sha": "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  "error": {
    "code": "migration_failed",
    "message": "migration 002_add_notes_pinned.sql failed at line 1 (SQLSTATE 42601); it failed in rehearsal, so production was not changed"
  },
  "files": [{ "name": "002_add_notes_pinned.sql", "outcome": "failed" }],
  "warnings": [],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:01:10Z"
}
```

Fix the file and push again. A push also deploys nothing when its files cannot
start a run: a directory that names no database in the project, top-level files
in a project with several databases, a file a run refuses, such as a malformed
name, a link, a file over 1 MiB, or a directory nested more than one level, or
a database over its storage allowance. No migration run is recorded for that
database, and the deployment run's `error` names the reason:

```json
{
  "code": "migration_invalid_layout",
  "message": "invalid migrations layout: volcano/migrations/billing/ names no database in the project"
}
```

A push starts its databases' runs one at a time, in name order. When a later
database's files are refused, a run already started for an earlier database
still applies, though nothing from the push deploys. The deployment run's
`migration_runs` lists it.

While another run holds a database, the push waits for it. A push waits for its
migrations for up to two hours from when it arrived, which can include time
queued behind the project's previous push, then fails without deploying. A run
it started keeps going and can still apply after that, while the live version
keeps serving the previous code. Once the run has finished, push again: the
next push finds the files already applied and deploys the code written for
them.

A push starts a migration run only while the project owner's account is
`active`, as starting a run through the API requires. While the account is
`read_only` or `inactive`, a push that would start a run starts none, deploys
nothing, and fails with code `owner_not_active`. This check does not stop runs
the push started before the account changed, but a run that has not started
applying then fails with `owner_not_active`, as
[Why a run failed](../guides/migrations.md#why-a-run-failed) describes, and the
push ends with `migration_failed`. If the push started every run it needs, it
deploys once they succeed; otherwise nothing deploys. A commit without
`volcano/migrations/` still deploys.

Nothing retries a push that failed with `owner_not_active`, and there is no
redeploy route: once the account is `active` again, push again.
[Plans and limits](../guides/plans-and-limits.md) explains how a `read_only`
account returns to `active`. Until then the owner cannot change Git deploy
settings either: `PUT .../git-deploy-settings` answers `403` for a `read_only`
account, and an `inactive` account's credentials answer `401`. Turning
`apply_migrations` off does not let a push deploy in the meantime.

Applying migrations needs the `databases.migrations`
[capability](../api-reference/overview.md#capabilities). Where it is
unavailable, turning on `apply_migrations` answers `400` with code
`feature_unavailable`, and a push that would apply migrations deploys nothing.
Turn `apply_migrations` off to deploy without them. While the owner's account
is `active`, turning it off, or sending back a saved `true` with other
settings, always works.
A commit without `volcano/migrations/` deploys either way.

`apply_migrations` is not part of [`volcano-config.yaml`](configuration.md).
Like the other Git deploy settings, only this endpoint sets it, so a commit
cannot grant itself the right to change your production schema.

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

**A frontend served by a promoted [preview](../frontends/previews.md) is not
deployed.** The push fails the frontend's deployment with an error that says to
roll back to the frontend's own build first. Roll back, then push again.

**Runs are skipped, not failed,** when there is nothing to do: auto-deploy is
off, the project was disconnected or its binding changed before execution, the
project was deleted, or the commit contains no deployable resource, no
migrations to apply, and no function that holds only TypeScript.

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

## Check that the owner can push

Volcano writes to a connected repository for a project, such as opening a pull
request, only where the project owner's GitHub account can push. An app or
agent acting on the project can ask the same question before it plans a
change:

```bash
curl -H "Authorization: Bearer $VOLCANO_TOKEN" \
  "https://api.volcano.dev/projects/$PROJECT_ID/git-connection/owner-push"
```

```json
{ "repository_id": 123456789, "can_push": true }
```

The check is always about the project's connected repository; it takes no
repository argument. A project access token can call it, including a
`read_only` one, and so can the [MCP](../interfaces/mcp.md) tool
`get_git_owner_push`. When `can_push` is `false`, `reason` says why:

| `reason`                   | Meaning                                                     | Fix                                                                   |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `owner_not_connected`      | The project owner has not connected a GitHub account        | The owner [connects GitHub](#1-connect-github)                        |
| `owner_reconnect_required` | The owner's GitHub connection expired or was revoked        | The owner connects GitHub again                                       |
| `repository_access_lost`   | The owner's GitHub account can no longer see the repository | Restore the owner's access, or connect a repository the owner can see |
| `no_push_permission`       | The owner can read the repository but not push to it        | Give the owner write access to the repository on GitHub               |

Other responses:

- `404`: the project has no repository connected. With code
  `feature_unavailable`, this deployment has no GitHub integration, as in local
  mode.
- `429` with `Retry-After`: checks that ask GitHub have an hourly budget for
  the project, and another for its owner across all their projects. Wait the
  seconds `Retry-After` gives.
- `503` with `Retry-After`: GitHub did not answer, or is rate limiting the
  owner's account. The check never answers `can_push: true` when it could not
  ask.

An answer can be a few seconds old. A repeated check within that time is
answered without asking GitHub again and does not count against the budget.

## Limits

Per deployment run:

| Limit                              | Value                                    |
| ---------------------------------- | ---------------------------------------- |
| Downloaded repository tarball      | 256 MiB compressed                       |
| Extracted repository               | 512 MiB total, 256 MiB per file          |
| Repository entries                 | 50,000                                   |
| Functions per commit               | 1,000                                    |
| Each generated deploy archive      | 256 MiB by default (operator-configured) |
| Total bytes packaged into archives | 1 GiB                                    |

Exceeding any of these fails the run with `source_invalid`, without retrying:
they are properties of the commit, not transient conditions.

## Troubleshooting

**Nothing happened after a push.** Find the commit in the project's
[deployment runs](#check-deployment-runs). A `skipped` or `failed` run
says why in `error`. No run for the commit means the push was not eligible:
check that it targeted the project's `production_branch` — read it back, don't
assume it is the repository's default — that `auto_deploy_enabled` is `true`,
and that the project is still bound to that repository
(`GET /projects/{id}/git-connection`).

**A push with migrations deployed nothing.** With `apply_migrations` on, a
failed migration stops the push. The commit's deployment run says why and lists
the migration runs it started, as in [Apply migrations on
push](#apply-migrations-on-push). A run that failed with `owner_not_active`
started no new migration run, because the project owner's account is not
`active`.

**A function is missing.** It is probably being skipped by discovery. Confirm it
sits directly under `volcano/functions/` inside `root_directory`, that its name
is DNS-safe and not reserved, and that a directory function contains at least one
supported source file. A function that holds only TypeScript isn't deployed;
commit its compiled JavaScript.

**The frontend did not deploy.** `frontend_name` must be set, and
`root_directory` + `frontend_app_root` must contain a `package.json`, or the
nearest `package.json` above it must build it with `next build <dir>`. A
`volcano init nextjs` project with `frontend_app_root: web` works this way. A
configured frontend that is not found in the source is skipped, not failed.

**Signed-in users or anon keys get `404` from a function you deployed.** New
functions are `private`, which admits only service keys and schedulers and
looks missing to everyone else. An anon key on an `authenticated` function gets
`403` when it invokes by id, and `404` when it calls by name through an SDK.
Declare the level the function needs in `volcano-config.yaml`, such as
`visibility: authenticated` for functions your signed-in pages call, or set it
through the API. An entry that still says `public: false` sets `authenticated`
on every push; use `visibility: private` to keep a function private. The SDKs
remember a name that wasn't found for about 30 seconds, so a running client can
keep getting not-found for that long after you widen the level. See
[who can invoke a function](../functions/creating-functions.md#choose-who-can-invoke-it).

## Related

- [Configuration manifest](configuration.md) — the declarative
  `volcano-config.yaml` reference
- [Creating functions](../functions/creating-functions.md) — the same
  `volcano/functions/` layout, deployed from the CLI
- [Deploy a frontend](../frontends/deploy.md) — deploying a frontend without git
