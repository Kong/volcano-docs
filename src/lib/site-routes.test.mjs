import assert from "node:assert/strict";
import { pageUrl, routeSlugs } from "./site-routes.mjs";

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

console.log("site-routes: OK");
