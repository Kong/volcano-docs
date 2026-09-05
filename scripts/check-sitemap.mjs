import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Exercise a running production build, including Next's metadata serialization
// and caching. Run after pnpm build + pnpm start.
const base = new URL(process.argv[2] ?? "http://localhost:3000");
const manifest = JSON.parse(await readFile(".next/prerender-manifest.json", "utf8"));
const expectedPaths = Object.entries(manifest.routes)
  .filter(([, route]) => route.srcRoute === "/[[...slug]]")
  .map(([path]) => path)
  .sort();
assert.ok(expectedPaths.length > 0, "Build must contain docs pages");

async function checkSitemap(origin, headers = {}) {
  const response = await fetch(new URL("/sitemap.xml", base), { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  const xml = await response.text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(xml.trimEnd().endsWith("</urlset>"));
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
  assert.equal(urls.length, expectedPaths.length);
  assert.equal(new Set(urls.map((url) => url.href)).size, urls.length);
  assert.deepEqual(urls.map((url) => url.pathname).sort(), expectedPaths);
  for (const url of urls) assert.equal(url.origin, origin);
  console.log(`sitemap: ${urls.length} unique docs URLs on ${origin}`);
}

await checkSitemap(base.origin);
await checkSitemap("https://docs.example.com", {
  "x-forwarded-host": "docs.example.com",
  "x-forwarded-proto": "https",
});
await checkSitemap("https://preview.example.com:8443", {
  "x-forwarded-host": "preview.example.com:8443",
  "x-forwarded-proto": "https",
});
await checkSitemap("http://docs.local:8080", {
  "x-forwarded-host": "docs.local:8080",
  "x-forwarded-proto": "http",
});
// Switching back catches a sitemap accidentally cached for a previous host.
await checkSitemap(base.origin);

for (const path of expectedPaths) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  await response.arrayBuffer();
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/, path);
}
console.log(`sitemap: all ${expectedPaths.length} listed docs paths serve HTML`);
