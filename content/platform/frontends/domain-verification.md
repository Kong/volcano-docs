---
title: "Verify domain ownership"
description: "Prove your account owns a domain once with a TXT record, then attach any hostname below it to your frontends."
---

A frontend serves a custom domain only for the account that owns it. Verify a
domain once with a DNS TXT record, and your account owns it and every name below
it. You can then attach `example.com`, `app.example.com`, or
`staging.app.example.com` to any frontend in any of your projects, with managed
or BYOC TLS, without another record.

```bash
curl -X POST "https://api.volcano.dev/user/domains" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'
```

## Verify a domain

1. Request verification. Until DNS serves your record, Volcano answers
   `409 Conflict` with the record to publish:

   ```json
   {
     "error": "ownership of example.com is not verified",
     "code": "ownership_verification_required",
     "required_record": {
       "name": "_volcano.example.com",
       "type": "TXT",
       "value": "volcano-domain-verification=6f0d3c1b9e2a47d58c4b1a0e9f3d2c7b"
     }
   }
   ```

2. Publish the record with your DNS provider:

   ```text
   _volcano.example.com.  TXT  "volcano-domain-verification=6f0d3c1b9e2a47d58c4b1a0e9f3d2c7b"
   ```

3. Repeat the request. Volcano returns `201 Created`:

   ```json
   {
     "domain": "example.com",
     "verified_at": "2026-10-07T14:03:11Z"
   }
   ```

   A domain your account already owns returns `200 OK`.

Publish the record at the name itself. Volcano ignores a TXT record reached
through a CNAME, including a wildcard CNAME, because the CNAME's target may
belong to someone else.

The value depends on your account and the domain, so it proves nothing for
another account or another domain. It never changes, so the record stays valid
for as long as you keep it published.

You can also skip this step. Attaching a hostname that nobody owns returns the
same `409` and `required_record`, for the hostname's registrable domain:
`example.com` for `app.example.com`, and `example.co.uk` for
`app.example.co.uk`. A managed TLS domain instead reserves the hostname and
reports the record in `verification_records`; the reservation proceeds once the
record is published. See [Custom domains](overview.md#custom-domains).

## Verify a subdomain

Verify a subdomain such as `team.example.com` when only that part of your DNS is
yours to change. The most specific verified domain owns a hostname, so another
account that verifies `team.example.com` owns `app.team.example.com`, while
`app.example.com` stays with whoever verified `example.com`. Only whoever runs
the `example.com` zone, or a zone delegated from it, can publish
`_volcano.team.example.com`, so the zone's operator decides who owns the
subdomain.

Volcano refuses public suffixes such as `com`, `co.uk`, or `github.io`, where
names belong to unrelated owners.

## List and remove verified domains

```bash
curl "https://api.volcano.dev/user/domains" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "domains": [
    { "domain": "example.com", "verified_at": "2026-10-07T14:03:11Z" }
  ]
}
```

```bash
curl -X DELETE "https://api.volcano.dev/user/domains/example.com" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Removing a domain returns `204 No Content`. Custom domains already attached
below it keep serving; attaching another one needs a new verification. Closing
your account removes its verified domains.

## Move a domain to another account

A domain moves when DNS changes hands, such as after a sale or when a team
consolidates accounts. The new account publishes its own `_volcano` record and
verifies the domain. Volcano moves the domain only when DNS serves the new
account's record and no longer serves the old one:

| DNS serves | Result |
| --- | --- |
| Only the new account's record | The domain moves to the new account. |
| Both accounts' records | `409 Conflict`: remove the old account's record first. |
| Only the old account's record | `409 Conflict` with the new account's `required_record`. |

Custom domains the old account already attached keep serving until it removes
them. While the lookup of the old account's record fails, Volcano answers
`503 Service Unavailable` instead of guessing; retry later.

## Volcano's own domains

Volcano owns its own domains, including `volcano.dev` and `volcano.run`. No
account can verify them or attach a hostname below them.

## Errors

| Status | Meaning |
| --- | --- |
| `400` | The domain is not a valid hostname, or it is a public suffix. |
| `403` | The domain is one of Volcano's own, which only its configuration changes. |
| `404` | Your account has not verified that domain. |
| `409` | DNS does not yet serve your record, or another account owns the domain. |
| `501` | Local mode has a single account, so it has no ownership to prove. |
| `503` | DNS did not answer the ownership check; retry later. |
