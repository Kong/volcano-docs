import assert from "node:assert/strict";
import { test } from "node:test";
import { getSearchSection, getSearchLabel, getSearchTags } from "./search-section.mjs";
import { collectTopics, topicLabel } from "./blog-topics.mjs";

test("search scope follows section boundaries for landing pages and articles", () => {
  for (const pathname of ["/", "/sdk/js/authentication", "/platform", "/blogger", "/cookbooks-old"]) {
    assert.equal(getSearchSection(pathname), "docs");
  }
  for (const section of ["cookbooks", "blog"]) {
    for (const suffix of ["", "/", "/article", "/article#heading", "?query=photo"]) {
      assert.equal(getSearchSection(`/${section}${suffix}`), section);
    }
    assert.equal(getSearchLabel(section), `Search ${section}`);
  }
  assert.equal(getSearchLabel("docs"), "Search docs");
});

test("blog topic filters stay scoped to blog and do not affect other sections", () => {
  assert.deepEqual(getSearchTags("blog", "storage"), ["blog", "blog-topic:storage"]);
  assert.deepEqual(getSearchTags("blog"), ["blog"]);
  assert.deepEqual(getSearchTags("docs", "storage"), ["docs"]);
  assert.deepEqual(getSearchTags("cookbooks", "storage"), ["cookbooks"]);
});

test("topic counts count each post once and use readable labels", () => {
  assert.equal(topicLabel("getting-started"), "Getting started");
  assert.deepEqual(collectTopics([
    { tags: ["storage", "storage", "authentication"] },
    { tags: ["storage"] },
    {},
  ]), [
    { tag: "authentication", label: "Authentication", count: 1 },
    { tag: "storage", label: "Storage", count: 2 },
  ]);
});
