import assert from "node:assert/strict";
import { test } from "node:test";
import { getSearchSection, getSearchLabel, getSearchTags } from "./search-section.mjs";

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

test("search is scoped to one section at a time", () => {
  for (const section of ["docs", "cookbooks", "blog"]) {
    assert.deepEqual(getSearchTags(section), [section]);
  }
});
