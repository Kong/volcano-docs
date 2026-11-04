---
title: Real-time chat
description: A Next.js chat app on Volcano with anonymous sign-in, rooms, messages saved in Postgres, live delivery, an online count and typing indicators.
tags:
  - realtime
  - database
  - auth
  - row-level-security
  - nextjs
---

Tested on Volcano CLI 0.66.0, SDK 2.2.0, Node 26.11.1, next 16.4.5, react 19.3.1; last verified 2026-11-04 on CLI 0.66.0.

## What it does

A chat app where visitors pick a display name and talk in three rooms with no sign-up form. Messages are saved in Postgres, so a reload keeps the history. New messages, the online count and "ada is typing…" arrive live over Volcano Realtime.

![Volcano Chat in #random: ada and sam trading messages, 2 online, and "ada is typing…" under the conversation](/cookbooks/realtime-chat-poster.png)

![sam's view a moment later: ada's new message has arrived live, she is typing again, and sam has a reply drafted](/cookbooks/realtime-chat-typing.png)

## What you need

- A Volcano account. Tested on SUPERAGENT. The app uses anonymous sign-in, one database, one frontend, and broadcast and presence channels. No functions and no third-party services.
- Claude Code, Codex or Cursor with the Volcano skills (`volcano setup`), or Node.js 24+ and the [Volcano CLI](/get-started/install) to build it yourself.

## Build it with your coding agent

Paste this into Claude Code, Codex or Cursor in an empty folder:

```text
Build a real-time chat app in this empty folder with Next.js and deploy it to Volcano.

- Visitors pick a display name and chat with no sign-up form (anonymous sign-in).
- Three rooms: general, random, help. Show who's online and who's typing.
- Keep messages in Postgres with row-level security: anyone signed in can read,
  people can only post as themselves, and messages can't be edited or deleted.
- Save each message before announcing it, and broadcast only its id, so a client
  can't make others display something the database didn't accept.
- Only the anon key goes to the browser. It needs Realtime Connect, Subscribe and
  Publish as well as the default Auth permissions.

Create a new Volcano project named volcano-chat, deploy to production and give me
the URL. Before you finish, test the live app with two anonymous users: B's message
reaches A without a reload, both show as online, and the database refuses a message
B posts with A's user id.
```

Tested with a fresh Claude Code agent (claude-opus-5-5) in an empty folder. It had only this prompt, Volcano CLI 0.66.0 and `volcano docs`, without the Volcano plugin, and the project was renamed so it didn't collide with an existing one. It worked on the first try in about 13 minutes. It deployed, then wrote a two-browser test that passed all 10 checks and passed again on a second run by hand. Those checks covered live delivery, both users online, typing, the refused post as another user, no edits or deletes, and forged broadcasts showing nothing. The one thing it had to work around was the Realtime key: the CLI only makes auth-only keys, so it called the anon key API with a project access token. It also chose one online list for the whole app, not one per room.

## Build it yourself

Scaffold a Next.js project and add a database:

```bash
volcano init nextjs
npm install
volcano login
volcano projects create volcano-chat
volcano use volcano-chat
volcano cloud databases create chat --region us-east-1 --pg-version 16
```

`volcano init nextjs` puts `package.json` at the root, the app in `web/`, and the migrations in `volcano/migrations/`. It also writes `.volcano/source-layout.json`, which tells `volcano cloud deploy` where the app is. Check that it lists the app, or create it if it's missing (older CLI versions don't write it):

```json
{ "version": 1, "frontends": [{ "name": "web", "workspace": "", "app_root": "web" }] }
```

### Tables and row-level security

Volcano runs each migration file as one query, so every statement below goes in its own numbered file, for example `001_create_rooms.sql` up to `015_rooms_seed.sql`. Each one is safe to re-run: `IF NOT EXISTS`, a `DROP POLICY IF EXISTS` file before each `CREATE POLICY` file, and `ON CONFLICT DO NOTHING` for the seed.

```sql
CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,32}$'),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id),
  user_id uuid NOT NULL,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 24),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_room_created_idx ON public.messages (room_id, created_at DESC);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rooms, public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rooms, public.messages TO authenticated;
GRANT INSERT (room_id, user_id, author_name, body) ON public.messages TO authenticated;
DROP POLICY IF EXISTS rooms_read ON public.rooms;
CREATE POLICY rooms_read ON public.rooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS messages_read ON public.messages;
CREATE POLICY messages_read ON public.messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS messages_send ON public.messages;
CREATE POLICY messages_send ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
INSERT INTO public.rooms (id, title) VALUES
  ('general', 'General'), ('random', 'Random'), ('help', 'Help')
ON CONFLICT (id) DO NOTHING;
```

The column-level `INSERT` grant means a client can't set `id` or `created_at`. With no `UPDATE` or `DELETE` grant, messages are append-only.

