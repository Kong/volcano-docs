// The markdown an agent reads in place of a page's HTML. One renderer feeds
// /api/llm/<slug>, /<slug>.md, and /llms-full.txt so the three never drift.

import { fromMarkdown } from "mdast-util-from-markdown";

/**
 * A page's markdown: its title (and, when given, its URL) and description as a
 * header, then the source body without frontmatter, its links passed through
 * `rewriteHref` when given.
 *
 * @param {{ title: string, description?: string, raw: string, url?: string, rewriteHref?: (href: string) => string }} page
 */
export function renderPageMarkdown({ title, description, raw, url, rewriteHref }) {
  let header = `# ${title}\n\n`;
  if (url) header += `URL: ${url}\n\n`;
  if (description) header += `${description}\n\n`;
  let body = raw.replace(/^---[\s\S]*?---\n*/, "");
  if (rewriteHref) body = rewriteMarkdownLinks(body, rewriteHref);
  return header + body;
}

/**
 * Where a link's destination can start: past a link's text, or past the
 * closing bracket of an image's alt or a definition's label.
 *
 * @param {string} text
 * @param {{ position: { start: { offset: number } }, children?: { position?: { end: { offset: number } } }[] }} node
 */
function destinationSearchStart(text, node) {
  const lastChild = node.children?.at(-1);
  if (lastChild?.position) return lastChild.position.end.offset;
  return text.indexOf("]", node.position.start.offset);
}

/**
 * Rewrite the destination of every inline link, image and link definition,
 * leaving the rest of the text byte for byte. Code is not parsed as links, so
 * examples inside it are untouched.
 *
 * @param {string} text
 * @param {(href: string) => string} rewriteHref
 */
export function rewriteMarkdownLinks(text, rewriteHref) {
  const edits = [];
  function visit(node) {
    const linkLike =
      node.type === "link" || node.type === "image" || node.type === "definition";
    if (linkLike && node.url && node.position) {
      const next = rewriteHref(node.url);
      if (next !== node.url) {
        const { end } = node.position;
        // The destination is the first occurrence of the URL after the
        // bracketed text, ahead of any title; one written with escapes or
        // entities is left alone.
        const at = text.indexOf(node.url, destinationSearchStart(text, node));
        if (at >= 0 && at + node.url.length <= end.offset) {
          edits.push({ at, length: node.url.length, next });
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(fromMarkdown(text));

  let out = text;
  edits.sort(function lastFirst(a, b) {
    return b.at - a.at;
  });
  for (const { at, length, next } of edits) {
    out = out.slice(0, at) + next + out.slice(at + length);
  }
  return out;
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
  // External links in the tree stay as they are.
  if (copy.type === "page" && !copy.external) copy.url = toUrl(copy.url);
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
