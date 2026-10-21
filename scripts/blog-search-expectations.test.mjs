import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assertBlogTopicIndex, readTaggedBlogPages } from "./blog-search-expectations.mjs";

test("authored topics remain required even if the index loses every topic tag", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "blog-search-check-"));
  try {
    fs.mkdirSync(path.join(directory, "nested"));
    fs.writeFileSync(path.join(directory, "nested", "index.md"), "---\ntitle: Renamable post\ntags: [storage, realtime]\n---\n");
    fs.writeFileSync(path.join(directory, "index.md"), "---\ntitle: Blog\n---\n");
    const expected = readTaggedBlogPages(directory);
    assert.deepEqual(expected, [{ url: "/blog/nested", title: "Renamable post", tags: ["blog-topic:storage", "blog-topic:realtime"] }]);
    assert.throws(() => assertBlogTopicIndex(expected, [{ url: "/blog/nested", tags: ["blog"] }]), /missing expected tag/);
    assert.throws(() => assertBlogTopicIndex(expected, []), /missing expected tag/);
    assert.doesNotThrow(() => assertBlogTopicIndex(expected, expected));
    fs.unlinkSync(path.join(directory, "nested", "index.md"));
    assert.deepEqual(readTaggedBlogPages(directory), []);
    assert.doesNotThrow(() => assertBlogTopicIndex([], []));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
