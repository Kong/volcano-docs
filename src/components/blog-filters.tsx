"use client";

import { createContext, Suspense, use, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSearchSection } from "@/lib/search-section.mjs";
import { blogTopicHref } from "@/lib/blog-topics.mjs";

type BlogFilters = { topic: string | null; setTopic: (topic: string | null) => void };
type BlogFiltersProviderProps = { children: ReactNode };
type BlogTopicUrlSyncProps = { onChange: (topic: string | null) => void };
type BlogTopicLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };
const BlogFiltersContext = createContext<BlogFilters | null>(null);

// Only this invisible bridge suspends while static pages hydrate their URL.
// The provider's children keep their server-rendered content.
function BlogTopicUrlSync({ onChange }: BlogTopicUrlSyncProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  let topic: string | null = null;
  if (getSearchSection(pathname) === "blog") topic = searchParams.get("topic") || null;
  useEffect(function syncTopic() { onChange(topic); }, [onChange, topic]);
  return null;
}

export function BlogFiltersProvider({ children }: BlogFiltersProviderProps) {
  const [topic, updateTopic] = useState<string | null>(null);
  const router = useRouter();
  function setTopic(nextTopic: string | null) { router.push(blogTopicHref(nextTopic), { scroll: false }); }
  return (
    <BlogFiltersContext value={{ topic, setTopic }}>
      <Suspense fallback={null}><BlogTopicUrlSync onChange={updateTopic} /></Suspense>
      {children}
    </BlogFiltersContext>
  );
}

export function useBlogFilters() {
  const context = use(BlogFiltersContext);
  if (!context) throw new Error("Blog filters require BlogFiltersProvider");
  return context;
}

export function BlogTopicLink({ href, ...props }: BlogTopicLinkProps) {
  const { topic } = useBlogFilters();
  return <Link data-slot="blog-topic-link" {...props} href={blogTopicHref(topic, href)} />;
}
