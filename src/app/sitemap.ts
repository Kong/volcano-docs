import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

// Mirrors docs.config.yaml's site.base_url (placeholder; final host TBD).
const BASE_URL = "https://docs.volcano.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${BASE_URL}${page.url}`,
  }));
}
