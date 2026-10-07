/**
 * Function: Realtime Test
 *
 * Tests Volcano Realtime from inside a function, as the user who invoked it:
 * 1. Connects to the realtime server with the caller's access token
 * 2. Subscribes to a broadcast channel and sends a message
 * 3. Joins a presence channel and finds the caller in its presence state
 * 4. Subscribes to Postgres changes and receives the change to the caller's row
 * 5. Checks RLS isolation: no change arrives for another user's row
 *
 * Project variables (set in Volcano):
 * - REALTIME_TEST_API_URL: The Volcano API URL
 * - REALTIME_TEST_ANON_KEY: An anon key with the realtime permissions
 * - REALTIME_TEST_DATABASE_URL: The database's connection_string
 *
 * Volcano passes the caller in event.__volcano_auth when a signed-in user's
 * access token invokes the function.
 */

const { setTimeout: sleep } = require('node:timers/promises');
const { Client } = require('pg');
const { databaseConnectionString } = require('@volcano.dev/sdk');
const { VolcanoRealtime } = require('@volcano.dev/sdk/realtime');

// Bounds each step, so one stalled step doesn't use up the function timeout.
const STEP_TIMEOUT_MS = 5000;
// How long to keep watching for the other user's change after the caller's.
const ISOLATION_GRACE_MS = 1000;
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000000';

exports.handler = async (event) => {
  const auth = event.__volcano_auth;
  if (!auth) {
    return respond(401, { error: "Invoke this function with a signed-in user's access token" });
  }

  const apiUrl = process.env.REALTIME_TEST_API_URL;
  const anonKey = process.env.REALTIME_TEST_ANON_KEY;
  const databaseUrl = process.env.REALTIME_TEST_DATABASE_URL;
  if (!apiUrl || !anonKey || !databaseUrl) {
    return respond(500, {
      error:
        'Set the REALTIME_TEST_API_URL, REALTIME_TEST_ANON_KEY and REALTIME_TEST_DATABASE_URL project variables',
    });
  }

  const tests = [];
  const addResult = (name, passed, details = {}) => {
    tests.push({ name, passed, ...details });
  };

  // Connecting as the caller makes Realtime apply their RLS policies.
  const realtime = new VolcanoRealtime({ apiUrl, anonKey, accessToken: auth.access_token });
  const connection = { clientId: '', disconnectReason: '' };
  realtime.onConnect((context) => {
    connection.clientId = context.client ?? '';
  });
  // The server refuses a connection, such as one from a key without
  // realtime.connect, by disconnecting it, which connect() doesn't report.
  realtime.onDisconnect((context) => {
    connection.disconnectReason = context.reason ?? '';
  });

  try {
    // ==========================
    // Test 1: Connection
    // ==========================
    try {
      await withTimeout(realtime.connect(), 'Connection');
      addResult('Connection', realtime.isConnected());
    } catch (error) {
      const reason = connection.disconnectReason || error.message;
      addResult('Connection', false, { message: `Failed to connect: ${reason}` });
      return report(tests);
    }

    // ==========================
    // Test 2: Broadcast Channel
    // ==========================
    try {
      const broadcastChannel = realtime.channel('test-function-broadcast');
      await withTimeout(broadcastChannel.subscribe(), 'Broadcast subscribe');
      addResult('Broadcast Subscribe', true, { channel: broadcastChannel.name });

      await broadcastChannel.send({ event: 'test', from: 'function', timestamp: Date.now() });
      addResult('Broadcast Send', true);

      broadcastChannel.unsubscribe();
    } catch (error) {
      addResult('Broadcast Channel', false, { message: `Broadcast failed: ${error.message}` });
    }

    // ==========================
    // Test 3: Presence Channel
    // ==========================
    try {
      const presenceChannel = realtime.channel('test-function-presence', { type: 'presence' });
      await withTimeout(presenceChannel.subscribe(), 'Presence subscribe');

      // Subscribing adds this connection to the presence state, keyed by client,
      // which the SDK fetches shortly afterwards.
      const present = await waitFor(() => connection.clientId in presenceChannel.getPresenceState());
      addResult('Presence Channel', present, {
        channel: presenceChannel.name,
        presenceKeys: Object.keys(presenceChannel.getPresenceState()).length,
      });

      presenceChannel.unsubscribe();
    } catch (error) {
      addResult('Presence Channel', false, { message: `Presence failed: ${error.message}` });
    }

    // ==========================
    // Tests 4 and 5: Postgres Changes and RLS Isolation
    // ==========================
    await testPostgresChanges(realtime, databaseUrl, auth.user_id, addResult);
  } finally {
    realtime.disconnect();
  }

  return report(tests);
};

