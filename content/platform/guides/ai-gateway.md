---
title: 'AI gateway'
description: 'Give an agent run a capped, expiring run token for the Volcano AI gateway instead of a model provider key.'
---

The Volcano AI gateway calls models on your project's behalf. Your backend
holds an AI key; for each run of an agent, it mints a run token that names the
models the run may call, caps what it may spend, and expires. The worker gets
the run token, never a provider key.

Volcano pays the model provider for these calls, and your project isn't
billed for them. The gateway measures each call at list price, counts it
against the run token's cap, and records it for Volcano's internal analytics
only. The caps are safety limits against a runaway run, not plan limits.

The gateway is in preview. Where the `ai_gateway` capability in
[`GET /capabilities`](../api-reference/overview.md) is unavailable, creating an
AI key and minting the first token of a run answer `404` with code
`feature_unavailable`. Runs already minted for keep working.

For now only registered first-party apps, such as the Volcano Builder, mint
run tokens. An AI key on any other project can be created, but minting with it
answers `403` with code `first_party_app_required`.

## Create an AI key

A person creates the AI key, signed in to the dashboard or with `volcano login`.
See [Create an AI key](../authentication/security/service-keys.md#create-an-ai-key).
Keep it on your backend: anyone holding it can mint run tokens that call
models on Volcano's account.

## Models

A run token may name these models:

| Model               |
| ------------------- |
| `claude-fable-5-1`  |
| `claude-opus-5-5`   |
| `claude-sonnet-5-5` |
| `claude-haiku-5-5`  |

OpenAI models have list prices, but the gateway doesn't forward calls to
OpenAI yet, so a mint that names one answers `400` with code
`model_not_offered`.

## Mint a run token

```bash
curl -X POST "https://api.volcano.dev/ai/tokens" \
  -H "Authorization: Bearer $VOLCANO_AI_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "run_ref": "run_01J8ZQ4M1V",
    "models": ["claude-sonnet-5-5"],
    "spend_cap_micro_usd": 20000000,
    "ttl_seconds": 900,
    "delegated_grant_id": "3c9e1f4a-7b2d-4e6f-8a1c-5d0b9e2f7a34",
    "generation": 0,
    "labels": { "attempt": "1" },
    "replace": true
  }'
```

Response (`201`):

```json
{
  "id": "0b7f3c1e-5a2d-4e8f-9c6b-1d2e3f4a5b6c",
  "project_id": "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d",
  "minting_key_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "run_ref": "run_01J8ZQ4M1V",
  "subject_project_id": "6f1c2a8e-3b7d-4c55-9a0e-2d4f8b1c7e90",
  "subject_user_id": "user_42",
  "labels": { "attempt": "1" },
  "models": ["claude-sonnet-5-5"],
  "spend_cap_micro_usd": 20000000,
  "spent_micro_usd": 0,
  "reserved_micro_usd": 0,
  "in_flight": 0,
  "max_concurrency": 4,
  "expires_at": "2026-11-11T21:15:00Z",
  "max_expires_at": "2026-11-12T05:00:00Z",
  "created_at": "2026-11-11T21:00:00Z",
  "updated_at": "2026-11-11T21:00:00Z",
  "token": "vgt_..."
}
```

`token` is returned once. Volcano stores only its SHA-256.

| Field                 | Required | Meaning                                                                                                                                                                                                                   |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run_ref`             | Yes      | Your name for the run, up to 200 bytes. A run is a `run_ref` of one customer project. `replace` acts on the run's tokens; revoking by `run_ref` acts on it in every customer project.                                     |
| `models`              | Yes      | 1 to 16 models the token may call. Each needs a list price and a provider the gateway forwards to, which today is Anthropic only, and the gateway must offer it, or the mint answers `400` with code `model_not_offered`. |
| `spend_cap_micro_usd` | Yes      | The most the token may spend at list price, in millionths of a US dollar. At most `150000000` ($150).                                                                                                                     |
| `ttl_seconds`         | Yes      | How long the token lives, 60 to 28800 seconds.                                                                                                                                                                            |
| `max_concurrency`     | No       | The most calls in flight at once, 1 to 4. Defaults to 4.                                                                                                                                                                  |
| `delegated_grant_id`  | Yes      | The run's live delegated grant. See below.                                                                                                                                                                                |
| `generation`          | Yes      | The run generation the grant was minted for.                                                                                                                                                                              |
| `labels`              | No       | Up to 16 tags. Keys are lowercase letters, digits, `_`, `.` and `-`, up to 64 bytes; values up to 256 bytes.                                                                                                              |
| `replace`             | No       | Revoke the run's other live tokens in the same step, so the new token is its only one. Without it a run may hold several.                                                                                                 |

A token belongs to the AI key's project. Deleting the AI key deletes the
tokens it minted, which stops them at once. What their calls cost still
counts against each run's $150, and each run stays minted for: another AI key
of the project can mint for it again while the gateway is unavailable.

Every mint names the run's live delegated grant in `delegated_grant_id` (the
grant's `token_id`) and `generation`. The grant's run key must equal
`run_ref`. The token's `subject_project_id` and `subject_user_id`, which every
call's usage carries, are copied from the grant and its consent; a request
that sets them answers `400`, and one that names no grant answers `400` with
code `delegated_grant_required`. A run is a `run_ref` of one customer project:
the same `run_ref` in another customer project is another run, with its own
tokens and its own $150. Every token of a run carries the same subject, so a
later mint for the run, `replace` included, must name a grant for the same
person. A grant that is unknown or another app's, revoked or expired, or for
another run or generation answers `409` with code `delegated_grant_not_found`,
`delegated_grant_not_live` or `delegated_grant_mismatch`. The token outlives
the grant's 15-minute lifetime; revoke the run's tokens when you revoke its
grants.

A run gets $150 in all, however many tokens it mints. A new token's cap is
`spend_cap_micro_usd` cut to $150 less what the run's other tokens count: what
each spent and still holds for calls in flight, and for a live token its whole
cap. The response shows the cap the token got. When nothing is left, the mint
answers `402` with code `budget_exhausted`. The 8-hour lifetime is per token.

## Call a model

The gateway speaks Anthropic's Messages API. Point an Anthropic SDK at
`https://api.volcano.dev/ai/anthropic` and give it the run token as its API
key:

```bash
curl -N "https://api.volcano.dev/ai/anthropic/v1/messages" \
  -H "x-api-key: $RUN_TOKEN" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-5-5",
    "max_tokens": 1024,
    "stream": true,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

`Authorization: Bearer $RUN_TOKEN` works too. The request goes to Anthropic
with Volcano's key and the response comes back byte for byte, streamed or not,
except that an `error` event in a stream is rebuilt like an error body (below).
Of Anthropic's response headers, only `Content-Type` and `Retry-After` come
back. The request is unchanged, except that one leaving `service_tier` out gets
`"service_tier": "standard_only"`, so no call runs at a tier priced above list.

Each call reserves its worst case against the token's cap before it starts:
its estimated input at the model's dearest input price plus `max_tokens` at its
output price. The input estimate is a token per four characters of text, and
1,600 tokens per image whatever its size. When it ends, the call counts its list price for what it
used, split into uncached input, cache reads, 5-minute and 1-hour cache
writes, and output. A stream cut off before its end counts the input
Anthropic reported and the output sent so far. A streamed call that ends
before Anthropic answers, for example because the caller left, counts its
estimated input and no output. A call that doesn't stream gets its answer
only after Anthropic has generated all of it, so one cut off before or during
its answer counts its whole reservation. A call can end a little over the cap;
the next one is then refused.

A call ends after 30 minutes, or after 15 minutes when it doesn't stream: a
non-streamed answer sends nothing until it is done, and the load balancer
closes a connection that is idle for longer. Stream a longer generation.

The gateway refuses, before calling Anthropic, a request that:

- has no `max_tokens`, one over 1,000,000, or names a model the token doesn't;
- sends any `anthropic-beta` header;
- uses `mcp_servers`, `container`, `fallbacks`, or a server tool such as web
  search, web fetch or code execution (tools you define, and `bash` and
  `text_editor` tools, are fine);
- sets `service_tier` other than `standard_only`, `speed` other than
  `standard`, or `inference_geo` other than `global`;
- sends a `document` block, in a message or a tool result, whose source is a
  PDF or a URL. Its cost depends on pages the gateway can't see, so it can't
  reserve for it. Send the document's text instead. A content block the
  gateway can't read is refused too, since it could hide one;
- gives a key the gateway reads (in the body, a message, a content block, a
  block's `source`, or a tool) twice, or in another case such as `"Model"`;
- nests content more than four levels deep: a message's content, a tool
  result in it, a block in that, and one more level.

Errors come back in Anthropic's shape, `{"type":"error","error":{"type":...,"message":...}}`:

| Status | `error.type`            | Meaning                                                                                                                                                            |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | `invalid_request_error` | The request policy refused it, or the token doesn't name the model                                                                                                 |
| `401`  | `authentication_error`  | No run token, or one that is unknown, revoked or expired                                                                                                           |
| `402`  | `budget_exhausted`      | What the token spent plus this call's reservation is over the cap. Stop the run; don't retry                                                                       |
| `404`  | `feature_unavailable`   | This server has no model provider configured                                                                                                                       |
| `413`  | `request_too_large`     | The body is over 16 MiB                                                                                                                                            |
| `429`  | `rate_limit_error`      | The token already has `max_concurrency` calls in flight, counting calls still sending their body, or calls in flight hold the rest of the cap. Retry when one ends |
| `502`  | `api_error`             | Anthropic couldn't be reached, or the call ended before it answered                                                                                                |
| `503`  | `api_error`             | The server is shutting down. Retry the call                                                                                                                        |

A token's calls also need its project to take traffic. While the project's
owner is suspended or on hold, a call answers the shared `503` described in
[Unavailable responses](unavailable-responses.md), in Volcano's shape rather
than Anthropic's, before its body is read.

Errors Anthropic returns, such as `529 overloaded_error`, come back with
Anthropic's status, error type and message, and cost nothing. Volcano's account
and request IDs are taken out of the message, and nothing else of the body
comes back. An `error` event in a stream is rebuilt the same way.

A server that shuts down while a call streams cuts it after about a minute,
and at once when the caller stopped reading. The call counts as a cut
stream. A call the shutdown cuts before Anthropic answers gets `503
api_error`; retry it.

## Extend a token or change its cap

Extend the token while the run is alive, for example on each worker heartbeat:

```bash
curl -X PATCH "https://api.volcano.dev/ai/tokens/$TOKEN_ID" \
  -H "Authorization: Bearer $VOLCANO_AI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ttl_seconds": 900}'
