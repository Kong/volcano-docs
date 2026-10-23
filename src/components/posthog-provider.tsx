"use client";

import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider, useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect } from "react";
import type { ReactNode } from "react";

type PostHogProviderProps = {
  children: ReactNode;
};

// Initializes posthog-js once in the browser. With no key configured (local dev
// without .env.local) PostHog stays off and every flag check reads as disabled.
function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(function initPostHog() {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2026-01-30",
      // Flags only: no analytics capture, replay, surveys or browser storage.
      // Flag evaluation still emits $feature_flag_called when a flag is read.
      // With no storage there is no stable visitor id, so each page load is a
      // new anonymous visitor. Use flags here as all-or-nothing switches (0% or
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
      person_profiles: "identified_only",
      persistence: "memory",
    });
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}

// Facade over posthog-js's flag hook so the rest of the app never imports the
// library directly. Returns a plain boolean and fails closed: false while flags
// load, when the flag is off, and when PostHog never starts.
function useFeatureFlag(flag: string): boolean {
  return useFeatureFlagEnabled(flag) === true;
}

export { PostHogProvider, useFeatureFlag };
