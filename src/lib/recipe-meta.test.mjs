import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import yaml from "js-yaml";
import {
  RECIPE_KINDS,
  RECIPE_KIND_SLUGS,
  RECIPE_RESOURCES,
  RECIPE_RESOURCE_SLUGS,
  RECIPE_USES_MAX,
  recipeKindLabel,
  recipeResourceLabel,
} from "./recipe-meta.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "spec/frontmatter.schema.json"), "utf8"));

test("the frontmatter schema accepts exactly the kinds and resources this module defines", () => {
  assert.deepEqual(schema.properties.kind.enum, RECIPE_KIND_SLUGS);
  assert.deepEqual(schema.properties.uses.items.enum, RECIPE_RESOURCE_SLUGS);
  assert.equal(schema.properties.uses.maxItems, RECIPE_USES_MAX);
});

test("every kind and resource has a distinct slug and a label", () => {
  for (const list of [RECIPE_KINDS, RECIPE_RESOURCES]) {
    assert.equal(new Set(list.map((entry) => entry.slug)).size, list.length);
  }
  for (const kind of RECIPE_KINDS) assert.equal(recipeKindLabel(kind.slug), kind.label);
  for (const resource of RECIPE_RESOURCES) assert.equal(recipeResourceLabel(resource.slug), resource.label);
});

test("every recipe names its kind and between one and three resources", () => {
  const dir = path.join(root, "content/cookbooks");
  const recipes = fs.readdirSync(dir).filter((file) => file.endsWith(".md") && file !== "index.md");
  assert.ok(recipes.length > 0);
  for (const file of recipes) {
    const frontmatter = fs.readFileSync(path.join(dir, file), "utf8").match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, `${file}: frontmatter`);
    const data = yaml.load(frontmatter[1]);
    assert.ok(RECIPE_KIND_SLUGS.includes(data.kind), `${file}: kind`);
    assert.ok(Array.isArray(data.uses) && data.uses.length >= 1 && data.uses.length <= RECIPE_USES_MAX, `${file}: uses`);
    for (const slug of data.uses) assert.ok(RECIPE_RESOURCE_SLUGS.includes(slug), `${file}: ${slug}`);
  }
});
