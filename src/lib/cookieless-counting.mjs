/**
 * Anonymous visitor counting for the docs, blog and cookbook.
 *
 * Counsel approved counting visitors who have not accepted analytics cookies,
 * on two conditions: no personal data is captured and nothing is stored in
 * the browser. The docs site has no analytics instance and no cookie banner of
 * its own, so this counter covers every docs visitor, except one sending
 * Global Privacy Control.
 *
 * It is a separate posthog-js instance in `cookieless_mode: "always"`:
 * posthog-js stores nothing in cookies, localStorage or sessionStorage, and
 * PostHog's ingestion derives an anonymous id from a hash of the day, IP
 * address, user agent and host with a salt that rotates daily. PostHog then
 * removes the IP address and user agent from the event before storing it.
 * The PostHog project's "cookieless server hash mode" setting must be on, or
 * PostHog discards these events.
 *
 * It sends `$pageview` and `$pageleave` only, with the query string and
 * fragment removed from page URLs and the referrer cut to its origin.
 *
 * Off unless the build sets `NEXT_PUBLIC_POSTHOG_COOKIELESS_COUNTING=true`.
 */

/** Named PostHog instance, kept apart from the flags instance. */
export const COOKIELESS_INSTANCE_NAME = "volcano_docs_cookieless";

/**
 * Consent cookies volcano-web writes: the production name (shared across
 * .volcano.dev) and the host-only name it uses on other volcano.dev hosts.
 */
const CONSENT_COOKIE_NAMES = ["volcano_cookie_consent", "volcano_cookie_consent_host"];

/** The only events the counter may send. */
const COUNTED_EVENTS = new Set(["$pageview", "$pageleave"]);

/** Properties holding a page URL: query string and fragment are removed. */
const PAGE_URL_PROPERTIES = ["$current_url", "$prev_pageview_url"];

/** Properties holding a referrer URL: cut to the origin. */
const REFERRER_PROPERTIES = ["$referrer", "$initial_referrer"];

/** Whether the build switch is on. Only the exact string `true` turns it on. */
export function cookielessCountingEnabled(value) {
  return value === "true";
}

/**
 * Whether volcano-web recorded a Global Privacy Control opt-out for this
 * browser. A recorded one keeps counting off after the browser stops sending
 * the signal, matching volcano-web. Malformed cookies are ignored.
 */
export function hasRecordedGlobalPrivacyControl(cookieHeader) {
  if (typeof cookieHeader !== "string" || cookieHeader === "") return false;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    const name = entry.slice(0, separator).trim();
    if (!CONSENT_COOKIE_NAMES.includes(name)) continue;
    try {
      const record = JSON.parse(decodeURIComponent(entry.slice(separator + 1).trim()));
      if (record && record.source === "gpc") return true;
    } catch {
      // Not a consent record volcano-web wrote.
    }
  }
  return false;
}

/**
 * Whether this visitor may be counted: the switch is on and the browser has
 * neither a live nor a recorded Global Privacy Control opt-out.
 */
export function shouldCountCookieless({ enabled, globalPrivacyControl, cookieHeader }) {
  if (!cookielessCountingEnabled(enabled)) return false;
  if (globalPrivacyControl === true) return false;
  if (hasRecordedGlobalPrivacyControl(cookieHeader)) return false;
  return true;
}

function withoutQueryOrFragment(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function originOnly(value) {
  if (value === "$direct") return value;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function scrubProperty(properties, key, scrub) {
  const value = properties[key];
  if (typeof value !== "string" || value === "") return;
  const scrubbed = scrub(value);
  if (scrubbed === null) {
    delete properties[key];
    return;
  }
  properties[key] = scrubbed;
}

/**
 * The counter's `before_send`: drops every event except pageview and
 * pageleave, and removes the query string and fragment from page URLs and
 * everything but the origin from referrers. Campaign parameters posthog-js
 * already copied into their own properties (`utm_source` and the rest) stay.
 */
export function scrubCookielessEvent(event) {
  if (!event || !COUNTED_EVENTS.has(event.event)) return null;
  const properties = { ...event.properties };
  for (const key of PAGE_URL_PROPERTIES) scrubProperty(properties, key, withoutQueryOrFragment);
  for (const key of REFERRER_PROPERTIES) scrubProperty(properties, key, originOnly);
  return { ...event, properties };
}

/**
 * Narrowest posthog-js config that still yields web-analytics visitor and
 * pageview counts.
 *
 * @param {string | undefined} apiHost
 * @returns {Partial<import("posthog-js").PostHogConfig>}
 */
export function cookielessPostHogConfig(apiHost) {
  return {
    api_host: apiHost,
    defaults: "2026-01-30",
    // No cookies, no local or session storage, no client session id, no replay.
    cookieless_mode: "always",
    persistence: "memory",
    disable_persistence: true,
    // Own consent key, so this instance never shares the flags instance's.
    consent_persistence_name: "volcano_docs_cookieless_consent",
    // App Router navigations count as pageviews. The flags instance never
    // captures pageviews, so this is the only instance that patches history.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_scroll_properties: true,
    disable_session_recording: true,
    disable_surveys: true,
    disable_conversations: true,
    disable_product_tours: true,
    disable_web_experiments: true,
    opt_in_site_apps: false,
    // No /flags call and no remote config, so no project setting can turn a
    // capture feature on for this instance without a code change.
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    // Never create or update a person.
    person_profiles: "never",
    before_send: scrubCookielessEvent,
  };
}
