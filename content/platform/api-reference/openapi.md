---
title: "OpenAPI specification"
description: "Fetch Volcano's machine-readable API description to generate a client, import the API into a REST client, or check your integration against the contract."
---

Volcano publishes a machine-readable description of this API. Fetch it and you can generate a client, load every endpoint into a REST client, or check an integration against the contract instead of against prose.

```bash
curl -O https://api.volcano.dev/openapi.yaml
```

JSON is served from the same document:

```bash
curl -O https://api.volcano.dev/openapi.json
```

Neither needs a credential. Both describe the whole public API, which is the same surface this reference documents page by page.

## What you get

A self-contained OpenAPI 3.0 document: every schema it references is inside it, so a generator or validator can read it on its own with nothing else downloaded.

It is the same description the API validates incoming requests against. A client generated from it cannot expect a different shape than the one that will answer — if a field is required here, the server requires it.

## Generate a client

Any OpenAPI generator works. For example, with [OpenAPI Generator](https://openapi-generator.tech):

```bash
curl -O https://api.volcano.dev/openapi.yaml

openapi-generator generate \
  -i openapi.yaml \
  -g python \
  -o ./volcano-client
```

Swap `-g python` for `typescript-axios`, `go`, `ruby`, or any other supported target.

Before you generate, check whether an [official SDK](/sdk) already covers what you need. The SDKs handle token refresh, retries, and realtime subscriptions, none of which a generated client gives you.

## Import into a REST client

Postman, Insomnia, Bruno, and Hoppscotch all import an OpenAPI document directly — point them at `https://api.volcano.dev/openapi.yaml` and every endpoint appears with its parameters and response shapes.

Then set one variable for your token and you can call the API without writing a request by hand. See [Using the API](using-the-api.md) for which token type to use.

## Lint the specification

`redocly lint` checks the document itself: that it parses, that every reference resolves, and that it conforms to OpenAPI.

```bash
npx @redocly/cli lint openapi.yaml
```

Worth running in CI on the fetched copy, so a description your generator cannot consume fails there rather than halfway through a build. It reads only the document — it sends no request and sees no response, so it cannot tell you whether a call you make still returns the fields you use.

## Keeping up with changes

The document changes when the API does, so fetch it rather than vendoring it indefinitely.

Responses carry a strong `ETag`. Send it back and an unchanged document costs you a `304` instead of several hundred kilobytes:

```bash
# First fetch: note the ETag
curl -sD - -o openapi.yaml https://api.volcano.dev/openapi.yaml | grep -i etag

# Later: 304 Not Modified if nothing changed
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'If-None-Match: "THE_ETAG_YOU_SAW"' \
  https://api.volcano.dev/openapi.yaml
```

`HEAD` works on both URLs too, if you only want to read the current `ETag`.

Ask for compression and the document arrives about seven times smaller:

```bash
curl -sS --compressed -o openapi.yaml https://api.volcano.dev/openapi.yaml
```

The compressed and uncompressed forms carry different `ETag` values, because
they are different representations. Send back the one you were given.

### Rate limit

One address may fetch the specification 30 times a minute. Past that the
endpoint answers `429` with a `Retry-After` telling you when to come back.

The limit is generous for the things this endpoint exists for — generating a
client, importing into a REST client, a contract test in CI — and you will not
reach it at all if you revalidate with `If-None-Match` instead of re-fetching a
document you already have.

## What's next

| Reference | Description |
|-----------|-------------|
| [Using the API](using-the-api.md) | Create a token and run a real workflow with it |
| [Overview](overview.md) | Base URL, request and response format, pagination |
| [Authentication](authentication.md) | Which token type each endpoint accepts |
| [Errors](errors.md) | Error codes and how to handle them |
