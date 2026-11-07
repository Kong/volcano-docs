---
title: 'Sharing and forking'
description: 'Share a project so anyone can fork their own copy as a Volcano project, and see how many people clicked and forked.'
---

A share lets anyone fork your project: deploy a copy of it as their own Volcano
project. You publish a release of the project to the share: a snapshot of the
functions and frontends you have deployed, which Volcano stores. Visitors fork
exactly that release. Deploying your project again changes nothing for them
until you publish again.

Any project can be shared, whether you deploy it from the CLI, the dashboard or
GitHub. A share's address, `https://volcano.dev/deploy/<id>`, carries only its id,
so it cannot be edited to point at other code. A fork never carries your data,
variable values, keys or sign-in settings.

Every request names its project with `project_id`, or names a share, release or
stat by the share's id, which its own project authorizes. A share of a project you
cannot use answers like one that does not exist.

## Create a share

```bash
curl -X POST "https://api.volcano.dev/shares" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "suggested_name": "notes-app", "description": "Notes that sync across devices."}'
```

`description` (optional, at most 280 characters on one line) is shown on the share's
page. `allow_reshare` (optional, off by default) lets people who fork the project share
their copy in turn.

```json
{
  "id": "k3Vn8TqPz0aX",
  "project_id": "5b6c1c9e-9a53-4f8e-8f55-0d2c7b6e2a10",
  "suggested_name": "notes-app",
  "description": "Notes that sync across devices.",
  "allow_reshare": false,
  "status": "active",
  "current_release": null,
  "created_at": "2026-10-19T21:12:00Z",
  "updated_at": "2026-10-19T21:12:00Z"
}
```

A new link is a draft. Its address answers `404` until you publish a release to
it. A project can have up to 20 shares.

## Publish a release

First review what a release would carry:

```bash
curl "https://api.volcano.dev/share-release-drafts?share_id=$SHARE_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "draft_id": "4f1d9c0e6a2b7f35c8e1d0a9b6f4c3e2a1d7b8c9e0f1a2b3c4d5e6f7a8b9c0d1",
  "functions": [
    { "name": "admin", "kind": "standard", "visibility": "private" },
    {
      "name": "api",
      "kind": "standard",
      "visibility": "public",
      "invocation_mode": "http",
      "http_auth_mode": "none",
      "variable_scope": "scoped",
      "variables": ["OPENAI_API_KEY"]
    }
  ],
  "frontends": ["web"],
  "variables": [{ "name": "OPENAI_API_KEY", "required": true, "secret": true }],
  "service_key_functions": ["admin"],
  "omissions": [{ "kind": "database", "resource": "main" }],
  "frontend_variables": { "web": [] }
}
```

The draft is built from what your project is serving now, and every request builds it
again: drafts and publishes together are limited to 30 an hour per account. It lists:

