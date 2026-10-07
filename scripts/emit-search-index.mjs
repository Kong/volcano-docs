#!/usr/bin/env node
// Writes the prebuilt search index into public/, gzip-compressed, so it deploys
// as a static asset (S3/CloudFront) instead of the Lambda-backed
// .open-next/cache path. See src/lib/search-index-client.mjs for why the file
// is compressed here rather than by CloudFront.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { SEARCH_INDEX_PATH } from "../src/lib/search-index-client.mjs";

const source = path.join(".next", "server", "app", "api", "search.body");
const dest = path.join("public", SEARCH_INDEX_PATH.replace(/^\//, ""));

if (!fs.existsSync(source)) {
  console.error(
    `emit-search-index: ${source} not found. Run "next build" first so ` +
      "the static search route is generated.",
  );
  process.exit(1);
}

const json = fs.readFileSync(source);
const gzip = zlib.gzipSync(json, { level: zlib.constants.Z_BEST_COMPRESSION });
fs.writeFileSync(dest, gzip);

console.log(
  `emit-search-index: wrote ${dest} (${gzip.length} bytes gzip, ${json.length} bytes JSON)`,
);
