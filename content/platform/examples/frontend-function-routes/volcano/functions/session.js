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
