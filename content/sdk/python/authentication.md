---
title: Authentication
description: Manage Volcano user accounts, sessions, email flows, and OAuth from Python.
order: 2
---

Sign in with a project's anonymous key and an existing user's credentials.
Enable the required [authentication methods](/platform/authentication/configuring-auth-methods) for the project first.
Install the SDK using the [quickstart](./README.md).

```python
import os

from volcano_sdk import VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
)
session = client.auth.sign_in(
    email=os.environ["VOLCANO_USER_EMAIL"],
    password=os.environ["VOLCANO_USER_PASSWORD"],
)
user = client.auth.get_user()
assert user.id == session.user_id
print(user.email)
```

Use a separate client for each independent user session.
The examples below describe separate account workflows using this client.
Keep access and refresh tokens out of logs; the SDK stores sessions in memory only.

## Create an account

`sign_up()` returns an immutable acknowledgement without changing the session by default.
The signup acknowledgement is identical for new and existing email addresses. Pass
`sign_in_when_allowed=True` to follow it with `sign_in()` only when confirmation is not required:

```python
result = client.auth.sign_up(
    email="new-user@example.com",
    password="correct-horse-battery-staple",
    sign_in_when_allowed=True,
)
session = result.session  # None when no follow-up sign-in ran.
```

A successful follow-up stores the session and emits the normal sign-in event. A failed
follow-up raises its usual typed error; it does not undo the successful signup.

## Read the local session and user

`get_session()` reads immutable local state. It does not refresh or validate the token.

Sessions returned by authentication retain the user payload in `session.user`,
including metadata. The snapshot is deeply immutable and available without a
request. It is cached data, not proof of authentication; use `auth.get_user()`
to fetch the server-validated profile. Existing three-field `Session` construction
still works, with `user=None`. An adopted snapshot must have the same user ID.
Successful `get_user()`, `update_user()`, `convert_anonymous()`, and
`confirm_email_change()` calls update that local snapshot. Automatic HTTP 401 recovery
can rotate credentials and emit `TOKEN_REFRESHED`; the profile update itself does not. Previously returned sessions remain immutable.
Profile identity checks compare UUID values; the session retains its original
user ID spelling, including in the cached snapshot.

## Validate and update a profile

`get_user()` sends the active access token to Volcano and returns an immutable, server-validated
profile with the complete public AuthUser fields. Profile timestamps are timezone-aware `datetime`
values, and nested user and application metadata are immutable. The request updates the cached
profile without changing credentials unless HTTP 401 recovery requires a refresh.
Successful recovery rotates credentials and emits `TOKEN_REFRESHED`. If another authentication operation replaces the session
while the request is in flight, `get_user()` raises `SessionChangedError` instead of returning a
profile for stale credentials.

```python
user = client.auth.update_user(metadata={"display_name": "Ada", "avatar": None})
print(user.id)
```

`update_user()` updates the current user's password, metadata, or both. Metadata is a shallow patch:
omitted keys remain unchanged, and setting a key to `None` removes it. The method returns the same
immutable profile type as `get_user()` and updates the cached profile without changing credentials unless HTTP 401 recovery requires a refresh.
Successful recovery rotates credentials and emits `TOKEN_REFRESHED`.
It also rejects a response if another authentication operation replaces the session while the
update is in flight.

## Recover a password

Request a password reset email without creating or changing a session:

```python
client.auth.reset_password_for_email(email="user@example.com")
```

When transactional email is configured, Volcano sends the reset link. Success returns `None`, and
the response is intentionally identical whether or not the email belongs to an account. Failures
raise the same typed Volcano errors as other authentication operations.

## Confirm an email address

Confirm an email address with the token from its confirmation link:

```python
client.auth.confirm_email(token="confirmation-token")
```

Success returns `None`. Confirmation does not sign in the confirmed account or change an unrelated
local session.

## Resend confirmation

Request another confirmation email without revealing account state:

```python
client.auth.resend_confirmation(email="user@example.com")
```

Success returns `None` whether the account is unknown, already confirmed, or eligible. Volcano sends
mail only for an existing unconfirmed account when transactional email is configured. Rate limits
raise `RateLimitedError` with `retry_after` when the server supplies it.

## Change an email address

Request confirmation for a new email address while keeping the current session:

```python
result = client.auth.request_email_change(new_email="new@example.com")
print(result.new_email)
```

The immutable result contains the server acknowledgement. Its `message` and `new_email` fields may
be `None`. The request fails if there is no active session or that session changes in flight.

Cancel the pending change while keeping the current session:

```python
client.auth.cancel_email_change()
```

Success returns `None`. A successful stale response is rejected if another authentication operation
replaces the session while cancellation is in flight.

Confirm the pending change with the token delivered to the new address:

```python
user = client.auth.confirm_email_change(token="email-change-token")
print(user.email)
```

