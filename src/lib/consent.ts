// Mirrors volcano-web `libs/data/src/consent.ts` (PR 973 gates flags on it). Docs is
// entirely the marketing surface, so only that branch applies: flags run only with
// an `accept` on the current Cookie Policy and no Global Privacy Control. The choice
// is the `.volcano.dev` cookie the marketing banner writes, so it is shared with
// docs; docs has no banner of its own, and an unanswered choice means flags stay off.
// Keep the cookie name, shape, and version in step with volcano-web.

const CONSENT_COOKIE_NAME = "volcano_cookie_consent";

// volcano-web derives this from its legal-documents catalog (the Cookie Policy's
// date). When the policy is re-dated, update it here. Until then a newer choice reads
// as stale and flags fail closed (off).
const COOKIE_POLICY_VERSION = "2026-09-07";

const CONSENT_CHANGE_EVENT = "volcano:consent-change";

type ConsentRecord = {
  analytics: "accept" | "reject";
  version: string;
  at: string;
  source: "banner" | "preference-centre" | "gpc";
};

type AnalyticsDecisionInput = {
  consent: ConsentRecord | null;
  globalPrivacyControl: boolean;
  policyVersion?: string;
};

// A cookie we cannot trust (absent, malformed, outside the vocabulary) reads as
// unanswered, never as accept.
function parseConsentCookie(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Partial<ConsentRecord>;
  if (record.analytics !== "accept" && record.analytics !== "reject") return null;
  if (record.source !== "banner" && record.source !== "preference-centre" && record.source !== "gpc") {
    return null;
  }
  if (typeof record.version !== "string" || typeof record.at !== "string") return null;
  return {
    analytics: record.analytics,
    version: record.version,
    at: record.at,
    source: record.source,
  };
}

function readConsentCookie(): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find(function isConsent(entry) {
      return entry.startsWith(`${CONSENT_COOKIE_NAME}=`);
    });
  if (!match) return null;
  return parseConsentCookie(match.slice(CONSENT_COOKIE_NAME.length + 1));
}

function detectGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true;
}

// Pure, so the rule is testable without a browser. Order matches volcano-web:
// Global Privacy Control first, then unanswered, stale, and finally the choice.
function decideAnalytics({
  consent,
  globalPrivacyControl,
  policyVersion = COOKIE_POLICY_VERSION,
}: AnalyticsDecisionInput): boolean {
  if (globalPrivacyControl) return false;
  if (consent === null) return false;
  if (consent.version !== policyVersion) return false;
  return consent.analytics === "accept";
}

function flagsAllowed(): boolean {
  return decideAnalytics({
    consent: readConsentCookie(),
    globalPrivacyControl: detectGlobalPrivacyControl(),
  });
}

// `document.cookie` fires no event. Same-origin writers emit the shared event; a
// choice made on the marketing host (another origin) is picked up when the tab
// becomes visible again.
function onConsentChange(listener: () => void): () => void {
  function onVisible() {
    if (document.visibilityState === "visible") listener();
  }
  window.addEventListener(CONSENT_CHANGE_EVENT, listener);
  document.addEventListener("visibilitychange", onVisible);
  return function unsubscribe() {
    window.removeEventListener(CONSENT_CHANGE_EVENT, listener);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export { decideAnalytics, flagsAllowed, onConsentChange, parseConsentCookie };
export type { ConsentRecord };
