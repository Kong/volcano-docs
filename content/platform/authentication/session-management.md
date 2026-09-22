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

## Start with a supplied access token

Create a separate client for each server request. Pass the bearer token received
by that request; the constructor does not validate it, invent refresh credentials,
or persist it. Load the profile to validate the token and fill the cached user.

```javascript
async function loadRequestUser(accessToken) {
  const client = new VolcanoAuth({
    anonKey: process.env.VOLCANO_ANON_KEY,
    accessToken,
  });
  const { user, error } = await client.auth.getUser();
  if (error) throw error;
  return user;
}
```

```python
def load_request_user(access_token: str):
    client = VolcanoClient(
        anon_key=os.environ["VOLCANO_ANON_KEY"],
        access_token=access_token,
    )
    return client.auth.get_user()
```

```ruby
def load_request_user(access_token)
  client = Volcano::Client.new(
    anon_key: ENV.fetch("VOLCANO_ANON_KEY"),
    access_token: access_token
  )
  client.auth.user
end
```

Use the imports from the corresponding language example above. The initial
session has no cached user or refresh token. Supply `refreshToken` in JavaScript
or `refresh_token` in Python/Ruby when refresh credentials are also available.
Complete session adoption still requires credentials and user identity.

Call sign-out only when the user intends to end the session, not as cleanup after
each server request: successful sign-out also invalidates other copies of that
session's access token. A malformed token without a session ID can only be
cleared locally; it cannot authenticate with Volcano.

## Handle refresh failures

Refresh requires a refresh token and fails before making a request when none exists.
A token-only client can refresh when its constructor also receives a refresh token.
A successful refresh atomically replaces the captured token pair.
Refresh preserves the server session identified by the access JWT, even before a profile has been loaded.
A different session is rejected, including another session for the same user.
Supplied credentials need a readable session identifier to refresh, even after
you supply a user profile or load it from the server. A user profile does not prove
that the supplied access and refresh tokens belong to the same session.
A response for a different validated user is rejected without replacing the credentials.
An authentication failure clears that captured session.
Server and transport failures leave it available for a later retry. If the server rotates the
refresh token but the response is lost, the retained token is already invalid; the next refresh
clears the session, and the user must sign in again.

If another sign-in or adoption replaces the session while refresh is pending, the SDK preserves the newer session and reports a session-change error.

## Recover authenticated requests

Profile, email-change, session-management, linked-provider, and provider API
operations can recover from one HTTP 401 response. The SDK refreshes the session
that started the request, then retries once with the original request values.
A second 401, a server error, or a transport error is returned to the caller.

If another sign-in or adoption replaces the session during the request, the SDK
preserves that newer session and reports a session-change error. It never retries
an older operation with the newer user's credentials.
Deleting the current server session clears its local credentials, including a
refresh that completed while deletion was pending.

## Handle logout request failures

Sign-out revokes the captured server session and clears its local credentials.
When the SDK received both credentials together from sign-in or a validated refresh,
it uses the refresh token directly, even if the access token has expired.
For supplied credentials, it revokes the session identified by the access token.
On HTTP 401, that path can refresh once and revoke the same session without adopting renewed credentials locally.
If the access token has no session identifier, the SDK uses the captured refresh token when available.
It does not retry an ambiguous transport or server failure.
Calling it without a current session succeeds without a request.
If the logout request fails, the SDK still clears that local session and reports the failure.
Sign-out waits for an already-running refresh and uses its validated credentials for revocation.
New refresh attempts for that session fail without a request. Concurrent sign-out calls share one result.
A separate sign-in or explicit adoption remains current.

Successful revocation deletes the server session. The captured refresh token can no longer create
access tokens, and session-bound access tokens are rejected within a few seconds even when their
encoded expiry is later. Do not treat local clearing as proof that revocation succeeded when the SDK
reports an error.
