---
title: 'Deploy a frontend'
description: 'Build and deploy a Next.js site to Volcano with the CLI, set variables, attach a custom domain, and view logs.'
---

Deploy a Next.js site to Volcano and serve it at a Volcano URL or your own
domain. This uses the [Volcano CLI](/cli); install it and sign in first (see the
[Quickstart](../getting-started/quickstart.md)).

## 1. Scaffold or bring your app

Start a new Next.js project scaffolded for Volcano, or use an existing one:

```bash
volcano init nextjs        # new project
# or: cd into your existing Next.js app
```

Select the project you're deploying to:

```bash
volcano projects create my-app
volcano use my-app
```

## 2. Set variables

Values your build needs go in project variables. Prefix anything the browser
needs with `NEXT_PUBLIC_`. Put the cloud project's values in
`volcano/cloud.env`; `volcano/volcano.env` holds the local development
server's:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com
```

Then save them to your cloud project:

```bash
volcano cloud variables deploy -f volcano/cloud.env
```

Without `cloud`, `volcano variables deploy` writes to local development
(`volcano start`), not to your cloud project.

## 3. Deploy

```bash
volcano cloud frontends deploy --variable-scope scoped --variable NEXT_PUBLIC_API_URL
```

The CLI uploads your app, Volcano builds it, publishes the assets, and returns
the site URL. New frontends use a scoped variable environment by default. Use
`--variable-scope scoped` and pass each required project variable with
`--variable`; variables not selected are not available to the build or runtime.
Scoped mode with no `--variable` flags exposes no project variables. Existing
frontends keep their current selection when these flags are omitted.

Watch progress and check status:

```bash
volcano cloud frontends list
volcano cloud frontends get my-site
```

Redeploy after changes — traffic stays on the live build until the new one is
ready:

```bash
volcano cloud frontends redeploy my-site
```

### First deploy with `volcano-config.yaml`

`volcano cloud config deploy` configures frontends but never creates one. An entry
for a frontend that does not exist yet is reported as `skipped`, and nothing
else happens for it. Create the frontend first, then apply the manifest:

```bash
volcano cloud frontends deploy --variable-scope scoped --variable NEXT_PUBLIC_API_URL
volcano cloud config deploy
```

Pass the same variables on that first deploy that the manifest's frontend entry
selects. The manifest updates the selection afterwards, but a `NEXT_PUBLIC_`
value only reaches the browser bundle through a build, so a variable added by
`cloud config deploy` alone needs a redeploy before the browser sees it.

### Deploy with the rest of the project

`volcano cloud deploy` deploys the frontends listed in
`.volcano/source-layout.json` together with the project's variables,
functions, and manifest. A frontend whose `volcano-config.yaml` entry sets
`variable_scope: all`, or `variable_scope: scoped` with a `variables` list,
builds with that selection, and the manifest is applied after the frontend
exists, so the two steps above happen in the right order:

```json
{
  "version": 1,
  "frontends": [{ "name": "my-site", "workspace": "", "app_root": "" }]
}
```

`workspace` is the directory to upload, relative to the project root, and
`app_root` is the Next.js app inside it. Projects created with
`volcano init nextjs` include this file. A [connected Git repository](../projects/git-deploy.md)
reads the same file. See the [CLI deploy reference](/cli/deploy).

The deploy can't pass any other selection to a build. An entry with
`variable_scope: shared`, or one that leaves out either field, builds with the
selection the frontend already has, which is none for a new frontend. The CLI
warns, the manifest step applies the selection afterwards, and the next deploy
rebuilds with it. Until then, the browser bundle lacks those `NEXT_PUBLIC_`
values.

### Deploy to local development

Leave out `cloud` to build and serve the frontend on the local development
server that `volcano start` runs:

```bash
volcano frontends deploy --name my-site --variable-scope scoped --variable NEXT_PUBLIC_API_URL
# or deploy it with the rest of the project
volcano deploy
```

The local site is served at an address like
`http://FRONTEND_ID.frontends.localhost:8080`. `volcano frontends get my-site`
prints it once the first build finishes. Custom domains are cloud-only. To call
an HTTP-mode function from the local site, declare a
[Frontend Function route](function-routes.md) with `function_routes` in
`volcano-config.yaml`; `volcano deploy` applies it after the frontend exists.
`volcano frontends routes list|create|delete` manages the same routes by hand.

### What the CLI uploads

The CLI archives the project directory (`--path`, the current directory by
default) and skips:

- `node_modules`, `.next`, `dist`, and `build`, at any depth
- `.env.local` and other `.env*.local` files
- `volcano/*.env` and `volcano.env`, which hold the project's variables, such
  as `volcano/cloud.env`, and under `volcano cloud deploy` the `--env-file` it
  deployed, wherever it is
