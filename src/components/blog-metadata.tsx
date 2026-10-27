import type { ContentPage } from "@/components/markdown-content";
import { BlogCategory } from "@/components/blog-category";
import "./blog-metadata.css";

type BlogMetadataProps = {
  data: Pick<ContentPage["data"], "author" | "published" | "category">;
};

function formatPublishedDate(published: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${published}T00:00:00Z`));
}

// The byline row: category, author, and date.
export function BlogMetadata({ data }: BlogMetadataProps) {
  if (!data.author && !data.published && !data.category) return null;
  return (
    <div data-slot="blog-metadata" className="blog-metadata">
      {data.category && <BlogCategory category={data.category} />}
      {data.author && <span>By {data.author}</span>}
      {data.published && <time dateTime={data.published}>{formatPublishedDate(data.published)}</time>}
    </div>
  );
}
