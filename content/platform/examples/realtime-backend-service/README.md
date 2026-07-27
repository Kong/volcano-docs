---
title: "Realtime Backend Service Example"
description: "This example demonstrates using Volcano Realtime with a service role key for backend/server-to-server communication."
---

# Realtime Backend Service Example

This example demonstrates using Volcano Realtime with a **service role key** for backend/server-to-server communication.

## Use Cases

- **Admin notifications** - Broadcast system messages to all connected users
- **Status updates** - Send server health, deployment status, etc.
- **Background jobs** - Push progress updates for long-running tasks
- **Bots/Automation** - Automated messages without user authentication

## Quick Start

```bash
# Install dependencies
yarn install

# Create .env file
echo "SERVICE_KEY=sk-your-service-key-here" > .env

# Run the service
yarn dev
```

## Authentication

Service role keys contain the project ID, so the anon key is **optional**:

```javascript
// Simplest: service key only
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: '',                    // Not required
  accessToken: 'sk-your-key'      // Service role key
});

// With extra validation
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: 'your-anon-key',       // Must match service key project
  accessToken: 'sk-your-key'
});
```

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Create a `.env` file:

```env
# Required: Your service role key
SERVICE_KEY=sk-your-service-key-here

# Optional: Volcano API URL (defaults to http://localhost:8000)
VOLCANO_API_URL=http://localhost:8000

# Optional: Anon key for additional validation
ANON_KEY=ak-your-anon-key
```

3. Run the service:

```bash
yarn dev
```

## How It Works

The service:
1. Connects to Volcano Realtime using the service key
2. Subscribes to the `admin-notifications` channel
3. Sends a welcome message
4. Sends periodic heartbeat messages every 10 seconds
5. Logs any received events

## Security Notes

- **Never expose service keys in client-side code**
- Service keys bypass Row Level Security for Postgres changes
- Service keys should only be used in trusted backend environments
- If the service key is compromised, regenerate it immediately
- Store service keys in environment variables or secure secret management

## Frontend Client Example

Frontend clients can listen to the same channels using user tokens:

```javascript
const realtime = new VolcanoRealtime({
  apiUrl: 'https://api.yourapp.com',
  anonKey: anonKey,
  accessToken: userToken
});

const channel = realtime.channel('admin-notifications');
channel.on('status_update', (payload) => {
  console.log('Server status:', payload.status);
});
await channel.subscribe();
```

Both backend (service key) and frontend (user token) clients can communicate on the same channels within a project.

## Project Structure

```
realtime-backend-service/
├── package.json    # Dependencies
├── index.js        # Service logic
├── .env            # Configuration (create this)
└── README.md
```
