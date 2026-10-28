import { Newspaper } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { BlogCategory } from "@/components/blog-category";
import { BlogMetadata } from "@/components/blog-metadata";
import { FeatureCard } from "@/components/home/feature-card";

export type BlogPost = {
  url: string;
  title: string;
  description?: string;
  author?: string;
  published?: string;
  category?: string;
  tags?: string[];
  cover?: string;
};

type BlogPostCardsProps = { posts: BlogPost[] };

// The post grid, shared by the blog listing and each category page so both
// show a post the same way: cover or icon, category, title, then the byline.
export function BlogPostCards({ posts }: BlogPostCardsProps) {
  return (
    <div data-slot="blog-post-cards" className="collection-home-cards">
      {posts.map(function renderPost(post) {
        let icon: ReactNode = <Newspaper className="feature-card-glyph" />;
        let image: ReactNode;
        if (post.cover) {
          icon = undefined;
          image = <Image src={post.cover} alt="" width={2400} height={1260} sizes="(min-width: 1024px) 40vw, 100vw" />;
        }
        let eyebrow: ReactNode;
        // The card is itself a link, so the category is a plain label here —
        // it links to its own page from the article.
        if (post.category) eyebrow = <BlogCategory category={post.category} linked={false} />;
        return (
          <FeatureCard
            key={post.url}
            variant="cover"
            icon={icon}
            image={image}
            eyebrow={eyebrow}
            title={post.title}
            description={post.description ?? ""}
            href={post.url}
          >
            <div className="blog-post-footer">
              <BlogMetadata data={{ author: post.author, published: post.published }} />
              <span className="blog-post-action">Read post <span aria-hidden="true">→</span></span>
            </div>
          </FeatureCard>
        );
      })}
    </div>
  );
}
