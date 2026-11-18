import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cookielessCountingEnabled,
  cookielessPostHogConfig,
  hasRecordedGlobalPrivacyControl,
  scrubCookielessEvent,
  shouldCountCookieless,
} from "./cookieless-counting.mjs";

function consentCookie(name, record) {
  return `${name}=${encodeURIComponent(JSON.stringify(record))}`;
}

const gpcRecord = { analytics: "reject", source: "gpc", version: "2026-11-01", at: "2026-11-16T00:00:00.000Z" };
const rejectRecord = { ...gpcRecord, source: "banner" };
const acceptRecord = { ...gpcRecord, analytics: "accept", source: "banner" };

test("the build switch is on only for the exact string true", () => {
  assert.equal(cookielessCountingEnabled("true"), true);
  for (const value of [undefined, "", "1", "TRUE", "false"]) {
    assert.equal(cookielessCountingEnabled(value), false);
  }
});

test("counts every visitor without a Global Privacy Control opt-out", () => {
  for (const cookieHeader of ["", consentCookie("volcano_cookie_consent", rejectRecord), consentCookie("volcano_cookie_consent", acceptRecord)]) {
    assert.equal(shouldCountCookieless({ enabled: "true", globalPrivacyControl: false, cookieHeader }), true);
  }
});

test("counts nobody while the switch is off", () => {
  assert.equal(shouldCountCookieless({ enabled: undefined, globalPrivacyControl: false, cookieHeader: "" }), false);
});

test("never counts a visitor sending Global Privacy Control, live or recorded", () => {
  assert.equal(shouldCountCookieless({ enabled: "true", globalPrivacyControl: true, cookieHeader: "" }), false);
  for (const name of ["volcano_cookie_consent", "volcano_cookie_consent_host"]) {
    const cookieHeader = `other=1; ${consentCookie(name, gpcRecord)}`;
    assert.equal(hasRecordedGlobalPrivacyControl(cookieHeader), true);
    assert.equal(shouldCountCookieless({ enabled: "true", globalPrivacyControl: false, cookieHeader }), false);
  }
});

test("ignores malformed and unrelated cookies", () => {
  assert.equal(hasRecordedGlobalPrivacyControl("volcano_cookie_consent=%7Bnot-json; theme=dark"), false);
  assert.equal(hasRecordedGlobalPrivacyControl(consentCookie("someone_else", gpcRecord)), false);
  assert.equal(hasRecordedGlobalPrivacyControl(undefined), false);
});

test("sends only pageviews and pageleaves", () => {
  assert.notEqual(scrubCookielessEvent({ event: "$pageview", properties: {} }), null);
  assert.notEqual(scrubCookielessEvent({ event: "$pageleave", properties: {} }), null);
  for (const event of ["$autocapture", "$feature_flag_called", "$identify", "$exception", "$web_vitals", "custom"]) {
    assert.equal(scrubCookielessEvent({ event, properties: {} }), null);
  }
  assert.equal(scrubCookielessEvent(null), null);
});

test("removes query strings, fragments and referrer paths", () => {
  const event = scrubCookielessEvent({
    event: "$pageview",
    properties: {
      $current_url: "https://docs.volcano.dev/sdk/js?email=ada@example.com#install",
      $prev_pageview_url: "https://docs.volcano.dev/cli?token=abc",
      $referrer: "https://mail.example.com/inbox/ada@example.com?x=1",
      $initial_referrer: "$direct",
      $pathname: "/sdk/js",
      utm_source: "newsletter",
    },
  });
  assert.deepEqual(event.properties, {
    $current_url: "https://docs.volcano.dev/sdk/js",
    $prev_pageview_url: "https://docs.volcano.dev/cli",
    $referrer: "https://mail.example.com",
    $pathname: "/sdk/js",
    utm_source: "newsletter",
  });
  const direct = scrubCookielessEvent({ event: "$pageview", properties: { $referrer: "$direct" } });
  assert.deepEqual(direct.properties, { $referrer: "$direct" });
  assert.equal(JSON.stringify(event).includes("ada@example.com"), false);
});

test("drops a referrer it cannot parse instead of sending it raw", () => {
  const event = scrubCookielessEvent({ event: "$pageview", properties: { $referrer: "not a url ada@example.com" } });
  assert.equal("$referrer" in event.properties, false);
});

test("drops ad click identifiers and keeps campaign names", () => {
  const event = scrubCookielessEvent({
    event: "$pageview",
    properties: { gclid: "Cj0KCQ", fbclid: "IwAR1", msclkid: "abc", li_fat_id: "x", utm_source: "google", utm_campaign: "launch" },
  });
  assert.deepEqual(event.properties, { utm_source: "google", utm_campaign: "launch" });
});

test("cleans every URL-valued property, whatever posthog-js calls it", () => {
  const event = scrubCookielessEvent({
    event: "$pageleave",
    properties: {
      $session_entry_url: "https://docs.volcano.dev/cli?code=secret#a",
      $session_entry_referrer: "https://mail.example.com/u/ada@example.com",
      some_future_url: "http://docs.volcano.dev/x?y=1",
      $prev_pageview_pathname: "/cli",
      $prev_pageview_duration: 12,
    },
  });
  assert.deepEqual(event.properties, {
    $session_entry_url: "https://docs.volcano.dev/cli",
    $session_entry_referrer: "https://mail.example.com",
    some_future_url: "http://docs.volcano.dev/x",
    $prev_pageview_pathname: "/cli",
    $prev_pageview_duration: 12,
  });
});

test("never sends person properties or first-touch snapshots", () => {
  const event = scrubCookielessEvent({
    event: "$pageview",
    properties: {
      $set: { email: "ada@example.com" },
      $set_once: { $initial_referrer: "https://x.example" },
      $initial_current_url: "https://docs.volcano.dev/?gclid=1",
      $initial_campaign_params: { gclid: "1" },
      $lib: "web",
    },
  });
  assert.deepEqual(event.properties, { $lib: "web" });

  const topLevel = scrubCookielessEvent({
    event: "$pageview",
    properties: {},
    $set: { email: "ada@example.com" },
    $set_once: { $initial_current_url: "https://docs.volcano.dev/?gclid=1" },
  });
  assert.equal("$set" in topLevel, false);
  assert.equal("$set_once" in topLevel, false);
});

test("the config stores nothing, captures nothing else and creates no person", () => {
  const config = cookielessPostHogConfig("https://us.i.posthog.com");
  assert.equal(config.cookieless_mode, "always");
  assert.equal(config.persistence, "memory");
  assert.equal(config.disable_persistence, true);
  assert.equal(config.person_profiles, "never");
  assert.equal(config.mask_personal_data_properties, true);
  assert.equal(config.autocapture, false);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.capture_performance, false);
  assert.equal(config.capture_exceptions, false);
  assert.equal(config.advanced_disable_flags, true);
  assert.equal(config.disable_external_dependency_loading, true);
  assert.equal(config.before_send, scrubCookielessEvent);
});
