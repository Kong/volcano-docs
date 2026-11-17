import {
  absoluteUrl,
  getPageMarkdown,
  pagesInLlmsOrder,
} from "@/lib/agent-docs";

// Docs change only on deploy, so prerender this once; Next then serves it with
// s-maxage like the pages.
export const revalidate = false;

export async function GET() {
  const sections: string[] = [];
  for (const page of pagesInLlmsOrder()) {
    const markdown = await getPageMarkdown(page, { url: absoluteUrl(page.url) });
    if (markdown !== null) sections.push(markdown.trimEnd());
  }

  return new Response(`${sections.join("\n\n---\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
