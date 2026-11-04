#!/usr/bin/env node
// Proves the server bundle carries the files its routes read at runtime. A
// host such as Volcano runs the server from Next.js's file traces, not the
// project tree, so an untraced read fails with ENOENT and the request with a
// 500. The social card reads the logo from public/, which Next.js does not
// trace on its own; next.config.ts names it.
import fs from "node:fs";
import path from "node:path";

const required = {
  "app/opengraph-image/route.js": ["public/design/logo-mark.svg"],
  "app/twitter-image/route.js": ["public/design/logo-mark.svg"],
};

let failed = false;
for (const [route, files] of Object.entries(required)) {
  const tracePath = path.resolve(".next/server", `${route}.nft.json`);
  if (!fs.existsSync(tracePath)) {
    console.error(`check-server-traces: ${tracePath} not found. Run "pnpm build" first.`);
    process.exit(1);
  }
  const traced = new Set(
    JSON.parse(fs.readFileSync(tracePath, "utf8")).files.map((file) => path.resolve(path.dirname(tracePath), file)),
  );
  for (const file of files) {
    if (!traced.has(path.resolve(file))) {
      console.error(`check-server-traces: ${route} reads ${file} at runtime but its trace does not include it.`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log("check-server-traces: OK");
