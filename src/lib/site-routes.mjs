// The site is mounted on volcano.dev at /docs, /blog, and /cookbooks, so blog
// and cookbook pages keep their section as the first path segment and every
// other page is served under /docs. Content files keep their paths: the CLI's
// `volcano docs` reads content/ and takes a page's topic from its first folder.

export const DOCS_PREFIX = "/docs";

const ROOT_SECTIONS = new Set(["blog", "cookbooks"]);

/**
 * The URL of the page whose content slugs are `slugs`.
 *
 * @param {string[]} slugs
 */
export function pageUrl(slugs) {
  if (ROOT_SECTIONS.has(slugs[0])) return `/${slugs.join("/")}`;
  return [DOCS_PREFIX, ...slugs].join("/");
}

/**
 * The content slugs a route such as "/docs/cli/setup" or "/blog/post" names.
 *
 * @param {string} route
 */
export function routeSlugs(route) {
  const slugs = route.split("/").filter(Boolean);
  if (slugs[0] === DOCS_PREFIX.slice(1)) return slugs.slice(1);
  return slugs;
}
