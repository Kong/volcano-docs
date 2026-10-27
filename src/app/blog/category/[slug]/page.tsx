import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogCategoryTabs } from "@/components/blog-category-tabs";
import { BlogPostCards, type BlogPost } from "@/components/blog-post-cards";
import { Hero } from "@/components/home/hero";
import { SectionHeading } from "@/components/home/section-heading";
import { Footer } from "@/components/home/footer";
import {
  categoryLabel,
  collectCategories,
  isBlogCategory,
  postsInCategory,
} from "@/lib/blog-categories.mjs";
import { getBlogViews } from "@/lib/posthog-views";
import { getSectionPages } from "@/lib/sections";
import "@/components/collection-home.css";
import "@/components/home/index.css";

type CategoryPageProps = { params: Promise<{ slug: string }> };

// A category's own page. Every post has exactly one category, so this is the
// canonical place a reader lands from the label on a post — not a filtered
// view of the listing, which is what the sidebar's topics do.
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
  const label = categoryLabel(slug);
  const views = await getBlogViews(inCategory.map(function toUrl(post) { return post.url; }));
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      <Hero
        title={label}
        description={describe(label)}
        actionHref={inCategory[0].url}
        actionLabel="Start reading"
      >
        {/* The category's own description is the whole header here. */}
        {null}
      </Hero>
      <SectionHeading>{`${label} (${inCategory.length})`}</SectionHeading>
      <BlogCategoryTabs categories={collectCategories(posts)} active={slug} />
      <BlogPostCards posts={inCategory} views={views} />
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
