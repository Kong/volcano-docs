import { BlogTopicLink } from "@/components/blog-filters";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsTitle, DocsDescription } from "fumadocs-ui/page";
import { source } from "@/lib/source";
import { CollectionHome } from "@/components/collection-home";
import { MarkdownContent } from "@/components/markdown-content";
import "@/components/collection.css";
import { BlogMetadata } from "@/components/blog-metadata";
import { BlogShare } from "@/components/blog-share";
import { siteUrl } from "@/lib/site-url";
import { Footer } from "@/components/home/footer";

type BlogPageProps = { params: Promise<{ slug?: string[] }> };

export default async function BlogPage({ params }: BlogPageProps) {
  const { slug = [] } = await params;
  const page = source.getPage(["blog", ...slug]);
  if (!page) notFound();
  if (slug.length === 0) {
    return <CollectionHome section="blog" page={page} />;
  }
  return (
    <div className="home-page">
      <div data-slot="blog-content" data-variant="article" className="blog-content">
        <article data-slot="collection-article" className="collection-article">
          <BlogTopicLink href="/blog" className="collection-back">← Back to posts</BlogTopicLink>
          <DocsTitle>{page.data.title}</DocsTitle>
          <BlogMetadata data={page.data} />
          <DocsDescription>{page.data.description}</DocsDescription>
          <BlogShare url={new URL(page.url, siteUrl).toString()} title={page.data.title} />
          <MarkdownContent page={page} />
        </article>
      </div>
      <Footer />
    </div>
  );
}

export function generateStaticParams() {
  return source.getPages().filter(function inBlog(page) {
    return page.slugs[0] === "blog";
  }).map(function toParams(page) {
    return { slug: page.slugs.slice(1) };
  });
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const page = source.getPage(["blog", ...slug]);
  if (!page) notFound();
  const metadata: Metadata = {
    title: page.data.title,
    description: page.data.description,
    keywords: page.data.tags,
    alternates: { canonical: page.url },
    openGraph: { type: "website" },
  };
  let authors: string[] | undefined;
  if (page.data.author) {
    metadata.authors = [{ name: page.data.author }];
    authors = [page.data.author];
  }
  if (slug.length > 0) {
    metadata.openGraph = {
      type: "article",
      publishedTime: page.data.published,
      authors,
      tags: page.data.tags,
    };
  }
  return metadata;
}
