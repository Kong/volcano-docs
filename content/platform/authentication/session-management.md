---
title: "Manage SDK sessions"
description: "Read, adopt, refresh, and sign out Volcano sessions with the JavaScript, Python, and Ruby SDKs."
---

Use the SDK session facade to move credentials between configured clients, rotate an expiring session, or sign out.
Each operation protects a newer session from a stale refresh or sign-out response.

## JavaScript

```javascript
import { VolcanoAuth } from '@volcano.dev/sdk';

const config = {
  apiUrl: process.env.VOLCANO_API_URL,
  anonKey: process.env.VOLCANO_ANON_KEY,
};
const source = new VolcanoAuth(config);
const target = new VolcanoAuth(config);

const { error: signInError } = await source.auth.signIn({
  email: process.env.VOLCANO_USER_EMAIL,
  password: process.env.VOLCANO_USER_PASSWORD,
});
if (signInError) throw signInError;

const {
  data: { session },
  error: readError,
} = await source.auth.getSession();
if (readError) throw readError;
if (!session?.refresh_token || !session.user) {
  throw new Error('Sign-in did not create a complete session');
}

const { error: adoptionError } = await target.auth.setSession(session);
if (adoptionError) throw adoptionError;

const { session: refreshed, error: refreshError } = await target.auth.refreshSession();
if (refreshError) throw refreshError;
if (!refreshed) throw new Error('Refresh did not create a session');

const { error: signOutError } = await target.auth.signOut();
if (signOutError) throw signOutError;

const {
  data: { session: signedOutSession },
} = await target.auth.getSession();
if (signedOutSession) throw new Error('Session was not cleared');
```

`setSession()` returns an error when the supplied session is incomplete.
Refresh failures and logout request failures are returned in the corresponding `error` field.

## Python

```python
import os

from volcano_sdk import VolcanoClient

config = {
    "api_url": os.environ["VOLCANO_API_URL"],
    "anon_key": os.environ["VOLCANO_ANON_KEY"],
}
source = VolcanoClient(**config)
target = VolcanoClient(**config)

source.auth.sign_in(
    email=os.environ["VOLCANO_USER_EMAIL"],
    password=os.environ["VOLCANO_USER_PASSWORD"],
)
session = source.auth.get_session()
if session is None:
    raise RuntimeError("Sign-in did not create a session")

target.auth.set_session(session)
target.auth.refresh_session()
target.auth.sign_out()

if target.auth.get_session() is not None:
    raise RuntimeError("Session was not cleared")
```

`set_session()` raises `ValueError` when the session type or a credential field is incomplete.
Refresh failures and logout request failures raise typed SDK exceptions.

## Ruby

```ruby
require "volcano"

config = {
  api_url: ENV.fetch("VOLCANO_API_URL"),
  anon_key: ENV.fetch("VOLCANO_ANON_KEY")
}
source = Volcano::Client.new(**config)
target = Volcano::Client.new(**config)

source.auth.sign_in(
  email: ENV.fetch("VOLCANO_USER_EMAIL"),
  password: ENV.fetch("VOLCANO_USER_PASSWORD")
)
session = source.auth.current_session
raise "sign-in did not create a session" unless session

target.auth.current_session = session
target.auth.refresh_session
target.auth.sign_out

raise "session was not cleared" if target.auth.current_session
```

The session writer raises `ArgumentError` for an incomplete value.
Refresh failures and logout request failures raise typed errors under `Volcano::Error`.

## Understand session state

Reading a session returns an SDK-owned snapshot without contacting Volcano.
Adopting a session validates and copies a complete access token, refresh token, and user identity into the target client without making a request.

Python and Ruby keep sessions in the current client process only.
JavaScript retains its existing browser storage behavior for sessions established by sign in or refresh; a session passed to `setSession()` is adopted in memory.
This contract does not add a shared persistence or auth-listener model.

## Handle refresh failures

Refresh requires a complete current session and fails before making a request when none exists.
A successful refresh atomically replaces the captured token pair.
An authentication failure clears that captured session.
Server and transport failures leave it available for a later retry. If the server rotates the
refresh token but the response is lost, the retained token is already invalid; the next refresh
clears the session, and the user must sign in again.

If another sign-in or adoption replaces the session while refresh is pending, the SDK preserves the newer session and reports a session-change error.

## Handle logout request failures

Sign-out submits the captured refresh token for revocation and clears the captured local session.
Calling it without a current session succeeds without a request.
If the logout request fails, the SDK still clears that local session and reports the failure.
A session established while sign-out is pending remains current.

Successful revocation deletes the server session. The captured refresh token can no longer create
access tokens, and session-bound access tokens are rejected immediately even when their encoded
expiry is later. Do not treat local clearing as proof that revocation succeeded when the SDK reports
an error.
