---
title: Build a Pixelboard
description: Create a shared pixel canvas with anonymous sign-in, persistent colors, and live updates using Volcano.
tags: [database, realtime, authentication]
---

## What it does

Paint a shared 400×240 canvas and watch other people draw, move their cursors, and chat live.
This is the Pixel canvas onboarding template (`pixel-board`): PostgreSQL stores colors; realtime carries live interactions.

![Pixelboard showing a shared canvas, color palette, and live collaborators](/cookbooks/pixel-board-poster.png)

## What you need

A Volcano account; no third-party services.
For the code paths below, install Node.js 24+, the [Volcano CLI](/get-started/install), and, for your agent, the [Volcano skills](https://github.com/Kong/volcano-agentic-plugins).

## Build it with your coding agent

Paste this into Claude Code, Cursor, or Codex with Volcano skills installed:

```text
Build Pixelboard using Next.js and Volcano Auth, Database, and Realtime.
Use a 400×240 zoomable, pannable canvas, a 16-color palette, an eraser,
and a minimap. Support mouse and touch.
Restore the session or sign in anonymously; no registration form.
Pre-seed a pixels table keyed by (x,y), default color #2A2A2A, with
updated_by and updated_at. Enable RLS; authenticated visitors can read
and update colors, but cannot insert or delete cells.
Persist each paint before broadcasting a pixel event on place-live.
Use that broadcast channel for cursors (6-second expiry) and chat bubbles
(60 characters, 5-second expiry; / to chat, Enter to finish).
Use place-lobby presence for the online count. Validate incoming events.
Enable anonymous sign-ins, broadcast/presence, and the needed key permissions.
Subscribe before loading the saved grid; reconcile on reconnect.
Handle failed writes, token refresh, loading/errors, and unmount cleanup.
Create the app in a new folder with web/ and volcano/migrations/.
Include the manifest and deployment commands; test in two browsers.
Ask before creating cloud resources or deploying.
```

For the one-click path, choose **Pixel canvas** when creating a project in the dashboard.
The CLI also supports `volcano projects create my-pixels --template pixel-board`; wait for `volcano projects get my-pixels` to report installation `ready`.

## Build it yourself

Create a Next.js app in `web/` and install `@volcano.dev/sdk` and `centrifuge` there.
Wire these core excerpts into its client canvas, palette, and error display; they are not complete UI files.

Save **each SQL statement separately**, in order, as `001.sql` through `008.sql` under `volcano/migrations/`:

```sql
CREATE TABLE public.pixels (
  x integer NOT NULL, y integer NOT NULL,
  color text NOT NULL DEFAULT '#2A2A2A',
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (x,y)
);
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pixels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pixels TO authenticated;
GRANT UPDATE(color,updated_by,updated_at) ON public.pixels TO authenticated;
CREATE POLICY pixels_read ON public.pixels FOR SELECT
  TO authenticated USING (true);
CREATE POLICY pixels_paint ON public.pixels FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL)
  WITH CHECK (updated_by = auth.uid());
INSERT INTO public.pixels(x,y)
SELECT x,y FROM generate_series(0,399) x, generate_series(0,239) y;
```

Initialize one browser client inside an async setup function, before enabling painting:

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
  const { error } = await volcano.auth.signUpAnonymous();
  if (error) throw error;
}
```

Call async setup from a client effect, catch its errors in your error display, and return synchronous cleanup from the effect.
Register listeners before subscribing.
`drawPixel(x,y,color)` updates your canvas; `showError(error)` displays a visible error.
Buffer broadcasts during snapshot loading so an older query cannot overwrite a live paint.
On unmount, call `live.unsubscribe()` and `realtime.disconnect()`; guard async setup and drawing after unmount.

```javascript
let loading = false;
const pending = new Map();
async function loadGrid() {
  if (loading) return;
  loading = true;
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await volcano.from('pixels').select('x,y,color')
        .order('x').order('y').limit(1000).offset(offset);
      if (error) throw error;
      for (const p of data ?? []) drawPixel(p.x, p.y, p.color);
      if ((data?.length ?? 0) < 1000) break;
    }
  } finally {
    for (const p of pending.values()) drawPixel(p.x, p.y, p.color);
    pending.clear(); loading = false;
  }
}
const realtime = new VolcanoRealtime({ apiUrl, anonKey,
  accessToken: volcano.accessToken,
  async getToken() {
    const { session, error } = await volcano.auth.refreshSession();
    if (error || !session) throw error || new Error('Session expired');
    return session.access_token;
  },
});
const live = realtime.channel('place-live', { type: 'broadcast' });
live.on('pixel', (pixel) => {
  if (!pixel || typeof pixel !== 'object') return;
  const { x, y, color } = pixel;
  if (Number.isInteger(x) && x >= 0 && x < 400 &&
      Number.isInteger(y) && y >= 0 && y < 240 &&
      /^#[0-9a-f]{6}$/i.test(color)) {
    if (loading) pending.set(`${x},${y}`, pixel);
    else drawPixel(x, y, color);
  }
});
let subscribed = false;
realtime.onConnect(() => {
  if (subscribed) void loadGrid().catch(showError);
});
await realtime.connect();
await live.subscribe();
subscribed = true;
await loadGrid();

