import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { siteUrl } from "@/lib/site-url";
import { categoryHref, collectCategories } from "@/lib/blog-categories.mjs";
import { getSectionPages } from "@/lib/sections";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages().map((page) => ({
    url: new URL(page.url, siteUrl).toString(),
  }));
  // Blog categories are pages of their own, not query filters, so each one
  // belongs in the sitemap alongside the posts.
  const posts = getSectionPages("blog").map((page) => page.data);
  const categories = collectCategories(posts).map((category) => ({
    url: new URL(categoryHref(category.slug), siteUrl).toString(),
  }));
  return [...pages, ...categories];
}
