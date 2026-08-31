#!/usr/bin/env node
// Route-aware link checker for the assembled docs. Fumadocs only turns .md files
// into routes (index.md -> the directory route); everything else under content/
// is NOT served. This catches broken cross-section links, index relocations that
// leave stale relative links, and links to unserved assets (openapi.yaml, source
// files, LICENSE, ...) that would 404 after deploy — which the format lint cannot.
//
// Usage: node scripts/check-links.mjs [contentDir] [publicDir]   (defaults: content, public)
import fs from "node:fs";
import path from "node:path";

const contentDir = process.argv[2] || "content";
const publicDir = process.argv[3] || "public";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// route for a .md file, relative to contentDir. index.md -> its directory.
function routeOf(file) {
  let rel = path.relative(contentDir, file).replace(/\\/g, "/").replace(/\.md$/, "");
  rel = rel.replace(/(^|\/)index$/, "");
  return "/" + rel.replace(/^\/+/, "").replace(/\/+$/, "");
}

const allFiles = walk(contentDir);
const mdFiles = allFiles.filter((f) => f.endsWith(".md"));
const routes = new Set(mdFiles.map(routeOf)); // served pages
const publicAssets = new Set(
  walk(publicDir).map((f) => "/" + path.relative(publicDir, f).replace(/\\/g, "/")),
);

const errors = [];
const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?[ \t]*\)/g;

for (const file of mdFiles) {
  const dir = path.dirname(file);
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(linkRe)) {
    let url = m[1].trim();
    if (/^(https?:|mailto:|tel:|#)/.test(url)) continue;
    url = url.split("#")[0].split("?")[0];
    if (url === "") continue;

    if (url.startsWith("/")) {
      const clean = "/" + url.replace(/^\/+/, "").replace(/\/+$/, "");
      if (routes.has(clean) || routes.has(clean.replace(/\.md$/, ""))) continue;
      if (publicAssets.has(url) || publicAssets.has(clean)) continue;
      errors.push(`${routeOf(file)}  ->  ${m[1]}  (no route or public asset)`);
      continue;
    }

    // relative link: resolve on the filesystem
    const target = path.normalize(path.join(dir, url));
    if (fs.existsSync(target) && target.endsWith(".md")) continue; // served page
    if (fs.existsSync(path.join(target, "index.md"))) continue; // dir -> index
    if (!url.endsWith(".md") && fs.existsSync(target + ".md")) continue; // extensionless page
    if (fs.existsSync(target)) {
      errors.push(`${routeOf(file)}  ->  ${m[1]}  (links to an unserved file, not a page)`);
    } else {
      errors.push(`${routeOf(file)}  ->  ${m[1]}  (target does not exist)`);
    }
  }
}

if (errors.length) {
  console.error(`\n${errors.length} broken link(s) — Fumadocs serves only .md pages:\n`);
  for (const e of errors.sort()) console.error("  " + e);
  process.exit(1);
}
console.log(`links OK (${routes.size} routes checked)`);
