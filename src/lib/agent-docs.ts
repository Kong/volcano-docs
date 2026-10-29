import { join } from "node:path";
import { readContentFile } from "@/lib/content-file.mjs";
import {
  markdownPath,
  mapTreeUrls,
  pageSlugs,
  renderPageMarkdown,
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
