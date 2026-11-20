import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedVersion } from "../../scripts/check-cookie-policy-version.mjs";
import { COOKIE_POLICY_VERSION, analyticsAccepted, consentCookieNameForHost, consentForHost } from "./consent.mjs";
import {
  DOCS_SURFACE,
  consentGuard,
  consentedPostHogConfig,
  forgetDocsHostId,
  forgetStoredPlaceholderId,
  postHogPersistenceKey,
  scrubConsentedEvent,
  scrubHeatmapData,
  stopConsentedAnalytics,
} from "./consented-analytics.mjs";
import { cookielessPostHogConfig, docsAnalyticsMode, scrubCookielessEvent, shouldCountCookieless } from "./cookieless-counting.mjs";

function consentCookie(record, name = "volcano_cookie_consent") {
  return `${name}=${encodeURIComponent(JSON.stringify(record))}`;
}

const current = { version: COOKIE_POLICY_VERSION, at: "2026-11-18T00:00:00.000Z" };
const accepted = consentCookie({ ...current, analytics: "accept", source: "banner" });
const rejected = consentCookie({ ...current, analytics: "reject", source: "banner" });
const staleAccept = consentCookie({ ...current, version: "2000-01-01", analytics: "accept", source: "banner" });
const gpcRecorded = consentCookie({ ...current, analytics: "reject", source: "gpc" });

function mode(cookieHeader, globalPrivacyControl = false, enabled = "true", hostname = "volcano.dev") {
  return docsAnalyticsMode({ enabled, globalPrivacyControl, cookieHeader, hostname });
}

test("a current accept on volcano.dev gets consented analytics, not the counter", () => {
  assert.equal(mode(accepted), "consented");
  assert.equal(mode(accepted, false, "true", "docs.volcano.dev"), "consented");
  const stagingAccept = consentCookie({ ...current, analytics: "accept", source: "banner" }, "volcano_cookie_consent_host");
  assert.equal(mode(stagingAccept, false, "true", "staging.volcano.dev"), "consented");
  assert.equal(shouldCountCookieless({ enabled: "true", globalPrivacyControl: false, cookieHeader: accepted, hostname: "volcano.dev" }), false);
});

test("unanswered, rejected, stale or malformed consent is counted anonymously", () => {
  for (const cookieHeader of ["", rejected, staleAccept, "volcano_cookie_consent=%7Bbroken", consentCookie({ analytics: "maybe", version: COOKIE_POLICY_VERSION })]) {
    assert.equal(mode(cookieHeader), "cookieless");
  }
});

test("Global Privacy Control, live or recorded, turns everything off, even over an accept", () => {
  assert.equal(mode(accepted, true), "off");
  assert.equal(mode("", true), "off");
  assert.equal(mode(gpcRecorded), "off");
});

test("the switch off turns everything off", () => {
  assert.equal(docsAnalyticsMode({ enabled: undefined, globalPrivacyControl: false, cookieHeader: accepted, hostname: "volcano.dev" }), "off");
  assert.equal(mode("", false, "false"), "off");
});

