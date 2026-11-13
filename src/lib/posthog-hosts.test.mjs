import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldInitializePostHog } from "./posthog-hosts.mjs";

test("PostHog starts only on the published docs hosts", () => {
  for (const hostname of ["docs.volcano.dev", "DOCS.volcano.dev", "docs.volcano.dev.", "docs.staging.volcano.dev"]) {
    assert.equal(shouldInitializePostHog(hostname), true, hostname);
  }
});

test("PostHog stays off on local, preview and look-alike hosts", () => {
  for (const hostname of [
    "localhost",
    "127.0.0.1",
    "[::1]",
    "0.0.0.0",
    "volcano.dev",
    "staging.volcano.dev",
    "docs-pr-12.frontends.staging.volcano.dev",
    "docs.volcano.dev.evil.com",
    "evil-docs.volcano.dev",
    "",
  ]) {
    assert.equal(shouldInitializePostHog(hostname), false, hostname);
  }
});
