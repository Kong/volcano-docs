import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsHeader } from "@/components/docs-header";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { getSectionPages } from "@/lib/sections";
import { collectCategories } from "@/lib/blog-categories.mjs";
import { baseOptions } from "@/lib/layout.shared";

type BlogLayoutProps = { children: ReactNode };

export default function BlogLayout({ children }: BlogLayoutProps) {
  const posts = getSectionPages("blog");
  const categories = collectCategories(posts.map(function metadata(post) { return post.data; }));
  return (
    <DocsLayout
      {...baseOptions()}
      tree={{ name: "Blog", children: [] }}
      tabs={false}
      slots={{ header: DocsHeader }}
      sidebar={{ collapsible: false, banner: <BlogSidebar categories={categories} total={posts.length} /> }}
    >
      {children}
    </DocsLayout>
  );
}