```

An extension moves `expires_at` to `ttl_seconds` from now. It never shortens
the token and never goes past `max_expires_at`, 8 hours after the mint. A run
that outlives that mints a new token for the same `run_ref`.
`spend_cap_micro_usd` sets a new cap, cut to what the run has left of its
$150. A cap below what the token already spent is allowed; its next call is
refused. When the run has nothing left, the change answers `402` with code
`budget_exhausted`.

A revoked or expired token stays dead: changing it answers `409` with code
`token_revoked` or `token_expired`, before the run's cap is read. Mint a new
one.

## Revoke tokens

Revoke one token:

```bash
curl -X DELETE "https://api.volcano.dev/ai/tokens/$TOKEN_ID" \
  -H "Authorization: Bearer $VOLCANO_AI_KEY"
```

Or every live token of a `run_ref`, in every customer project:

```bash
curl -X POST "https://api.volcano.dev/ai/tokens/revoke" \
  -H "Authorization: Bearer $VOLCANO_AI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"run_ref": "run_01J8ZQ4M1V"}'
```

```json
{ "revoked": 1 }
```

A revoked token's next call is refused. Read a token, with what it spent, with
`GET /ai/tokens/{tokenId}`; its value is never returned again.

## Who can call these routes

Only an AI key. A run token is refused, so a worker holding one can't extend it
or raise its cap. Any other service key, including one that holds `*`, and
platform and project access tokens are refused too:

| Credential                                        | Response                      |
| ------------------------------------------------- | ----------------------------- |
| AI key                                            | Served                        |
| Another service key                               | `403`, code `ai_key_required` |
| Run token, platform or project access token, none | `401`                         |

A token another project's key minted answers `404`, the same as one that
doesn't exist.
