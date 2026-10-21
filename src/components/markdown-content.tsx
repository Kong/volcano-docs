import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody } from "fumadocs-ui/page";
import type { ComponentProps } from "react";
import { source } from "@/lib/source";
import { resolveRelativeMdHref } from "@/lib/relative-md-href.mjs";

export type ContentPage = NonNullable<ReturnType<typeof source.getPage>>;
type MarkdownContentProps = { page: ContentPage };

export function MarkdownContent({ page }: MarkdownContentProps) {
  const ResolvedLink = defaultMdxComponents.a;
  const MDXContent = page.data.body;
  function MdLink({ href, ...props }: ComponentProps<"a">) {
    return <ResolvedLink href={resolveRelativeMdHref(href, source, page)} {...props} />;
  }
  return (
    <DocsBody>
      <MDXContent components={{ ...defaultMdxComponents, a: MdLink }} />
    </DocsBody>
  );
}
