import assert from "node:assert/strict";
import { test } from "node:test";
import { getSearchSection, getSearchLabel, getSearchTags } from "./search-section.mjs";
import { blogTopicHref, collectTopics, topicLabel } from "./blog-topics.mjs";

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
  assert.equal(topicLabel("ai-agents"), "AI agents");
  assert.equal(topicLabel("api-design"), "API design");
  assert.equal(topicLabel("sdk"), "SDK");
  assert.equal(topicLabel("using-the-sdk"), "Using the SDK");
  assert.deepEqual(collectTopics([
    { tags: ["storage", "storage", "authentication"] },
    { tags: ["storage"] },
    {},
  ]), [
    { tag: "authentication", label: "Authentication", count: 1 },
    { tag: "storage", label: "Storage", count: 2 },
  ]);
});

test("blog topic links preserve filters on the listing and articles", () => {
  assert.equal(blogTopicHref(null), "/blog");
  assert.equal(blogTopicHref("application-design"), "/blog?topic=application-design");
  assert.equal(blogTopicHref("ai-agents", "/blog/introducing-volcano-sandbox"),
    "/blog/introducing-volcano-sandbox?topic=ai-agents");
  assert.equal(new URL(blogTopicHref("a & b"), "https://docs.example").searchParams.get("topic"), "a & b");
  assert.equal(blogTopicHref("storage", "/blog/post#upload-files"), "/blog/post?topic=storage#upload-files");
  assert.equal(blogTopicHref("storage", "/blog/post?from=search&topic=old#upload-files"),
    "/blog/post?from=search&topic=storage#upload-files");
  assert.equal(blogTopicHref(null, "/blog/post#upload-files"), "/blog/post#upload-files");
});
