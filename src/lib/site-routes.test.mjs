import assert from "node:assert/strict";
import { pageUrl, routeSlugs, siteHref } from "./site-routes.mjs";

assert.equal(pageUrl([]), "/docs");
assert.equal(pageUrl(["cli", "setup"]), "/docs/cli/setup");
assert.equal(pageUrl(["blog"]), "/blog");
assert.equal(pageUrl(["cookbooks", "chat-app"]), "/cookbooks/chat-app");

assert.deepEqual(routeSlugs("/docs"), []);
assert.deepEqual(routeSlugs("/docs/cli/setup"), ["cli", "setup"]);
assert.deepEqual(routeSlugs("/blog/post"), ["blog", "post"]);

for (const slugs of [[], ["platform", "functions"], ["blog", "post"], ["cookbooks"]]) {
  assert.deepEqual(routeSlugs(pageUrl(slugs)), slugs);
}

assert.equal(siteHref("/"), "/docs");
assert.equal(siteHref("/#top"), "/docs#top");
assert.equal(siteHref("/platform/functions/overview"), "/docs/platform/functions/overview");
assert.equal(siteHref("/sdk#authentication"), "/docs/sdk#authentication");
assert.equal(siteHref("/cli?tab=js"), "/docs/cli?tab=js");
assert.equal(siteHref("/docs/cli"), "/docs/cli");
assert.equal(siteHref("/blog/post"), "/blog/post");
assert.equal(siteHref("/cookbooks"), "/cookbooks");
assert.equal(siteHref("/platforms"), "/platforms");
assert.equal(siteHref("https://volcano.dev/platform"), "https://volcano.dev/platform");
assert.equal(siteHref("#anchor"), "#anchor");
assert.equal(siteHref(undefined), undefined);

console.log("site-routes: OK");
