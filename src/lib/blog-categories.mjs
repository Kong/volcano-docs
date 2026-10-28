// Every blog post carries exactly one category. Categories are a small curated
// vocabulary (not free-form tags) because each one is a page of its own at
// /blog/category/<slug> and is listed in the blog sidebar — a label per feature
// would turn both into noise. `tags` stay free-form and are indexed for search;
// nothing in the UI filters by them.
//
// Shared with spec/frontmatter.schema.json, which validates authored posts
// against the same list; blog-categories.test.mjs keeps the two in step.
export const BLOG_CATEGORIES = [
  { slug: "product", label: "Product" },
  { slug: "engineering", label: "Engineering" },
  { slug: "research", label: "Research" },
  { slug: "company", label: "Company" },
];

export const BLOG_CATEGORY_SLUGS = BLOG_CATEGORIES.map(function toSlug(category) {
  return category.slug;
});

/** @param {string | undefined} slug */
export function isBlogCategory(slug) {
  if (!slug) return false;
  return BLOG_CATEGORY_SLUGS.includes(slug);
}

/** @param {string} slug */
export function categoryLabel(slug) {
  const match = BLOG_CATEGORIES.find(function bySlug(category) {
    return category.slug === slug;
  });
  if (match) return match.label;
  return slug;
}

/** @param {string} slug */
export function categoryHref(slug) {
  return `/blog/category/${slug}`;
}

/**
 * Posts in a category, newest first, matching the listing's own order.
 * @template {{ category?: string }} Post
 * @param {Post[]} posts
 * @param {string} slug
 */
export function postsInCategory(posts, slug) {
  return posts.filter(function inCategory(post) {
    return post.category === slug;
  });
}

/**
 * The categories that actually have posts, with their counts. An empty
 * category has no page worth linking to, so it never reaches the sidebar.
 * @param {{ category?: string }[]} posts
 */
export function collectCategories(posts) {
  return BLOG_CATEGORIES.map(function withCount(category) {
    return { ...category, count: postsInCategory(posts, category.slug).length };
  }).filter(function hasPosts(category) {
    return category.count > 0;
  });
}
