import assert from "node:assert/strict";
import { test } from "node:test";
import { loader, llms } from "fumadocs-core/source";
import { isPageVisible } from "./content-visibility.mjs";

const files = [
  { type: "meta", path: "blog/meta.json", data: { pages: ["index", "launch", "unannounced", "..."] } },
  { type: "page", path: "blog/index.md", data: { title: "Blog" } },
  { type: "page", path: "blog/launch.md", data: { title: "Launch", draft: false } },
  { type: "page", path: "blog/unannounced.md", data: { title: "Unannounced", draft: true } },
];

function previewSource(environment) {
  return loader({
    baseUrl: "/",
    source: { files: files.filter((file) => file.type !== "page" || isPageVisible(file.data, environment)) },
  });
}

test("production drafts are absent from page lookup, generated routes, navigation, and LLM listings", () => {
  const source = previewSource("production");
  assert.equal(source.getPage(["blog", "unannounced"]), undefined);
  assert.deepEqual(source.getPages().map((page) => page.url).sort(), ["/blog", "/blog/launch"]);
  assert.deepEqual(source.generateParams().map((params) => params.slug.join("/")).sort(), ["blog", "blog/launch"]);
  assert.ok(!JSON.stringify(source.pageTree).includes("Unannounced"), "explicit meta entries must not reveal drafts");
  assert.ok(!llms(source).index().includes("Unannounced"));
});

test("development previews include drafts without changing published-page visibility", () => {
  const source = previewSource("development");
  assert.equal(source.getPage(["blog", "unannounced"]).data.title, "Unannounced");
  assert.equal(source.getPages().length, 3);
  assert.ok(JSON.stringify(source.pageTree).includes("Unannounced"));
  assert.equal(isPageVisible({}, "production"), true);
  assert.equal(isPageVisible({ draft: false }, "production"), true);
  assert.equal(isPageVisible({ draft: true }, "production"), false);
});
