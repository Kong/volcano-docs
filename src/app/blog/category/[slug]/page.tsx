import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostCards, type BlogPost } from "@/components/blog-post-cards";
import { Footer } from "@/components/home/footer";
import { categoryLabel, collectCategories, isBlogCategory, postsInCategory } from "@/lib/blog-categories.mjs";
import { getSectionPages } from "@/lib/sections";
import "@/components/collection-home.css";
import "@/components/home/index.css";

type CategoryPageProps = { params: Promise<{ slug: string }> };

// A category's own page: where the label on a post leads, and what the
// sidebar lists.
function blogPosts(): BlogPost[] {
  return getSectionPages("blog").map(function toPost(entry) {
    const { title, description, author, published, category, tags, cover } = entry.data;
    return { url: entry.url, title, description, author, published, category, tags, cover };
  });
}

function describe(label: string) {
  return `Volcano blog posts in ${label}.`;
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  if (!isBlogCategory(slug)) notFound();
  const posts = blogPosts();
  const inCategory = postsInCategory(posts, slug);
  if (inCategory.length === 0) notFound();
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      <BlogPostCards posts={inCategory} />
      <Footer />
    </div>
  );
}

export function generateStaticParams() {
  return collectCategories(blogPosts()).map(function toParams(category) {
    return { slug: category.slug };
  });
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isBlogCategory(slug)) notFound();
  const label = categoryLabel(slug);
  return {
    title: `${label} — Volcano blog`,
    description: describe(label),
    alternates: { canonical: `/blog/category/${slug}` },
  };
}