The method returns the immutable updated user without replacing the active session. A successful
stale response is rejected if another authentication operation replaces that session in flight.

## List server sessions

List sessions using the stable activity-ordered offset pagination:

```python
page = client.auth.list_sessions(page=1, limit=20)
for session in page.sessions:
    print(session.id, session.user_agent, session.is_current)
```

The method returns immutable `SessionPage` and `AuthSession` values. It raises
`SessionChangedError` instead of returning a page for a session that was replaced while the request
was in flight. Sort, filter, and cursor controls are not yet exposed by this facade.

## Use hosted authentication

Build a managed hosted-auth URL:

```python
import secrets

hosted_state = secrets.token_urlsafe(32)
hosted_url = client.auth.get_hosted_auth_url(
    project_id="00000000-0000-4000-8000-000000000020",
    action="signup",
    state=hosted_state,
)
```

Store `hosted_state` in the user's signed server-side session before redirecting to `hosted_url`.
In the callback, atomically fetch and delete the stored state before validation,
even if validation or adoption fails. Reject a missing or already-consumed state.
After parsing the returned fragment into a `Session`, validate and adopt it:

```python
session = client.auth.adopt_hosted_auth_session(
    returned_session,
    state=returned_state,
    expected_state=hosted_state,
)
```

The SDK rejects a mismatched state before changing local authentication. It builds and adopts the
flow but does not parse browser URLs, navigate, or persist state. The `action` deep link applies to
Volcano's built-in page; a customized login page must implement its own signup or forgot-password
flow.

## Sign in with OAuth

Build the URL that starts an OAuth sign-in flow:

```python
import secrets

oauth_state = secrets.token_urlsafe(32)
authorization_url = client.auth.sign_in_with_oauth(
    provider="github",
    redirect_to="https://app.example.com/auth/callback",
    state=oauth_state,
)
```

Store `oauth_state` in the user's signed server-side session, then redirect the user to the returned
URL. In the callback, atomically fetch and delete the stored nonce as `stored_oauth_state`;
reject a missing or already-consumed nonce. Pass the returned and consumed states to
the SDK so it rejects login CSRF before exchanging the one-time code:

```python
session = client.auth.exchange_oauth_code(
    code=callback_code,
    redirect_to="https://app.example.com/auth/callback",
    state=callback_state,
    expected_state=stored_oauth_state,
)
```

The callback URL must exactly match a registered project redirect. The exchange stores the returned
Volcano session on the client. The SDK does not open a browser or persist OAuth state between
requests; use your framework's signed session or equivalent storage for that state.

List the OAuth providers linked to the current account:

```python
providers = client.auth.list_linked_oauth_providers()
for provider in providers:
    print(provider.provider, provider.linked_at)
```

The method returns an immutable tuple of `LinkedOAuthProvider` values and raises
`SessionChangedError` if the active session changes while the request is in flight.

## Link and unlink providers

Start linking another OAuth provider to the current account:

```python
authorization_url = client.auth.link_oauth_provider(provider="github")
```

Redirect the user to the returned URL to complete the provider flow. The method accepts `apple`,
`github`, `google`, or `microsoft` and raises `SessionChangedError` if the active session changes
while the request is in flight.

Unlink an OAuth provider from the current account:

```python
client.auth.unlink_oauth_provider(provider="github")
```

The server rejects removal of the account's only authentication method. A successful stale response
raises `SessionChangedError` instead of acknowledging work authorized by a replaced session.

## Use provider APIs

Check whether Volcano has a valid server-held provider token:

```python
status = client.auth.get_oauth_provider_token(provider="github")
print(status.provider, status.expires_in)
```

The immutable `OAuthProviderTokenStatus` contains provider and expiry metadata, not the credential.
Volcano refreshes an expired token on the server. A stale result raises `SessionChangedError`.

Refresh a provider token explicitly:

```python
status = client.auth.refresh_oauth_provider_token(provider="github")
print(status.provider, status.expires_in)
```

The refresh credential and new access token remain on the server. A stale result raises
`SessionChangedError`.

Call a provider API through Volcano's fixed-host server proxy:

```python
repos = client.auth.call_oauth_api(
    provider="github",
    endpoint="/user/repos",
)
print(repos[0]["name"])
```

The method returns an immutable copy of the provider's JSON value. Volcano owns token refresh and
host validation. A stale result raises `SessionChangedError`.

## Revoke other sessions

Sign out every other device while keeping the current session active:

```python
client.auth.delete_all_other_sessions()
```

Success returns `None`. Do not replace the client's session while this request is in flight: the
server may revoke that replacement as an "other" session. If replacement occurs, the method raises
`SessionChangedError` instead of acknowledging a stale result.

## Revoke one session

Revoke one session by ID:

```python
client.auth.delete_session(session_id="00000000-0000-4000-8000-000000000099")
```

