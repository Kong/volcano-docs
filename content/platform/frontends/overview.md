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
curl -sI -H 'Accept-Encoding: br, gzip' https://your-site.frontends.volcano.run/ | grep -i content-encoding
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
curl -sI https://your-site.frontends.volcano.run/pricing | grep -i -e x-cache -e cache-control
# cache-control: s-maxage=31536000
# x-cache: Hit from volcano
```

Every response also says which build and region answered. Your app's own headers
are served as written, and Volcano's internal ones are never returned:

```bash
curl -sI https://your-site.frontends.volcano.run/pricing | grep -i x-volcano
# x-volcano-version: staging-abc1234
# x-volcano-region: us-east-1
```

**Your app decides what is shared.** The edge stores nothing that does not ask
to be stored, so Next.js's own rendering choice is the whole contract:

| Route | What Next.js sends | At the edge |
| --- | --- | --- |
| Prerendered at build | `s-maxage=31536000` | Cached until something replaces it |
| `export const revalidate = 60` | `s-maxage=60` | Cached for 60 seconds |
| `export const dynamic = 'force-dynamic'` | `no-store` | Never cached |
| Reads cookies, headers, or search params | `no-store` | Never cached |

So a page that is always a `Miss` is a page your app is rendering per request.
If you expected it to be cached, make it static — the usual cause is a dynamic
API called in the page or in a layout above it, which opts the whole route out.

**A cached page is kept for the lifetime it asked for.** A page prerendered at
build stays at the edge until something replaces it, so a visitor returning the
next day is answered without your runtime being involved at all. A page with
`export const revalidate = N` expires on its own after N seconds.

Three things replace a page before then: a redeploy,
[`revalidatePath()`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath),
and [`revalidateTag()`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag).
All of them clear only the pages they affect — publishing one post does not empty
the cache for the rest of your site:

```js
// app/api/publish/route.js
import { revalidatePath } from "next/cache";

export async function POST() {
  revalidatePath("/blog"); // /blog is refetched on the next visit; nothing else moves
  return Response.json({ revalidated: true });
}
```

Two limits come with `revalidatePath()`. It clears the exact address that was
revalidated — both `/blog` and `/blog/`, so a site that canonicalizes the
trailing slash still drops the stored page — and the cache treats each query
string as its own entry, so clearing `/blog` leaves `/blog?utm_source=newsletter`
serving until that entry's own lifetime runs out. Redeploy when you need every
variant of a page gone at once. A rewritten route is cleared at the address the
visitor requested, not the destination the rewrite resolved. And the route has to
be one Volcano can name: a path *ending* in `*` is rejected, because there is no
way to clear that one page without also clearing every page sharing its prefix.
An asterisk anywhere else in a path is fine, and so is a path of up to about
3,950 characters. A path Volcano cannot clear is refused and recorded in your
function's logs; `revalidatePath()` itself still returns normally, so check the
logs if a page you cleared is still serving the old content.

Passing `"layout"` as the second argument marks the layout and everything beneath
it, which is more pages than a single address can name. Volcano clears the
layout's own page. For the pages under it, tag their data and use
`revalidateTag()`, or redeploy — a prerendered page is otherwise kept until
something replaces it.

The same limit applies to a typed dynamic pattern such as
`revalidatePath("/product/[slug]", "page")`: that names `/product/[slug]`, not
`/product/123` or `/product/456`. Tag the data those pages are built from if you
need them cleared by name.

**`revalidateTag()` clears pages too.** A tag names data rather than an address,
so the CDN keeps the tags a page was built from alongside it and clears every
page carrying the tag when you mark it — wherever those pages live:

```js
// app/api/publish/route.js
import { revalidateTag } from "next/cache";

