"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PostHog } from "posthog-js";
import { flagsAllowed, onConsentChange } from "@/lib/consent";

type PostHogProviderProps = {
  children: ReactNode;
};

// `version` changes whenever flags (re)load so consumers re-render.
type LoadedState = { client: PostHog | null; version: number };
type FlagsState = { client: PostHog | null; version: number; allowed: boolean };

const FlagsContext = createContext<FlagsState>({ client: null, version: 0, allowed: false });

// Loads posthog-js on demand: builds with no key never download the SDK, and
// builds with one load it after the page is interactive. With no key configured
// (local dev without .env.local) PostHog stays off and every flag check reads
// as disabled. Flags follow volcano-web's analytics consent rule (see
// src/lib/consent.ts): without an accepted choice, no Global Privacy Control, the
// SDK is never loaded and PostHog is never contacted.
function PostHogProvider({ children }: PostHogProviderProps) {
  const [loaded, setLoaded] = useState<LoadedState>({ client: null, version: 0 });
  const [allowed, setAllowed] = useState(false);

  useEffect(function watchConsent() {
    function sync() {
      setAllowed(flagsAllowed());
    }
    sync();
    return onConsentChange(sync);
  }, []);

  useEffect(function initPostHog() {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (!allowed) return;
    let cancelled = false;
    let started: PostHog | undefined;
    let unsubscribe: (() => void) | undefined;

    function bump(client: PostHog) {
      setLoaded(function next(previous) {
        return { client, version: previous.version + 1 };
      });
    }

    function start(loaded: { default: PostHog }) {
      if (cancelled) return;
      const posthog = loaded.default;
      started = posthog;
      if (!posthog.__loaded) {
        posthog.init(key as string, {
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
          disable_conversations: true,
          disable_product_tours: true,
          person_profiles: "identified_only",
          persistence: "memory",
        });
      }
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
      // Consent withdrawn: forget the flag identity. Reads are off via `allowed`.
      if (started) started.reset();
    };
  }, [allowed]);

  return <FlagsContext.Provider value={{ ...loaded, allowed }}>{children}</FlagsContext.Provider>;
}

// Facade so the rest of the app never imports posthog-js directly. Returns a
// plain boolean and fails closed: false until the SDK has loaded and the flags
// are back, when the flag is off, and when PostHog never starts.
function useFeatureFlag(flag: string): boolean {
  const { client, allowed } = useContext(FlagsContext);
  if (!client || !allowed) return false;
  return client.isFeatureEnabled(flag) === true;
}

export { PostHogProvider, useFeatureFlag };
