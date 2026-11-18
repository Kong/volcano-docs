import { scrubCookielessEvent } from "./cookieless-counting.mjs";

/**
 * Pageview analytics for docs visitors who accepted analytics cookies on
 * volcano.dev (see `docsAnalyticsMode` in `cookieless-counting.mjs`).
 *
 * volcano.dev/docs is served by this app on the same origin as volcano.dev,
 * so it shares volcano.dev's localStorage. This instance uses the same project
 * token and the same `persistence: "localStorage"` as volcano-web's analytics
 * instance, so posthog-js reads the id volcano.dev stored
 * (`ph_<token>_posthog`), and a visitor who accepted is one person across the
 * marketing pages and the docs. On docs.volcano.dev, a different origin, it
 * stores its own id; redirecting that host to volcano.dev/docs is what joins
 * the two.
 *
 * Deliberately narrower than volcano-web's instance: pageviews and page
 * exits only, with the same URL and personal-data scrub as the cookieless
 * counter. No autocapture, session replay, web vitals, exceptions, surveys or
 * flags (the flags instance does flags), and it never identifies anyone; it
 * only reuses the id volcano.dev already identified. Every event says
 * `surface: "marketing"` (see `DOCS_SURFACE`).
 */

/** Named PostHog instance, kept apart from the flags instance. */
export const CONSENTED_INSTANCE_NAME = "volcano_docs_analytics";

/**
 * Shared placeholder ids volcano-web refuses to analyze as a person
 * (`libs/data/src/analytics-identity.ts` there). A stored one is cleared
 * before init so the first pageview is not sent as the placeholder.
 */
const PLACEHOLDER_DISTINCT_IDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "11111111-1111-1111-1111-111111111111",
  "11111111-1111-4111-8111-111111111111",
]);

export function isPlaceholderDistinctId(distinctId) {
  return typeof distinctId === "string" && PLACEHOLDER_DISTINCT_IDS.has(distinctId.trim().toLowerCase());
}

function safeToken(token) {
  return token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ");
}

/** posthog-js's localStorage key for a token, built the way the SDK builds it. */
export function postHogPersistenceKey(token) {
  return `ph_${safeToken(token)}_posthog`;
}

/**
 * Every record posthog-js removes when an instance's persistence is disabled:
 * the stored id and properties (in localStorage, and a per-tab copy in
 * sessionStorage) and the session-scoped super properties.
 */
function persistenceRecordKeys(token) {
  return [postHogPersistenceKey(token), `ph_${safeToken(token)}_session_registered_properties`];
}

/**
 * Remove a stored placeholder id so init mints a fresh anonymous one instead
 * of sending this visitor's pageviews as the shared placeholder. Returns
 * whether it removed one. Storage errors leave everything as it was.
 */
export function forgetStoredPlaceholderId(token, storage) {
  const key = postHogPersistenceKey(token);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return false;
  }
  if (!raw) return false;
  let distinctId;
  try {
    distinctId = JSON.parse(raw)?.distinct_id;
  } catch {
    return false;
  }
  if (!isPlaceholderDistinctId(distinctId)) return false;
  try {
    storage.removeItem(key);
  } catch {
    return false;
  }
  return true;
}

/** Origins whose stored PostHog id belongs to volcano-web's own analytics. */
const VOLCANO_WEB_HOSTS = new Set(["volcano.dev", "www.volcano.dev", "staging.volcano.dev", "localhost"]);

function isVolcanoWebHost(hostname) {
  return VOLCANO_WEB_HOSTS.has(String(hostname ?? "").toLowerCase());
}

/**
 * Remove the PostHog id the consented instance stored on a docs-only origin
 * (docs.volcano.dev, docs.staging.volcano.dev) once the visitor no longer has
 * consented analytics: they rejected, their accept is for an older policy, or
 * Global Privacy Control applies. volcano-web cannot clear storage on those
 * origins, so the docs do. On volcano-web's own origins the stored id is
 * volcano-web's to manage, and is left alone. Returns whether it removed one.
 */
