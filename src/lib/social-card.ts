import type { Metadata } from "next";

// Next replaces `openGraph` and `twitter` wholesale between route segments
// rather than merging them: a page that sets either one drops everything the
// root layout put there, the image from opengraph-image.tsx included. So every
// page that wants its own og:url or its own image states the whole object, and
// builds it here so the site name, the card type and the fallback image cannot
// drift apart between the four places that set them.

const SITE_NAME = "Volcano docs";

/** The generated default card — see src/app/opengraph-image.tsx. */
const DEFAULT_CARD = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type Images = NonNullable<OpenGraph["images"]>;
type SocialMetadata = Pick<Metadata, "openGraph" | "twitter">;
type SocialInput = {
  /** The page's own URL, resolved against metadataBase. */
  url: string;
  /** Social title, when it should read differently from the page title. */
  title?: string;
  /** Social description, when it should read differently from the page's. */
  description?: string;
  /** The page's own image. Without one the page shares the generated card. */
  images?: Images;
  /** Article fields, for a blog post. */
  article?: Pick<Extract<OpenGraph, { type: "article" }>, "publishedTime" | "authors" | "tags">;
};

export function socialMetadata({ url, title, description, images, article }: SocialInput): SocialMetadata {
  let card: Images = DEFAULT_CARD;
  if (Array.isArray(images) && images.length > 0) card = images;
  const twitter: SocialMetadata["twitter"] = { card: "summary_large_image", title, description, images: card };
  const shared = { siteName: SITE_NAME, url, title, description, images: card };
  if (!article) return { openGraph: { type: "website", ...shared }, twitter };
  return { openGraph: { type: "article", ...shared, ...article }, twitter };
}
