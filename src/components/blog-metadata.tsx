import type { ContentPage } from "@/components/markdown-content";
import "./blog-metadata.css";
import { topicLabel } from "@/lib/blog-topics.mjs";

type BlogMetadataProps = { data: Pick<ContentPage["data"], "author" | "published" | "tags"> };

function formatPublishedDate(published: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${published}T00:00:00Z`));
}

export function BlogMetadata({ data }: BlogMetadataProps) {
  if (!data.author && !data.published && !data.tags?.length) return null;
  return (
    <div data-slot="blog-metadata" className="blog-metadata">
      {data.author && <span>By {data.author}</span>}
      {data.published && <time dateTime={data.published}>{formatPublishedDate(data.published)}</time>}
      {data.tags?.map(function renderTag(tag) {
        return <span className="blog-metadata-tag" key={tag}>{topicLabel(tag)}</span>;
      })}
    </div>
  );
}