- `.git`, editor and OS files (`.vscode`, `.idea`, `.DS_Store`, `*.swp`), and
  `*.log`
- anything matched by the root `.gitignore`

When the app uses `workspace:` dependencies, the CLI archives the workspace root
instead of `--path`, so these rules, the root `.gitignore`, and the file limit
below apply to the whole workspace. Pass `--app-root` to archive only `--path`.

Symbolic links are skipped with a warning. More than 10,000 files fails the
deploy with `too many files`. `.env` and `.env.production` are uploaded, so
Next.js reads them during the build; keep secrets in project variables instead.

### Build environment

| Tool    | Version                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js | 22, or 24 when `package.json` `engines.node` asks for it                                                                              |
| npm     | The version bundled with that Node.js (npm 10 on Node.js 22), unless `packageManager` pins another; see [Dependencies](#dependencies) |
| Next.js | 15 or 16                                                                                                                              |

Volcano runs your `build` script, or `next build` when there is none. On
Next.js 16, where Turbopack is the default, it adds `--webpack` to `next build`.
The server runtime uses the same Node.js major as the build, but its patch
version can differ. The build log prints the exact versions. See
[supported frontend environments](../api-reference/frontend-endpoints.md#create-frontend-deployment)
for the `engines.node` rules.

### Environment size

A frontend's server runtime environment is capped at 4096 bytes, the same limit
as a function's, counted as the UTF-8 bytes of every name and value. It holds
the selected variables other than `NEXT_PUBLIC_*` plus about 900 bytes of
values Volcano sets for the runtime, so plan for roughly 3,100 bytes of your
own. A variable write, scope change, or deploy that would exceed the limit is
rejected, and the running deployment keeps serving:

```text
function environment exceeds the maximum size: frontend "web" environment is 5809 bytes (max 4096)
```

The error response puts more context in front of this message. Select fewer
variables with `--variable-scope scoped`, or move large values out of the
runtime environment.

### Dependencies

Volcano installs your dependencies before running the build, and picks the
package manager in this order:

| Your project                                                                      | Volcano installs with                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| declares `"packageManager": "pnpm@9.15.0"` (or `yarn@`, `npm@`) in `package.json` | the manager you declared, at that version (for npm, see below) |
| declares `"packageManager"` as anything else (`bun@…`, a bare `pnpm`)             | the build fails                                                |
| declares nothing and ships one lockfile                                           | the manager that lockfile belongs to                           |
| declares nothing and ships several lockfiles                                      | `pnpm`, then `yarn`, then `npm`                                |
| declares nothing and ships no lockfile                                            | `npm`                                                          |

npm installs with the version bundled with your Node.js runtime unless
`packageManager` names a different npm major, so `npm@11.2.0` on a runtime that
bundles npm 11.6.2 installs with 11.6.2.

`packageManager` wins over the lockfiles, so a stale `pnpm-lock.yaml` left in a
project that declares `npm@10` no longer changes what runs. Declaring it is the
only way to be certain, and it is what to reach for when several lockfiles are
checked in — where a single manager is required, several lockfile families fail
the build rather than falling back to that order.

**Ship the lockfile that belongs to that manager.** Volcano installs from it, so
your build gets the versions you tested. Without it — none shipped, or
`packageManager` naming a manager whose lockfile is missing — dependencies
resolve fresh during the build and can differ from your local install. Where
locked installs are required, the build stops instead:

```text
no pnpm lockfile found and ALLOW_UNLOCKED_INSTALLS=false
```

The build log names the manager and version that were selected, so check there
first when a build installed something you did not expect.

### Regional runtime repair

After propagation retries, Volcano treats a regional runtime as missing only
when the frontend proxy receives a provider-confirmed not-found response for
the deployed runtime or its invocation URL. Volcano first verifies that the same
deployment is still serving and that the region is still expected, then queues durable repair
of that immutable generation. Repair does not rebuild source, create a new
deployment, or change what `active` and `degraded` mean.

Volcano does not repair application errors, ambiguous provider failures such as
timeouts, throttling, or network errors, user deletion, regional convergence,
or resources removed by a non-preserved staging purge. The request that detects
drift can still fail while repair runs; Volcano does not replay it in another
region. Repair is request-driven and does not proactively audit idle frontends.

Volcano controls the Next.js build ID, including when an application defines
`generateBuildId`. Redeploying the same frontend with identical source, build
variables, app path, architecture, and build toolchain keeps the same opaque
build ID and `_next/static` asset URLs. Changing any of those build inputs
changes the ID. Build IDs are scoped to the project and frontend; do not use
them as release identifiers.

Each generated frontend runtime image must fit within 4096 MB. Volcano checks an
uncompressed upper
bound—the exact pinned base-image layers plus the generated application
layer—before publishing. A server or image-optimizer image over the limit fails
the asynchronous deployment. Remove unused production dependencies or large
generated files from the frontend bundle to reduce its size.

## 4. Add a custom domain

Custom domains are available on every plan and support Volcano-managed TLS or
bring-your-own-certificate (BYOC) TLS. For managed TLS, attach the domain with
`--tls managed` (Volcano CLI 0.50 or later):

```bash
volcano cloud frontends domain create my-site --domain app.example.com --tls managed
volcano cloud frontends domain get my-site
```

A `volcano-config.yaml` entry for this frontend that omits `custom_domain`
leaves the domain attached; `custom_domain: null` removes it. The manifest can
also attach it on its own:

```yaml
version: 1
frontends:
  - name: my-site
    custom_domain:
      domain: app.example.com
      tls:
        mode: managed
```

If your account already owns the domain, Volcano returns the certificate
validation CNAME right away. Otherwise it returns a `_volcano` TXT record; add
it within 72 hours to prove ownership, and Volcano then returns the CNAME. Add
the CNAME and keep it in DNS for renewal. Keep the TXT record too: the domain
moves to another account only once DNS stops serving it. If ownership
verification expires, Volcano removes the domain; once it is gone, submit it
again for a new challenge. Certificate
validation also expires after 72 hours.
If setup fails with `failure_reason: certificate`, check the validation CNAME,
delete the failed domain, wait for deletion to finish, and submit it again.
Volcano does not repeatedly request certificates for an abandoned setup.
An `ownership` failure means another account has already claimed the hostname;
retrying under the same account will not resolve that conflict.
If another account has only reserved the hostname, attaching the domain to a
frontend without one reports the `_volcano` TXT record your account must
publish. Add it and attach the domain again, with the CLI or a deploy, to take
over the reservation. A verified
domain moves only as described in
[Move a domain to another account](domain-verification.md#move-a-domain-to-another-account).

If a live domain's certificate becomes unavailable, the domain returns to
`pending_verification`, with `verification_status: pending`, while Volcano
re-validates it. Validation records can be
temporarily empty during this transition; keep polling and follow any records
returned. Temporary provider failures are retried automatically. When issuance
resumes after a failure, `verification_status` returns to `pending`. A terminal
certificate-validation failure requires the delete-and-create retry above.

To use BYOC instead, supply your own PEM certificate
and unencrypted private key (`--chain` is optional):

```bash
volcano cloud frontends domain create my-site \
  --domain app.example.com \
  --cert  ./fullchain-leaf.pem \
  --key   ./privkey.pem \
  --chain ./chain.pem
volcano cloud frontends domain get my-site      # status + the default URL to point DNS at
```

Check with your DNS provider whether your domain is a zone apex; even a
delegated subdomain such as `app.example.com` can be one. If the provider
confirms it is not an apex, create a `CNAME`. For any apex, use a
provider-supported ALIAS, ANAME, or CNAME-flattening record. Point the record
at the default Volcano frontend hostname
(`<frontend-id>.frontends.<region-domain>`, from `domain get` / `frontends get`).
That host is stable across redeploys. For a provider-confirmed non-apex:

```text
app.example.com.  CNAME  <frontend-id>.frontends.volcano.run.
```

The domain goes `active` once Volcano finishes attaching the certificate —
that status doesn't confirm routing DNS is live, so verify it separately. See
[custom domains](overview.md#custom-domains) for lifecycle and BYOC rotation,
and [Wait out the switchover](overview.md#wait-out-the-switchover) before
treating an error after `active` as a failure.

## 5. View logs

```bash
volcano cloud frontends logs my-site
```

Build logs show the selected Node.js and package-manager versions, dependency
installation, Next.js detection, the build command, and your Next.js build
output. Validation failures include an actionable message. If Volcano cannot
prepare prerendered pages, the build log names the installed Next.js version.
For an unfamiliar cache format, it recommends a supported version for that major
when it differs from the installed version. If the log recommends a version,
pin `next` to it, update your lockfile, and rebuild, or contact support.
For other packaging failures, or failures on the recommended version, contact support.
Detailed platform setup, packaging, and publishing diagnostics stay in internal
operator logs.

## Next

- [Frontends overview](overview.md) — how builds, variables, and domains fit together.
- [Environment variables](../functions/environment-variables.md) — build vs runtime.
- [Frontend API reference](../api-reference/frontend-endpoints.md) — deploy over HTTP.
- [Deploy from GitHub](../projects/git-deploy.md) — redeploy on every push instead of running the CLI.

## Next.js configuration support

Volcano applies the routing in your `next.config` file the way `next start` does:

- `redirects()`
- `rewrites()`, including `beforeFiles`, `afterFiles`, and `fallback`
- `headers()`
- `has` and `missing` conditions on `host`, `header`, `cookie`, and `query`
- Middleware, in `proxy.js` (Next.js 16) or `middleware.js`

For example, send visitors from your apex domain to `www`:

```js
// next.config.mjs
export default {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'example.com' }],
        destination: 'https://www.example.com/:path*',
        permanent: true,
      },
    ];
  },
};
```

```bash
curl -sI 'https://example.com/pricing?plan=pro' | grep -iE '^(HTTP|location)'
# HTTP/2 308
# location: https://www.example.com/pricing?plan=pro
```

Requests to `www.example.com` and to your frontend's default URL are not redirected. Conditions match the way Next.js matches them:

- A `host` condition sees the hostname the visitor requested, lowercased and without its port, so write its `value` in lowercase.
- A `value` is a regular expression that must match the whole value, so `example.com` does not match `www.example.com`.
- A condition without a `value` requires only that the header, cookie, or query parameter is present with a value; `?draft` and `?draft=` do not satisfy it. Its value becomes a parameter named after the key's letters, lowercased for a header, so `X-Tenant` gives `:xtenant`.
- Named groups in a `value`, such as `(?<tenant>[^.]+)\\.example\\.com`, become parameters you can use in `destination` and in the keys and values of `headers`.
- In a `destination` path or host, a parameter from a condition is percent-encoded, so a `/`, `?`, or `#` in the request's value stays inside its segment and cannot send the visitor to another host. Next.js inserts it as sent, so `/docs/:path*` with `?path=guides/setup` reaches `/docs/guides%2Fsetup` here rather than `/docs/guides/setup`; capture the segments from `source` instead.

Redeploy existing frontends to apply this matching. A rule that relied on a partial match stops matching after the redeploy: a `user-agent` value of `Googlebot` needs `.*Googlebot.*`. Next.js matches conditions the same way, so apart from the encoding above, configuration written for Next.js is unaffected.

Known limits:

- A request for a file in `public/` is answered with the file. `redirects`, `headers`, and middleware do not run for it.
- The CDN caches a page by its URL, host, and a few request headers such as `Authorization`, but not by cookies or other headers. When a `cookie` or `header` condition sends visitors to different content at the same URL, keep that route out of the shared cache, for example by reading the cookie in the page. See [Caching](overview.md#caching).
- Middleware `matcher` entries match on `source` only. Their `has` and `missing` conditions are not evaluated, so check the condition inside the middleware.
- Rewrites to files in `public/` do not resolve when `basePath` and i18n are combined. See [Rewrite routes to public files](#rewrite-routes-to-public-files).

## Rewrite routes to public files

With the default Volcano frontend configuration, `beforeFiles` rewrites can serve files from your app's `public` directory:

```js
// next.config.mjs
export default {
  async rewrites() {
    return {
      beforeFiles: [{ source: '/dashboard/:path*', destination: '/app/index.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};
```

Place the document at `public/app/index.html`. Requests to `/dashboard` and its nested paths return that document while preserving the browser URL. Headers configured for the requested route still apply. Missing files remain 404 responses.

Rebuild existing deployments to enable public-file rewrites.

- Use regular files in `public` for rewrite destinations. Symbolic links are not included.
- Files reachable through rewrites increase deployment size. Unrelated public files and identity self-rewrites are excluded from the server copy.
- The server copy is capped at 256 MiB and 20,000 files, and each file is capped at 199 MiB so it fits in a single streamed response. The build warning names files skipped at either byte cap. A rewrite to a skipped file returns 404; narrow the rewrite destinations or change the app to use the file's direct static URL.
- Rewrites to public files do not support byte ranges. Use direct static URLs for seekable media and resumable downloads.
- Configured locales work when the app has no `basePath`, and `basePath` works when i18n is disabled. The build warns that rewrites to public files do not resolve when `basePath` and i18n are combined.

Public-file responses include a content-based `ETag`. Uncompressed `GET` responses include a byte length. Matching conditional requests return `304` without reading the file body.

Precompressed public files such as `.gz` downloads retain their compressed bytes and are served as downloads. Dynamic rewrite parameters can include encoded slashes (`%2F`) to reach nested public files.

The default `max-age=0` still requires revalidation; validators reduce transferred bytes, not the number of origin requests.
