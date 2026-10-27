"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/components/posthog-provider";
import { BLOG_VIEW_EVENT, BLOG_VIEW_PROPERTY } from "@/lib/blog-views.mjs";

type BlogViewTrackerProps = { post: string };

// Records one view of a blog post. The only event this site captures by hand:
// autocapture and pageview capture stay off, and PostHog keeps no browser
// storage, so this sends the post's URL and nothing that identifies a reader.
// posthog-views.ts reads the totals back for the count shown on the page.
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
