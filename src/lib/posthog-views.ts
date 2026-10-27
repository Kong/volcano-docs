import { BLOG_VIEW_EVENT, BLOG_VIEW_PROPERTY } from "@/lib/blog-views.mjs";

// Blog view counts, read from PostHog at render time. The browser records one
// `blog_pageview` event per post view (see blog-view-tracker.tsx); this reads
// the totals back with a HogQL query, cached for an hour so a page render
// never waits on PostHog more than once per window.
//
// Server-side only — POSTHOG_API_KEY is a personal API key and must not reach
// the browser. With no key configured (local development, previews) every
// lookup returns no counts and the UI simply omits them.

const REVALIDATE_SECONDS = 3600;
const LOOKBACK_DAYS = 365;
const DEFAULT_API_HOST = "https://us.posthog.com";

type BlogViewCounts = ReadonlyMap<string, number>;

const NO_COUNTS: BlogViewCounts = new Map();

type QueryResponse = { results?: unknown };

function viewsQuery() {
  // The event name and property are constants in this repo, not user input, so
  // the query carries no interpolated values from the request.
  return [
    `SELECT properties.${BLOG_VIEW_PROPERTY} AS post, count() AS views`,
    "FROM events",
    `WHERE event = '${BLOG_VIEW_EVENT}' AND timestamp >= now() - INTERVAL ${LOOKBACK_DAYS} DAY`,
    "GROUP BY post",
  ].join(" ");
}

function toCounts(payload: QueryResponse): BlogViewCounts {
  if (!Array.isArray(payload.results)) return NO_COUNTS;
  const counts = new Map<string, number>();
  for (const row of payload.results) {
    if (!Array.isArray(row)) continue;
    const [post, views] = row;
    if (typeof post !== "string" || typeof views !== "number") continue;
    counts.set(post, views);
  }
  return counts;
}

async function fetchViewCounts(): Promise<BlogViewCounts> {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return NO_COUNTS;
  const host = process.env.POSTHOG_API_HOST ?? DEFAULT_API_HOST;
  const project = process.env.POSTHOG_PROJECT_ID ?? "@current";
  try {
    const response = await fetch(`${host}/api/projects/${project}/query/`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: viewsQuery() } }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return NO_COUNTS;
    return toCounts((await response.json()) as QueryResponse);
  } catch {
    // PostHog being unreachable is never a reason to fail a docs page: the
    // post renders without its count.
    return NO_COUNTS;
  }
}

/**
 * View counts for the given post URLs, keyed by URL and omitting posts with no
 * views yet, so the result stays serializable for the client components that
 * render it.
 */
export async function getBlogViews(urls: string[]): Promise<Record<string, number>> {
  const counts = await fetchViewCounts();
  const views: Record<string, number> = {};
  for (const url of urls) {
    const count = counts.get(url);
    if (count) views[url] = count;
  }
  return views;
}
