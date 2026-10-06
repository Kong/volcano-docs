---
title: "Frontend Function routes"
description: "Serve a public HTTP function under a path of your frontend, so the browser calls it on the same origin with cookies instead of tokens."
---

A Frontend Function route sends every request under a path of your frontend,
such as `/api/session`, to an HTTP-mode function. The browser stays on your
site's origin, so the function can keep a session in `HttpOnly` cookies and your
pages never handle an access token.

```yaml
# volcano-config.yaml (excerpt)
functions:
  - name: session
    visibility: public
    invocation_mode: http
frontends:
  - name: web
    function_routes:
      - function: session
        path_prefix: /api/session
        strip_prefix: true
```

With that route, `GET https://<your-frontend>/api/session/me` runs `session`
with `event.path` set to `/me`.

## Requirements

- The target is a standard function in the same project with
  `invocation_mode: http`. Durable and RPC-mode functions are refused.
- The target is `public`. A route reaches the function with no Volcano
  credential, so anyone who can load your site can call it. Volcano refuses a
  route to a `private` or `authenticated` function, and refuses an update or
  redeploy that would make a routed function non-public until its routes are
  removed. See
  [function visibility](../functions/creating-functions.md#choose-who-can-invoke-it).
- The function does its own authentication. Volcano doesn't read the
  `Authorization` header or cookies on a routed request, and never adds
  `__volcano_auth`, even when the visitor sends a valid token.

## Add a route

Declare `function_routes` on the frontend in `volcano-config.yaml` and run
`volcano cloud config deploy`. One apply can make the function public and add
the route. The list is the complete set: routes you leave out are deleted, and
`function_routes: []` deletes them all. See
[project configuration](../projects/configuration.md).

Or use the CLI:

```bash
volcano cloud frontends routes create web --path /api/session --function session --strip-prefix
```

Or call the API:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/frontends/$FRONTEND_ID/function-routes" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"function_id\":\"$FUNC_ID\",\"path_prefix\":\"/api/session\",\"strip_prefix\":true}"
```

```json
{
  "id": "6f1c2a9e-3b0d-4a51-9a39-0c6f2f1e8d42",
  "project_id": "c4e8a1f2-7d3b-4e9a-b6c0-1f2e3d4c5b6a",
  "frontend_id": "2d6b1c0e-8f4a-4b7e-9d3a-5e1f0c2b7a64",
  "function_id": "9a3e5c71-0b2d-4f6e-8c1a-7d4b2e9f0a13",
  "path_prefix": "/api/session",
  "strip_prefix": true,
  "created_at": "2026-10-01T12:00:00Z",
  "updated_at": "2026-10-01T12:00:00Z"
}
```

`GET` on the same path lists the routes, and `PUT` or `DELETE` on
`/function-routes/{routeId}` replaces or removes one. `GET` on the frontend
includes its routes as `function_routes`. See the
[frontend API reference](../api-reference/frontend-endpoints.md#function-routes).

## How requests are matched

- `path_prefix` matches whole segments: `/api/session` matches `/api/session`
  and `/api/session/me`, not `/api/sessions`. The longest matching prefix wins.
- With `strip_prefix: true`, the function sees the rest of the path, or `/` for
  the prefix itself. With `false`, it sees the full path.
- The query string, body, and cookies reach the function unchanged. Headers
  follow the function's `http_auth_mode`: with `volcano`, the default,
  `Authorization` and `X-Anon-Key` are removed; with `none`, they are forwarded.
  See [HTTP mode request event](../functions/invoking-functions.md#http-mode-request-event).
  `request_context.host` is the hostname the visitor used, and
  `request_context.source_ip` is the visitor's address.
- Every routed response carries `Cache-Control: private, no-store`.
- A route applies to every hostname of the frontend: its generated hostname,
  preview hostnames, a custom domain, and `*.frontends.localhost` in local mode.
- A route change can take a few seconds to reach every request.

## Keep a session in cookies

The [example project](../examples/frontend-function-routes/README.md) signs
users in through a public `session` function. The page posts the email and
password to `/api/session/login`, and the function exchanges them with Volcano
auth and keeps the tokens in cookies the page can't read. When the access token
expires, `/me` trades the refresh token for a new pair, so the session lasts
until the visitor closes the browser or the refresh token expires.

```javascript
// volcano/functions/session.js
const crypto = require("node:crypto");

const API_URL = process.env.AUTH_API_URL;
const ANON_KEY = process.env.AUTH_ANON_KEY;
const SESSION_COOKIE = "Path=/; Secure; HttpOnly; SameSite=Strict";

exports.handler = async (event) => {
  // Browsers send this site's SameSite cookies from other frontends under
  // frontends.volcano.run too, so answer only this site's own pages.
  if (!fromThisSite(event)) {
    return reply(403, { error: "cross-origin request" });
  }
  const cookies = readCookies(header(event, "cookie"));
  const route = `${event.method} ${event.path}`;

  if (route === "GET /csrf") {
    const token = cookies["__Host-csrf"] || crypto.randomBytes(32).toString("base64url");
    return reply(200, { csrf_token: token }, [`__Host-csrf=${token}; ${SESSION_COOKIE}`]);
  }
  if (route === "GET /me") {
    return me(cookies["__Host-session"], cookies["__Host-refresh"]);
  }
  // Every state change must also carry the CSRF token.
  const csrf = header(event, "x-csrf-token");
  if (!csrf || csrf !== cookies["__Host-csrf"]) {
    return reply(403, { error: "missing or invalid CSRF token" });
  }
  if (route === "POST /login") {
    return login(readJSON(requestBody(event)));
  }
  if (route === "POST /logout") {
    return logout(cookies["__Host-refresh"]);
  }
  return reply(404, { error: "not found" });
};

async function login({ email, password }) {
  const response = await auth("/auth/signin", { email, password });
  if (!response.ok) {
    return reply(401, { error: "invalid email or password" });
  }
  return signedIn(await response.json());
}

async function me(accessToken, refreshToken) {
  const user = accessToken && (await currentUser(accessToken));
  if (user) {
    return reply(200, { user });
  }
  // The access token expired: trade the refresh token for a new pair.
  if (!refreshToken) {
    return reply(401, { error: "not signed in" });
  }
  const response = await auth("/auth/refresh", { refresh_token: refreshToken });
  if (!response.ok) {
    return reply(401, { error: "not signed in" }, clearedCookies());
  }
  return signedIn(await response.json());
}

async function logout(refreshToken) {
  if (refreshToken) {
    await auth("/auth/logout", { refresh_token: refreshToken });
  }
  return reply(200, { signed_out: true }, clearedCookies());
}

async function currentUser(accessToken) {
  const response = await fetch(`${API_URL}/auth/user`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return null;
  }
  const { user } = await response.json();
  return { id: user.id, email: user.email };
}

function auth(path, body) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signedIn(session) {
  return reply(200, { user: { id: session.user.id, email: session.user.email } }, [
    `__Host-session=${session.access_token}; ${SESSION_COOKIE}; Max-Age=${session.expires_in}`,
    `__Host-refresh=${session.refresh_token}; ${SESSION_COOKIE}`,
  ]);
}

function clearedCookies() {
  return [`__Host-session=; ${SESSION_COOKIE}; Max-Age=0`, `__Host-refresh=; ${SESSION_COOKIE}; Max-Age=0`];
}

function fromThisSite(event) {
  const site = header(event, "sec-fetch-site");
  if (site) {
    return site === "same-origin" || site === "none";
  }
  const origin = header(event, "origin");
  return !origin || origin === `${event.request_context.scheme}://${event.request_context.host}`;
}

function reply(statusCode, body, cookies = []) {
  return {
    statusCode,
    multiValueHeaders: { "Content-Type": ["application/json"], "Set-Cookie": cookies },
    body: JSON.stringify(body),
  };
}

function header(event, name) {
  const key = Object.keys(event.headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? [].concat(event.headers[key]).join("; ") : "";
}

function readCookies(value) {
  return Object.fromEntries(
    value.split(";").map((pair) => pair.trim().split("=")).filter(([name]) => name).map(([name, ...rest]) => [name, rest.join("=")]),
  );
}

function readJSON(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function requestBody(event) {
  return event.is_base64_encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}
```

The page calls the route with plain `fetch`. Each `POST` first reads the CSRF
token and sends it back in a header:

```javascript
// web/pages/index.js
import { useEffect, useState } from "react";

async function post(path, body) {
  const { csrf_token } = await fetch("/api/session/csrf").then((response) => response.json());
  const response = await fetch(`/api/session${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf_token },
    body: JSON.stringify(body ?? {}),
  });
  return { ok: response.ok, body: await response.json() };
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/session/me")
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((body) => setUser(body.user));
  }, []);

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await post("/login", { email: form.get("email"), password: form.get("password") });
    setError(result.ok ? "" : result.body.error);
    setUser(result.ok ? result.body.user : null);
  }

  async function signOut() {
    await post("/logout");
    setUser(null);
  }

  if (user) {
    return (
      <main>
        <p>Signed in as {user.email}</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }
  return (
    <main>
      <form onSubmit={signIn}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Sign in</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
```

The manifest makes `session` public, gives it the two variables it reads, and
adds the route:

```yaml
# volcano-config.yaml
version: 1
functions:
  - name: session
    visibility: public
    invocation_mode: http
    variable_scope: scoped
    variables:
      - AUTH_API_URL
      - AUTH_ANON_KEY
frontends:
  - name: web
    function_routes:
      - function: session
        path_prefix: /api/session
        strip_prefix: true
```

Deploy it from the example directory, with your project's anon key from
`volcano projects keys anon list`:

```bash
printf 'AUTH_API_URL=https://api.volcano.dev\nAUTH_ANON_KEY=<anon-key>\n' > volcano/volcano.env
volcano cloud variables deploy
volcano cloud functions deploy --all
volcano cloud frontends deploy --path web
volcano cloud config deploy
```

`volcano cloud config deploy` runs last because it configures the function and
frontend the earlier commands created.

### Cookie rules

- Name session cookies with the `__Host-` prefix. The browser then requires
  `Secure` and `Path=/` and refuses a `Domain` attribute, so the cookie is sent
  only to the exact hostname that set it, and no other site can overwrite it.
- Mark session cookies `HttpOnly` so scripts on the page can't read them.
- Return each cookie as a separate `Set-Cookie` value in `multiValueHeaders`.
  `headers` takes one value per name.

### Refuse requests from other sites

`SameSite=Strict` isn't enough on its own. Browsers treat every frontend under
`frontends.volcano.run` as the same site, so a page on another project's
frontend can call your routes with your visitors' cookies attached. Routed
responses also follow your project's function CORS settings, which allow any
origin unless you restrict them. A custom domain doesn't remove the need either,
because other subdomains of your domain are also the same site.

Do both of these, as the example does:

- Refuse any request whose `Sec-Fetch-Site` header isn't `same-origin`, or
  `none` for a page the visitor opened directly. Older browsers don't send the
  header; check that `Origin`, when present, is your own origin. This stops
  another site from reading responses such as `/me`.
- Check a CSRF token on every request that changes state, with a
  `__Host-csrf` cookie and an `X-CSRF-Token` header.

## Local mode

Routes work the same on the frontend URL Volcano returns in local mode, such as
`http://FRONTEND_ID.frontends.localhost:8080`. Chrome and Firefox accept
`Secure` and `__Host-` cookies over plain HTTP on `localhost` names; other
browsers may drop them, so test locally in one of those. A development server at
`http://localhost:3000` doesn't pass through Volcano, so proxy the route's path
to the local frontend URL if you keep using it.

## Limits and errors

A frontend can have up to 64 Function routes. `path_prefix` must start with
`/`, can't be `/` alone, can't end with `/`, and is at most 512 bytes.

| Status | Error | Fix |
| --- | --- | --- |
| `400` | `route path prefix is invalid` | Use a prefix like `/api/session` |
| `400` | `ingress routes support HTTP-mode Functions only` | Set `invocation_mode: http` on a standard function |
| `404` | `route resources do not exist in the Project` | Target a function and frontend of the same project |
| `409` | `Frontend Function routes require a public Function` | Make the function `public` first |
| `409` | `Frontend path is already routed` | Pick another prefix, or replace the existing route |
| `409` | `Frontend Function route limit reached` | Remove a route; the limit is 64 |
| `409` | `remove attached Frontend Function routes before making the function non-public` | Returned by a function update or redeploy; delete the routes first |
| `409` | `remove attached Frontend Function routes before changing invocation mode` | Returned by a function update or redeploy; delete the routes first |
