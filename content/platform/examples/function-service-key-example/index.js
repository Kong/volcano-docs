/**
 * Example: Using a Service Key for Admin Operations
 * 
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * Service keys BYPASS Row-Level Security and grant admin access to ALL data.
 * - ONLY use in backend functions
 * - NEVER expose in frontend code
 * - NEVER commit to git
 * - Store in environment variables only
 * 
 * This example shows admin operations like:
 * - Analytics across all users
 * - Content moderation
 * - Bulk operations
 * - System maintenance
 */

const { VolcanoAuth } = require('@volcano.dev/sdk');

/**
 * Handler - Admin operations with service key
 */
exports.handler = async (event) => {
	// Initialize SDK with SERVICE KEY (admin access)
	// Note: anonKey is still required for SDK initialization, but accessToken
	// overrides it for authenticated requests, granting admin privileges.
	const volcano = new VolcanoAuth({
		apiUrl: process.env.VOLCANO_API_URL,
		anonKey: process.env.ANON_KEY,
		accessToken: process.env.SERVICE_ROLE_KEY  // ← Admin key from Service Keys page
	});
	
	// Set database
	volcano.database(process.env.DATABASE_NAME);
	
	// Handle admin actions
	const { action, ...params } = event;
	
	try {
		switch (action) {
			case 'get_analytics':
				return await getAnalytics(volcano);
			
			case 'moderate_content':
				return await moderateContent(volcano, params);
			
			case 'bulk_update':
				return await bulkUpdate(volcano, params);
			
			case 'export_all_data':
				return await exportAllData(volcano);
			
			case 'cleanup_old_posts':
				return await cleanupOldPosts(volcano, params);
			
			default:
				return {
					statusCode: 400,
					body: JSON.stringify({ error: 'Unknown action' })
				};
		}
	} catch (error) {
		console.error('Admin operation error:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: error.message })
		};
	}
};

/**
 * Get analytics across ALL users
 * RLS BYPASSED - sees all data
 */
async function getAnalytics(volcano) {
	// Get ALL posts from ALL users
	const { data: allPosts, error } = await volcano
		.from('posts')
		.select('id, title, status, user_id, created_at');
	
	if (error) {
		throw new Error(error);
	}
	
	// Calculate analytics
	const now = Date.now();
	const oneDayAgo = now - 24 * 60 * 60 * 1000;
	const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
	
	const analytics = {
		total_posts: allPosts.length,
		total_users: [...new Set(allPosts.map(p => p.user_id))].length,
		posts_by_status: {
			published: allPosts.filter(p => p.status === 'published').length,
			draft: allPosts.filter(p => p.status === 'draft').length,
			archived: allPosts.filter(p => p.status === 'archived').length
		},
		recent_activity: {
			last_24h: allPosts.filter(p => new Date(p.created_at).getTime() > oneDayAgo).length,
			last_7d: allPosts.filter(p => new Date(p.created_at).getTime() > oneWeekAgo).length
		},
		top_users: getTopUsers(allPosts, 10)
	};
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			analytics,
			generated_at: new Date().toISOString()
		})
	};
}

/**
 * Content moderation - flag or remove posts
 * RLS BYPASSED - can moderate any user's content
 */
async function moderateContent(volcano, params) {
	const { post_ids, action, reason } = params;
	
	if (!post_ids || !Array.isArray(post_ids)) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'post_ids array required' })
		};
	}
	
	let updates = {};
	
	switch (action) {
		case 'flag':
			updates = { status: 'flagged', moderation_reason: reason };
			break;
		case 'remove':
			updates = { status: 'removed', moderation_reason: reason };
			break;
		case 'restore':
			updates = { status: 'published', moderation_reason: null };
			break;
		default:
			return {
				statusCode: 400,
				body: JSON.stringify({ error: 'Invalid moderation action' })
			};
	}
	
	// Update multiple posts (from any user)
	const results = [];
	
	for (const postId of post_ids) {
		const { data, error } = await volcano
			.update('posts', updates)
			.eq('id', postId);
		
		if (error) {
			results.push({ id: postId, success: false, error });
		} else {
			results.push({ id: postId, success: true, data: data[0] });
		}
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			moderated: results.filter(r => r.success).length,
			failed: results.filter(r => !r.success).length,
			results
		})
	};
}

/**
 * Bulk update across all users
 * RLS BYPASSED - can update any data
 */
async function bulkUpdate(volcano, params) {
	const { table, updates, filters } = params;
	
	if (!table || !updates) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'table and updates required' })
		};
	}
	
	let query = volcano.update(table, updates);
	
	// Apply filters if provided
	if (filters) {
		for (const [field, value] of Object.entries(filters)) {
			query = query.eq(field, value);
		}
	}
	
	const { data, error } = await query;
	
	if (error) {
		throw new Error(error);
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			updated_count: data.length,
			message: `Bulk updated ${data.length} records in ${table}`
		})
	};
}

/**
 * Export all data for backup/migration
 * RLS BYPASSED - exports everything
 */
async function exportAllData(volcano) {
	// Export ALL posts from ALL users
	const { data: posts, error: postsError } = await volcano
		.from('posts')
		.select('*')
		.order('created_at', { ascending: false });
	
	if (postsError) {
		throw new Error(postsError);
	}
	
	// Could also export other tables
	// const { data: users } = await volcano.from('users').select('*');
	// const { data: comments } = await volcano.from('comments').select('*');
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			export: {
				posts,
				// users,
				// comments,
			},
			total_records: posts.length,
			exported_at: new Date().toISOString()
		})
	};
}

/**
 * Cleanup old posts across all users
 * RLS BYPASSED - can delete any user's data
 */
async function cleanupOldPosts(volcano, params) {
	const { days_old = 365, dry_run = true } = params;
	
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days_old);
	
	// Find old posts
	const { data: oldPosts, error: findError } = await volcano
		.from('posts')
		.select('id, title, user_id, created_at')
		.lt('created_at', cutoffDate.toISOString());
	
	if (findError) {
		throw new Error(findError);
	}
	
	if (dry_run) {
		// Just report what would be deleted
		return {
			statusCode: 200,
			body: JSON.stringify({
				dry_run: true,
				would_delete: oldPosts.length,
				posts: oldPosts,
				message: `Would delete ${oldPosts.length} posts older than ${days_old} days`
			})
		};
	}
	
	// Actually delete the posts
	const deletedIds = [];
	
	for (const post of oldPosts) {
		const { error: deleteError } = await volcano
			.delete('posts')
			.eq('id', post.id);
		
		if (!deleteError) {
			deletedIds.push(post.id);
		}
	}
	
	return {
		statusCode: 200,
		body: JSON.stringify({
			deleted: deletedIds.length,
			message: `Deleted ${deletedIds.length} posts older than ${days_old} days`
		})
	};
}

/**
 * Helper: Get top users by post count
 */
function getTopUsers(posts, limit = 10) {
	const userCounts = {};
	
	posts.forEach(post => {
		userCounts[post.user_id] = (userCounts[post.user_id] || 0) + 1;
	});
	
	return Object.entries(userCounts)
		.map(([user_id, count]) => ({ user_id, post_count: count }))
		.sort((a, b) => b.post_count - a.post_count)
		.slice(0, limit);
}
