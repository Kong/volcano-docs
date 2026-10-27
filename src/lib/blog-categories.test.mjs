import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { BLOG_CATEGORIES, BLOG_CATEGORY_SLUGS, categoryHref, categoryLabel, collectCategories, isBlogCategory, postsInCategory } from "./blog-categories.mjs";

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../spec/frontmatter.schema.json");

test("the frontmatter schema accepts exactly the categories this module defines", () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.deepEqual(schema.properties.category.enum, BLOG_CATEGORY_SLUGS);
});

test("every category has a distinct slug, a label, and a page", () => {
  assert.equal(new Set(BLOG_CATEGORY_SLUGS).size, BLOG_CATEGORIES.length);
  for (const category of BLOG_CATEGORIES) {
    assert.ok(category.label.length > 0);
    assert.equal(categoryLabel(category.slug), category.label);
    assert.equal(categoryHref(category.slug), `/blog/category/${category.slug}`);
    assert.ok(isBlogCategory(category.slug));
  }
  assert.equal(isBlogCategory("sandbox"), false);
  assert.equal(isBlogCategory(undefined), false);
});

test("only categories with posts are listed, and each lists its own posts", () => {
  const posts = [
    { url: "/blog/a", category: "product" },
    { url: "/blog/b", category: "product" },
    { url: "/blog/c", category: "engineering" },
    { url: "/blog/d" },
  ];
  assert.deepEqual(
    collectCategories(posts).map((category) => [category.slug, category.count]),
    [["product", 2], ["engineering", 1]],
  );
  assert.deepEqual(postsInCategory(posts, "engineering"), [{ url: "/blog/c", category: "engineering" }]);
  assert.deepEqual(postsInCategory(posts, "company"), []);
});