### Sign in and connect

Create one client per tab inside a client effect, and connect the realtime socket while the rooms load:

```javascript
import { VolcanoClient } from '@volcano.dev/sdk';
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';

const apiUrl = process.env.NEXT_PUBLIC_VOLCANO_API_URL;
const anonKey = process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY;

const volcano = new VolcanoClient({ apiUrl, anonKey });
volcano.database(process.env.NEXT_PUBLIC_VOLCANO_DATABASE);
const restored = await volcano.initialize();
if (restored.error) throw restored.error;
if (!restored.user) {
  const { error } = await volcano.auth.signInAnonymously();
  if (error) throw error;
}

const realtime = new VolcanoRealtime({
  apiUrl, anonKey,
  accessToken: volcano.accessToken,
  async getToken() {
    const { session, error } = await volcano.auth.refreshSession();
    if (error || !session) throw error || new Error('Session expired');
    return session.access_token;
  },
});
const [{ data: rooms, error: roomsError }] = await Promise.all([
  volcano.from('rooms').select('id,title').order('id'),
  realtime.connect(),
]);
if (roomsError) throw roomsError;

// One broadcast channel per room for the whole session. A channel only sends
// while subscribed, so a message still saving when you switch rooms can still
// reach the room it was written in.
const roomChannels = new Map(rooms.map((room) =>
  [room.id, realtime.channel(`chat-${room.id}`, { type: 'broadcast' })]));
for (const channel of roomChannels.values()) channel.subscribe().catch(showError);
```

### Send a message

Save first. `volcano.insert()` resolves to the created rows, so show your own message from that result, then tell the room the new id. Take the room's channel before the insert, and show the row only if that room is still on screen:

```javascript
async function send(roomId, authorName, body) {
  const channel = roomChannels.get(roomId);
  const { data, error } = await volcano.insert('messages', {
    room_id: roomId, user_id: volcano.auth.user().id, author_name: authorName, body,
  });
  if (error) throw error;
  if (roomId === currentRoomId) showMessage(data[0]);
  channel.send({ event: 'message', id: data[0].id }).catch(() => {
    showError(new Error('Sent, but live delivery failed. Peers will see it on reload.'));
  });
}
```

### Receive messages, presence and typing

For each room, register listeners, show history, subscribe, then load history again. `merge(rows)` adds rows by id and sorts by `created_at`, so the same message can arrive from history and from a broadcast without showing twice. `joinRoom` returns the cleanup for when the room unmounts, for example from a React effect:

```javascript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function joinRoom(roomId) {
  let cancelled = false;
  currentRoomId = roomId;
  const live = roomChannels.get(roomId);
  const presence = realtime.channel(`presence-${roomId}`, { type: 'presence' });

  // Reads take 1–2 seconds; drop any that finish after the room is gone.
  function loadHistory() {
    return volcano.from('messages').select('id,room_id,user_id,author_name,body,created_at')
      .eq('room_id', roomId).order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (error) throw error;
        if (!cancelled) merge(data.reverse());
      });
  }

  // The broadcast channel outlives this room view, so keep each handler's off().
  const offMessage = live.on('message', async ({ id } = {}) => {
    // Any visitor can publish, so a bogus id costs one ignored event, not a history reload.
    if (typeof id !== 'string' || !UUID_RE.test(id)) return;
    const { data, error } = await volcano.from('messages')
      .select('id,room_id,user_id,author_name,body,created_at').eq('id', id).limit(1);
    if (cancelled) return;
    // A failed read would drop the message, so reconcile from history instead.
    if (error) return loadHistory().catch(showError);
    if (data?.[0]?.room_id === roomId) merge(data);
  });
  const offTyping = live.on('typing', ({ user, name } = {}) => {
    if (user !== me && typeof name === 'string') showTyping(user, name.slice(0, 24));
  });
  presence.onPresenceSync((state) => {
    if (!cancelled) setOnline(new Set(Object.values(state).map((p) => p.user)).size);
  });

  let ready = false;
  const offConnect = realtime.onConnect(() => {
    if (ready && !cancelled) void live.subscribe().then(loadHistory).catch(showError);
  });
  loadHistory().catch(showError);
  Promise.all([live.subscribe(), presence.subscribe()])
    .then(() => {
      if (cancelled) return;
      ready = true;
      return loadHistory();
    })
    .catch(showError);

  return function leaveRoom() {
    cancelled = true;
    offConnect();
    offMessage();
    offTyping();
    realtime.removeChannel(`presence-${roomId}`, 'presence');
  };
}
```

Channels are cached by name, and `unsubscribe()` only pauses delivery and keeps the handlers. So a room view that leaves its listeners behind stacks a second set on #general → #random → #general, and each broadcast then triggers two database reads. Here the broadcast channel stays subscribed and `leaveRoom` calls each handler's `off()`. The presence channel belongs to the view, so `removeChannel()` drops it along with its listeners.