| Field                   | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft_id`              | Names exactly what a release built now would carry: each function's and frontend's current deployment, and everything else the draft lists. It changes when you redeploy a function or frontend or anything the draft lists changes, such as a function's HTTP authentication or OpenAPI document, a variable, or what a frontend receives. Rebuilding only a sandbox does not change it, since a release does not carry one. Send it when you publish. |
| `functions`             | The functions a release deploys, with their kind, visibility and invocation settings: `http_auth_mode` when it is not the default (`volcano`), where `none` lets anyone call the function in every copy without a credential; `openapi_spec_sha256`, the digest of its OpenAPI document; and `variable_scope` `scoped` with the `variables` it receives, when it receives only the ones it declares.                                                    |
| `frontends`             | The frontends a release deploys. They must be Next.js apps.                                                                                                                                                                                                                                                                                                                                                                                             |
| `variables`             | Your project's variables, which every copy gets, empty unless the visitor gives a value. Volcano's own are never listed.                                                                                                                                                                                                                                                                                                                                |
| `service_key_functions` | The functions whose code reads `VOLCANO_SERVICE_KEY`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `frontend_variables`    | The variables each frontend receives, by name, as your frontend of that name selects them now.                                                                                                                                                                                                                                                                                                                                                          |
| `omissions`             | What a release does not carry: databases, sandboxes, resources with no stored source, and any file the source holds that may carry credentials, such as dotenv and `.envrc` files, an `.npmrc` holding a registry credential, private keys, credential JSON and `*.tfvars`.                                                                                                                                                                             |

Then publish the draft you reviewed, naming its `draft_id` and confirming its
variables and the functions that receive the new project's service key. Both lists
must be exactly the draft's: every copy gets every variable, since leaving one out
would only break the code that reads it.

```bash
curl -X POST "https://api.volcano.dev/share-releases" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"share_id": "'"$SHARE_ID"'", "draft_id": "'"$DRAFT_ID"'", "variables": ["OPENAI_API_KEY"], "service_key_functions": ["admin"]}'
```

```json
{
  "id": "0b6c1f1e-4a55-4d6f-9c3e-5d2f7a1b9e10",
  "share_id": "k3Vn8TqPz0aX",
  "project_id": "5b6c1c9e-9a53-4f8e-8f55-0d2c7b6e2a10",
  "published_at": "2026-10-20T09:00:00Z",
  "published_by": "user_2a7f",
  "sha256": "9f2c...e41a",
  "size_bytes": 48211,
  "functions": [
    { "name": "admin", "kind": "standard", "visibility": "private" },
    { "name": "api", "kind": "standard", "visibility": "public" }
  ],
  "frontends": ["web"],
  "variables": [{ "name": "OPENAI_API_KEY", "required": true, "secret": true }],
  "service_key_functions": ["admin"],
  "omissions": [{ "kind": "database", "resource": "main" }]
}
```

The release becomes the link's current release in one step, so a visitor sees
either the previous release or this one. A release carries variable names, never
their values: each visitor enters their own.

`variables` and `service_key_functions` must both be exactly the draft's. The service key bypasses row-level security, so a function
receives it only when you confirm it here. If a fresh build is not the draft you
reviewed, or what you confirmed does not match it, nothing is published and the
answer is `409` with code `draft_changed` and the fresh draft in `draft`, with its
own `draft_id`. The `error` message names the confirmed variables the draft does
not have, the draft variables you left out, or the service key functions the draft
expects. It says the project changed when your confirmation matches the fresh
draft but its `draft_id` is not the one you sent: you redeployed or changed the
project since you reviewed the draft, or while the release was being built.
Review the draft and publish again.

```json
{
  "error": "The service key functions must be exactly the draft's: admin. Confirm from the draft and publish again.",
  "code": "draft_changed",
  "draft": {
    "draft_id": "4f1d9c0e6a2b7f35c8e1d0a9b6f4c3e2a1d7b8c9e0f1a2b3c4d5e6f7a8b9c0d1",
    "functions": [
      { "name": "admin", "kind": "standard", "visibility": "private" },
      { "name": "api", "kind": "standard", "visibility": "public" }
    ],
    "frontends": ["web"],
    "variables": [{ "name": "OPENAI_API_KEY", "required": true, "secret": true }],
    "service_key_functions": ["admin"],
    "omissions": [{ "kind": "database", "resource": "main" }],
    "frontend_variables": { "web": [] }
  }
}
```

A release carries no database. A visitor's project starts without one, and the
preview says so.

`GET /share-releases?share_id=…` pages a link's releases, newest first: 10 at a
time, or up to 100 with `limit`. While `has_more` is `true`, pass `next_cursor` back
as `cursor`, with the same `limit`, for the next page.

## Fork a share

A visitor opens the link and sees the release: when it was published, what it
creates and what it asks for. Nothing is created until the visitor signs in and
confirms.

```bash
curl "https://api.volcano.dev/share-previews/$SHARE_ID"
```

```json
{
  "id": "k3Vn8TqPz0aX",
  "suggested_name": "notes-app",
  "release": {
    "id": "0b6c1f1e-4a55-4d6f-9c3e-5d2f7a1b9e10",
    "published_at": "2026-10-20T09:00:00Z",
    "sha256": "9f2c...e41a",
    "frontends": ["web"],
    "functions": ["admin", "api"],
    "service_key_functions": ["admin"],
    "variables": [{ "name": "OPENAI_API_KEY", "required": true, "secret": true }],
    "omissions": [{ "kind": "database", "resource": "main" }]
  }
}
```

This request needs no credential. A link that does not exist, was switched off,
or has not been published all answer the same `404`, so a visitor cannot tell
which.

To fork it, the visitor creates a fork, naming the share and the release they
saw. `variables` is optional: every variable the release declares is created, and
one left out starts empty.

```bash
curl -X POST "https://api.volcano.dev/forks" \
  -H "Authorization: Bearer $VISITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "my-notes",
    "share_id": "k3Vn8TqPz0aX",
    "release_id": "0b6c1f1e-4a55-4d6f-9c3e-5d2f7a1b9e10",
    "variables": { "OPENAI_API_KEY": "sk-..." }
  }'