export function forgetDocsHostId(token, hostname, storage) {
  if (isVolcanoWebHost(hostname)) return false;
  try {
    const key = postHogPersistenceKey(token);
    if (storage.getItem(key) === null) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-checks consent while the consented instance runs. The docs layout stays
 * mounted across App Router navigations, so one page load can last as long
 * as the tab is open, and the visitor can reject on volcano.dev in another
 * tab meanwhile. Returns a check that is true while `stillConsented()` is.
 * The first time it is not (or it throws), `onLapse` runs once, synchronously
 * (posthog-js saves its record when it builds an event, so a stop must not
 * wait), and every later check is false, even if consent comes back: a new
 * accept takes effect on the next page load.
 */
export function consentGuard(stillConsented, onLapse) {
  let lapsed = false;
  return function consentStillApplies() {
    if (lapsed) return false;
    let consented = false;
    try {
      consented = stillConsented() === true;
    } catch {
      consented = false;
    }
    if (consented) return true;
    lapsed = true;
    try {
      onLapse();
    } catch {
      // The guard already drops every later event.
    }
    return false;
  };
}

/**
 * Stops a running consented instance once consent lapses, for the rest of the
 * page load: no more pageviews or page exits, and no more writes to storage.
 * Persistence must be disabled, not just capture: while it is on, any save
 * (a session touch, a property update) writes the instance's in-memory copy
 * of the id back, even after volcano-web cleared it on a reject.
 *
 * posthog-js deletes the stored records when persistence is disabled. On a
 * docs-only origin that is the point (see `forgetDocsHostId`). On
 * volcano-web's own origins those records are volcano-web's to manage, so
 * they are put back exactly as they were just before: whatever volcano-web
 * holds stays, and a record it already cleared stays cleared.
 *
 * `stores` are the browser storages to protect (localStorage, and
 * sessionStorage where available).
 */
export function stopConsentedAnalytics(instance, token, hostname, stores) {
  const kept = [];
  if (isVolcanoWebHost(hostname)) {
    for (const store of stores) {
      for (const key of persistenceRecordKeys(token)) {
        const value = readStoredItem(store, key);
        if (value !== undefined) kept.push({ store, key, value });
      }
    }
  }
  instance.set_config({ capture_pageview: false, capture_pageleave: false, disable_persistence: true });
  for (const { store, key, value } of kept) restoreStoredItem(store, key, value);
  if (isVolcanoWebHost(hostname)) return;
  for (const store of stores) forgetDocsHostId(token, hostname, store);
}

/** A stored value, null when absent, or undefined when storage is blocked. */
function readStoredItem(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return undefined;
  }
}

function restoreStoredItem(store, key, value) {
  try {
    if (value === null) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, value);
  } catch {
    // Storage blocked: nothing was written either.
  }
}

function alwaysConsented() {
  return true;
}

/**
 * volcano-web registers `surface` on every event as the legal basis it rests
 * on: "marketing" (a cookie accept) or "product" (the customer agreement);
 * see `Surface` in its `libs/data/src/consent.ts`. posthog-js attaches
 * registered properties from the shared stored record to the docs' events
 * too, so a visitor who was last in the product would otherwise send docs
 * pageviews as "product". The docs rest on the volcano.dev cookie accept, so
 * every docs event says "marketing". It is set per event, never registered,
 * so volcano-web's own stored value is left alone.
 */
export const DOCS_SURFACE = "marketing";

/**
 * The consented instance's `before_send`: the cookieless counter's scrub
 * (pageview and page exit only, URLs without query or fragment, no ad click
 * ids, no person properties), nothing sent as a placeholder id, and the
 * docs' own `surface`.
 */
export function scrubConsentedEvent(event) {
  const scrubbed = scrubCookielessEvent(event);
  if (!scrubbed) return null;
  if (isPlaceholderDistinctId(scrubbed.properties?.distinct_id)) return null;
  return { ...scrubbed, properties: { ...scrubbed.properties, surface: DOCS_SURFACE } };
}

/**
 * @param {string | undefined} apiHost
 * @param {() => boolean} [consentStillApplies] a `consentGuard` check; every
 *   event is dropped once it returns false.
 * @returns {Partial<import("posthog-js").PostHogConfig>}
 */
export function consentedPostHogConfig(apiHost, consentStillApplies = alwaysConsented) {
  function beforeSend(event) {
    if (!consentStillApplies()) return null;
    return scrubConsentedEvent(event);
  }
  return {
    api_host: apiHost,
    defaults: "2026-01-30",
    // Same persistence as volcano-web's analytics instance, so the stored id
    // is shared on volcano.dev's origin. No cookie, so nothing is sent to
    // other volcano.dev hosts.
    persistence: "localStorage",
    cross_subdomain_cookie: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_conversations: true,
    disable_product_tours: true,
    disable_web_experiments: true,
    opt_in_site_apps: false,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    mask_personal_data_properties: true,
    // Never creates a person here; events join the person volcano.dev
    // identified through the shared id.
    person_profiles: "identified_only",
    before_send: beforeSend,
  };
}
