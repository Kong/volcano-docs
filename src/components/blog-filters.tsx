"use client";

import { createContext, use, useState, type ReactNode } from "react";

type BlogFilters = { topic: string | null; setTopic: (topic: string | null) => void };
type BlogFiltersProviderProps = { children: ReactNode };
const BlogFiltersContext = createContext<BlogFilters | null>(null);

export function BlogFiltersProvider({ children }: BlogFiltersProviderProps) {
  const [topic, setTopic] = useState<string | null>(null);
  return <BlogFiltersContext value={{ topic, setTopic }}>{children}</BlogFiltersContext>;
}

export function useBlogFilters() {
  const context = use(BlogFiltersContext);
  if (!context) throw new Error("Blog filters require BlogFiltersProvider");
  return context;
}
