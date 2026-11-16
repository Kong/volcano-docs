// The site is mounted on volcano.dev at /docs, /blog, and /cookbooks, so blog
// and cookbook pages keep their section as the first path segment and every
// other page is served under /docs. Content files keep their paths: the CLI's
// `volcano docs` reads content/ and takes a page's topic from its first folder.

export const DOCS_PREFIX = "/docs";

const ROOT_SECTIONS = new Set(["blog", "cookbooks"]);

// Content links another docs section by its content path ("/platform/x"), as
// the CLI and the Markdown routes show it. siteHref renders it as the served
// URL; volcano.dev also mounts these sections on this site, whose redirects
// send the content path to /docs.
export const DOCS_SECTIONS = ["get-started", "platform", "sdk", "cli"];

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

/**
 * The served URL of a link written in content: "/platform/x" becomes
 * "/docs/platform/x" and "/" the docs home. Other hrefs are unchanged.
 *
 * @template {string | undefined} T
 * @param {T} href
 * @returns {T}
 */
export function siteHref(href) {
  if (!href?.startsWith("/")) return href;
  if (href === "/" || href.startsWith("/#") || href.startsWith("/?")) {
    return /** @type {T} */ (DOCS_PREFIX + href.slice(1));
  }
  const section = href.slice(1).split(/[/?#]/, 1)[0];
  if (!DOCS_SECTIONS.includes(section)) return href;
  return /** @type {T} */ (DOCS_PREFIX + href);
}
