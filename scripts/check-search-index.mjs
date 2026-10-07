#!/usr/bin/env node
// Proves the static search asset is what the search dialog actually fetches:
// present at the shared path, gzip-compressed within the size budget, loadable
// by the same client the dialog uses (src/lib/search-index-client.mjs), and
// able to answer a real query with body-prose results (not just title/heading
// matches).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { SEARCH_INDEX_PATH, searchIndexClient } from "../src/lib/search-index-client.mjs";

// Budget for the bytes a reader downloads on their first search. When it was
// set, the index was 1.66 MB gzip (9.98 MB JSON), just under the 10 MB raw
// ceiling that applied while CloudFront compressed it. 3 MB leaves room for
// about 80% more indexed content. At the index's 6:1 gzip ratio, that is about
// 18 MB of JSON for the browser to parse and load into Orama, so past this
// point shrink or split the index rather than raise the budget.
const GZIP_SIZE_BUDGET = 3_000_000;
const searchTerm = "browser-friendly";
const expectedUrl = "/get-started/what-is-volcano";
const expectedText = "managed PostgreSQL";

const indexPath = path.join("public", SEARCH_INDEX_PATH.replace(/^\//, ""));
if (!fs.existsSync(indexPath)) {
  console.error(`check-search-index: ${indexPath} not found. Run "pnpm build" first.`);
  process.exit(1);
}

const gzip = fs.readFileSync(indexPath);
if (gzip[0] !== 0x1f || gzip[1] !== 0x8b) {
  console.error(`check-search-index: ${indexPath} is not gzip-compressed.`);
  process.exit(1);
}
const jsonSize = zlib.gunzipSync(gzip).length;
console.log(
  `check-search-index: ${indexPath} is ${gzip.length} bytes gzip (${jsonSize} bytes JSON)`,
);
if (gzip.length > GZIP_SIZE_BUDGET) {
  console.error(
    `check-search-index: ${gzip.length} bytes exceeds the ${GZIP_SIZE_BUDGET} byte ` +
      "gzip budget for the search index.",
  );
  process.exit(1);
}

const servingModes = {
  // Production: S3 returns the gzip bytes as stored, with no Content-Encoding,
  // and the client decompresses them itself.
  stored: { "content-type": "application/octet-stream" },
  // A server that sets Content-Encoding, so fetch decodes the body first.
  encoded: { "content-type": "application/json", "content-encoding": "gzip" },
};

const server = http.createServer((req, res) => {
  const mode = req.url.split("/")[1];
  res.writeHead(200, servingModes[mode]);
  res.end(gzip);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

try {
  for (const mode of Object.keys(servingModes)) {
    const client = searchIndexClient(`http://127.0.0.1:${port}/${mode}${SEARCH_INDEX_PATH}`);
    const results = await client.search(searchTerm);
    if (results.length === 0) {
      throw new Error(`check-search-index: query "${searchTerm}" returned no results (${mode}).`);
    }
    const bodyMatch = results.some(
      (result) =>
        result.type === "text" &&
        result.url === expectedUrl &&
        result.content.includes(expectedText),
    );
    if (!bodyMatch) {
      throw new Error(
        `check-search-index: query "${searchTerm}" did not match body text at ${expectedUrl} (${mode}).`,
      );
    }
    console.log(
      `check-search-index: query "${searchTerm}" returned ${results.length} result(s) (${mode})`,
    );
    for (const [query, url] of [
      ["Volcano SDK Documentation", "/sdk/js"],
      ["Python SDK", "/sdk/python"],
      ["Ruby SDK", "/sdk/ruby"],
    ]) {
      const matches = await client.search(query);
      if (!matches.some((result) => result.type === "page" && result.url === url)) {
        throw new Error(`check-search-index: query "${query}" did not find ${url} (${mode}).`);
      }
      console.log(`check-search-index: query "${query}" found ${url} (${mode})`);
    }
  }
} finally {
  server.close();
}
