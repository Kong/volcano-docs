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
 * only reuses the id volcano.dev already identified.
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

/** posthog-js's localStorage key for a token, built the way the SDK builds it. */
export function postHogPersistenceKey(token) {
  const safe = token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ");
  return `ph_${safe}_posthog`;
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

/**
 * The consented instance's `before_send`: the cookieless counter's scrub
 * (pageview and page exit only, URLs without query or fragment, no ad click
 * ids, no person properties), and nothing sent as a placeholder id.
 */
export function scrubConsentedEvent(event) {
  const scrubbed = scrubCookielessEvent(event);
  if (!scrubbed) return null;
  if (isPlaceholderDistinctId(scrubbed.properties?.distinct_id)) return null;
  return scrubbed;
}

/**
 * @param {string | undefined} apiHost
 * @returns {Partial<import("posthog-js").PostHogConfig>}
 */
export function consentedPostHogConfig(apiHost) {
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
    before_send: scrubConsentedEvent,
  };
}
