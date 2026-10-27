"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/components/posthog-provider";
import { BLOG_VIEW_EVENT, BLOG_VIEW_PROPERTY } from "@/lib/blog-views.mjs";

type BlogViewTrackerProps = { post: string };

// Records one view of a blog post — the only event this site captures by hand.
// Autocapture and pageview capture stay off and PostHog keeps no browser
// storage, so there is no stable visitor id across page loads. The event still
// carries posthog-js's default properties (current URL, referrer, host,
// browser, OS, device and screen size) and PostHog records the client IP and
// GeoIP unless the project has "Discard client IP data" turned on — this is a
// view counter, not an anonymous beacon. posthog-views.ts reads the totals
// back for the count shown on the page.
export function BlogViewTracker({ post }: BlogViewTrackerProps) {
  const client = useAnalytics();
  useEffect(
    function captureView() {
      if (!client) return;
      client.capture(BLOG_VIEW_EVENT, { [BLOG_VIEW_PROPERTY]: post });
    },
    [client, post],
  );
  return null;
}
