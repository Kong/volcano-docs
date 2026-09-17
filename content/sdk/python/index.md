---
title: Python SDK
description: Install the Volcano Python SDK and authenticate a user from a Python application.
order: 1
---

Use `volcano-sdk-python` for authentication, database queries, storage, functions, logs, locks, and realtime events.
REST calls are synchronous and raise typed exceptions on failure.
Python 3.11 or later is required; CI tests Python 3.11 and 3.14.

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
It signs in, fetches the server-validated profile, prints the user's email, revokes its refresh token, and clears the local session.
An invalid email or password raises `AuthenticationError`; failed network requests raise `TransportError`.
Both inherit from `VolcanoError` and are exported from `volcano_sdk`.

## Keep authentication scoped to one user

A client holds its current session in memory.
Use a separate client for each independent user session; do not share one mutable client across users in a web server.
`client.current_session` and `client.auth.get_session()` read the local immutable snapshot without a request.
Use `client.auth.get_user()` when you need a server-validated profile.
Successful profile operations update the cached user without replacing credentials.

`sign_up()` returns an acknowledgement without signing in by default.
Pass `sign_in_when_allowed=True` to sign in only when the project does not require email confirmation.
To adopt an existing session, pass a `Session` containing its access token, refresh token, and user ID to `client.auth.set_session()`.
The SDK does not persist tokens for you.

For operations that require a [service key](/platform/authentication/security/service-keys), pass `service_key` to the constructor in trusted server code.
Keep service keys and user credentials out of source control and client applications.

## Use the rest of the API

The SDK repository contains [examples for every public facade](https://github.com/Kong/volcano-sdk-python#try-the-contract-facade), including database filters and mutations, resumable uploads, function invocation, log queries, lock guards, and realtime presence and database changes.
Realtime uses an asynchronous lifecycle; follow those examples to connect and disconnect its channels.

See [release notes](https://github.com/Kong/volcano-sdk-python/releases) for version changes and [GitHub issues](https://github.com/Kong/volcano-sdk-python/issues) to report a problem.
Include the package version, Python version, and a minimal reproduction without credentials.