```

If you published another release since the visitor looked, the request answers
`409` with code `release_changed` and creates nothing. The visitor reads the
preview again, reviews the new release, and confirms again.

Send an `Idempotency-Key` header, a value you generate once per confirmation, so
the request is safe to retry: a repeat with the same key from the same account
answers `201` with the project the first request created. A repeat that arrives
while the first request is still running answers `409` with code
`request_in_progress` and a `Retry-After` header: wait that long and send it again. A
key reused for a different request answers `409` with code `idempotency_key_reused`.

The response is the new project, and installing the release is asynchronous:
poll the project until `template_installation.status` is `ready`.
`template_installation.source` names the share and the release that was installed.

```json
{
  "id": "7d7b2e0e-0c53-4d58-9a59-6f2f0c1f5e11",
  "name": "my-notes",
  "template_installation": {
    "status": "pending",
    "phase": "database",
    "source": {
      "kind": "share_release",
      "share_id": "k3Vn8TqPz0aX",
      "release_id": "0b6c1f1e-4a55-4d6f-9c3e-5d2f7a1b9e10"
    }
  }
}
```

The installed code runs in the visitor's project with the project's public keys,
its API address and its project id, and the service key only in the functions you
confirmed. Volcano checks the stored release against its `sha256` before it
installs it.

### When an install fails

A failed install keeps the project, with `template_installation.status` set to
`failed` and `failure_code` saying why:

```json
{
  "template_installation": {
    "status": "failed",
    "phase": "database",
    "failure_code": "source_withdrawn",
    "source": {
      "kind": "share_release",
      "share_id": "k3Vn8TqPz0aX",
      "release_id": "0b6c1f1e-4a55-4d6f-9c3e-5d2f7a1b9e10"
    }
  }
}
```

| `failure_code`                 | Meaning                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_withdrawn`             | The owner switched the link off or deleted it, is deleting its project, or their account no longer allows traffic, or the link is a copy that may no longer be shared. |
| `source_invalid`               | The stored release failed Volcano's checks: its digest, size or archive is wrong, or it holds other functions or frontends than the share listed.                      |
| `invalid_source_configuration` | The release's `volcano-config.yaml` is invalid, or declares a missing variable.                                                                                        |
| `function_deploy_refused`      | A function in the release cannot be deployed as defined.                                                                                                               |
| `function_quota_exceeded`      | The visitor's plan allows no more functions. Other plan limits have their own codes.                                                                                   |
| `build_failed`                 | A function or frontend from the release failed to build or deploy in the visitor's project. Its deployment's build logs say why.                                       |
| `retry_budget_exhausted`       | The install kept failing and Volcano stopped retrying.                                                                                                                 |
| `internal_error`               | Volcano failed for a reason of its own.                                                                                                                                |

