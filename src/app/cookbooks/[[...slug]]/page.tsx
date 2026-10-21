import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsPage, DocsTitle, DocsDescription } from "fumadocs-ui/page";
import { source } from "@/lib/source";
import { CollectionHome } from "@/components/collection-home";
import { MarkdownContent } from "@/components/markdown-content";
import { CopyPageDropdown } from "@/components/copy-page-dropdown";

type CookbooksPageProps = { params: Promise<{ slug?: string[] }> };

export default async function CookbooksPage({ params }: CookbooksPageProps) {
  const { slug = [] } = await params;
  const page = source.getPage(["cookbooks", ...slug]);
  if (!page) notFound();
  if (slug.length === 0) {
    return <CollectionHome section="cookbooks" page={page} />;
  }
  return (
    <DocsPage toc={page.data.toc}>
      <div className="docs-title-row">
        <DocsTitle>{page.data.title}</DocsTitle>
        <CopyPageDropdown slug={page.slugs} />
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <MarkdownContent page={page} />
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.getPages().filter(function inCookbooks(page) {
    return page.slugs[0] === "cookbooks";
  }).map(function toParams(page) {
    return { slug: page.slugs.slice(1) };
  });
}

export async function generateMetadata({ params }: CookbooksPageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const page = source.getPage(["cookbooks", ...slug]);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description, alternates: { canonical: page.url } };
}