async function paint(x, y, color) {
  const { error } = await volcano.update('pixels', {
    color, updated_by: volcano.auth.user().id,
    updated_at: new Date().toISOString(),
  }).eq('x', x).eq('y', y);
  if (error) throw error;
  drawPixel(x, y, color);
  try { await live.send({ type: 'pixel', x, y, color }); }
  catch { showError(new Error('Pixel saved; live update failed. Reload to sync.')); }
}
```

Save `volcano/volcano-config.yaml`:

```yaml
version: 1
realtime:
  enabled: true
  broadcast_enabled: true
  presence_enabled: true
auth:
  signup:
    enable_anonymous_signins: true
```

Create a fresh project and database:

```bash
volcano login
volcano projects create my-pixels
volcano use my-pixels
volcano cloud databases create pixel_board
volcano cloud databases get pixel_board
```

Wait for database status `active`.
Create an [anonymous key with custom permissions](/platform/authentication/security/anon-keys#creating-a-key-with-custom-permissions): all auth permissions plus `realtime.connect`, `realtime.subscribe`, and `realtime.publish`.
Set these in `volcano/cloud.env` and `web/.env.local`:

```dotenv
NEXT_PUBLIC_VOLCANO_API_URL=https://api.volcano.dev
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-your-project-key
NEXT_PUBLIC_VOLCANO_DATABASE=pixel_board
```

Replace the key; add `volcano/*.env` and `web/.env*` to the root `.gitignore` before deployment.
From the project root, run in order:

```bash
volcano cloud databases migration up --all --database pixel_board
volcano cloud config deploy --file volcano/volcano-config.yaml
volcano cloud variables deploy --file volcano/cloud.env
volcano cloud frontends deploy --name web --path . --app-root web \
  --variable-scope scoped --variable NEXT_PUBLIC_VOLCANO_API_URL \
  --variable NEXT_PUBLIC_VOLCANO_ANON_KEY --variable NEXT_PUBLIC_VOLCANO_DATABASE
volcano cloud frontends get web
```

Allow your exact development and deployed origins in the project's auth CORS settings.
These initial migrations target an empty database; do not rerun them on an installed template.

## Check that it works

Open the app in two browser profiles.
Paint in one; confirm the other updates without reloading.
Reload both to confirm persistence, then disconnect/reconnect one and verify its canvas catches up.
Move a cursor and send a chat bubble; both should appear remotely and expire.

## Why it's built this way

Pre-seeding makes painting an UPDATE, avoiding insert races.
PostgreSQL is authoritative; broadcasts, cursors, and chat are ephemeral.
Broadcasts can be missed or forged, so validate payloads and reload saved colors after reconnecting.
This open canvas has no painting cooldown or moderation; add those before running a public community.
