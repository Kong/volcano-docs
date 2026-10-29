import { absoluteUrl, getMarkdownPage, getPageMarkdown } from "@/lib/agent-docs";
import { canonicalLinkHeader } from "@/lib/page-markdown.mjs";
import { notFound } from "next/navigation";

// Also serves /<slug>.md, which next.config.ts rewrites here.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = getMarkdownPage(slug);
  if (!page) notFound();

  const markdown = await getPageMarkdown(page);
  if (markdown === null) {
    return new Response("Page content not found", { status: 404 });
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // Search engines index the HTML page, not this duplicate.
      Link: canonicalLinkHeader(absoluteUrl(page.url)),
    },
  });
}