[Failed installs](templates.md#failed-installs) lists every code. New codes can be
added, so show a generic message for one you do not know.

### Variables the release declares

A visitor does not have to send any values. Every listed variable is created in
the new project; one the visitor leaves out of `variables`, or
sends empty, is created empty for them to set later. A name the preview did not
list answers `422` with code `variable_not_declared`, and nothing is created. Each
listed variable's `required` is always `true`: it means the project always gets
the variable, never that a value must be given. Each value is at most 4096
bytes of UTF-8, so a value in a non-Latin script holds fewer characters; a longer
one, or one containing a NUL character, answers `400`. The values become the new
project's variables before anything is installed, and are never logged or counted
in the link's statistics.

Each variable reaches the same code in the copy as in your project. A function
gets it as yours does, and a frontend gets the variables your frontend of that
name was given, by its variable scope when you published, so a secret only one
function uses does not reach a frontend's runtime.

## Manage shares

| Request                     | Does                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `GET /shares?project_id=…`  | Lists the project's shares, newest first.                                           |
| `GET /shares/{share_id}`    | Returns one share, with its current release.                                        |
| `PATCH /shares/{share_id}`  | Changes `suggested_name`, `description`, `allow_reshare` or `status`.               |
| `DELETE /shares/{share_id}` | Deletes the share, its releases and its recorded events. The address stops working. |

Switch a link off, and on again, with `status`:

```bash
curl -X PATCH "https://api.volcano.dev/shares/$SHARE_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "disabled"}'
```

You can always switch a link off: even while deploy links are not available in
an environment, and while your account is read-only. You can also always turn
re-sharing off with `allow_reshare` `false`, alone or with a switch-off. While your
account is read-only these are the only changes you can make to a link: switching it
off does not stop copies made from it being shared again, so turning re-sharing off
is how you withdraw that too. Switching a link off or deleting it also
stops the installs it started that have not finished, including ones
still waiting to run. Each fails at its next step, and so does an install from a
link whose project you are deleting. The visitor keeps the project, with its
installation failed and `failure_code` set to `source_withdrawn`. Publishing a
new release does not stop installs of an earlier one. Switching the link back on lets only installs that have not
failed yet go ahead.

A share's `disabled_reason` says why it is off: `owner` when you switched it off,
and `operator` when Volcano took it down, for example after an abuse report. More
reasons may be added, so treat an unknown one as off. You cannot switch a share
Volcano took down back on, or delete it (`403` with code `operator_disabled`);
you can still edit it, and deleting its project still removes it. While it is
down, you cannot share that project any more: creating a share, reviewing a
draft, publishing, switching a share on and allowing re-sharing all answer `403`
with code `operator_disabled`. The project's other shares that are already
published keep working. No project made from it, or from a copy of it, can be
shared either, including copies you made yourself. Contact support if you think
a take-down is a mistake.

Creating, editing, publishing and deleting links is a person's decision: a
project access token can read links and releases, but not change them.

### Copies and re-sharing

A project made from a link is a copy. Its owner cannot share it with a deploy
link of their own unless your link allows it with `allow_reshare`, which is off
by default. The rule follows the whole chain: a copy of a copy needs every link
it came through to allow re-sharing. A copy you make from your own link is not
blocked by that link, but it is by any earlier link in its chain, owned by someone
else, that does not allow re-sharing.

Volcano reads `allow_reshare` at every request. Switching it off, or deleting the
link, stops the copies made from it from sharing again, including links of
theirs that are already on: their pages answer like a link switched off, a
visitor cannot create a project from them, and installs from them that have not
finished fail with `source_withdrawn`. A copy's owner who tries to switch such a
link on, create one, draft or publish gets `403` with code `reshare_not_allowed`.
They can always switch it off. A copy made from a share that is not available to
share from right now, or from a copy of one, is stopped the same way and gets
code `source_unavailable` instead.

A share's `serving` says whether its address serves its release right now. A
share can be `active` and not serving: while it has no release yet, while
sharing is not available in this environment, while its project is being deleted
or your account does not allow traffic, or when the project is a copy that may no
longer be shared. Switching such a share on again
changes nothing until that is resolved, and `serving` stays `false`.

Re-sharing control records your consent; it does not keep your code secret. A
copy's owner has the code, and can export it to a repository and start a new
project from that, which is not a copy.

## Click and fork counts

```bash
curl "https://api.volcano.dev/share-stats?share_id=$SHARE_ID&days=30" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "since": "2026-09-19T00:00:00Z",
  "totals": [
    { "kind": "click", "events": 42, "visitors": 31 },
    { "kind": "confirm", "events": 9, "visitors": 9 },
    { "kind": "ready", "events": 8, "visitors": 0 }
  ],
  "daily": [{ "day": "2026-10-18", "kind": "click", "events": 17 }]
}
```

The counts are for information only. Visitors are counted from a salted hash, so
the counts hold no address. Link previews and crawlers are not counted as clicks.
Events are counted per day in UTC, so `since` is the midnight UTC the window
reaches back into. Events are kept for 90 days, so a `days` above 90 is rejected
with `400`.

## Where sharing is not available

Sharing is not on in every environment. Where it is off, listing, reading,
deleting and getting the counts of existing shares still work, a share can still
be switched off, and re-sharing can still be turned off with `allow_reshare`
`false`. A `PATCH` that sends back the values the share already has changes
nothing and still answers `200`. Everything else answers with code
`feature_unavailable`:

| Request                              | Status |
| ------------------------------------ | ------ |
| Create a share                       | `404`  |
| Edit a share, or switch it on        | `400`  |
| Review a draft, or publish a release | `404`  |
| Preview a share                      | `404`  |
| Fork a share                         | `404`  |

`GET /capabilities` reports whether sharing is available, as the `shares`
capability. A local server has sharing off: it stores no deployed source, so it
has nothing to publish.

## Errors

| Status | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | The suggested name is invalid, a share id or `project_id` is malformed or missing, or a fork request is missing its name, share or release, or a releases page's `limit` or `cursor` is invalid. Code `edit_dropped`: the share was switched off, or while your account is read-only its re-sharing was turned off, but the other edit sent with it was not saved.                                                                                                                                                                                                                                                                              |
| `401`  | A request that needs an account has none. A `401` is only ever about your own session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `403`  | A project access token was used where only a person may, or, when creating a project, your plan does not allow what the release deploys. Code `proxy_credential_rejected`: the dashboard proxy's visitor headers came without a valid proof. Code `reshare_not_allowed`: the project is a copy whose source does not allow re-sharing. Code `source_unavailable`: the project is a copy, and a share it was made from is not available to share from right now. Code `operator_disabled`: Volcano took a share of the project down, so that share cannot be switched back on or deleted, and the project cannot be shared until that is lifted. |
| `404`  | The project, share or release does not exist, or is not one you can use, such as another account's project or share. When previewing or forking a share, it was switched off, has not been published, or belongs to a copy that may no longer be shared; the answer is the same either way.                                                                                                                                                                                                                                                                                                                                                     |
| `409`  | The project has 20 shares already. `draft_changed`: a fresh draft is not the one you reviewed (its `draft_id` differs), or what you confirmed does not match it; the message says what differs. When creating a project, `release_changed`: the share has a new release; `request_in_progress`: a request with the same `Idempotency-Key` is still running, retry after `Retry-After`.                                                                                                                                                                                                                                                          |
| `422`  | The project cannot be released as it is: nothing deployed has stored source, a function's settings would be refused, the project has more than 100 variables or more than 100 functions reading `VOLCANO_SERVICE_KEY`, or the release is too large. When creating a project, `variable_not_declared`, or `variables_required`: the release declares variables Volcano could not set up, so ask the person who shared it to share it again.                                                                                                                                                                                                      |
| `429`  | Too many requests. A preview is limited per address, and projects started from links to 20 an hour per account. Code `release_builds_limited`: drafts and publishes are limited to 30 an hour per account. `Retry-After` says how many seconds remain in the hour.                                                                                                                                                                                                                                                                                                                                                                              |
| `451`  | Volcano cannot serve requests from the visitor's location under US sanctions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `503`  | Code `service_unavailable`: the dashboard's own project is not being served right now. Code `feature_paused`: durable functions are paused and the release has one. Code `rate_limit_unavailable`: Volcano cannot count creates from links right now, so none is started; retry after `Retry-After`. Code `builds_busy`: release builds are busy, so a draft or publish was not built; retry after `Retry-After`.                                                                                                                                                                                                                               |
