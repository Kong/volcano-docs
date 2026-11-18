"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PostHog } from "posthog-js";
import {
  COOKIELESS_INSTANCE_NAME,
  cookielessPostHogConfig,
  docsAnalyticsMode,
} from "@/lib/cookieless-counting.mjs";
import {
  CONSENTED_INSTANCE_NAME,
  consentGuard,
  consentedPostHogConfig,
  forgetDocsHostId,
  forgetStoredPlaceholderId,
  stopConsentedAnalytics,
} from "@/lib/consented-analytics.mjs";

type PostHogProviderProps = {
  children: ReactNode;
};

// `version` changes whenever flags (re)load so consumers re-render.
type FlagsState = { client: PostHog | null; version: number };

const FlagsContext = createContext<FlagsState>({ client: null, version: 0 });

// Drops every event the flags instance would send (`$feature_flag_called`
// carries the visitor's IP address). Flag evaluation itself still works.
function dropFlagsInstanceEvents() {
  return null;
}

type NavigatorWithPrivacyControl = Navigator & { globalPrivacyControl?: boolean };

// This visitor's analytics mode, read from the switch, Global Privacy Control
// and volcano.dev's consent cookie (see cookieless-counting.mjs).
function currentAnalyticsMode() {
  return docsAnalyticsMode({
    enabled: process.env.NEXT_PUBLIC_POSTHOG_COOKIELESS_COUNTING,
    globalPrivacyControl: (navigator as NavigatorWithPrivacyControl).globalPrivacyControl,
    cookieHeader: document.cookie,
    hostname: window.location.hostname,
  });
}

function stillConsented() {
  return currentAnalyticsMode() === "consented";
}

// Starts this visitor's analytics, chosen once per page load. A visitor who
// accepted on volcano.dev gets pageview analytics under the PostHog id
// volcano.dev stored; anyone else is counted anonymously. Each is a separate
// instance; nothing else captures through them.
function startVisitorAnalytics(posthog: PostHog, key: string) {
  const hostname = window.location.hostname;
  const storage = browserLocalStorage();
  let mode = currentAnalyticsMode();
  // Without storage there is no volcano.dev id to share: count anonymously.
  if (mode === "consented" && !storage) mode = "cookieless";
  if (mode !== "consented" && storage) forgetDocsHostId(key, hostname, storage);
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (mode === "consented" && storage) {
    forgetStoredPlaceholderId(key, storage);
    startConsentedAnalytics(posthog, key, apiHost, storage);
    return;
  }
  if (mode === "cookieless") {
    posthog.init(key, cookielessPostHogConfig(apiHost), COOKIELESS_INSTANCE_NAME);
  }
}

// The consented instance re-checks consent before every event and whenever
// the tab comes back into view (the visitor may have rejected on volcano.dev
// in another tab). Once consent lapses it stops for the rest of the page load.
function startConsentedAnalytics(posthog: PostHog, key: string, apiHost: string | undefined, storage: Storage) {
  let analytics: PostHog | undefined;

  function stop() {
    window.removeEventListener("focus", recheck);
    window.removeEventListener("pageshow", recheck);
    document.removeEventListener("visibilitychange", recheck);
    const hostname = window.location.hostname;
    if (analytics) {
      stopConsentedAnalytics(analytics, key, hostname, availableStores(storage));
      return;
    }
    forgetDocsHostId(key, hostname, storage);
  }

  // Stops outside posthog-js's capture call, which may be what found the lapse.
  function stopSoon() {
    window.setTimeout(stop, 0);
  }

  const consentStillApplies = consentGuard(stillConsented, stopSoon);

  function recheck() {
    if (document.visibilityState === "visible") consentStillApplies();
  }

  window.addEventListener("focus", recheck);
  window.addEventListener("pageshow", recheck);
  document.addEventListener("visibilitychange", recheck);
  analytics = posthog.init(key, consentedPostHogConfig(apiHost, consentStillApplies), CONSENTED_INSTANCE_NAME);
}

// localStorage, or null where the browser blocks it (reading the property
// itself can throw).
function browserLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// sessionStorage, or null where the browser blocks it.
function browserSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// The storages posthog-js keeps the consented instance's records in.
function availableStores(local: Storage): Storage[] {
  const stores = [local];
  const session = browserSessionStorage();
  if (session) stores.push(session);
  return stores;
}

// Analytics never stops the flags instance from loading: a failure here is
// swallowed so flag consumers (the Blog header link) still get their flags.
function startVisitorAnalyticsSafely(posthog: PostHog, key: string) {
  try {
    startVisitorAnalytics(posthog, key);
  } catch {
    // Analytics stays off for this page load.
  }
}

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
          // Flags only: no analytics capture, replay, surveys or browser storage,
          // and before_send drops the $feature_flag_called event a flag read
          // would otherwise send. Visitor analytics run in their own
          // instances (startVisitorAnalytics). With no storage there is no
          // stable visitor id, so each page load is a new anonymous visitor.
          // Use flags here as all-or-nothing switches (0% or 100%, or
          // property targeting); a partial percentage rollout would show or
          // hide a feature at random on each load. Switch persistence to
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
          before_send: dropFlagsInstanceEvents,
        });
        startVisitorAnalyticsSafely(posthog, key as string);
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

export { PostHogProvider, useFeatureFlag };
