---
title: "Password Requirements"
description: "Volcano enforces a secure password baseline in the backend for sign-up, password reset, anonymous-account conversion, and password changes."
---

Volcano enforces a secure password baseline in the backend for sign-up,
password reset, anonymous-account conversion, and password changes.

## Effective baseline

- Minimum length: 15 Unicode characters by default
- Maximum length: 128 Unicode characters
- Unicode passwords are normalized to NFC and counted by code point
- The complete password is validated and hashed; it is never silently truncated
- Common and known-compromised passwords are rejected
- Sign-in and password-reset endpoints are rate limited by the backend

New passwords are hashed with Argon2id. Existing bcrypt credentials remain
readable for compatibility with accounts created before the Argon2id migration.

Known-compromised checks use a padded k-anonymous request: only the first five
characters of a SHA-1 digest are sent to the breach service. Plaintext passwords
and complete password digests do not leave Volcano.

## Read the effective policy

`GET /projects/{projectId}/auth/config` returns both the configured minimum and
the effective backend policy:

```json
{
  "min_password_length": 15,
  "password_policy": {
    "effective_min_length": 15,
    "min_configurable_length": 15,
    "max_length": 128,
    "require_uppercase": false,
    "require_lowercase": false,
    "require_numbers": false,
    "require_special_chars": false,
    "compromised_passwords_rejected": true
  }
}
```

Applications should render and validate settings from `password_policy` instead
of duplicating policy constants. `effective_min_length`, `max_length`, and the
`require_*` fields describe the rules currently enforced, while
`min_configurable_length` is the lowest value an administrator may choose.
Client-side validation is useful feedback, but the backend remains authoritative
and may reject a password that appears in the compromised-password corpus.

## Configure minimum length

**Setting:** `min_password_length`  
**Default:** 15
**Range:** 15-128

```json
{"min_password_length": 20}
```

Long passphrases are preferred. Volcano accepts spaces and Unicode characters.

## Optional composition settings

Projects may add composition requirements, although length and
compromised-password screening provide the baseline protection.

### Require uppercase

**Setting:** `require_uppercase`  
**Default:** false

```json
{"require_uppercase": true}
```

### Require lowercase

**Setting:** `require_lowercase`  
**Default:** false

```json
{"require_lowercase": true}
```

### Require numbers

**Setting:** `require_numbers`  
**Default:** false

```json
{"require_numbers": true}
```

### Require special characters

**Setting:** `require_special_chars`  
**Default:** false

```json
{"require_special_chars": true}
```

## Configuration example

```bash
curl -X PUT https://api.volcano.dev/projects/PROJECT_ID/auth/config \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "min_password_length": 20,
    "require_uppercase": true,
    "require_numbers": true
  }'
```

## References

- [NIST SP 800-63B password requirements](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Have I Been Pwned Pwned Passwords API](https://haveibeenpwned.com/API/V3#PwnedPasswords)

## See also

- [Configuration Overview](overview.md)
- [Rate Limiting](rate-limiting.md)
