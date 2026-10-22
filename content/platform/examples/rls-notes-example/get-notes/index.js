const { Client } = require('pg');

exports.handler = async (event) => {
  const auth = event.__volcano_auth;

  if (!auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Build connection string with auth context. DATABASE_URL already carries the
  // unique routing username and an application_name (volcano_full_access), so
  // REPLACE application_name to switch to user-access — appending a second one
  // would leave the startup mode up to the driver's duplicate-param handling.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', `volcano_user_access:${auth.user_id}`);

  const client = new Client({ connectionString: url.toString() });

  try {
    const notes = await queryNotes(client);
    return notesResponse(notes, auth.user_id);
  } catch (error) {
    console.error('Error getting notes:', error);

    // If table doesn't exist, return empty array
    if (error.message && error.message.includes('does not exist')) {
      return notesResponse([], auth.user_id);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function queryNotes(client) {
  await client.connect();

  // Query - RLS automatically filters using auth.uid()
  // auth.uid() returns auth.user_id from event.__volcano_auth
  const result = await client.query(
    'SELECT id, user_id, title, content, created_at FROM notes ORDER BY created_at DESC',
  );

  await client.end();

  return result.rows;
}

function notesResponse(notes, userId) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      notes,
      count: notes.length,
      user_id: userId,
    }),
  };
}
