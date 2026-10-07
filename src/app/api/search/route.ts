import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";
import type { StructuredData } from "fumadocs-core/mdx-plugins";

// The API reference repeats endpoint parameter and field tables that swell the
// static index past the CloudFront auto-compression ceiling (see
// scripts/check-search-index.mjs). Its titles and headings, which name each
// endpoint, stay searchable; its body text is left out.
const HEADINGS_ONLY_PREFIX = "/platform/api-reference";

type Page = ReturnType<typeof source.getPages>[number];

async function buildIndex(page: Page) {
  const data = page.data as Page["data"] & {
    structuredData?: StructuredData | (() => Promise<StructuredData>);
  };
  const structuredData =
    typeof data.structuredData === "function" ? await data.structuredData() : data.structuredData;
  if (!structuredData) {
    throw new Error(`search index: no structured data for ${page.url}`);
  }
  // A page without headings would keep only its title, so index it in full.
  const headingsOnly =
    (page.url === HEADINGS_ONLY_PREFIX || page.url.startsWith(`${HEADINGS_ONLY_PREFIX}/`)) &&
    structuredData.headings.length > 0;
  return {
    id: page.url,
    url: page.url,
    title: data.title ?? page.url,
    description: data.description,
    structuredData: headingsOnly ? { headings: structuredData.headings, contents: [] } : structuredData,
  };
}

// Results use relevance scores, so property-sort indexes only enlarge the asset.
const search = createFromSource(source, { sort: { enabled: false }, buildIndex });

function getHandler() {
  if (process.env.NODE_ENV === "development") {
    return search.GET;
  }
  return search.staticGET;
}

// Production only uses this route to emit the index copied into public/.
export const revalidate = false;
export const GET = getHandler();
