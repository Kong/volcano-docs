/**
 * Lambda Example: Using @volcano.dev/sdk in Lambda Functions
 * 
 * This example shows how to use the Volcano SDK in Lambda functions:
 * - Clean, expressive query builder syntax
 * - Automatic RLS enforcement using user's token
 * - No manual connection management
 * - Works seamlessly with event.__volcano_auth
 */

const { VolcanoAuth } = require('@volcano.dev/sdk');

/**
 * Lambda handler - Query database using SDK with user authentication
 */
exports.handler = async (event) => {
	// 1. Get user's auth context from Volcano
	const auth = event.__volcano_auth;
	
	if (!auth) {
		return {
			statusCode: 401,
			body: JSON.stringify({ error: 'Unauthorized' })
		};
	}
	
	// 2. Initialize SDK with user's access token
	const volcano = new VolcanoAuth({
		apiUrl: process.env.VOLCANO_API_URL,
		anonKey: process.env.ANON_KEY,
		accessToken: auth.access_token  // User's token - RLS enforced!
	});
	
	// 3. Set database name
	volcano.database(process.env.DATABASE_NAME);
	
	// 4. Handle different actions
	const { action, ...params } = event;
	
	try {
		switch (action) {
			case 'get_posts':
				return await getPosts(volcano, auth, params);
			
			case 'create_post':
				return await createPost(volcano, auth, params);
			
			case 'update_post':
				return await updatePost(volcano, auth, params);
			
			case 'delete_post':
				return await deletePost(volcano, auth, params);
			
			default:
				return {
					statusCode: 400,
					body: JSON.stringify({ error: 'Unknown action' })
				};
		}
	} catch (error) {
		console.error('Error:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: error.message })
		};
	}
};

/**
 * Get posts for current user
 * RLS automatically filters to user's posts
 */
async function getPosts(volcano, auth, params) {
	const { filter = 'all', limit = 50 } = params;
	
	let query = volcano
		.from('posts')
		.select('id, title, content, status, created_at');
	
	// Add filters
	if (filter === 'published') {
		query = query.eq('status', 'published');
	} else if (filter === 'recent') {
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		query = query.gte('created_at', sevenDaysAgo.toISOString());
	}
	
	// Order and limit
	query = query
		.order('created_at', { ascending: false })
		.limit(limit);
	
	const { data, error } = await query;
	
	if (error) {
		throw new Error(error);
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			posts: data,
			count: data.length,
			user_id: auth.user_id,
			user_email: auth.email
		})
	};
}

/**
 * Create new post
 * user_id automatically set by database trigger using auth.uid()
 */
async function createPost(volcano, auth, params) {
	const { title, content, status = 'draft' } = params;
	
	if (!title || !content) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'Title and content required' })
		};
	}
	
	const { data, error } = await volcano.insert('posts', {
		title,
		content,
		status
	});
	
	if (error) {
		throw new Error(error);
	}
	
	return {
		statusCode: 201,
		body: JSON.stringify({ 
			post: data[0],
			message: 'Post created successfully'
		})
	};
}

/**
 * Update post
 * RLS ensures user can only update their own posts
 */
async function updatePost(volcano, auth, params) {
	const { id, title, content, status } = params;
	
	if (!id) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'Post ID required' })
		};
	}
	
	const updates = {};
	if (title !== undefined) updates.title = title;
	if (content !== undefined) updates.content = content;
	if (status !== undefined) updates.status = status;
	
	const { data, error } = await volcano
		.update('posts', updates)
		.eq('id', id);
	
	if (error) {
		throw new Error(error);
	}
	
	if (!data || data.length === 0) {
		return {
			statusCode: 404,
			body: JSON.stringify({ error: 'Post not found or access denied' })
		};
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({ 
			post: data[0],
			message: 'Post updated successfully'
		})
	};
}

/**
 * Delete post
 * RLS ensures user can only delete their own posts
 */
async function deletePost(volcano, auth, params) {
	const { id } = params;
	
	if (!id) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'Post ID required' })
		};
	}
	
	const { data, error } = await volcano
		.delete('posts')
		.eq('id', id);
	
	if (error) {
		throw new Error(error);
	}
	
	if (!data || data.length === 0) {
		return {
			statusCode: 404,
			body: JSON.stringify({ error: 'Post not found or access denied' })
		};
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({ 
			message: 'Post deleted successfully',
			deleted_id: id
		})
	};
}
