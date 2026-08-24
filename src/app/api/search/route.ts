import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Not served at runtime; scripts/emit-search-index.mjs copies its build output to public/.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
