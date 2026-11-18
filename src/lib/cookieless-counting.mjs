/**
 * Anonymous visitor counting for the docs, blog and cookbook.
 *
 * Counsel approved counting visitors who have not accepted analytics cookies,
 * on two conditions: no personal data is captured and nothing is stored in
 * the browser. The docs have no cookie banner of their own, so this counter
 * covers every docs visitor who has not accepted on volcano.dev, except one
 * sending Global Privacy Control. Visitors who accepted get the consented
 * analytics in `consented-analytics.mjs` instead, so nobody is counted twice.
 *
 * It is a separate posthog-js instance in `cookieless_mode: "always"`:
 * posthog-js stores nothing in cookies, localStorage or sessionStorage, and
 * PostHog's ingestion derives an anonymous id from a hash of the day, IP
 * address, user agent and host with a salt that rotates daily. PostHog then
 * removes the IP address and user agent from the event before storing it.
 * The PostHog project's "cookieless server hash mode" setting must be on, or
 * PostHog discards these events.
 *
 * It sends `$pageview` and `$pageleave` only. Every URL loses its query string
 * and fragment, referrers keep only their origin, and ad click identifiers
 * are removed.
 *
 * Off unless the build sets `NEXT_PUBLIC_POSTHOG_COOKIELESS_COUNTING=true`,
 * which turns on both the counter and the consented analytics.
 */

import { consentForHost } from "./consent.mjs";

/** Named PostHog instance, kept apart from the flags instance. */
export const COOKIELESS_INSTANCE_NAME = "volcano_docs_cookieless";

/** The only events the counter may send. */
const COUNTED_EVENTS = new Set(["$pageview", "$pageleave"]);

/**
 * Ad click identifiers posthog-js copies from the landing URL into their own
 * properties. Each one names a single ad click, so it is personal data and is
 * never sent. `mask_personal_data_properties` already masks them; the
 * scrubber drops them as well, so a later SDK default cannot bring them back.
 */
const CLICK_ID_PROPERTIES = new Set([
  "_kx",
  "dclid",
  "epik",
  "fbclid",
  "gbraid",
  "gclid",
  "igshid",
  "irclid",
  "li_fat_id",
  "mc_eid",
  "msclkid",
  "qclid",
  "rdt_cid",
  "sccid",
  "ttclid",
  "twclid",
  "wbraid",
]);

/** Person-property payloads and first-touch snapshots: never sent. */
function isPersonOrInitialProperty(key) {
  return key === "$set" || key === "$set_once" || key.startsWith("$initial_");
}

function isUrlString(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isReferrerProperty(key) {
  return key.includes("referrer");
}

/** Whether the build switch is on. Only the exact string `true` turns it on. */
export function cookielessCountingEnabled(value) {
  return value === "true";
}

/**
 * Whether volcano-web recorded a Global Privacy Control opt-out for this
 * browser. A recorded one keeps counting off after the browser stops sending
 * the signal, matching volcano-web. Every consent cookie is checked.
 */
export function hasRecordedGlobalPrivacyControl(cookieHeader) {
  return consentForHost(cookieHeader, "").gpcRecorded;
}

/**
 * Which analytics the docs run for this visitor, chosen at page load (a
 * running consented instance re-checks and stops if consent lapses; see
 * `consentGuard` in `consented-analytics.mjs`):
 *
 * - `"consented"`: accepted analytics cookies on volcano.dev against the
 *   current Cookie Policy. Full pageview analytics with the same stored
 *   PostHog id as volcano.dev (see `consented-analytics.mjs`).
 * - `"cookieless"`: everyone else, counted anonymously by this module.
 * - `"off"`: the switch is off, or Global Privacy Control is live or
 *   recorded in any consent cookie.
 *
 * `hostname` picks which consent cookie holds the choice for this host (see
 * `consentCookieNameForHost`); a recorded reject in any of them wins.
 */
export function docsAnalyticsMode({ enabled, globalPrivacyControl, cookieHeader, hostname }) {
  if (!cookielessCountingEnabled(enabled)) return "off";
  if (globalPrivacyControl === true) return "off";
  const consent = consentForHost(cookieHeader, hostname);
  if (consent.gpcRecorded) return "off";
  if (consent.accepted) return "consented";
  return "cookieless";
}

/** Whether this visitor is counted by the cookieless counter. */
export function shouldCountCookieless(input) {
  return docsAnalyticsMode(input) === "cookieless";
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

function scrubbedUrl(key, value) {
  if (isReferrerProperty(key)) return originOnly(value);
  return withoutQueryOrFragment(value);
}

/**
 * The counter's `before_send`: drops every event except pageview and
 * pageleave, then cleans what is left.
 *
 * - Ad click identifiers, person-property payloads and `$initial_*`
 *   snapshots are removed.
 * - Every property whose value is a URL, whatever posthog-js names it now or
 *   in a later version, loses its query string and fragment; a referrer keeps
 *   only its origin. A referrer that is not a URL (`$direct`) stays, and one
 *   that cannot be parsed is removed.
 *
 * Campaign names posthog-js copies into their own properties (`utm_source`,
 * `utm_campaign` and the rest) stay: they name a campaign, not a person.
 */
export function scrubCookielessEvent(event) {
  if (!event || !COUNTED_EVENTS.has(event.event)) return null;
  const properties = {};
  for (const [key, value] of Object.entries(event.properties ?? {})) {
    if (CLICK_ID_PROPERTIES.has(key) || isPersonOrInitialProperty(key)) continue;
    if (isReferrerProperty(key) && typeof value === "string" && value !== "$direct" && !isUrlString(value)) continue;
    if (!isUrlString(value)) {
      properties[key] = value;
      continue;
    }
    const scrubbed = scrubbedUrl(key, value);
    if (scrubbed !== null) properties[key] = scrubbed;
  }
  // posthog-js attaches person updates at the top level of the event too.
  const { $set: _set, $set_once: _setOnce, ...rest } = event;
  return { ...rest, properties };
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
    // Masks ad click identifiers and other personal-data URL parameters;
    // the scrubber then drops the click identifiers outright.
    mask_personal_data_properties: true,
    before_send: scrubCookielessEvent,
  };
}
