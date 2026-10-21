"use client";

import Link from "next/link";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { useBlogFilters } from "@/components/blog-filters";
import { blogTopicHref } from "@/lib/blog-topics.mjs";
import { SearchBanner } from "@/components/sidebar/search-banner";
import "./blog-sidebar.css";

type Topic = { tag: string; label: string; count: number };
type BlogSidebarProps = { topics: Topic[]; total: number };

export function BlogSidebar({ topics, total }: BlogSidebarProps) {
  const { topic } = useBlogFilters();
  const { setOpen } = useSidebar();
  function closeSidebar() { setOpen(false); }
  return (
    <div data-slot="blog-sidebar" className="blog-sidebar">
      <SearchBanner />
      <nav aria-label="Blog topics" className="blog-sidebar-topics">
        <Link href="/blog" onClick={closeSidebar} aria-current={topic === null} data-active={topic === null} className="blog-sidebar-link">
          <span>All posts</span><span>{total}</span>
        </Link>
        <p className="blog-sidebar-label">Topics</p>
        {topics.map(function renderTopic(item) {
          return (
            <Link key={item.tag} href={blogTopicHref(item.tag)} onClick={closeSidebar} aria-current={topic === item.tag} data-active={topic === item.tag} className="blog-sidebar-link">
              <span>{item.label}</span><span>{item.count}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
