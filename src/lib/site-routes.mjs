// The site is mounted on volcano.dev at /docs, /blog, and /cookbook, so blog
// and cookbook pages are served under their section's path and every other
// page under /docs. Content files keep their paths: the CLI's `volcano docs`
// reads content/ and takes a page's topic from its first folder, so recipes
// stay in content/cookbooks/ and are served at /cookbook.

export const DOCS_PREFIX = "/docs";

// The path each root section is served at, by its content folder.
const ROOT_SECTIONS = new Map([
  ["blog", "blog"],
  ["cookbooks", "cookbook"],
]);
const ROOT_SECTION_FOLDERS = new Map([...ROOT_SECTIONS].map(([folder, path]) => [path, folder]));

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
  const sectionPath = ROOT_SECTIONS.get(slugs[0]);
  if (sectionPath) return ["", sectionPath, ...slugs.slice(1)].join("/");
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
  const folder = ROOT_SECTION_FOLDERS.get(slugs[0]);
  if (folder) return [folder, ...slugs.slice(1)];
  return slugs;
}

/**
 * The served URL of a link written in content: "/platform/x" becomes
 * "/docs/platform/x", "/cookbooks/x" "/cookbook/x", and "/" the docs home.
 * Other hrefs are unchanged.
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
  const sectionPath = ROOT_SECTIONS.get(section);
  if (sectionPath) return /** @type {T} */ (`/${sectionPath}${href.slice(1 + section.length)}`);
  if (!DOCS_SECTIONS.includes(section)) return href;
  return /** @type {T} */ (DOCS_PREFIX + href);
}

/**
 * The `.md` path that serves a page's markdown. A section landing such as
 * /docs is served as /docs/index.md, because the site is mounted by path
 * prefix and /docs.md would fall outside /docs. The site root is /index.md.
 *
 * @param {string} pageUrl a page route such as "/docs/cli/installation"
 */
export function markdownPath(pageUrl) {
  const trimmed = pageUrl.replace(/\/+$/, "");
  if (!trimmed.slice(1).includes("/")) return `${trimmed}/index.md`;
  return `${trimmed}.md`;
}
