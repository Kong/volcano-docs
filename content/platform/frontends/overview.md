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

Volcano serves your site through a CDN. Static assets, optimized images, and
pages Next.js built ahead of time are held at the edge, so repeat visitors are
answered without reaching your runtime. Check any response with `X-Cache`:

```bash
curl -sI https://your-site.frontends.volcano.dev/pricing | grep -i -e x-cache -e cache-control
# cache-control: s-maxage=31536000
# x-cache: Hit from volcano
```

Every response also says which build and region answered. Your app's own headers
are served as written, and Volcano's internal ones are never returned:

```bash
curl -sI https://your-site.frontends.volcano.dev/pricing | grep -i x-volcano
# x-volcano-version: staging-abc1234
# x-volcano-region: us-east-1
```

**Your app decides what is shared.** The edge stores nothing that does not ask
to be stored, so Next.js's own rendering choice is the whole contract:

| Route | What Next.js sends | At the edge |
| --- | --- | --- |
| Prerendered at build | `s-maxage=31536000` | Cached |
| `export const revalidate = 60` | `s-maxage=60` | Cached for 60 seconds |
| `export const dynamic = 'force-dynamic'` | `no-store` | Never cached |
| Reads cookies, headers, or search params | `no-store` | Never cached |

So a page that is always a `Miss` is a page your app is rendering per request.
If you expected it to be cached, make it static — the usual cause is a dynamic
API called in the page or in a layout above it, which opts the whole route out.

**Cached pages are never more than a minute behind your app.** A page your app
can replace at any moment cannot also be trusted for a year, so the edge checks
back with your runtime at least every 60 seconds and serves what it already has
while nothing has changed. Anything that changes what a page renders —
[`revalidatePath()`, `revalidateTag()`](https://nextjs.org/docs/app/guides/incremental-static-regeneration),
or a redeploy — reaches visitors within that window:

```js
// app/api/publish/route.js
import { revalidatePath } from "next/cache";

export async function POST() {
  revalidatePath("/blog"); // live for everyone within a minute
  return Response.json({ revalidated: true });
}
```

A response that sets a cookie is never shared, whatever its `Cache-Control`
says. Neither is one whose `Vary` names a header the CDN does not key on: only
`Accept-Encoding` and the App Router's own routing headers are, so
`Vary: Accept-Language` or `Vary: Origin` on a cacheable response takes it out
of the shared cache rather than risk serving one visitor's copy to the next.
Read those headers in the page instead and Next.js will render per request.

A prefetch and a full page load of the same URL are cached separately, as are
the same page requested on two different domains.

**Middleware turns caching off for the routes it matches.** Middleware runs in
your runtime, so a page answered from the edge would skip it — a route gated on
a cookie would be served to the next visitor without one. Rather than guess
which middleware is a security check, Volcano keeps every matched route out of
the shared cache:

```js
// middleware.js — /dashboard is never cached, everything else still is
export const config = { matcher: ["/dashboard/:path*"] };
```

Narrow the `matcher` to the routes that need it. Middleware declared without a
`matcher` runs on every request, which leaves nothing cacheable. If you use
middleware only to rewrite or add headers, moving that logic into
[`next.config.js` rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
or into the page itself keeps the route at the edge.

Redeploying clears your frontend's cached pages, so a new build takes over
without waiting for anything to expire. It cannot clear a browser's copy, which
is why Next.js puts a build hash in the filename of every asset it expects to
change.

## Platform error pages

When Volcano cannot route or serve a frontend request, browsers receive a
self-contained HTML error page. The status code identifies the failure:

| Status | Meaning |
| --- | --- |
| `403` | Project traffic is disabled. |
| `404` | No deployed frontend matches the address. |
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
