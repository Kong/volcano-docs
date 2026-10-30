---
title: Petstore API from its OpenAPI spec
description: Turn the Swagger Petstore OpenAPI spec into a live API on Postgres, with public reads, signed-in writes and row-level security, then test it in Insomnia.
tags:
  - openapi
  - rest-api
  - database
  - functions
  - auth
  - row-level-security
  - insomnia
---

Tested on Volcano CLI 0.54.0, Node 24.9.0, pg 8.23.1; last verified 2026-10-30 on CLI 0.54.0.

## What it does

You have an OpenAPI spec, or you're learning with the Swagger Petstore one, and want a real API behind it to call from Insomnia, without hand-writing the backend. Your coding agent builds the `pet` endpoints on Postgres and deploys them to Volcano. Reads are public; only a pet's creator can change or delete it.

![Swagger UI with the Petstore spec pointed at the deployed function URL: GET /pet/findByStatus?status=available answers 200 with the seeded pets, starting with Biscuit and Mochi](/cookbooks/petstore-api.png)

## What you need

- A Volcano account ([sign up](https://volcano.dev/signup)).
- Claude Code, Codex or Cursor with the Volcano skills (`volcano setup`).
- Insomnia 12 or later.

## Build it with your coding agent

Paste this into your agent in an empty folder:

```text
Build the Swagger Petstore API in this empty folder and deploy it to Volcano.

The spec is https://petstore3.swagger.io/api/v3/openapi.json. I will import that same spec into Insomnia and point it at your URL, so match its paths, parameters, JSON shapes and status codes exactly, under the spec's /api/v3 prefix.

- Implement the pet operations: POST /pet, PUT /pet, GET /pet/findByStatus, GET /pet/findByTags, GET /pet/{petId}, POST /pet/{petId} (name and status as query parameters) and DELETE /pet/{petId}. Leave out uploadImage, store and user. JSON only.
- Store pets in a Postgres table on Volcano. Pet ids are integers the database assigns. Seed five or six pets with a mix of statuses, so the first GET returns rows.
- Serve it from one public Volcano Function in HTTP mode, with http_auth_mode none, so GET requests work with no Authorization header.
- Reads are public. POST, PUT and DELETE need "Authorization: Bearer <access token>" from a Volcano email and password sign-in; without a valid token answer 401.
- A pet belongs to the user who created it. Only that user can update or delete it: answer 403 when the pet exists but belongs to someone else. Enforce this with row-level security, so the database refuses another user's change even if the function code is wrong. Run writes as the signed-in user, never with a full-access connection. Seeded pets belong to no one.
- Refuse bad input with 400 or 422 before touching the database: name at most 100 characters, at most 10 photoUrls and 10 tags, status one of available, pending, sold. Allow at most 100 pets per user, enforced in the database.

Create a new Volcano project named petstore-api, deploy to production and give me the base URL to put in Insomnia (ending in /api/v3), plus the exact sign-in request that returns a token. Before you finish, test the live API: GET /pet/findByStatus?status=available with no header returns seeded pets; POST /pet with no token gets 401; sign up two throwaway users; user A creates a pet; user B can't update or delete it (and it is unchanged afterwards); user A can.
```

Tested with Claude Code 2.1.314 (claude-opus-5-5) and Codex CLI 0.163.0, each with Volcano plugin 0.2.47. Both worked on the first try and passed all ten smoke checks. Claude Code took 14 minutes and $1.81. Codex took 8 minutes.

## Build it yourself

The API is one Volcano Function in HTTP mode. With `http_auth_mode: none`, requests reach it with their `Authorization` header and the function decides what needs a token:

```yaml
# volcano/volcano-config.yaml
version: 1
functions:
  - name: petstore
    visibility: public
    invocation_mode: http
    http_auth_mode: none
```

Ownership lives in the table. Seeded rows have no owner, so nobody can change them:

```sql
CREATE TABLE IF NOT EXISTS pets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    category JSONB,
    photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT CHECK (status IS NULL OR status IN ('available', 'pending', 'sold')),
    owner_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY pets_select_all ON pets FOR SELECT USING (true);
CREATE POLICY pets_insert_own ON pets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
CREATE POLICY pets_update_own ON pets FOR UPDATE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY pets_delete_own ON pets FOR DELETE USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());
```

A write checks the token, then sends the change to the database API with that token, so the policies run as that user:

```js
const res = await fetch(`${API_URL}/auth/user`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) return { statusCode: 401, body: JSON.stringify({ code: 401, type: "error", message: "Unauthorized" }) };

await fetch(`${API_URL}/databases/app/query/update`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ table: "pets", values, filters: [{ column: "id", operator: "eq", value: id }] }),
});
```

Reads use a Postgres connection as the `anon` role. Its connection string, `DATABASE_READ_URL`, holds the database password: keep it in `volcano/cloud.env` only, never in the repo or a client. To deploy by hand:

```sh
volcano init javascript
volcano projects create petstore-api
volcano use petstore-api
volcano cloud databases create app --region us-east-1 --pg-version 16
volcano cloud databases get app --show-connection-string   # into volcano/cloud.env as DATABASE_READ_URL
volcano cloud deploy --env-file volcano/cloud.env --with-migrations -d app
volcano cloud functions get petstore   # base URL: invoke_url + api/v3
```

## Check that it works

1. In your Insomnia project, click **Import**, choose **Url**, paste `https://petstore3.swagger.io/api/v3/openapi.json`, click **Scan**, then **Import**.
2. The spec's server is the relative `/api/v3`, so the imported `base_url` is built from `scheme`, `host` and `base_path` in the **OpenAPI env** environment. Set `scheme` to `https` and `host` to your function's host, such as `<function-id>.functions.volcano.run`. Leave `base_path` as `/api/v3`.
3. Every imported pet request carries the spec's OAuth 2.0 auth, which would start a sign-in flow at petstore3.swagger.io. Open **Finds Pets by status.**, set its auth to **None**, tick the `status` parameter (`available`) and send. You get `200` and the pets your agent seeded, each shaped like the spec's `Pet`.
4. Get a token with the anon key from `volcano projects keys anon list`. Send this to `/auth/signup` once to create the account (passwords need 15 characters by default), then to `/auth/signin`:

   ```http
   POST https://api.volcano.dev/auth/signin
   Authorization: Bearer <anon key>
   Content-Type: application/json

   {"email": "you@example.com", "password": "a-long-password-123"}
   ```

   Copy `access_token`. It lasts an hour.
5. Open **Add a new pet to the store.**, set its auth to **Bearer Token** with that token and send the generated body: `200` and the new pet with the id the database gave it. With auth set to **None**: `401`.

## Why it's built this way

An OpenAPI spec pins down paths and shapes but says nothing about who may change what. When this recipe was built, petstore3.swagger.io accepted a `POST /pet` and a `DELETE /pet/{petId}` with no credentials at all: fine for a sandbox, wrong for anything with users. Ownership is the rule to spell out in the prompt and put in the database, where it holds however the function code changes. Both test runs got the spec's shapes right unaided; the two-user check is what proved ownership.

Where the API deviates from the spec:

- Auth: a Volcano access token as a bearer token on writes and nothing on reads, in place of the spec's OAuth 2 `petstore_auth` and `api_key` header.
- Extra statuses: `401`, `403`, and `404` on `POST` and `DELETE /pet/{petId}`. `DELETE` returns an empty body.
- JSON only, no XML or form bodies. `POST /pet` ignores any `id` in the body.
- No `uploadImage`, `store` or `user`. `user` would duplicate Volcano auth.

Other notes:

- Volcano's database API needs a signed-in session even for a public read, so reads use the [direct connection with `application_name=volcano_user_access`](/platform/databases/direct-connection#authentication--user-impersonation). Codex instead signed the function in as an anonymous user: no password, but anonymous sign-ins on project-wide.
- An Express app on Fly or Render with Postgres, or a Cloudflare Worker with D1, works too, with the ownership check and the user store in your code.
- The first request after a deploy or an idle spell took 7 to 10 seconds, warm requests about 0.55 seconds.
- Migrations are one statement per file and rerun on every deploy, so each `CREATE POLICY` follows a `DROP POLICY IF EXISTS`.
