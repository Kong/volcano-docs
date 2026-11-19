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
  postHogPersistenceKey,
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
// accepted on volcano.dev gets pageview and heatmap analytics under the PostHog
// id volcano.dev stored; anyone else is counted anonymously. Each is a separate
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

// The consented instance stops for the rest of the page load as soon as
// consent lapses (the visitor may reject on volcano.dev in another tab, even
// while this tab is hidden). Every check stops it synchronously, before
// posthog-js can save its in-memory id again:
// - a `storage` event, which reaches hidden tabs too. One removing the shared
//   PostHog record (volcano-web clearing it on a reject) stops it whatever
//   the consent cookie says yet;
// - `pagehide`, registered before posthog-js's own handler so the stop runs
//   before the page-exit capture;
// - the tab coming back into view, and every event (`before_send`).
function startConsentedAnalytics(posthog: PostHog, key: string, apiHost: string | undefined, storage: Storage) {
  const recordKey = postHogPersistenceKey(key);
  let analytics: PostHog | undefined;
  let sharedRecordRemoved = false;

  function consentHolds() {
    return !sharedRecordRemoved && stillConsented();
  }

  function stop() {
    window.removeEventListener("storage", recheckOnStorage);
    window.removeEventListener("pagehide", recheck, true);
    window.removeEventListener("focus", recheckWhenVisible);
    window.removeEventListener("pageshow", recheckWhenVisible);
    document.removeEventListener("visibilitychange", recheckWhenVisible);
    const hostname = window.location.hostname;
    if (analytics) {
      stopConsentedAnalytics(analytics, key, hostname, availableStores(storage));
      return;
    }
    forgetDocsHostId(key, hostname, storage);
  }

  const consentStillApplies = consentGuard(consentHolds, stop);

  function recheck() {
    consentStillApplies();
  }

  function recheckWhenVisible() {
    if (document.visibilityState === "visible") consentStillApplies();
  }

  function recheckOnStorage(event: StorageEvent) {
    if (event.storageArea !== storage) return;
    if (sharedRecordRemovedBy(event, recordKey)) sharedRecordRemoved = true;
    consentStillApplies();
  }

  window.addEventListener("storage", recheckOnStorage);
  window.addEventListener("pagehide", recheck, true);
  window.addEventListener("focus", recheckWhenVisible);
  window.addEventListener("pageshow", recheckWhenVisible);
  document.addEventListener("visibilitychange", recheckWhenVisible);
  analytics = posthog.init(key, consentedPostHogConfig(apiHost, consentStillApplies), CONSENTED_INSTANCE_NAME);
}

// Whether a storage event removed the shared PostHog record (or cleared all
// of localStorage).
function sharedRecordRemovedBy(event: StorageEvent, recordKey: string) {
  if (event.key === null) return true;
  return event.key === recordKey && event.newValue === null;
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
