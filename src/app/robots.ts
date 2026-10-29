import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Everything is public docs, so every crawler (AI ones included) is welcome.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
