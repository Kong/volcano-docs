import Link from "next/link";
import { categoryHref } from "@/lib/blog-categories.mjs";
import "./blog-category-tabs.css";

type Category = { slug: string; label: string; count: number };
type BlogCategoryTabsProps = { categories: Category[]; active?: string };

// The listing's category row: All, then every category that has posts. Each
// one is a page of its own, so these are plain links — no client state, and
// every category is crawlable and linkable.
export function BlogCategoryTabs({ categories, active }: BlogCategoryTabsProps) {
  if (categories.length === 0) return null;
  const allActive = !active;
  return (
    <nav data-slot="blog-category-tabs" aria-label="Blog categories" className="blog-category-tabs">
      <Link
        href="/blog"
        aria-current={allActive}
        data-active={allActive}
        className="blog-category-tab"
      >
        All
      </Link>
      {categories.map(function renderTab(category) {
        const isActive = category.slug === active;
        return (
          <Link
            key={category.slug}
            href={categoryHref(category.slug)}
            aria-current={isActive}
            data-active={isActive}
            className="blog-category-tab"
          >
            {category.label}
          </Link>
        );
      })}
    </nav>
  );
}
