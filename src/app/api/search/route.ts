import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Prebuilt at build time; the Orama index build is too slow to run per request.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
