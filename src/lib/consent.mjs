/**
 * Reads the cookie consent volcano-web records, so the docs follow the
 * visitor's choice from the main site's banner. The docs have no banner of
 * their own.
 *
 * volcano-web writes the record as URI-encoded JSON
 * (`{ analytics, version, at, source }`) in `volcano_cookie_consent`, shared
 * across .volcano.dev from the production site, or in the host-only
 * `volcano_cookie_consent_host` on other volcano.dev hosts such as staging
 * (`libs/data/src/consent.ts` there). On a staging host both can be present.
 */

/**
 * The Cookie Policy version an accept must have been given against. Must
 * match the version volcano.dev publishes at /legal/cookies; the daily
 * `pnpm check:cookie-policy` job fails when it does not. An accept given
 * against another version is treated as unanswered, as volcano-web does.
 */
export const COOKIE_POLICY_VERSION = "2026-09-07";

export const PRODUCTION_CONSENT_COOKIE = "volcano_cookie_consent";
export const HOST_CONSENT_COOKIE = "volcano_cookie_consent_host";

const CONSENT_COOKIE_NAMES = new Set([PRODUCTION_CONSENT_COOKIE, HOST_CONSENT_COOKIE]);

/** Hosts whose consent is the production banner's `.volcano.dev` cookie. */
const PRODUCTION_HOSTS = new Set(["volcano.dev", "www.volcano.dev", "docs.volcano.dev"]);

/**
 * The consent cookie that holds the choice made for `hostname`: the
 * production cookie on the production site and its docs, the host-only
 * cookie on other volcano.dev hosts (staging and previews), and the
 * production name anywhere else, as volcano-web does.
 */
export function consentCookieNameForHost(hostname) {
  const host = String(hostname ?? "").toLowerCase().replace(/\.+$/, "");
  if (PRODUCTION_HOSTS.has(host)) return PRODUCTION_CONSENT_COOKIE;
  if (host.endsWith(".volcano.dev")) return HOST_CONSENT_COOKIE;
  return PRODUCTION_CONSENT_COOKIE;
}

function parseCookieValue(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Not a record volcano-web wrote.
  }
  return null;
}

/** Every consent cookie in `cookieHeader`, parsed loosely: `{ name, record }`. */
export function readConsentCookies(cookieHeader) {
  if (typeof cookieHeader !== "string" || cookieHeader === "") return [];
  const found = [];
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    const name = entry.slice(0, separator).trim();
    if (!CONSENT_COOKIE_NAMES.has(name)) continue;
    const record = parseCookieValue(entry.slice(separator + 1).trim());
    if (record) found.push({ name, record });
  }
  return found;
}

function isValidRecord(record) {
  return (record.analytics === "accept" || record.analytics === "reject") && typeof record.version === "string";
}

/**
 * The visitor's consent as the docs apply it, most restrictive first:
 *
 * - `gpcRecorded`: any consent cookie records a Global Privacy Control
 *   opt-out, whatever else it holds.
 * - `rejected`: any valid consent cookie records a Reject.
 * - `accepted`: the cookie for this host records an accept against the
 *   current Cookie Policy, and nothing above applies.
 */
export function consentForHost(cookieHeader, hostname) {
  const cookies = readConsentCookies(cookieHeader);
  const gpcRecorded = cookies.some(function recordsGpc({ record }) {
    return record.source === "gpc";
  });
  const rejected = cookies.some(function recordsReject({ record }) {
    return isValidRecord(record) && record.analytics === "reject";
  });
  const hostCookie = consentCookieNameForHost(hostname);
  const own = cookies.find(function forThisHost({ name, record }) {
    return name === hostCookie && isValidRecord(record);
  });
  const accepted =
    !gpcRecorded && !rejected && own?.record.analytics === "accept" && own.record.version === COOKIE_POLICY_VERSION;
  return { gpcRecorded, rejected, accepted };
}

/**
 * Whether the visitor accepted analytics cookies on volcano.dev against the
 * current Cookie Policy, with no Global Privacy Control signal, live or
 * recorded. The same rule volcano-web applies on its marketing pages.
 */
export function analyticsAccepted({ globalPrivacyControl, cookieHeader, hostname }) {
  if (globalPrivacyControl === true) return false;
  return consentForHost(cookieHeader, hostname).accepted;
}
