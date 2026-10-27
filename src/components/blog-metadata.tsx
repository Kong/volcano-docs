import type { ContentPage } from "@/components/markdown-content";
import { BlogCategory } from "@/components/blog-category";
import { formatViewCount } from "@/lib/blog-views.mjs";
import "./blog-metadata.css";

type BlogMetadataProps = {
  data: Pick<ContentPage["data"], "author" | "published" | "category">;
  views?: number;
};

function formatPublishedDate(published: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${published}T00:00:00Z`));
}

// The byline row: category, author, date, and — once PostHog has counts for the
// post — how many times it has been read. A post with no count yet (a new one,
// or a build with no analytics key) simply shows the rest.
export function BlogMetadata({ data, views }: BlogMetadataProps) {
  if (!data.author && !data.published && !data.category && !views) return null;
  return (
    <div data-slot="blog-metadata" className="blog-metadata">
      {data.category && <BlogCategory category={data.category} />}
      {data.author && <span>By {data.author}</span>}
      {data.published && <time dateTime={data.published}>{formatPublishedDate(data.published)}</time>}
      {views !== undefined && views > 0 && <span>{formatViewCount(views)}</span>}
    </div>
  );
}
