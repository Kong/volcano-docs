import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Results use relevance scores, so property-sort indexes only enlarge the asset.
const search = createFromSource(source, { sort: { enabled: false } });

function getHandler() {
  if (process.env.NODE_ENV === "development") {
    return search.GET;
  }
  return search.staticGET;
}

// Production only uses this route to emit the index copied into public/.
export const revalidate = false;
export const GET = getHandler();
