#!/usr/bin/env node
// Copies the prebuilt search index into public/ so it deploys as a static
// asset (S3/CloudFront) instead of the Lambda-backed .open-next/cache path.
import fs from "node:fs";
import path from "node:path";

const source = path.join(".next", "server", "app", "api", "search.body");
const dest = path.join("public", "search-index.json");

if (!fs.existsSync(source)) {
  console.error(
    `emit-search-index: ${source} not found. Run "next build" first so ` +
      "the static search route is generated.",
  );
  process.exit(1);
}

fs.copyFileSync(source, dest);

const { size } = fs.statSync(dest);
console.log(`emit-search-index: wrote ${dest} (${size} bytes)`);