test("the cookie for the host holds the choice; GPC or Reject in any cookie wins", () => {
  assert.equal(consentCookieNameForHost("volcano.dev"), "volcano_cookie_consent");
  assert.equal(consentCookieNameForHost("docs.volcano.dev"), "volcano_cookie_consent");
  assert.equal(consentCookieNameForHost("docs.staging.volcano.dev"), "volcano_cookie_consent_host");
  assert.equal(consentCookieNameForHost("localhost"), "volcano_cookie_consent");

  const hostReject = consentCookie({ ...current, analytics: "reject", source: "banner" }, "volcano_cookie_consent_host");
  const hostGpc = consentCookie({ source: "gpc" }, "volcano_cookie_consent_host");
  for (const cookieHeader of [`${accepted}; ${hostReject}`, `${hostReject}; ${accepted}`]) {
    assert.equal(mode(cookieHeader, false, "true", "staging.volcano.dev"), "cookieless");
    assert.equal(mode(cookieHeader, false, "true", "volcano.dev"), "cookieless");
  }
  for (const cookieHeader of [`${accepted}; ${hostGpc}`, `${hostGpc}; ${accepted}`]) {
    assert.equal(mode(cookieHeader, false, "true", "volcano.dev"), "off");
  }
  // The production accept is not the staging choice.
  assert.equal(mode(accepted, false, "true", "staging.volcano.dev"), "cookieless");
  assert.equal(consentForHost("theme=dark", "volcano.dev").accepted, false);
  assert.equal(analyticsAccepted({ globalPrivacyControl: false, cookieHeader: accepted, hostname: "volcano.dev" }), true);
  assert.equal(analyticsAccepted({ globalPrivacyControl: true, cookieHeader: accepted, hostname: "volcano.dev" }), false);
  assert.equal(analyticsAccepted({ globalPrivacyControl: false, cookieHeader: staleAccept, hostname: "volcano.dev" }), false);
});

test("the consented instance shares volcano.dev's stored id and sends nothing else", () => {
  const config = consentedPostHogConfig("https://us.i.posthog.com");
  assert.equal(config.persistence, "localStorage");
  assert.equal(config.cross_subdomain_cookie, false);
  assert.equal(config.autocapture, false);
  assert.equal(config.capture_heatmaps, true);
  assert.equal(config.capture_dead_clicks, false);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.capture_performance, false);
  assert.equal(config.advanced_disable_flags, true);
  const pageview = { event: "$pageview", properties: { distinct_id: "user-1" } };
  assert.deepEqual(config.before_send(pageview), scrubConsentedEvent(pageview));
  assert.equal(config.before_send({ event: "$autocapture", properties: {} }), null);
  assert.equal(config.before_send({ event: "$rageclick", properties: {} }), null);
  assert.equal(postHogPersistenceKey("phc_a+b/c="), "ph_phc_aPLbSLcEQ_posthog");
});

test("the consented instance scrubs like the counter and never sends a placeholder id", () => {
  const sent = scrubConsentedEvent({
    event: "$pageview",
    properties: { distinct_id: "user-1", $current_url: "https://volcano.dev/docs/cli?token=x", gclid: "1" },
  });
  assert.deepEqual(sent.properties, {
    distinct_id: "user-1",
    $current_url: "https://volcano.dev/docs/cli",
    surface: "marketing",
  });
  assert.equal(scrubConsentedEvent({ event: "$autocapture", properties: {} }), null);
  assert.equal(
    scrubConsentedEvent({ event: "$pageview", properties: { distinct_id: "11111111-1111-1111-1111-111111111111" } }),
    null,
  );
});

test("heatmap points keep only their position, keyed by the page without query or fragment", () => {
  const sent = scrubConsentedEvent({
    event: "$$heatmap",
    properties: {
      distinct_id: "user-1",
      $current_url: "https://volcano.dev/docs/cli?token=x",
      gclid: "1",
      $heatmap_data: {
        "https://volcano.dev/docs/cli?token=x#install": [{ x: 10, y: 20, target_fixed: false, type: "click", text: "secret" }],
        "https://volcano.dev/docs/cli": [{ x: 1, y: 2, target_fixed: true, type: "mousemove" }],
        "https://volcano.dev/docs/sdk?gclid=1": [{ x: 3, y: 4, target_fixed: false, type: "rageclick" }],
        "not a url": [{ x: 5, y: 6, target_fixed: false, type: "click" }],
      },
    },
  });
  assert.deepEqual(sent.properties, {
    distinct_id: "user-1",
    $current_url: "https://volcano.dev/docs/cli",
    $heatmap_data: {
      "https://volcano.dev/docs/cli": [
        { x: 10, y: 20, target_fixed: false, type: "click" },
        { x: 1, y: 2, target_fixed: true, type: "mousemove" },
      ],
      "https://volcano.dev/docs/sdk": [{ x: 3, y: 4, target_fixed: false, type: "rageclick" }],
    },
    surface: "marketing",
  });
});

