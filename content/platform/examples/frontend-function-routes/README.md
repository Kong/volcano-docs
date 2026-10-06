---
title: "Frontend Function routes example"
description: "A Next.js frontend that signs users in through a public session function served on its own origin."
---

A Next.js frontend whose `/api/session` path is served by a public `session`
function. The function signs users in with Volcano auth and keeps the session in
`__Host-` cookies, so the browser never holds a token. The
[Frontend Function routes guide](../../frontends/function-routes.md) walks
through the code.

## Deploy

From this directory, with a project selected:

```bash
volcano projects keys anon list   # copy the anon key
printf 'AUTH_API_URL=https://api.volcano.dev\nAUTH_ANON_KEY=<anon-key>\n' > volcano/volcano.env
volcano cloud variables deploy
volcano cloud functions deploy --all
volcano cloud frontends deploy --path web
volcano cloud config deploy
```

`volcano cloud config deploy` makes `session` public, gives it the two
variables, and routes `/api/session` on the `web` frontend to it. Open the
frontend URL and sign in with a user of your project.

## Files

| File | Purpose |
| --- | --- |
| `volcano/functions/session.js` | Signs in, reports the session, and signs out |
| `web/pages/index.js` | The sign-in page |
| `volcano-config.yaml` | Function visibility, variables, and the route |
