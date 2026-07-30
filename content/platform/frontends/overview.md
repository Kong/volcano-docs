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
