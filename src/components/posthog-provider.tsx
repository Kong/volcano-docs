"use client";

import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";
import { useEffect } from "react";
import type { ReactNode } from "react";

type PostHogProviderProps = {
  children: ReactNode;
};

// Initializes posthog-js once in the browser. With no key configured (local dev
// without .env.local) PostHog stays off and every flag check reads as disabled.
function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2026-01-30",
    });
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}

export { PostHogProvider };
