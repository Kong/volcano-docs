import {
  absoluteUrl,
  markdownPageTree,
} from "@/lib/agent-docs";
import { source } from "@/lib/source";
import { llms } from "fumadocs-core/source/llms";

// Fumadocs renders links from the page tree's URLs, so hand it a source whose
// tree links each page's absolute .md URL.
const markdownSource: typeof source = Object.create(source, {
  getPageTree: { value: markdownPageTree },
});

// Docs change only on deploy, so prerender this once; Next then serves it with
// s-maxage like the pages.
export const revalidate = false;

export function GET() {
  const index = llms(markdownSource).index();
  const content = `${index}\n\nThe full text of every page above, in this order: ${absoluteUrl("/llms-full.txt")}\n`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