test("a heatmap event with no usable points is not sent", () => {
  for (const data of [undefined, null, "x", {}, { "https://volcano.dev/docs": [] }, { "https://volcano.dev/docs": [{ x: "1", y: 2 }] }, { "/docs": [{ x: 1, y: 2 }] }]) {
    assert.equal(scrubHeatmapData(data), null);
    assert.equal(scrubConsentedEvent({ event: "$$heatmap", properties: { distinct_id: "user-1", $heatmap_data: data } }), null);
  }
  assert.equal(
    scrubConsentedEvent({
      event: "$$heatmap",
      properties: { distinct_id: "11111111-1111-1111-1111-111111111111", $heatmap_data: { "https://volcano.dev/docs": [{ x: 1, y: 2 }] } },
    }),
    null,
  );
});

test("the anonymous counter still never sends heatmap points", () => {
  const heatmap = { event: "$$heatmap", properties: { $heatmap_data: { "https://volcano.dev/docs": [{ x: 1, y: 2 }] } } };
  assert.equal(scrubCookielessEvent(heatmap), null);
  assert.equal(cookielessPostHogConfig("https://us.i.posthog.com").capture_heatmaps, false);
});

test("forgetStoredPlaceholderId clears only a stored placeholder", () => {
  const key = postHogPersistenceKey("phc_test");
  function storage(value) {
    const items = new Map([[key, value]]);
    return {
      items,
      getItem: function getItem(k) { return items.get(k) ?? null; },
      removeItem: function removeItem(k) { items.delete(k); },
    };
  }
  const placeholder = storage(JSON.stringify({ distinct_id: "11111111-1111-1111-1111-111111111111" }));
  assert.equal(forgetStoredPlaceholderId("phc_test", placeholder), true);
  assert.equal(placeholder.items.has(key), false);
  const real = storage(JSON.stringify({ distinct_id: "user-1" }));
  assert.equal(forgetStoredPlaceholderId("phc_test", real), false);
  assert.equal(real.items.has(key), true);
});

test("the policy check reads the published version line", () => {
  assert.equal(publishedVersion("# Cookie Policy\n\nVersion 2026-09-07 · Effective 2026-09-07\n"), "2026-09-07");
  assert.equal(publishedVersion("# Cookie Policy\n"), null);
});

test("forgetDocsHostId clears a docs-host id but never volcano-web's", () => {
  const key = postHogPersistenceKey("phc_test");
  function storage() {
    const items = new Map([[key, JSON.stringify({ distinct_id: "user-1" })]]);
    return {
      items,
      getItem: function getItem(k) { return items.get(k) ?? null; },
      removeItem: function removeItem(k) { items.delete(k); },
    };
  }
  const docs = storage();
  assert.equal(forgetDocsHostId("phc_test", "docs.volcano.dev", docs), true);
  assert.equal(docs.items.has(key), false);
  for (const host of ["volcano.dev", "www.volcano.dev", "staging.volcano.dev"]) {
    const web = storage();
    assert.equal(forgetDocsHostId("phc_test", host, web), false);
    assert.equal(web.items.has(key), true);
  }
  const broken = { getItem: function getItem() { throw new Error("blocked"); }, removeItem: function removeItem() {} };
  assert.equal(forgetDocsHostId("phc_test", "docs.volcano.dev", broken), false);
});

test("consentGuard stops once, at the first check where consent no longer holds", () => {
  let consented = true;
  let lapses = 0;
  function onLapse() {
    lapses += 1;
  }
  const check = consentGuard(function stillConsented() { return consented; }, onLapse);
  assert.equal(check(), true);
  assert.equal(lapses, 0);
  consented = false;
  assert.equal(check(), false);
  assert.equal(check(), false);
  assert.equal(lapses, 1);
  // A new accept takes effect on the next page load, not in this one.
  consented = true;
  assert.equal(check(), false);
  assert.equal(lapses, 1);

  const throwing = consentGuard(function stillConsented() { throw new Error("no cookies"); }, onLapse);
  assert.equal(throwing(), false);
  assert.equal(lapses, 2);
  const throwingLapse = consentGuard(function stillConsented() { return false; }, function onLapseThrows() { throw new Error("x"); });
  assert.equal(throwingLapse(), false);
});

