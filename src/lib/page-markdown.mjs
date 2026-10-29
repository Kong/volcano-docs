// The markdown an agent reads in place of a page's HTML. One renderer feeds
// /api/llm/<slug>, /<slug>.md, and /llms-full.txt so the three never drift.

/**
 * A page's markdown: its title (and, when given, its URL) and description as a
 * header, then the source body without frontmatter.
 *
 * @param {{ title: string, description?: string, raw: string, url?: string }} page
 */
export function renderPageMarkdown({ title, description, raw, url }) {
  let header = `# ${title}\n\n`;
  if (url) header += `URL: ${url}\n\n`;
  if (description) header += `${description}\n\n`;
  return header + raw.replace(/^---[\s\S]*?---\n*/, "");
}

/**
 * The `.md` path that serves a page's markdown. The site root has no slug of
 * its own, so it is served as /index.md.
 *
 * @param {string} pageUrl a page route such as "/cli/installation"
 */
export function markdownPath(pageUrl) {
  const trimmed = pageUrl.replace(/\/+$/, "");
  if (trimmed === "") return "/index.md";
  return `${trimmed}.md`;
}

/**
 * The page slugs a markdown request names. `/index.md` is the site root, which
 * the [...slug] route cannot otherwise reach.
 *
 * @param {string[]} slug
 */
export function pageSlugs(slug) {
  if (slug.length === 1 && slug[0] === "index") return [];
  return slug;
}

/**
 * A copy of a page tree whose page URLs are rewritten by `toUrl`. Nodes keep
 * their `$ref`, so Fumadocs still resolves them to the same pages.
 *
 * @template T
 * @param {T} node
 * @param {(url: string) => string} toUrl
 * @returns {T}
 */
export function mapTreeUrls(node, toUrl) {
  const copy = { ...node };
  if (copy.type === "page") copy.url = toUrl(copy.url);
  if (copy.index) copy.index = mapTreeUrls(copy.index, toUrl);
  if (Array.isArray(copy.children)) {
    copy.children = copy.children.map(function mapChild(child) {
      return mapTreeUrls(child, toUrl);
    });
  }
  return copy;
}

/**
 * The page nodes of a tree in the order Fumadocs' llms.txt lists them: a
 * folder's index page first, then its children.
 *
 * @param {{ type?: string, index?: object, children?: object[] }} node
 * @returns {object[]}
 */
export function treePages(node) {
  if (node.type === "page") return [node];
  const pages = [];
  if (node.index) pages.push(...treePages(node.index));
  for (const child of node.children ?? []) pages.push(...treePages(child));
  return pages;
}
