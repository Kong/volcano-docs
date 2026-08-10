---
title: "Email Domain Allowlist"
description: "Restrict which email domains can own an account in your Volcano project, and choose whether the restriction covers signup only or sign-in as well."
---

Restrict which email domains can own an account in your project, and decide
whether accounts that predate the restriction may keep signing in.

**Settings:** `allowed_email_domains`, `allowed_email_domains_mode`
**Types:** Array of strings, string
**Defaults:** `[]` (any domain), `"signup"`

Use it for internal tools, customer-specific deployments, or any app where only
people with a company address should be able to join.

## Enable

Set both settings from the Dashboard, the API, or `volcano-config.yaml`. An empty
list accepts any domain.

**Dashboard:** in **Auth Settings → General**, under **Email Domain Allowlist**,
enter the domains one per line and choose where the list applies: **New signups
only** (`signup`), **Signups and sign-ins** (`signup_and_signin`), or **Not
enforced** (`disabled`). Picking **Signups and sign-ins** asks you to confirm
first, because saving it signs out every account outside the list.

**API:**

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowed_email_domains": ["domain1.com", "domain2.com"],
    "allowed_email_domains_mode": "signup_and_signin"
  }'
```

**`volcano-config.yaml`:**

```yaml
auth:
  signup:
    allowed_email_domains:
      - domain1.com
      - domain2.com
    allowed_email_domains_mode: signup_and_signin
```

## Modes

`allowed_email_domains_mode` decides how far the list reaches. An empty list
restricts nothing whatever the mode is.

| Mode | Signup | Sign-in | Existing sessions |
|------|--------|---------|-------------------|
| `signup` (default) | Blocked outside the list | Allowed | Kept |
| `signup_and_signin` | Blocked outside the list | Blocked outside the list | Revoked for the addresses it blocks |
| `disabled` | Allowed | Allowed | Kept |

Pick `signup` to stop new accounts while letting everyone who already signed up
carry on. Pick `signup_and_signin` to cut off accounts outside the list too —
this is the setting that turns the allowlist into an access control rather than
a registration filter. Pick `disabled` to park the list without deleting it, so
you can switch the same domains back on later.

## What It Covers

Every path that would give an address an account is checked under `signup` and
`signup_and_signin`:

| Path | Behavior with a disallowed domain |
|------|-----------------------------------|
| `POST /auth/signup` | 403, no user created |
| OAuth/SSO callback creating a new user | 403, no user created |
| OAuth/SSO callback claiming an existing unconfirmed account by email | 403 |
| `POST /auth/oauth/{provider}/link` | 403 when the provider address would become a new address on the account |
| `POST /auth/user/convert-anonymous` | 403, the user stays anonymous |
| `POST /auth/user/change-email` | 403, the address is unchanged |
| `POST /auth/user/confirm-email-change` | 403 if the allowlist narrowed after the change was requested |
| `POST /auth/user/methods/{methodId}/promote` | 403, the account keeps its current primary |
| Anonymous signup (no email) | Allowed — nothing to check |

Promotion is on that list because it re-derives the account's canonical email
from the promoted identity. An account can hold an identity that predates the
restriction, and promoting it would move the account onto an address signup
would refuse.

Under `signup_and_signin`, every path that hands out a session is checked as
well:

| Path | Behavior with a disallowed domain |
|------|-----------------------------------|
| `POST /auth/signin` | 403, no session issued |
| OAuth/SSO callback for an already-linked account | 403 |
| `POST /auth/oauth/exchange` | 403 |
| `POST /auth/device/token` | 403 `access_denied` |
| `POST /auth/refresh` | 403, the session cannot be extended |
| `POST /auth/platform/exchange` | 403, no CLI platform token is minted |
| Anonymous sign-in | Allowed — anonymous accounts carry an internal address |

Linking a provider whose address the account already owns keeps working, so a
user grandfathered in before the restriction can still add a provider.

Sign-in is judged on the account's **canonical email** — the address of its
primary identity, the one `GET /auth/user` returns — not on the address the
request presented. An account with several identities is therefore either in or
out as a whole: it cannot sign in through a secondary address that happens to be
on the list while its canonical address is not. That is the same address the
session revocation matches, so the two never disagree.

The error message is `email domain is not allowed for this project`.

## Matching Rules

Matching is an exact, case-insensitive comparison of the part after the last
`@`:

| Allowlist | Address | Result |
|-----------|---------|--------|
| `domain1.com` | `user@domain1.com` | Allowed |
| `domain1.com` | `User@DOMAIN1.COM` | Allowed |
| `domain1.com` | `user+tag@domain1.com` | Allowed |
| `domain1.com` | `user@mail.domain1.com` | Rejected |
| `domain1.com` | `user@domain1.com.evil.com` | Rejected |

Subdomains are not implied. List `mail.domain1.com` explicitly if you want to
accept it.

## Entry Format

Entries are normalized before they are stored, so the forms people paste all
converge:

| You write | Stored as |
|-----------|-----------|
| `@Domain1.com` | `domain1.com` |
| `  DOMAIN1.com  ` | `domain1.com` |
| `domain1.com.` | `domain1.com` |

Duplicates are dropped and the configured order is kept. An entry must be a bare
domain with a top-level domain of at least two letters, so `localhost`,
`user@domain1.com`, and `domain 1.com` are rejected with a 400 when you save.
The list holds at most 100 domains.

## Existing Users

Under `signup` and `disabled`, adding a restriction never locks anyone out.
Users whose domain is no longer on the list keep signing in normally; the
allowlist only governs new accounts and email changes.

Under `signup_and_signin`, saving the policy signs out every account outside the
list right away — their sessions are deleted, so their access tokens stop
working on the next request rather than at expiry. The accounts themselves stay,
so putting the domain back restores access; delete the users if you need them
gone for good.

Saving and signing out are one operation: if the sign-out fails, the save fails
with it and the previous policy stays in force, so a project never advertises a
lock it has not applied. A sign-in that was already in flight when you saved can
still land a session — it read the old policy — but it cannot be refreshed or
exchanged for a CLI token, so it ends when its access token expires.

One exception to "right away": a Realtime connection that is already open is not
closed, because its session was checked when it connected. It stops working as
soon as it reconnects. Close those connections from your app if you need the
lock to reach live subscribers immediately.

Anonymous accounts are never affected: whether they may exist at all is governed
by [anonymous users](../anonymous-users.md) instead. The exemption follows the
account being anonymous, not the address it carries — `anonymous.volcano.internal`
is reserved for accounts the platform mints, and a signup asking for an address
inside it is refused with the same 403 whatever the mode, including `disabled`.

Builder debug users (`*@volcano.local`, created by the project owner from the
dashboard) are provisioned directly and never pass through the signup check.
Saving a `signup_and_signin` policy does end their session; the next debug run
mints a new one.

## Remove the Restriction

Two ways, depending on whether you want to keep the list:

```bash
# Park the list — the domains stay, nothing is enforced.
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"allowed_email_domains_mode": "disabled"}'

