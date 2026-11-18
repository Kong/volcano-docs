/**
 * Reads the cookie consent volcano-web records, so the docs follow the
 * visitor's choice from the main site's banner. The docs have no banner of
 * their own.
 *
 * volcano-web writes the record as URI-encoded JSON
 * (`{ analytics, version, at, source }`) in `volcano_cookie_consent`, shared
 * across .volcano.dev in production, or in the host-only
 * `volcano_cookie_consent_host` on other volcano.dev hosts
 * (`libs/data/src/consent.ts` there).
 */

/**
 * The Cookie Policy version an accept must have been given against. Must
 * match the version volcano.dev publishes at /legal/cookies; the daily
 * `pnpm check:cookie-policy` job fails when it does not. An accept given
 * against another version is treated as unanswered, as volcano-web does.
 */
export const COOKIE_POLICY_VERSION = "2026-09-07";

const CONSENT_COOKIE_NAMES = ["volcano_cookie_consent", "volcano_cookie_consent_host"];

const CHOICES = new Set(["accept", "reject"]);

/**
 * The consent record in `cookieHeader`, or null when there is none or it is
 * malformed. A malformed record fails closed to "unanswered", never "accept".
 */
export function readConsentRecord(cookieHeader) {
  if (typeof cookieHeader !== "string" || cookieHeader === "") return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    const name = entry.slice(0, separator).trim();
    if (!CONSENT_COOKIE_NAMES.includes(name)) continue;
    let record;
    try {
      record = JSON.parse(decodeURIComponent(entry.slice(separator + 1).trim()));
    } catch {
      continue;
    }
    if (!record || typeof record !== "object") continue;
    if (!CHOICES.has(record.analytics) || typeof record.version !== "string") continue;
    return record;
  }
  return null;
}

/**
 * Whether the visitor accepted analytics cookies on volcano.dev against the
 * current Cookie Policy, with no Global Privacy Control signal. The same rule
 * volcano-web applies on its marketing pages.
 */
export function analyticsAccepted({ globalPrivacyControl, consent }) {
  if (globalPrivacyControl === true) return false;
  if (!consent) return false;
  if (consent.version !== COOKIE_POLICY_VERSION) return false;
  return consent.analytics === "accept";
}

/** Whether a Global Privacy Control opt-out is live or was recorded by volcano-web. */
export function globalPrivacyControlOptOut({ globalPrivacyControl, consent }) {
  return globalPrivacyControl === true || consent?.source === "gpc";
}
