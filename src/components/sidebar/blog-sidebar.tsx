"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { categoryHref } from "@/lib/blog-categories.mjs";
import { SearchBanner } from "@/components/sidebar/search-banner";
import "./blog-sidebar.css";

type Category = { slug: string; label: string; count: number };
type BlogSidebarProps = { categories: Category[]; total: number };

// Blog navigation: all posts, then one entry per category that has posts. Each
// category is a page of its own, so the active entry follows the URL.
export function BlogSidebar({ categories, total }: BlogSidebarProps) {
  const pathname = usePathname();
  const { setOpen } = useSidebar();
  function closeSidebar() { setOpen(false); }
  const allActive = pathname === "/blog";
  return (
    <div data-slot="blog-sidebar" className="blog-sidebar">
      <SearchBanner />
      <nav aria-label="Blog categories" className="blog-sidebar-topics">
        <Link href="/blog" onClick={closeSidebar} aria-current={allActive} data-active={allActive} className="blog-sidebar-link">
          <span>All posts</span><span>{total}</span>
        </Link>
        <p className="blog-sidebar-label">Categories</p>
        {categories.map(function renderCategory(category) {
          const href = categoryHref(category.slug);
          const isActive = pathname === href;
          return (
            <Link key={category.slug} href={href} onClick={closeSidebar} aria-current={isActive} data-active={isActive} className="blog-sidebar-link">
              <span>{category.label}</span><span>{category.count}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