The request uses the current access token. When its JWT contains a readable UUID `session_id`,
deleting that session clears local credentials even if the request outcome is uncertain.
Without that identifier, the SDK cannot recognize self-deletion. Deleting another session does not
itself clear local state. HTTP 401 recovery can rotate credentials and emit `TOKEN_REFRESHED`;
a server-rejected refresh clears the captured session before the operation raises. If another authentication operation replaces the session before deletion finishes, the method
raises `SessionChangedError` instead of clearing the replacement or acknowledging a stale result.

## Use anonymous accounts

Create an anonymous account and make its tokens the current session:

```python
session = client.auth.sign_in_anonymously(metadata={"device": "mobile"})
```

Anonymous sign-ins must be enabled for the project. Convert the account before signing out if the
user needs to recover it later.

Attach email credentials while preserving the anonymous user's ID:

```python
user = client.auth.convert_anonymous(
    email="user@example.com",
    password="a-long-example-password-2026",
    metadata={"display_name": "Ada"},
)
```

When email confirmation is required, confirm the new address before treating it as verified.

## Complete a password reset

Set a new password with the recovery token from that email:

```python
client.auth.reset_password(
    token="recovery-token",
    new_password="new-correct-horse-battery-staple",
)
```

Success returns `None`. The reset revokes the recovered account's existing sessions and does not
sign it in. The client keeps any unrelated local session unchanged; sign in with the new password
when the reset flow completes.

## Use supplied credentials

To start with only a supplied user access token, pass `access_token` to
`VolcanoClient`. Construction makes no request and leaves `refresh_token`,
`user_id`, and `user` as `None` until supplied or validated by the server.
`get_user()` validates and caches the profile without changing credentials unless HTTP 401 recovery requires a refresh.
Successful recovery rotates credentials and emits `TOKEN_REFRESHED`.
Without a refresh token, `refresh_session()` raises `AuthenticationError` and
`sign_out()` clears local state and revokes the server session when the access JWT
contains a readable UUID `session_id`.
Supplied credentials require both a refresh token and an access JWT with a readable UUID
`session_id` to enable refresh. See the [token bootstrap example](./README.md#use-a-supplied-access-token).

## Adopt an existing session

Copy a complete native session into another client's memory:

```python
session = source.auth.get_session()
if session is not None:
    fresh.auth.set_session(session)
```

`set_session()` copies the session without making a request, persisting credentials, or notifying
auth-state subscribers. It raises `ValueError` when the session type or any credential field is
incomplete.

Password sign-in raises `SessionChangedError` if local session state changes while the request is
in flight. The late response does not replace the newer state or emit a sign-in notification.

## Refresh the current session

Refresh the session with its current refresh token:

```python
refreshed = client.auth.refresh_session()
assert client.auth.get_session() is refreshed
```

On success, `refresh_session()` replaces the in-memory session and returns the immutable new
snapshot. An authentication rejection from the refresh endpoint clears the captured session.
Missing refresh credentials, failed session-continuity checks, server errors, and
transport failures preserve it, and a late response never replaces a newer session. The SDK does
not persist sessions.

## Observe authentication changes

Observe local session transitions:

```python
from volcano_sdk import AuthChangeEvent, Session


def handle_auth_change(event: AuthChangeEvent, session: Session | None) -> None:
    print(event, session is not None)


subscription = client.auth.on_auth_state_change(handle_auth_change)
# Later, stop receiving events.
subscription.unsubscribe()
```

Registration queues `INITIAL_SESSION`. It normally arrives before registration returns, but an
existing notification dispatch may deliver it afterward. Successful session creation, refresh, and
local clearing emit `SIGNED_IN`, `TOKEN_REFRESHED`, and `SIGNED_OUT`. Callbacks are delivered locally
in transition order after the state lock is released. Ordinary callback `Exception` failures are
isolated; exceptions such as `KeyboardInterrupt` propagate after the session transition has committed. Unsubscribing prevents queued and future delivery; a callback already selected for
delivery may finish after `unsubscribe()` returns. The SDK does not broadcast between processes or
persist sessions.

## Sign out the current session

Sign out by revoking and clearing the current session:

```python
client.auth.sign_out()
assert client.auth.get_session() is None
```

Sign-out uses the refresh token directly when the SDK received both credentials together from
sign-in or a validated refresh. Supplied credentials use the access-token session when its JWT
contains a readable UUID `session_id`; on HTTP 401, the SDK can refresh once and revoke that
same session without adopting the renewed credentials. Without that identifier, sign-out uses
the supplied refresh token, or only clears local state if no refresh token is available.
Calling `sign_out()` without a session succeeds without a request. A revocation failure is raised
after the captured local session is cleared. Sign-out waits for an already-running refresh and uses its validated credentials.
Later refresh attempts raise `SessionChangedError` without a request. Concurrent sign-out calls
share one result. A separate sign-in or adoption remains current.