export async function POST() {
  revalidateTag("posts"); // every page built from `posts` is cleared; nothing else moves
  return Response.json({ revalidated: true });
}
```

Both reach visitors within seconds of the call, and a tag costs the same whether
it clears two pages or ten thousand. A page is only cleared this way if it was
stored after being built from that tag, so the first build of a page following a
tag change is what puts it under the tag.

Unlike `revalidatePath()`, a tag is not tied to an address, so it clears every
query-string variant of the pages it covers.

A page carries up to about forty tags to the CDN, and each tag has to be under
about 215 characters with no spaces. Tags past either limit still work inside
your app — they just will not clear the page from the CDN, so keep the tags you
publish with short and few.

**Signed-in pages are not shared.** The CDN keys on `Authorization` but not on
cookies, so an answer that depends on who is asking is held out of the shared
cache rather than handed to the next visitor. Five things take a response out of
it, whatever its `Cache-Control` says:

- it sets a cookie;
- it answers a request that carried an `Authorization` header;
- its `Vary` names a header the CDN does not key on. The key holds the
  compression headers, the App Router's own routing headers, `Authorization`,
  and the host the request was made to, so `Vary` on any of those is honoured
  while `Vary: Cookie` or `Vary: Accept-Language` takes the response out;
- its `Content-Security-Policy` carries a `nonce-`, which authorizes the inline
  scripts of one response and must not be replayed to anyone else;
- its route is matched by middleware (see below).

A page that reads the session cookie is already rendered per request, so it is
never stored to begin with. The one way to defeat all of this is to set
`Cache-Control: public` or `s-maxage` yourself on a page whose content depends
on who is asking — that is your app telling the CDN the opposite, for a request
it cannot tell apart from anyone else's.

Most of these rules act on a response, not on the route that produced it.
`Authorization` is in the cache key, so a request carrying a token never reads
an answer stored for an anonymous one. Cookies are not, and that is the gap to
design around: ask the same URL without the session cookie and the answer is
stored under whatever your app declared, and a later request that does carry one
can be served that copy for as long as your app said the page could live. On a
route whose answer depends on a cookie, do not declare it shareable.

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

Redeploying clears everything your frontend has at the edge — pages and
optimized images alike — and the deploy waits for that to finish before
reporting the new build active. Once it does, nothing from the old build is
served. Redeploying cannot clear a browser's copy, which is why Next.js puts a
build hash in the filename of every asset it expects to change.

**Files under `public/` are served as files.** They keep their browser cache
metadata, and they do not run middleware or authentication, so do not put
protected content there. Naming one so it looks like a build asset does not make
it one: only the hashed files your build actually emitted are treated as
content-addressed.

`/_volcano/static` and `/_volcano/immutable` are reserved for Volcano's own
cache routing. A request a visitor makes under either prefix returns
`404 Not Found`, so do not put your own routes or files there. Your assets are
served from their own paths and only pass through these namespaces internally.

Local mode puts no CDN in front of your app — every request reaches it — so
`X-Cache` and everything above only applies once deployed. A page that is
cached wrongly will look fine locally.

## Response time on the first request

A request your runtime has to answer needs that runtime started, and starting it
takes time if nothing has run there recently. That startup is what makes an
occasional request slower than the ones after it.

Volcano keeps your runtimes started for you, in every region the frontend is
deployed to, so most visitors never pay for it:

- **For two days after each deploy**, whether or not anyone visits. You
  deploy, then open your own site — that first look is the one worth being fast,
  and it is fast without any traffic having warmed it up.
- **For a day after the most recent request**, for as long as your site keeps
  being used. A site with a visitor every few hours stays continuously ready.

A site that goes a full day without a single request stops being kept ready, and
its next visitor waits for a runtime to start. That request also puts the site
back on the list, within a couple of minutes, so a site coming back to life is
slow once rather than slow repeatedly. Redeploying restores the two-day window
immediately.

Nothing here is a setting. Both windows are the same on both plans; SUPERAGENT keeps two
runtimes ready per region instead of one, so two visitors arriving at once are
both answered without a startup. Keeping runtimes ready is not billed as requests
or bandwidth, and it does not appear in your
[usage](../guides/plans-and-limits.md).

Keeping a frontend ready renders a page, so anything your server-side code logs
while doing that appears in your logs alongside real visits. Only the logging is
shared; those renders are still not counted as requests.

## Measuring where a response spent its time

Every response Volcano proxies from your site carries:

```text
X-Volcano-Origin-Ms: 42
```

That is how long your site took to *start* answering, measured from the moment
Volcano asked it. A page streams to the browser as it is produced, so by the
time the last byte leaves there is nowhere left to write a header — first byte
is the part that can be reported. Compare it against the browser's total load
time: when the two are far apart, the difference is transfer and rendering
rather than your server-side code.

A static asset served from cache typically reports single digits. A page your
server-side code renders reports whatever that render costs, plus a startup if
the request arrived cold — see the section above.

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

Custom domains are a **SUPERAGENT** feature and use **bring-your-own-certificate
(BYOC)** TLS: you supply the certificate and private key, and Volcano serves
your domain with them. Volcano does not issue the certificate for you.

On the HOBBY plan an attached domain is kept but stops serving: requests to it
return `404` while the frontend's `*.frontends.volcano.run` URL keeps working. Upgrading
puts the domain back in service without re-attaching it. See
[moving from SUPERAGENT to HOBBY](../guides/plans-and-limits.md#moving-from-superagent-to-hobby).

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
app.example.com.  CNAME  <frontend-id>.frontends.volcano.run.
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
