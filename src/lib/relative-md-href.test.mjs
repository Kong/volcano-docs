// Run: node src/lib/relative-md-href.test.mjs
import assert from "node:assert/strict";
import { ensureRelativeMdHref as f } from "./relative-md-href.mjs";

// bare relative .md -> ./-prefixed (the fix)
assert.equal(f("overview.md"), "./overview.md");
assert.equal(f("auth/config.md"), "./auth/config.md");
assert.equal(f("token-lifetimes.md#access-token"), "./token-lifetimes.md#access-token");
assert.equal(f("examples/frontend-auth-nextjs/README.md"), "./examples/frontend-auth-nextjs/README.md");

// already relative -> untouched
assert.equal(f("./install.md"), "./install.md");
assert.equal(f("../databases/row-level-security.md"), "../databases/row-level-security.md");
assert.equal(f("./buckets.md#volcano-configyaml-format"), "./buckets.md#volcano-configyaml-format");

// external / absolute / in-page / non-md -> untouched
assert.equal(f("/platform"), "/platform");
assert.equal(f("/sdk/js/authentication"), "/sdk/js/authentication");
assert.equal(f("#section"), "#section");
assert.equal(f("https://volcano.dev"), "https://volcano.dev");
assert.equal(f("mailto:hi@volcano.dev"), "mailto:hi@volcano.dev");
assert.equal(f("./diagram.png"), "./diagram.png");
assert.equal(f("data.json"), "data.json");
assert.equal(f("notebook.mdx"), "notebook.mdx"); // .mdx is not .md
assert.equal(f(""), "");
assert.equal(f(undefined), undefined);

console.log("relative-md-href: OK");
