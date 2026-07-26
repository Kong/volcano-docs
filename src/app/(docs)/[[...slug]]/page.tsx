import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { HomePage } from "@/components/home";

type PageProps = { params: Promise<{ slug?: string[] }> };

function isHome(slug?: string[]) {
  return !slug || slug.length === 0;
}

export default async function Page(props: PageProps) {
  const params = await props.params;

  // The site root renders the custom Figma landing page edge-to-edge inside
  // the docs layout, so it keeps the real header + sidebar but skips the
  // article padding that DocsPage would add.
  if (isHome(params.slug)) {
    return <HomePage />;
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;

  if (isHome(params.slug)) {
    return {
      title: "Volcano docs",
      description:
        "Volcano provides a serverless cloud for engineers and researchers who want to build compute-intensive applications without thinking about infrastructure.",
    };
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
