const { Pool } = require('pg');

// Size this across all execution instances within the shared project capacity.
const MAX_USER_POOLS = 4;
const poolsByUser = new Map();

async function connectForUser(userId) {
  let entry = poolsByUser.get(userId);
  if (entry?.pending) await entry.ready;
  if (!entry) {
    if (poolsByUser.size < MAX_USER_POOLS) {
      entry = { pool: null, pending: true };
      poolsByUser.set(userId, entry);
    } else {
      entry = await reserveEntry(userId);
    }
  }
  try {
    if (entry.pending) {
      const url = new URL(process.env.DATABASE_URL);
      url.searchParams.set('application_name', `volcano_user_access:${userId}`);
      entry.pool = new Pool({
        connectionString: url.toString(),
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      entry.pool.on('error', () => console.error('Idle database connection failed'));
      entry.pool.on('remove', () => retireEmptyPool(userId, entry));
      entry.pending = false;
    }
    // Call connect before yielding: its client/waiter counts protect the entry
    // from idle eviction while acquisition is pending.
    return await entry.pool.connect();
  } catch (error) {
    retireEmptyPool(userId, entry);
    throw error;
  }
}

async function reserveEntry(userId) {
  const entry = { pool: null, pending: true };
  const idle = [...poolsByUser].find(
    ([, candidate]) =>
      !candidate.pending && candidate.pool.idleCount === candidate.pool.totalCount && candidate.pool.waitingCount === 0,
  );
  if (!idle) throw capacityError();
  const [oldUserId, oldEntry] = idle;
  // Reserve the same cache slot while Pool.end completes. This bounds cache
  // entries, not process file descriptors or the driver's asynchronous cleanup.
  poolsByUser.delete(oldUserId);
  poolsByUser.set(userId, entry);
  try {
    entry.ready = oldEntry.pool.end();
    await entry.ready;
  } catch (error) {
    poolsByUser.delete(userId);
    throw error;
  }
  return entry;
}

function retireEmptyPool(userId, entry) {
  const pool = entry.pool;
  if (poolsByUser.get(userId) !== entry || (pool && (pool.totalCount !== 0 || pool.waitingCount !== 0))) return;
  // A failed startup emits no remove event, so connect's catch uses this too.
  poolsByUser.delete(userId);
  pool?.end().catch(() => console.error('Database pool cleanup failed'));
}

function capacityError() {
  return Object.assign(new Error('User connection capacity reached; retry with backoff'), {
    code: 'USER_POOL_CAPACITY',
  });
}

module.exports = { connectForUser };
