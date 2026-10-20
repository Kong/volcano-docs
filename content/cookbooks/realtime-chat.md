---
title: Realtime chat
description: Build a live chat prototype that broadcasts messages between connected browser tabs using Volcano Realtime.
---

Build a chat prototype for one shared demo room.
Messages reach currently connected subscribers and are not saved as chat history.

## Prepare the project

Complete [user signup and login](./user-signup-and-login.md) and reuse its `volcano.js` client.
Enable realtime access for your project and use an anonymous key with `realtime.connect` permission.
Configure channel access for your intended demo users.
If CORS is enabled, add your application's exact origin, such as `http://localhost:3000`, to the project's auth allowed origins.
See the [realtime guide](/sdk/js/realtime) for connection and channel behavior.

## Connect and subscribe

Create `chat.js` next to `volcano.js`.
Call `startChat()` after signing in and pass a function that adds a received message to your interface.
Render message text as text content rather than HTML.

```javascript
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';
import { volcano } from './volcano.js';

export async function startChat(onMessage) {
  const { user, error } = await volcano.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sign in before joining chat');

  const realtime = new VolcanoRealtime({
    apiUrl: 'YOUR_PROJECT_API_URL',
    anonKey: 'YOUR_PROJECT_ANON_KEY',
    accessToken: volcano.accessToken,
  });
  realtime.onError(function handleError(context) {
    console.error('Chat connection error:', context.message);
  });

  const channel = realtime.channel('cookbook-demo', { type: 'broadcast' });
  channel.on('message', function handleMessage(data) {
    if (typeof data.text !== 'string') return;
    onMessage({ text: data.text });
  });

  try {
    await realtime.connect();
    await channel.subscribe();
  } catch (error) {
    realtime.disconnect();
    throw error;
  }

  async function sendMessage(text) {
    const message = text.trim();
    if (!message) return;
    if (message.length > 1000) throw new Error('Keep messages under 1,001 characters');
    await channel.send({ event: 'message', text: message });
  }

  function close() {
    realtime.disconnect();
  }

  return { sendMessage, close };
}
```

Replace the API URL and anonymous key with the same values used by your authenticated client.
All tabs using this channel share the demo room; channel names alone do not enforce private room membership.

## Wire up your interface

Keep the object returned by `startChat()` for the lifetime of the chat view.
Call its `sendMessage(text)` method from the message form and show a retry option if sending fails.
Disable the form until `startChat()` resolves.
Call `close()` when leaving the view, signing out, or changing accounts, then create a new connection after the next sign-in.
For long-lived connections, follow the [dynamic token refresh guide](/sdk/js/realtime#dynamic-token-refresh).

## Check the result

1. Open the application in two browser tabs and sign in.
2. Connect both tabs to the demo room.
3. Send a message from one tab and confirm the other receives it.
4. Close the connection in one tab and confirm it stops receiving messages.
5. Reload a tab and confirm old messages are absent; broadcast does not replay history.

To add persistent history, store messages in a [database](/sdk/js/database) with row-level access policies and use [Postgres changes](/sdk/js/realtime#postgres-changes) to refresh the view.