test("the consented instance drops every event once consent lapses", () => {
  let consented = true;
  function noop() {}
  const config = consentedPostHogConfig("https://us.i.posthog.com", consentGuard(function stillConsented() { return consented; }, noop));
  const pageview = { event: "$pageview", properties: { distinct_id: "user-1" } };
  assert.notEqual(config.before_send(pageview), null);
  consented = false;
  assert.equal(config.before_send(pageview), null);
  assert.equal(config.before_send({ event: "$pageleave", properties: { distinct_id: "user-1" } }), null);
});

test("stopConsentedAnalytics stops capture and storage writes, keeping volcano-web's records", () => {
  const id = postHogPersistenceKey("phc_test");
  const sessionProps = "ph_phc_test_session_registered_properties";
  function memoryStorage(entries) {
    const items = new Map(entries);
    return {
      items,
      getItem: function getItem(k) { return items.get(k) ?? null; },
      setItem: function setItem(k, v) { items.set(k, String(v)); },
      removeItem: function removeItem(k) { items.delete(k); },
    };
  }
  // Behaves like posthog-js: disabling persistence deletes the instance's records.
  function fakeInstance(stores) {
    const configs = [];
    return {
      configs,
      set_config: function setConfig(config) {
        configs.push(config);
        if (!config.disable_persistence) return;
        for (const store of stores) {
          store.removeItem(id);
          store.removeItem(sessionProps);
        }
      },
    };
  }
  const stopped = { capture_pageview: false, capture_pageleave: false, capture_heatmaps: false, disable_persistence: true };

  const docsLocal = memoryStorage([[id, "docs-id"]]);
  const docsSession = memoryStorage([[id, "docs-id"], [sessionProps, "{}"]]);
  const docs = fakeInstance([docsLocal, docsSession]);
  stopConsentedAnalytics(docs, "phc_test", "docs.volcano.dev", [docsLocal, docsSession]);
  assert.deepEqual(docs.configs, [stopped]);
  assert.equal(docsLocal.items.size, 0);
  assert.equal(docsSession.items.size, 0);

  for (const host of ["volcano.dev", "staging.volcano.dev"]) {
    const local = memoryStorage([[id, "web-id"], ["other", "x"]]);
    const session = memoryStorage([[sessionProps, "{\"surface\":\"web\"}"]]);
    const web = fakeInstance([local, session]);
    stopConsentedAnalytics(web, "phc_test", host, [local, session]);
    assert.deepEqual(web.configs, [stopped]);
    assert.deepEqual(Object.fromEntries(local.items), { [id]: "web-id", other: "x" });
    assert.deepEqual(Object.fromEntries(session.items), { [sessionProps]: "{\"surface\":\"web\"}" });
  }

  // volcano-web already cleared its id on a reject: it stays cleared.
  const cleared = memoryStorage([]);
  stopConsentedAnalytics(fakeInstance([cleared]), "phc_test", "volcano.dev", [cleared]);
  assert.equal(cleared.items.size, 0);
});

test("docs events always say the marketing surface, whatever volcano-web registered", () => {
  for (const registered of ["product", "marketing", undefined]) {
    const properties = { distinct_id: "user-1", $current_url: "https://volcano.dev/docs" };
    if (registered) properties.surface = registered;
    const sent = scrubConsentedEvent({ event: "$pageview", properties });
    assert.equal(sent.properties.surface, DOCS_SURFACE);
    assert.equal(DOCS_SURFACE, "marketing");
  }
  const leave = scrubConsentedEvent({ event: "$pageleave", properties: { distinct_id: "user-1", surface: "product" } });
  assert.equal(leave.properties.surface, "marketing");
});
