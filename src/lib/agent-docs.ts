import { join } from "node:path";
import { readContentFile } from "@/lib/content-file.mjs";
import { resolveRelativeMdHref } from "@/lib/relative-md-href.mjs";
import {
  markdownPath,
  mapTreeUrls,
  pageSlugs,
  renderPageMarkdown,
  rootPageMarkdownHref,
  treePages,
} from "@/lib/page-markdown.mjs";
import { siteUrl } from "@/lib/site-url";
import { source } from "@/lib/source";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

type PageTreeNode = Parameters<typeof source.getNodePage>[0];

// Absolute so the links still work once an agent has the text out of context.
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export function markdownUrl(pageUrl: string): string {
  return absoluteUrl(markdownPath(pageUrl));
}

// The page a /<slug>.md or /api/llm/<slug> request names.
export function getMarkdownPage(slug: string[]): DocsPage | undefined {
  return source.getPage(pageSlugs(slug));
}

// The page route a relative .md link in a page's source names, with its query
// and fragment, or null when it names no page. A section's README.md is synced
// as index.md, so a link to the README falls back to the index.
function resolvePageHref(href: string, page: DocsPage): string | null {
  const candidates = [href, href.replace(/README\.md(?=[?#]|$)/, "index.md")];
  for (const candidate of candidates) {
    const resolved = resolveRelativeMdHref(candidate, source, page);
    if (resolved?.startsWith("/")) return resolved;
  }
  return null;
}

// Whether a route such as "/cli/installation" is a docs page.
function isPageRoute(route: string): boolean {
  return source.getPage(route.split("/").filter(Boolean)) !== undefined;
}

// Every link to a docs page becomes the absolute .md URL of that page, so an
// agent reading markdown stays on markdown. Relative links in a page's source
// are relative to its file, which is not where its .md is served
// (content/cli/index.md is /cli.md), so they resolve against the file.
function markdownHref(href: string, page: DocsPage): string {
  if (href.startsWith("/")) {
    return rootPageMarkdownHref(href, isPageRoute, markdownUrl);
  }
  if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href)) return href;
  const resolved = resolvePageHref(href, page);
  if (resolved === null) return href;
  const [, route, suffix] = resolved.match(/^([^?#]*)(.*)$/)!;
  return markdownUrl(route) + suffix;
}

// Read the raw markdown source file from disk, contained to content/.
export async function getPageMarkdown(
  page: DocsPage,
  options: { url?: string } = {},
): Promise<string | null> {
  const raw = await readContentFile(join(process.cwd(), "content"), page.path);
  if (raw === null) return null;
  return renderPageMarkdown({
    title: page.data.title,
    description: page.data.description,
    raw,
    url: options.url,
    rewriteHref: function rewriteHref(href: string) {
      return markdownHref(href, page);
    },
  });
}

// The page tree with every page linked by its absolute .md URL, for llms.txt.
// Nodes keep their $ref, so Fumadocs still resolves titles and descriptions.
export function markdownPageTree() {
  return mapTreeUrls(source.getPageTree(), markdownUrl);
}

// Every docs page in the order llms.txt lists them.
export function pagesInLlmsOrder(): DocsPage[] {
  const pages: DocsPage[] = [];
  for (const node of treePages(source.getPageTree())) {
    const page = source.getNodePage(node as PageTreeNode);
    if (page) pages.push(page);
  }
  return pages;
}
