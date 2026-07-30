import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { HomePage } from "@/components/home";
import { CopyPageDropdown } from "@/components/copy-page-dropdown";
import { ensureRelativeMdHref } from "@/lib/relative-md-href.mjs";

type PageProps = { params: Promise<{ slug?: string[] }> };

type DocsPageData = ReturnType<typeof source.getPage>;

// Resolve relative Markdown links (`./x.md`, `../x.md`, and bare `x.md`) to real
// routes so they don't 404. createRelativeLink handles ./ and ../ against the
// page tree (index/README/slug rules and #fragments included); ensureRelativeMdHref
// normalizes bare links first so they qualify. Runs at build for whatever content
// the sync lands — no content edits, so synced docs stay untouched.
function createMdLink(page: NonNullable<DocsPageData>) {
  const ResolvedLink = createRelativeLink(source, page);
  return function MdLink({ href, ...props }: ComponentProps<"a">) {
    return <ResolvedLink href={ensureRelativeMdHref(href)} {...props} />;
  };
}

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
      <div className="docs-title-row">
        <DocsTitle>{page.data.title}</DocsTitle>
        <CopyPageDropdown slug={params.slug!} />
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={{ ...defaultMdxComponents, a: createMdLink(page) }} />
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
