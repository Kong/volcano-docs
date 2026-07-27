/**
 * Backend Realtime Service Example
 * 
 * This example demonstrates using Volcano Realtime with a service role key
 * for server-to-server or backend-to-frontend communication.
 * 
 * Use cases:
 * - Admin notifications to all users
 * - System status updates
 * - Background job progress updates
 * - Bot/automated messages
 * 
 * Setup:
 *   1. yarn install
 *   2. Create .env file with SERVICE_KEY
 *   3. yarn dev
 * 
 * Environment variables:
 *   VOLCANO_API_URL - Your Volcano API URL (default: http://localhost:8000)
 *   SERVICE_KEY     - Your service role key (sk-...)
 *   ANON_KEY        - (Optional) Anon key for additional validation
 */

require('dotenv').config();
const { VolcanoRealtime } = require('@volcano.dev/sdk/realtime');

// Configuration
const config = {
  apiUrl: process.env.VOLCANO_API_URL || 'http://localhost:8000',
  serviceKey: process.env.SERVICE_KEY,
  anonKey: process.env.ANON_KEY || '',  // Optional with service key
};

// Validate configuration
if (!config.serviceKey) {
  console.error('');
  console.error('  Error: SERVICE_KEY environment variable is required');
  console.error('');
  console.error('  Create a .env file with:');
  console.error('    SERVICE_KEY=sk-your-service-key-here');
  console.error('    VOLCANO_API_URL=http://localhost:8000  # optional');
  console.error('');
  process.exit(1);
}

if (!config.serviceKey.startsWith('sk-')) {
  console.error('');
  console.error('  Error: SERVICE_KEY must be a service role key (starts with sk-)');
  console.error('  You provided:', config.serviceKey.substring(0, 10) + '...');
  console.error('');
  process.exit(1);
}

// Service key contains project ID, so anon key is optional
const realtime = new VolcanoRealtime({
  apiUrl: config.apiUrl,
  anonKey: config.anonKey,
  accessToken: config.serviceKey,
});

async function main() {
  console.log('');
  console.log('  🚀 Volcano Backend Realtime Service');
  console.log('  ====================================');
  console.log(`  API URL: ${config.apiUrl}`);
  console.log('');
  console.log('  Connecting...');
  
  try {
    await realtime.connect();
    console.log('  ✅ Connected!');
  } catch (error) {
    console.error('  ❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Subscribe to admin channel
  const adminChannel = realtime.channel('admin-notifications');
  
  adminChannel.on('*', (payload) => {
    console.log('  📨 Received event:', payload);
  });

  await adminChannel.subscribe();
  console.log('  📡 Subscribed to admin-notifications channel');

  // Example: Send periodic status updates
  let counter = 0;
  setInterval(async () => {
    counter++;
    
    const message = {
      event: 'status_update',
      timestamp: new Date().toISOString(),
      counter: counter,
      status: 'healthy',
      message: `Server heartbeat #${counter}`
    };

    try {
      await adminChannel.send(message);
      console.log(`  💓 Sent heartbeat #${counter}`);
    } catch (error) {
      console.error('  ❌ Failed to send:', error.message);
    }
  }, 10000); // Every 10 seconds

  // Example: Send a welcome message immediately
  await adminChannel.send({
    event: 'system',
    type: 'welcome',
    message: 'Backend service connected and ready',
    timestamp: new Date().toISOString()
  });
  console.log('  📤 Sent welcome message');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  👋 Disconnecting...');
    realtime.disconnect();
    process.exit(0);
  });

  console.log('');
  console.log('  ✨ Backend service running! Press Ctrl+C to stop.');
  console.log('');
}

main().catch(console.error);
