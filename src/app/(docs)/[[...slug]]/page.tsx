import { source } from "@/lib/source";
import {
  DocsPage,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HomePage } from "@/components/home";
import { CopyPageDropdown } from "@/components/copy-page-dropdown";
import { MarkdownContent } from "@/components/markdown-content";
import { isStandaloneSection } from "@/lib/sections";
import { socialMetadata } from "@/lib/social-card";

type PageProps = { params: Promise<{ slug?: string[] }> };

function isHome(slug?: string[]) {
  return !slug || slug.length === 0;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  if (isStandaloneSection(params.slug)) notFound();

  // The site root renders the custom Figma landing page edge-to-edge inside
  // the docs layout, so it keeps the real header + sidebar but skips the
  // article padding that DocsPage would add.
  if (isHome(params.slug)) {
    return <HomePage />;
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="docs-title-row">
        <DocsTitle>{page.data.title}</DocsTitle>
        <CopyPageDropdown slug={params.slug!} />
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <MarkdownContent page={page} />
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams().filter(function docsOnly(params) {
    return !isStandaloneSection(params.slug);
  });
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;

  if (isHome(params.slug)) {
    return {
      title: "Volcano docs",
      description:
        "Build AI agents and modern applications with the platform for the AI era, fully integrated with your agentic coding tools.",
      ...socialMetadata({
        url: "/",
        // The landing page's social title names the product, not the section.
        title: "Volcano - AI infrastructure for agents and applications",
        description:
          "Build AI agents and modern applications with the platform for the AI era, fully integrated with your agentic coding tools.",
      }),
      alternates: { canonical: "/" },
    };
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    ...socialMetadata({ url: page.url }),
  };
}
