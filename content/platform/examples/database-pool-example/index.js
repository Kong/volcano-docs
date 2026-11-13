/**
 * Production Example: Database Access with Connection Pooling + RLS
 *
 * Volcano's pgproxy chooses the access mode and RLS identity from
 * `application_name` at CONNECTION STARTUP — it cannot be changed later with a
 * `SET application_name`. So to combine connection pooling with per-user
 * Row-Level Security, keep ONE pool per auth user, each built from a connection
 * string whose `application_name` is `volcano_user_access:{userId}`. Every
 * connection in that pool starts up scoped to that user, so queries are
 * RLS-filtered without any per-request SET. Pools are reused across invocations
 * while the execution environment is warm.
 */

const { connectForUser } = require('./user-db-pool');

/**
 * Handler - invoked per request
 */
exports.handler = async (event) => {
  // 1. Check authentication (from user's JWT token)
  const auth = event.__volcano_auth;

  if (!auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // 2. Get a connection from THIS user's pool. Its startup application_name
  // already fixed the RLS identity to auth.user_id, so every query below is
  // automatically scoped to that user — no `SET` needed (and none would work).
  let client;
  try {
    client = await connectForUser(auth.user_id);
  } catch (error) {
    // Log diagnostic codes, never connection strings or error messages.
    console.error('Database connection failed', { name: error?.name, code: error?.code ?? 'UNKNOWN' });
    return {
      statusCode: 503,
      headers: { 'Retry-After': '1' },
      body: JSON.stringify({ error: 'Database temporarily unavailable' }),
    };
  }

  try {
    return await dispatchAction(client, auth, event);
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    // 5. Return connection to pool (critical!)
    client.release();
  }
};

function dispatchAction(client, auth, event) {
  const { action, ...params } = event;

  switch (action) {
    case 'get_posts':
      return getPosts(client, auth, params);

    case 'create_post':
      return createPost(client, auth, params);

    case 'update_post':
      return updatePost(client, auth, params);

    case 'delete_post':
      return deletePost(client, auth, params);

    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unknown action' }),
      };
  }
}

/**
 * Get posts for current user
 * RLS automatically filters to user's posts
 */
async function getPosts(client, auth, params) {
  const { filter = 'all' } = params;

  let query = 'SELECT id, title, content, created_at FROM posts';

  if (filter === 'recent') {
    query += " WHERE created_at > NOW() - INTERVAL '7 days'";
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const { rows } = await client.query(query);

  return {
    statusCode: 200,
    body: JSON.stringify({
      posts: rows,
      count: rows.length,
      user_id: auth.user_id,
    }),
  };
}

/**
 * Create new post
 * user_id automatically set by database trigger using auth.uid()
 */
async function createPost(client, auth, params) {
  const { title, content } = params;

  if (!title || !content) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Title and content required' }),
    };
  }

  const { rows } = await client.query(
    'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING id, title, content, created_at',
    [title, content],
  );

  return {
    statusCode: 201,
    body: JSON.stringify({ post: rows[0] }),
  };
}

/**
 * Update post
 * RLS ensures user can only update their own posts
 */
async function updatePost(client, auth, params) {
  const { id, title, content } = params;

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Post ID required' }),
    };
  }

  const { rows } = await client.query(
    'UPDATE posts SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content',
    [title, content, id],
  );

  if (rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Post not found or access denied' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ post: rows[0] }),
  };
}

/**
 * Delete post
 * RLS ensures user can only delete their own posts
 */
async function deletePost(client, auth, params) {
  const { id } = params;

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Post ID required' }),
    };
  }

  const { rowCount } = await client.query('DELETE FROM posts WHERE id = $1', [id]);

  if (rowCount === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Post not found or access denied' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Post deleted' }),
  };
}
