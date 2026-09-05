import { source } from "@/lib/source";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The hosting proxy sets these to the public origin. Reading headers keeps
  // the sitemap request-specific, including when the deployment domain changes.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("Cannot generate sitemap without a request host");
  const origin = new URL(`${protocol}://${host}`).origin;

  return source.getPages().map((page) => ({
    url: new URL(page.url, origin).href,
  }));
}
