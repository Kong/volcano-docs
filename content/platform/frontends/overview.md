---
title: "Frontends overview"
description: "Deploy static and server-rendered sites on Volcano, with build/runtime variables, custom domains, and zero-downtime redeploys."
---

A **frontend** is a web site — static or server-rendered — that Volcano builds,
hosts, and serves. You push your project's source; Volcano builds it, publishes
the static assets to the edge, and runs any server-rendered routes on managed
runtimes. Every frontend belongs to a [project](../projects/overview.md).

## How it works

1. You deploy your source (the CLI uploads a `tar.gz` of your app).
2. Volcano builds it, resolving your project [variables](../functions/environment-variables.md) at build time.
3. Static assets publish to the edge; server-rendered routes run on managed runtimes.
4. The site is served at a Volcano URL, or at your own [custom domain](#custom-domains).

Redeploys are **zero-downtime**: the live build keeps serving until the new one
is ready, then traffic cuts over. A failed redeploy leaves the previous
deployment running. Deploys use latest-wins queueing — a newer deploy supersedes
an older queued one.

## Frameworks

Next.js is supported today (`framework: nextjs`), including static export and
server-side rendering. For a monorepo, point Volcano at the app with `app_root`
(for example `apps/web`).

## Compression

Responses are compressed automatically — no plugin or middleware needed. Send
an `Accept-Encoding` header and you get the best encoding you accept:

```bash
curl -sI -H 'Accept-Encoding: br, gzip' https://your-site.frontends.volcano.dev/ | grep -i content-encoding
# content-encoding: br
```

Static assets are compressed at the edge with Brotli or gzip. Server-rendered
pages and API routes are compressed by the runtime, which also supports
`deflate`. Both prefer Brotli, and both honour quality values: a coding you
refuse with `q=0` is never sent, and a response you accept no coding for arrives
uncompressed.

A route that sets its own `Content-Encoding` keeps it. Those bytes are shipped
exactly as the route wrote them, never compressed a second time:

```js
// pages/api/report.js
export default function handler(req, res) {
  res.setHeader("Content-Encoding", "gzip");
  res.status(200).send(gzipSync(Buffer.from(report)));
}
```

Compressed **request** bodies are passed through untouched too, so a route that
accepts `Content-Encoding: gzip` reads the compressed bytes and decodes them
itself.

## Caching

Volcano caches content-addressed Next.js assets under `/_next/static/` at the
edge. Their hashed filenames change when their bytes change, so repeat requests
can safely use the shared copy. Next.js prefixes asset URLs when `basePath` is
configured, so discover the asset URL from your page's HTML:

```bash
site=https://your-site.frontends.volcano.dev
page_path=/docs # Use / for a root deployment.
asset_path="$(curl -fsS "$site$page_path" | grep -oE '/([^"?]+/)?_next/static/[^"?]+\.js' | head -n 1)"
test -n "$asset_path"
curl -fsSI "$site$asset_path" >/dev/null
curl -fsSI "$site$asset_path" | grep -i -e x-cache -e cache-control
# x-cache: Hit from volcano
```

All other frontend requests bypass the shared edge cache. HTML, API routes,
optimized images, prerendered pages, ISR pages, and RSC payloads reach your
runtime on every request. Volcano returns those runtime responses with
`Cache-Control: private, no-store`; an app cannot opt them into the shared CDN
cache with its own `Cache-Control` header.

Files under `public/` are served from the deployment's static files and retain
their browser cache metadata. They do not run runtime middleware or
authentication, so do not use them for protected content. Arbitrary files
under `public/`, including paths containing `/_next/static/`, do not use the
shared cache.

The `/_volcano/immutable/` path is reserved for Volcano's internal cache
routing. Frontend requests to that path return `404 Not Found`.

This boundary lets middleware, authentication, request headers, cookies, and a
fresh per-response Content Security Policy run for every application request.
Use hashed files under `/_next/static/` for content that must be served from the
shared edge cache.

Every response also says which build and region answered. Volcano's internal
headers are never returned:

```bash
curl -sI https://your-site.frontends.volcano.dev/pricing | grep -i x-volcano
# x-volcano-version: staging-abc1234
# x-volcano-region: us-east-1
```

## Platform error pages

When Volcano cannot route or serve a frontend request, browsers receive a
self-contained HTML error page. The status code identifies the failure:

| Status | Meaning |
| --- | --- |
| `403` | Project traffic is disabled. |
| `404` | No deployed frontend serves the address. |
| `429` | The project reached a rate or monthly request limit. |
| `502` | The deployed frontend is temporarily unreachable. |
| `503` | A platform dependency is temporarily unavailable. |

The page may include a reference ID for support. `502` and `503` pages link to
the platform status page. Clients that prefer `application/json` receive a JSON
error response instead; `Accept` quality values are honored.

## Variables

All project variables are available to the **build**. Variables prefixed with
`NEXT_PUBLIC_` are also available to the deployed frontend at **runtime**. Manage
them with `volcano variables …` or the [declarative config](../projects/configuration.md).

## Custom domains

Custom domains are a **PRO** feature and use **bring-your-own-certificate
(BYOC)** TLS: you supply the certificate and private key, and Volcano serves
your domain with them. Volcano does not issue the certificate for you.

On the Free plan an attached domain is kept but stops serving: requests to it
return `404` while the frontend's `*.volcano.dev` URL keeps working. Upgrading
puts the domain back in service without re-attaching it. See
[moving from Pro to Free](../guides/plans-and-limits.md#moving-from-pro-to-free).

Attaching a custom domain takes two steps — attach the domain (with your cert),
then point DNS at your frontend:

```bash
# 1. Attach the domain with your PEM certificate + unencrypted private key
#    (--chain is optional; include it if your CA requires the issuing chain).
volcano cloud frontends domain create my-site \
  --domain app.example.com \
  --cert  ./fullchain-leaf.pem \
  --key   ./privkey.pem \
  --chain ./chain.pem

# 2. Check status and the frontend's default URL.
volcano cloud frontends domain get my-site
```

You can also attach a custom domain declaratively — see
[`custom_domain` in the configuration reference](../projects/configuration.md).

### Point DNS at your frontend

Create a `CNAME` record for your domain pointing at the frontend's **default
Volcano URL** (the `<frontend-id>.frontends.<region-domain>` host shown by
`volcano cloud frontends get`). That host is stable for the life of the
frontend — it does not change across redeploys.

```text
app.example.com.  CNAME  <frontend-id>.frontends.volcano.dev.
```

The domain becomes `active` once Volcano finishes attaching your certificate.
That status does not confirm your DNS is live — verify separately (for
example `dig CNAME app.example.com`).

To rotate the certificate later, update it through the declarative
[`custom_domain` config](../projects/configuration.md) and re-apply; the
rotation is zero-downtime. Re-running `domain create` for a domain that's
already attached is a no-op and won't replace the certificate.

## Next

- [Deploy a frontend](deploy.md) — step-by-step with the CLI.
- [Frontend API reference](../api-reference/frontend-endpoints.md) — the HTTP surface.
- [CLI reference](/cli) — every `volcano cloud frontends` command.