# Clear the list — the domains are gone.
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"allowed_email_domains": []}'
```

In `volcano-config.yaml`, `allowed_email_domains: []` clears the list; omitting
a key leaves the stored value untouched. From the Dashboard, **Not enforced**
parks the list and emptying the field clears it.

## Troubleshooting

**Signup returns 403 `email domain is not allowed for this project`**
The address is outside the list. Add its domain, or clear the list.

**Sign-in returns 403 `email domain is not allowed for this project`**
The project is in `signup_and_signin` and the account's domain is not listed.
Check the account's canonical email (`GET /auth/user`) rather than the address
you signed in with — they differ when another identity is primary. Add the
domain, or switch the mode back to `signup` to let existing accounts in.

**Signup returns 403 for an `@anonymous.volcano.internal` address**
That domain is reserved for anonymous accounts the platform creates. No project
can accept it, and adding it to the allowlist has no effect.

**Users were signed out after a config change**
Expected under `signup_and_signin`: saving the policy revokes the sessions of
every account outside the list.

**A subdomain is rejected even though the parent domain is listed**
Expected — add the subdomain as its own entry.

**Saving returns 400 `invalid allowed_email_domains entry`**
An entry is not a bare domain. Use `domain1.com`, not `user@domain1.com`,
`https://domain1.com`, or `localhost`.

**Saving returns 400 `invalid allowed_email_domains_mode`**
The mode must be `disabled`, `signup`, or `signup_and_signin`.

## Related

- [Provider Separation](provider-separation.md) — which providers can create users
- [Configuring Auth Methods](../configuring-auth-methods.md) — enabling and disabling signup
- [CORS](cors.md) — which sites can call your auth endpoints
