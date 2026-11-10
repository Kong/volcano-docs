import { BookOpen } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { getSectionPages, type ContentSection } from "@/lib/sections";
import { MarkdownContent, type ContentPage } from "@/components/markdown-content";
import { Hero } from "@/components/home/hero";
import { FeatureCard } from "@/components/home/feature-card";
import { SectionHeading } from "@/components/home/section-heading";
import { Footer } from "@/components/home/footer";
import { BlogHome } from "@/components/blog-home";
import "@/components/home/index.css";
import "./collection-home.css";

type CollectionHomeProps = { section: ContentSection; page: ContentPage };

export function CollectionHome({ section, page }: CollectionHomeProps) {
  const pages = getSectionPages(section);
  if (section === "blog") {
    const posts = pages.map(function toPost(entry) {
      const { title, description, author, published, category, tags, cover } = entry.data;
      return { url: entry.url, title, description, author, published, category, tags, cover };
    });
    return <BlogHome title={page.data.title} posts={posts} />;
  }

  return (
    <div data-slot="collection-home" className="home-page collection-home">
      <Hero
        title={page.data.title}
        description={page.data.description}
        actionHref={pages[0]?.url ?? "/get-started"}
        actionLabel="Start building"
      >
        <MarkdownContent page={page} />
      </Hero>
      <SectionHeading>Recipes</SectionHeading>
      <div className="collection-home-cards">
        {pages.map(function renderCard(entry) {
          // A recipe with a cover shows it the way a blog post card does; one
          // without keeps the icon.
          let icon: ReactNode = <BookOpen className="feature-card-glyph" />;
          let image: ReactNode;
          if (entry.data.cover) {
            icon = undefined;
            image = <Image src={entry.data.cover} alt="" width={2400} height={1260} sizes="(min-width: 1024px) 33vw, 100vw" />;
          }
          return (
            <FeatureCard
              key={entry.url}
              variant="cover"
              icon={icon}
              image={image}
              title={entry.data.title}
              description={entry.data.description ?? ""}
              href={entry.url}
            >
              <div className="blog-post-footer">
                <span className="blog-post-action">View recipe <span aria-hidden="true">→</span></span>
              </div>
            </FeatureCard>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}
