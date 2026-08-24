#!/usr/bin/env node
// Proves the static search asset is what RootProvider is actually configured
// to fetch: present at that exact path, under the CloudFront auto-compression
// ceiling (10,000,000 bytes), loadable by the installed fumadocs-core Orama
// client, and able to answer a real query with body-prose results (not just
// title/heading matches).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";

const RAW_SIZE_CEILING = 10_000_000;
const searchTerm = "deploy";

const layoutSource = fs.readFileSync(path.join("src", "app", "layout.tsx"), "utf8");
const configuredApi = layoutSource.match(/api:\s*"([^"]+)"/)?.[1];
if (!configuredApi) {
  console.error("check-search-index: no static search `api` path found in src/app/layout.tsx.");
  process.exit(1);
}

const indexPath = path.join("public", configuredApi.replace(/^\//, ""));
if (!fs.existsSync(indexPath)) {
  console.error(`check-search-index: ${indexPath} not found. Run "pnpm build" first.`);
  process.exit(1);
}

const { size } = fs.statSync(indexPath);
console.log(`check-search-index: ${indexPath} is ${size} bytes`);
if (size >= RAW_SIZE_CEILING) {
  console.error(
    `check-search-index: ${size} bytes exceeds the ${RAW_SIZE_CEILING} byte ` +
      "CloudFront auto-compression ceiling.",
  );
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  fs.createReadStream(indexPath).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

try {
  const client = oramaStaticClient({ from: `http://127.0.0.1:${port}/${configuredApi.replace(/^\//, "")}` });
  const results = await client.search(searchTerm);
  if (results.length === 0) {
    console.error(`check-search-index: query "${searchTerm}" returned no results.`);
    process.exit(1);
  }
  if (!results.some((r) => r.type === "text")) {
    console.error(`check-search-index: query "${searchTerm}" matched no body text.`);
    process.exit(1);
  }
  console.log(`check-search-index: query "${searchTerm}" returned ${results.length} result(s)`);
} finally {
  server.close();
}
