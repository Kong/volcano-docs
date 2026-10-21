"use client";

import { Newspaper } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useBlogFilters } from "@/components/blog-filters";
import { BlogMetadata } from "@/components/blog-metadata";
import { Hero } from "@/components/home/hero";
import { FeatureCard } from "@/components/home/feature-card";
import { SectionHeading } from "@/components/home/section-heading";
import { Footer } from "@/components/home/footer";
import { blogTopicHref, topicLabel } from "@/lib/blog-topics.mjs";
import "./collection-home.css";
import "@/components/home/index.css";

type BlogPost = { url: string; title: string; description?: string; author?: string; published?: string; tags?: string[]; cover?: string };
type BlogHomeProps = { title: string; description?: string; posts: BlogPost[]; children: ReactNode };

export function BlogHome({ title, description, posts, children }: BlogHomeProps) {
  const { topic, setTopic } = useBlogFilters();
  const filtered = posts.filter(function matchesTopic(post) { return !topic || post.tags?.includes(topic); });
  let heading = `All posts (${filtered.length})`;
  if (topic) heading = `${topicLabel(topic)} (${filtered.length})`;
  function clearTopic() { setTopic(null); }
  return (
    <div data-slot="collection-home" className="home-page collection-home blog-home">
      <Hero title={title} description={description} actionHref={blogTopicHref(topic, filtered[0]?.url ?? "/blog")} actionLabel="Start reading">{children}</Hero>
      <SectionHeading>{heading}</SectionHeading>
      <div className="collection-home-cards" aria-live="polite">
        {filtered.map(function renderPost(post) {
          let icon: ReactNode = <Newspaper className="feature-card-glyph" />;
          let image: ReactNode;
          if (post.cover) {
            icon = undefined;
            image = <Image src={post.cover} alt="" width={2400} height={1260} sizes="(min-width: 1024px) 40vw, 100vw" />;
          }
          return (
            <FeatureCard key={post.url} className="blog-post-card" icon={icon} image={image} eyebrow={<BlogMetadata data={{ tags: post.tags }} />} title={post.title} description={post.description ?? ""} href={blogTopicHref(topic, post.url)}>
              <div className="blog-post-footer">
                <BlogMetadata data={{ author: post.author, published: post.published }} />
                <span className="blog-post-action">Read post <span aria-hidden="true">→</span></span>
              </div>
            </FeatureCard>
          );
        })}
      </div>
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
