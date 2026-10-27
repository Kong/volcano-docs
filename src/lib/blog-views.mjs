// Shared by the client that records a blog view and the server that reads the
// totals back, so both agree on the event name and the property that carries
// the post. Kept free of server-only imports: the tracker is a client
// component.
export const BLOG_VIEW_EVENT = "blog_pageview";
export const BLOG_VIEW_PROPERTY = "post";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** @param {number} count */
export function formatViewCount(count) {
  if (count === 1) return "1 view";
  return `${compact.format(count)} views`;
}
