/**
 * Lambda Function: Realtime Test
 * 
 * This Lambda function tests Volcano Realtime capabilities:
 * 1. Connects to realtime server
 * 2. Subscribes to postgres changes
 * 3. Creates a record and verifies the change event is received
 * 4. Tests RLS isolation by ensuring only authorized records are visible
 * 
 * Environment Variables (set in Volcano):
 * - VOLCANO_API_URL: The API server URL
 * - VOLCANO_ANON_KEY: Project anon key
 * - VOLCANO_REALTIME_URL: Realtime WebSocket URL (optional)
 * 
 * Context Variables (from Volcano):
 * - context.user: The authenticated user making the request
 * - context.projectId: The project ID
 * - context.db: Database client with RLS context
 */

const { VolcanoRealtime } = require('@volcano.dev/sdk/realtime');

// Test timeout in milliseconds
const TEST_TIMEOUT = 10000;

exports.handler = async (event, context) => {
  const results = {
    tests: [],
    passed: 0,
    failed: 0,
    errors: [],
  };

  const addResult = (name, passed, details = {}) => {
    results.tests.push({ name, passed, ...details });
    if (passed) results.passed++;
    else results.failed++;
  };

  try {
    // Get configuration from environment
    const apiUrl = process.env.VOLCANO_API_URL;
    const anonKey = process.env.VOLCANO_ANON_KEY;
    const realtimeUrl = process.env.VOLCANO_REALTIME_URL || apiUrl;

    if (!apiUrl || !anonKey) {
      throw new Error('Missing required environment variables: VOLCANO_API_URL, VOLCANO_ANON_KEY');
    }

    // Get user context from Volcano
    const user = context.user;
    const accessToken = context.accessToken;

    if (!user || !accessToken) {
      throw new Error('This function requires authenticated user context');
    }

    console.log(`Running realtime tests for user: ${user.id}`);

    // ==========================
    // Test 1: Connection
    // ==========================
    let realtime;
    try {
      realtime = new VolcanoRealtime({
        apiUrl: realtimeUrl,
        anonKey,
        accessToken,
      });

      await Promise.race([
        realtime.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        ),
      ]);

      addResult('Connection', realtime.isConnected(), {
        message: 'Successfully connected to realtime server',
      });
    } catch (error) {
      addResult('Connection', false, {
        message: `Failed to connect: ${error.message}`,
      });
      results.errors.push(error.message);
      return formatResponse(results);
    }

    // ==========================
    // Test 2: Broadcast Channel Subscription
    // ==========================
    try {
      const broadcastChannel = realtime.channel('test-lambda-broadcast');
      
      await Promise.race([
        broadcastChannel.subscribe(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Subscribe timeout')), 5000)
        ),
      ]);

      addResult('Broadcast Subscribe', true, {
        channel: broadcastChannel.name,
      });

      // Test sending a message
      await broadcastChannel.send({ event: 'test', from: 'lambda', timestamp: Date.now() });
      addResult('Broadcast Send', true, {
        message: 'Successfully sent broadcast message',
      });

      broadcastChannel.unsubscribe();
    } catch (error) {
      addResult('Broadcast Channel', false, {
        message: `Broadcast failed: ${error.message}`,
      });
    }

    // ==========================
    // Test 3: Presence Channel
    // ==========================
    try {
      const presenceChannel = realtime.channel('test-lambda-presence', { type: 'presence' });
      
      await Promise.race([
        presenceChannel.subscribe(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Subscribe timeout')), 5000)
        ),
      ]);

      // Track presence
      await presenceChannel.track({ 
        status: 'testing',
        function: 'realtime-lambda-test',
        userId: user.id,
      });

      const presenceState = presenceChannel.getPresenceState();
      
      addResult('Presence Channel', true, {
        channel: presenceChannel.name,
        presenceKeys: Object.keys(presenceState).length,
      });

      presenceChannel.unsubscribe();
    } catch (error) {
      addResult('Presence Channel', false, {
        message: `Presence failed: ${error.message}`,
      });
    }

    // ==========================
    // Test 4: Postgres Changes with RLS
    // ==========================
    try {
      // First, ensure the test table exists and has RLS
      const db = context.db;
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS realtime_test (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          data TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Enable RLS if not already enabled
        ALTER TABLE realtime_test ENABLE ROW LEVEL SECURITY;
        
        -- Create or replace the RLS policy
        DROP POLICY IF EXISTS realtime_test_user_only ON realtime_test;
        CREATE POLICY realtime_test_user_only ON realtime_test
          FOR ALL
          USING (user_id::text = current_setting('request.jwt.claim.sub', true));
      `);

      // Subscribe to postgres changes
      const pgChannel = realtime.channel('public:realtime_test', { type: 'postgres' });
      
      const receivedChanges = [];
      pgChannel.onPostgresChanges('*', 'public', 'realtime_test', (change) => {
        receivedChanges.push(change);
      });

      await Promise.race([
        pgChannel.subscribe(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Subscribe timeout')), 5000)
        ),
      ]);

      addResult('Postgres Subscribe', true, {
        channel: pgChannel.name,
      });

      // Insert a record for this user
      const testData = `Lambda test at ${new Date().toISOString()}`;
      await db.query(
        'INSERT INTO realtime_test (user_id, data) VALUES ($1, $2)',
        [user.id, testData]
      );

      // Wait for the change event
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we received the change
      const ourChange = receivedChanges.find(c => 
        c.record?.user_id === user.id && c.record?.data === testData
      );

      addResult('Postgres Change Received', receivedChanges.length > 0, {
        receivedCount: receivedChanges.length,
        receivedOurChange: !!ourChange,
      });

      // ==========================
      // Test 5: RLS Isolation
      // ==========================
      // Insert a record for a different user and verify we DON'T receive it
      const otherUserId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        'INSERT INTO realtime_test (user_id, data) VALUES ($1, $2)',
        [otherUserId, 'This should be invisible to us']
      );

      // Wait for potential change event
      await new Promise(resolve => setTimeout(resolve, 2000));

      const otherUserChange = receivedChanges.find(c => 
        c.record?.user_id === otherUserId
      );

      addResult('RLS Isolation', !otherUserChange, {
        message: otherUserChange 
          ? 'SECURITY ISSUE: Received change for other user' 
          : 'Correctly did not receive change for other user',
        otherUserChangeReceived: !!otherUserChange,
      });

      pgChannel.unsubscribe();
    } catch (error) {
      addResult('Postgres Changes', false, {
        message: `Postgres changes failed: ${error.message}`,
      });
      results.errors.push(error.message);
    }

    // Disconnect
    realtime.disconnect();

    // ==========================
    // Test 6: Verify Disconnect
    // ==========================
    addResult('Disconnect', !realtime.isConnected(), {
      message: 'Successfully disconnected from realtime server',
    });

  } catch (error) {
    results.errors.push(error.message);
    console.error('Test error:', error);
  }

  return formatResponse(results);
};

function formatResponse(results) {
  const allPassed = results.failed === 0;
  
  return {
    statusCode: allPassed ? 200 : 500,
    body: {
      success: allPassed,
      summary: `${results.passed} passed, ${results.failed} failed`,
      tests: results.tests,
      errors: results.errors,
    },
  };
}
