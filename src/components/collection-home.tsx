import { BookOpen } from "lucide-react";
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
    return <BlogHome posts={posts} />;
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
          return (
            <FeatureCard
              key={entry.url}
              icon={<BookOpen className="feature-card-glyph" />}
              title={entry.data.title}
              description={entry.data.description ?? ""}
              href={entry.url}
            />
          );
        })}
      </div>
      <Footer />
    </div>
  );
}
