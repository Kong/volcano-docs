// Fails when the Cookie Policy version volcano.dev publishes differs from
// COOKIE_POLICY_VERSION in src/lib/consent.mjs. The docs give full analytics
// only to visitors whose volcano.dev consent names that version, so when
// counsel publishes a new policy the constant must follow it: until it does,
// an accept given under the old policy would still count here.
import { COOKIE_POLICY_VERSION } from "../src/lib/consent.mjs";

const POLICY_URL = process.env.COOKIE_POLICY_URL ?? "https://volcano.dev/legal/cookies.md";

/** The version in the policy's "Version YYYY-MM-DD" line, or null. */
export function publishedVersion(markdown) {
  const match = /^Version (\d{4}-\d{2}-\d{2})\b/m.exec(markdown);
  if (!match) return null;
  return match[1];
}

async function main() {
  const response = await fetch(POLICY_URL);
  if (!response.ok) throw new Error(`${POLICY_URL} answered ${response.status}`);
  const version = publishedVersion(await response.text());
  if (!version) throw new Error(`${POLICY_URL} has no "Version YYYY-MM-DD" line`);
  if (version !== COOKIE_POLICY_VERSION) {
    throw new Error(
      `volcano.dev publishes Cookie Policy version ${version}, but src/lib/consent.mjs has ${COOKIE_POLICY_VERSION}. Update COOKIE_POLICY_VERSION.`,
    );
  }
  console.log(`check-cookie-policy: version ${version} matches`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(function fail(error) {
    console.error(`check-cookie-policy: ${error.message}`);
    process.exitCode = 1;
  });
}
