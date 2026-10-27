"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PostHog } from "posthog-js";

type PostHogProviderProps = {
  children: ReactNode;
};

// `version` changes whenever flags (re)load so consumers re-render.
type FlagsState = { client: PostHog | null; version: number };

const FlagsContext = createContext<FlagsState>({ client: null, version: 0 });

// Loads posthog-js on demand: builds with no key never download the SDK, and
// builds with one load it after the page is interactive. With no key configured
// (local dev without .env.local) PostHog stays off and every flag check reads
// as disabled.
function PostHogProvider({ children }: PostHogProviderProps) {
  const [state, setState] = useState<FlagsState>({ client: null, version: 0 });

  useEffect(function initPostHog() {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    function bump(client: PostHog) {
      setState(function next(previous) {
        return { client, version: previous.version + 1 };
      });
    }

    function start(loaded: { default: PostHog }) {
      if (cancelled) return;
      const posthog = loaded.default;
      if (!posthog.__loaded) {
        posthog.init(key as string, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          defaults: "2026-01-30",
          // Flags, plus the explicit events this app sends itself: no
          // autocapture, no pageview capture, no replay, no surveys, no browser
          // storage. The only event captured by hand today is the blog view
          // (blog-view-tracker.tsx).
          // Flag evaluation still emits $feature_flag_called when a flag is read.
          // With no storage there is no stable visitor id, so each page load is a
          // new anonymous visitor — a blog view count is therefore views, not
          // unique visitors. Use flags here as all-or-nothing switches (0% or
          // 100%, or property targeting); a partial percentage rollout would show
          // or hide a feature at random on each load. Switch persistence to
          // "localStorage" if stable percentage rollouts are needed.
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_performance: false,
          capture_heatmaps: false,
          capture_dead_clicks: false,
          capture_exceptions: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_conversations: true,
          disable_product_tours: true,
          person_profiles: "identified_only",
          persistence: "memory",
        });
      }
      // Publish the client as soon as it exists. Flags still fail closed until
      // they load (below), but anything that only captures an event — the blog
      // view tracker — must not wait on a flag response that may never arrive.
      bump(posthog);
      unsubscribe = posthog.onFeatureFlags(function flagsLoaded() {
        bump(posthog);
      });
    }

    function ignoreLoadFailure() {
      // The SDK failed to load (offline, blocked): flags stay off.
    }

    import("posthog-js").then(start).catch(ignoreLoadFailure);

    return function cleanup() {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return <FlagsContext.Provider value={state}>{children}</FlagsContext.Provider>;
}

// Facade so the rest of the app never imports posthog-js directly. Returns a
// plain boolean and fails closed: false until the SDK has loaded and the flags
// are back, when the flag is off, and when PostHog never starts.
function useFeatureFlag(flag: string): boolean {
  const { client } = useContext(FlagsContext);
  if (!client) return false;
  return client.isFeatureEnabled(flag) === true;
}

// The loaded client, or null while PostHog is off or still loading. Callers
// capture explicit events with it; autocapture, replay and pageview capture
// stay disabled in the init above.
function useAnalytics(): PostHog | null {
  return useContext(FlagsContext).client;
}

export { PostHogProvider, useAnalytics, useFeatureFlag };
