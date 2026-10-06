---
title: Python SDK
description: Install the Volcano Python SDK and authenticate a user from a Python application.
order: 1
---

Use `volcano-sdk-python` for authentication, database queries, storage, functions, logs, locks, and realtime events.
REST calls are synchronous and raise typed exceptions on failure.
Python 3.11 or later is required; CI tests every Python version from 3.11 through 3.14.

## Install the published package

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install volcano-sdk-python
```

The [PyPI distribution](https://pypi.org/project/volcano-sdk-python/) is named `volcano-sdk-python`.
Import it as `volcano_sdk`.
The package includes type information for mypy and other PEP 561-compatible checkers.

## Sign in and read a profile

Create a project, enable [email and password authentication](/platform/authentication/configuring-auth-methods), and create a user with a confirmed email when your project requires confirmation.
Use that project's [anonymous key](/platform/authentication/security/anon-keys).
Set `VOLCANO_ANON_KEY`, `VOLCANO_USER_EMAIL`, and `VOLCANO_USER_PASSWORD` in your environment.
Set `VOLCANO_API_URL` only when using a different API endpoint, such as local mode.

Save this as `quickstart.py`:

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
try:
    user = client.auth.get_user()
    assert user.id == session.user_id
    print(f"Signed in as {user.email}")
finally:
    client.auth.sign_out()
```

Run it with `python quickstart.py`.
It signs in, fetches the server-validated profile, prints the user's email, revokes its server session, and clears the local session.
An invalid email or password raises `AuthenticationError`; failed network requests raise `TransportError`.
Both inherit from `VolcanoError` and are exported from `volcano_sdk`.

## Keep authentication scoped to one user

A client holds its current session in memory.
Use a separate client for each independent user session; do not share one mutable client across users in a web server.
`client.current_session` and `client.auth.get_session()` read the local immutable snapshot without a request.
Use `client.auth.get_user()` when you need a server-validated profile.
Successful profile operations update the cached user while preserving the current credentials.
Authenticated profile, session-list/deletion, email-change request/cancellation, linked-provider, provider-token, and provider-API operations refresh a usable session once after HTTP 401 and replay the original request values.
Deleting the current server session also clears its refreshed local credentials; a separately adopted session remains current.
These operations do not retry other HTTP failures or ambiguous network failures, and they never retry under a replacement session.

`sign_up()` returns an acknowledgement without signing in by default.
Pass `sign_in_when_allowed=True` to sign in only when the project does not require email confirmation.
To adopt an existing session, pass a `Session` containing its access token, refresh token, and user ID to `client.auth.set_session()`.
The SDK does not persist tokens for you.

For operations that require a [service key](/platform/authentication/security/service-keys), pass `service_key` to the constructor in trusted server code.
Keep service keys and user credentials out of source control and client applications.

## Use a supplied access token

For a server request that already carries a user's access token, create a client for that request:

```python
import os

from volcano_sdk import VolcanoClient


def load_request_user(access_token: str):
    client = VolcanoClient(
        anon_key=os.environ["VOLCANO_ANON_KEY"],
        access_token=access_token,
    )
    return client.auth.get_user()
```

Call this helper from your request handler with the bearer token from that request.
For a Volcano function, use the access token in `event["__volcano_auth"]["access_token"]` supplied for that invocation.
The helper validates the token with Volcano before returning the user.

Once a user identity has been validated, a refresh response for another user is rejected and leaves the current credentials unchanged.
Construction makes no request and does not persist credentials.
The initial snapshot has `refresh_token=None`, `user_id=None`, and `user=None`.
A successful profile read fills in the validated identity and cached user while retaining the supplied access token.
Without a refresh token, an HTTP 401 remains an authentication error, `refresh_session()` raises `AuthenticationError`, and `sign_out()` revokes the server session identified by the access token before clearing local state.
Refresh must preserve the server session identified by the access JWT, even before a profile is loaded. A different session is rejected, including another session for the same user. Supplied credentials need a readable session identifier to refresh, even when you provide a user profile or load it from the server. Profile data does not prove that access and refresh tokens belong together.
For supplied credentials, sign-out revokes the access-token session. On HTTP 401, it can refresh once and revoke that same session without adopting the renewed credentials locally.
When the SDK received both credentials together from sign-in or a validated refresh, it uses the refresh token directly, even if access has expired.
Sign-out joins an existing refresh and prevents later refresh attempts for that session. Concurrent sign-outs share one result; a separate sign-in or adoption remains current.
Pass `refresh_token` alongside `access_token` when the client should refresh that session.
A revocation failure is reported after local clearing; it does not prove that copied tokens are invalid.
Adopting a session with `set_session()` still requires complete credentials and identity.

## Use the rest of the API

The SDK repository contains [examples for every public facade](https://github.com/Kong/volcano-sdk-python#try-the-contract-facade), including database filters and mutations, resumable uploads, function invocation, log queries, lock guards, and realtime presence and database changes.
Realtime uses an asynchronous lifecycle; follow those examples to connect and disconnect its channels.

See [release notes](https://github.com/Kong/volcano-sdk-python/releases) for version changes and [GitHub issues](https://github.com/Kong/volcano-sdk-python/issues) to report a problem.
Include the package version, Python version, and a minimal reproduction without credentials.

See [Distributed locks](./locks.md) for acquisition recovery, renewal, and fencing.

Read the [database guide](./database.md) for projection, filters, ordered pagination, and mutations.

For uploads, visibility, and resumable sessions, see [Storage](./storage.md).

See [Logs](./logs.md) for project-token authentication, search, pagination, and activity.


See [Realtime](./realtime.md) for broadcasts, presence, database changes, and shutdown.

See [Authentication](./authentication.md) for account, session, email, and OAuth workflows.

See [Functions](./functions.md) for standard invocation, durable execution, local durable development, and error handling.

See [Versions and compatibility](./versions.md) for runtime support, upgrades, and restoring a tested dependency set.

- [Sandboxes](sandboxes.md): isolated commands, sessions, files, and HTTP access.