Send typing events at most every 1.5 seconds while someone types (`roomChannels.get(currentRoomId).send({ event: 'typing', user: me, name })`), and drop each typer 3 seconds after their last event. Queue the database reads the way the [Pixelboard](./pixel-board.md) does if out-of-order responses matter in your UI. Here, merging by id makes the order of reads harmless.

### Configure and deploy

Save `volcano/volcano-config.yaml`:

```yaml
version: 1
realtime:
  enabled: true
  broadcast_enabled: true
  presence_enabled: true
auth:
  signup:
    enable_signup: true
    enable_anonymous_signins: true
  cors:
    enabled: true
    allowed_origins:
      - http://localhost:3000
frontends:
  - name: web
    variable_scope: scoped
    variables:
      - NEXT_PUBLIC_VOLCANO_API_URL
      - NEXT_PUBLIC_VOLCANO_ANON_KEY
      - NEXT_PUBLIC_VOLCANO_DATABASE
```

The browser key needs Realtime permissions, and `volcano projects keys anon create` only makes auth-only keys. Create it in the [dashboard's anonymous keys page](https://volcano.dev/dashboard/keys): select the project, click **Create Key**, name it `Chat`, keep the default **Auth** permissions, add **Realtime → Connect, Subscribe, Publish**, and copy the value. To script it, mint a short-lived project access token with `volcano cloud access-tokens create chat-key-setup --expires-at <RFC3339 time> --json`. Send it as the bearer token to the [anon key API](/platform/authentication/security/anon-keys) with the same permission list, then revoke it with `volcano cloud access-tokens revoke chat-key-setup --yes`.

Put the three variables in `volcano/cloud.env`, and the same values in `web/.env.local` for `npm run dev`. Both paths are gitignored:

```dotenv
NEXT_PUBLIC_VOLCANO_API_URL=https://api.volcano.dev
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-your-chat-key
NEXT_PUBLIC_VOLCANO_DATABASE=chat
```

Deploy everything in one command:

```bash
volcano cloud deploy --env-file volcano/cloud.env --with-migrations -d chat
```

It saves the variables, runs the migrations, builds the frontend and applies the manifest, then prints the frontend URL. Add that exact HTTPS origin to `auth.cors.allowed_origins` and run the same command again. Without it, the browser can't open the realtime socket. See [CORS configuration](/platform/authentication/configuration/cors).

## Check that it works

Open the URL in a normal window and a private window, so each gets its own anonymous user. Pick different names and open the same room. Each window should show "2 online". A message sent in one appears in the other without a reload, and typing in one shows "… is typing" in the other for about 3 seconds. Reload either window to confirm the history is still there.

To check the database and not just the page, write a short Node script that signs in two anonymous users against the live project with the same SDK calls. It should check that presence sees both users, that B's message reaches A as a broadcast id A can read back, that B can't insert a row with A's `user_id`, that an update fails, and that a 501-character body is rejected. In testing, that script passed all eight checks:

```text
PASS two distinct anonymous users
PASS presence sees both users
PASS B inserts a message
PASS A receives broadcast id
PASS A reads the persisted row
PASS RLS blocks posting as another user — Query failed: ERROR: new row violates row-level security policy for table "messages" (SQLSTATE 42501)
PASS messages cannot be edited — Query failed: ERROR: permission denied for table messages (SQLSTATE 42501)
PASS CHECK rejects bodies over 500 chars — Query failed: ERROR: new row for relation "messages" violates check constraint "messages_body_check" (SQLSTATE 23514)
```

The first load took about 5 seconds in testing. Loading the page took about 1.6 seconds, and each database read 1 to 2 seconds. After that, messages arrived within a few hundred milliseconds.

## Why it's built this way

- **Postgres is the source of truth.** Broadcast carries only the message id, and receivers read the row. A client can broadcast anything, but it can't make others show a message the database didn't accept. The cost is one read per incoming message, which is fine for small rooms. For busy ones, subscribe to [Postgres changes](/platform/realtime/postgres-changes) or batch the reads.
- **Two snapshots per room.** History loads straight away so the room isn't empty, then again once the channels are subscribed, because a message sent between the first read and the subscription would otherwise be missed. Merging by id makes the overlap harmless. Every reconnect re-subscribes and loads again.
- **Presence for who's here, broadcast for what they're doing.** Presence gives each connection's authenticated user id, so the online count counts distinct users across tabs. Typing is a short-lived broadcast and is never stored.
- **Anonymous sessions, not accounts.** Display names are plain labels anyone can reuse, and only `user_id` is tied to the session. Add [email sign-in](./notes-app-with-login.md) if names must belong to someone.
- **No moderation.** Any visitor can post, there's no rate limit, and messages can't be deleted from the app. Add a cooldown, a report flow and an admin delete path before running a public room.
