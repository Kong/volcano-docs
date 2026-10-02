import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CONTENT_DIRECTORY = "content";
const SITEMAP_ARTIFACT = ".next/server/app/sitemap.xml.body";
const EXPECTED_ORIGIN = new URL(
  process.env.DOCS_SITE_URL ?? "https://docs.volcano.dev",
).origin;
const SITEMAP_URL_LIMIT = 50_000;

async function collectContentRoutes(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      routes.push(...(await collectContentRoutes(absolutePath, relativePath)));
      continue;
    }

    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
    routes.push(contentPathToRoute(relativePath));
  }

  return routes;
}

function contentPathToRoute(relativePath) {
  const withoutExtension = relativePath.replace(/\.mdx?$/, "");
  const withoutIndex = withoutExtension.replace(/(^|\/)index$/, "");
  const normalized = withoutIndex.replace(/\/$/, "");
  if (!normalized) return "/";
  return `/${normalized}`;
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value)).sort();
}

const expectedRoutes = (await collectContentRoutes(CONTENT_DIRECTORY)).sort();
const sitemapXml = await readFile(SITEMAP_ARTIFACT, "utf8");
const locations = sitemapLocations(sitemapXml);

assert.match(sitemapXml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.ok(locations.length > 0, "sitemap contains no URLs");
assert.ok(
  locations.length <= SITEMAP_URL_LIMIT,
  `sitemap exceeds the ${SITEMAP_URL_LIMIT.toLocaleString()} URL protocol limit`,
);
assert.deepEqual(duplicates(expectedRoutes), [], "content resolves to duplicate routes");
assert.deepEqual(duplicates(locations), [], "sitemap contains duplicate URLs");

const actualRoutes = locations.map((location) => {
  const url = new URL(location);
  assert.equal(url.origin, EXPECTED_ORIGIN, `unexpected sitemap origin: ${location}`);
  assert.equal(url.search, "", `sitemap URL has a query string: ${location}`);
  assert.equal(url.hash, "", `sitemap URL has a fragment: ${location}`);
  return url.pathname;
});

assert.deepEqual(
  difference(expectedRoutes, actualRoutes),
  [],
  "public content routes missing from sitemap",
);
assert.deepEqual(
  difference(actualRoutes, expectedRoutes),
  [],
  "sitemap contains routes without matching documentation content",
);

console.log(
  `check-sitemap: ${actualRoutes.length}/${expectedRoutes.length} public documentation routes covered`,
);