async function testPostgresChanges(realtime, databaseUrl, userId, addResult) {
  let db;
  const insertedIds = [];
  try {
    // Full access bypasses RLS, which the setup and the other user's row need.
    db = new Client({
      connectionString: databaseConnectionString(databaseUrl),
      connectionTimeoutMillis: STEP_TIMEOUT_MS,
      query_timeout: STEP_TIMEOUT_MS,
    });
    // A dropped connection fails the next query, which reports it.
    db.on('error', () => {});
    await db.connect();
    await createTestTable(db);

    // A change event carries only the row's primary key.
    const receivedIds = new Set();
    const pgChannel = realtime.channel('public:realtime_test', { type: 'postgres' });
    pgChannel.onPostgresChanges('INSERT', 'public', 'realtime_test', (change) => {
      receivedIds.add(change.id);
    });

    // Subscribe before inserting: earlier writes produce no events.
    await withTimeout(pgChannel.subscribe(), 'Postgres subscribe');
    addResult('Postgres Subscribe', true, { channel: pgChannel.name });

    // Insert the other user's row first, so a leaked change has at least as
    // long to arrive as the caller's own.
    const otherRowId = await insertRow(db, OTHER_USER_ID, 'This should be invisible to us');
    insertedIds.push(otherRowId);
    const ownRowId = await insertRow(db, userId, `Function test at ${new Date().toISOString()}`);
    insertedIds.push(ownRowId);

    const ownChangeReceived = await waitFor(() => receivedIds.has(ownRowId));
    addResult('Postgres Change Received', ownChangeReceived, {
      receivedCount: receivedIds.size,
    });

    await sleep(ISOLATION_GRACE_MS);
    const otherUserChangeReceived = receivedIds.has(otherRowId);
    let message = 'Correctly did not receive change for other user';
    if (otherUserChangeReceived) {
      message = 'SECURITY ISSUE: Received change for other user';
    } else if (!ownChangeReceived) {
      // Without the caller's own change, a missing event proves nothing.
      message = 'Inconclusive: no change arrived for the caller either';
    }
    addResult('RLS Isolation', ownChangeReceived && !otherUserChangeReceived, { message });

    pgChannel.unsubscribe();
  } catch (error) {
    addResult('Postgres Changes', false, { message: `Postgres changes failed: ${error.message}` });
  } finally {
    if (db && insertedIds.length > 0) {
      // Best effort: a failed cleanup doesn't change the results.
      await db.query('DELETE FROM public.realtime_test WHERE id = ANY($1)', [insertedIds]).catch(() => {});
    }
    await db?.end();
  }
}

// Runs once: after the policy exists, invocations skip the DDL, whose table
// locks would hold up Realtime's RLS checks. One statement per query, because
// the database proxy rejects multi-statement queries. If a statement fails,
// closing the connection rolls the transaction back.
async function createTestTable(db) {
  const { rows } = await db.query(`
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'realtime_test' AND policyname = 'realtime_test_user_only'
  `);
  if (rows.length > 0) {
    return;
  }

  await db.query('BEGIN');
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.realtime_test (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      data TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query('ALTER TABLE public.realtime_test ENABLE ROW LEVEL SECURITY');
  // Realtime checks this policy as each subscriber before delivering a change.
  await db.query(`
    CREATE POLICY realtime_test_user_only ON public.realtime_test
      FOR SELECT
      USING (user_id = auth.uid())
  `);
  await db.query('COMMIT');
}

async function insertRow(db, userId, data) {
  const { rows } = await db.query(
    'INSERT INTO public.realtime_test (user_id, data) VALUES ($1, $2) RETURNING id',
    [userId, data]
  );
  return rows[0].id;
}

async function waitFor(condition) {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (!condition() && Date.now() < deadline) {
    await sleep(100);
  }
  return condition();
}

async function withTimeout(promise, step) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${step} timed out`)), STEP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function report(tests) {
  const failed = tests.filter((test) => !test.passed).length;
  return respond(failed === 0 ? 200 : 500, {
    success: failed === 0,
    summary: `${tests.length - failed} passed, ${failed} failed`,
    tests,
  });
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
