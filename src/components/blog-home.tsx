"use client";

import type { ReactNode } from "react";
import { useBlogFilters } from "@/components/blog-filters";
import { BlogCategoryTabs } from "@/components/blog-category-tabs";
import { BlogPostCards, type BlogPost } from "@/components/blog-post-cards";
import { Hero } from "@/components/home/hero";
import { SectionHeading } from "@/components/home/section-heading";
import { Footer } from "@/components/home/footer";
import { blogTopicHref, topicLabel } from "@/lib/blog-topics.mjs";
import "./collection-home.css";
import "@/components/home/index.css";

type Category = { slug: string; label: string; count: number };
type BlogHomeProps = {
  title: string;
  description?: string;
  posts: BlogPost[];
  categories: Category[];
  views: Record<string, number>;
  children: ReactNode;
};

export function BlogHome({ title, description, posts, categories, views, children }: BlogHomeProps) {
  const { topic, setTopic } = useBlogFilters();
  const filtered = posts.filter(function matchesTopic(post) { return !topic || post.tags?.includes(topic); });
  let heading = `All posts (${filtered.length})`;
  if (topic) heading = `${topicLabel(topic)} (${filtered.length})`;
  function clearTopic() { setTopic(null); }
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      <Hero title={title} description={description} actionHref={blogTopicHref(topic, filtered[0]?.url ?? "/blog")} actionLabel="Start reading">{children}</Hero>
      <SectionHeading>{heading}</SectionHeading>
      <BlogCategoryTabs categories={categories} />
      <BlogPostCards posts={filtered} views={views} topic={topic} />
      {filtered.length === 0 && (
        <div data-slot="blog-empty" className="blog-empty">
          <p>No posts match this topic.</p>
          <button type="button" onClick={clearTopic}>Show all posts</button>
        </div>
      )}
      <Footer />
    </div>
  );
}
