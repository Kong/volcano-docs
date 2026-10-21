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
import { getSearchSection } from "../src/lib/search-section.mjs";
import { assertBlogTopicIndex, readTaggedBlogPages } from "./blog-search-expectations.mjs";

// Budget for the bytes a reader downloads on their first search. When it was
// set, the index was 1.48 MB gzip (8.92 MB JSON), under the 10 MB raw ceiling
// that applied while CloudFront compressed it. 3 MB leaves room for about twice
// today's indexed content. At the index's 6:1 gzip ratio, that is about 18 MB
// of JSON for the browser to parse and load into Orama, so past this point
// shrink or split the index rather than raise the budget.
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
const exportedIndex = JSON.parse(zlib.gunzipSync(gzip));
const indexedPages = Object.values(exportedIndex.docs.docs).filter((document) => document.type === "page");
const taggedBlogPages = readTaggedBlogPages();
assertBlogTopicIndex(taggedBlogPages, indexedPages);
const topicPage = taggedBlogPages[0];
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
    // Anchor the Docs scope check to content authored here, so SDK syncs and
    // ranking changes for broad terms cannot invalidate this assertion.
    for (const [section, query, expected] of [
      ["docs", searchTerm, expectedUrl],
      ["cookbooks", "Cookbooks", "/cookbooks"],
      ["blog", "Blog", "/blog"],
    ]) {
      const scoped = searchIndexClient(`http://127.0.0.1:${port}/${mode}${SEARCH_INDEX_PATH}`, section);
      const matches = await scoped.search(query);
      if (!matches.some((result) => result.type === "page" && result.url === expected)) {
        throw new Error(`check-search-index: ${section} query "${query}" did not find ${expected} (${mode}).`);
      }
      if (matches.some((result) => getSearchSection(result.url) !== section)) {
        throw new Error(`check-search-index: ${section} query returned results from another section (${mode}).`);
      }
      console.log(`check-search-index: ${section} search returns only its own section (${mode})`);
    }
    // Editorial posts may be renamed, retagged, or removed. Derive the topic
    // and query from authored frontmatter; an untagged blog has no topic to test.
    if (topicPage) {
      const topic = topicPage.tags[0];
      const topicPages = new Set(taggedBlogPages.filter((page) => page.tags.includes(topic)).map((page) => page.url));
      const topicClient = searchIndexClient(`http://127.0.0.1:${port}/${mode}${SEARCH_INDEX_PATH}`, ["blog", topic]);
      const topicMatches = await topicClient.search(topicPage.title);
      if (topicMatches.length === 0 || topicMatches.some((result) => !topicPages.has(result.url.split("#", 1)[0]))) {
        throw new Error(`check-search-index: ${topic} search did not isolate matching posts (${mode}).`);
      }
      // An absent topic must exclude results even if all current posts share a topic.
      let absentTopic = "blog-topic:__missing-topic-for-scope-check__";
      while (indexedPages.some((page) => page.tags?.includes(absentTopic))) absentTopic += "_";
      const absentTopicClient = searchIndexClient(`http://127.0.0.1:${port}/${mode}${SEARCH_INDEX_PATH}`, ["blog", absentTopic]);
      const absentTopicMatches = await absentTopicClient.search(topicPage.title);
      if (absentTopicMatches.length !== 0) {
        throw new Error(`check-search-index: a nonmatching topic returned blog results (${mode}).`);
      }
      console.log(`check-search-index: blog topic search isolates matching posts (${mode})`);
    } else {
      console.log(`check-search-index: no tagged blog posts; topic checks skipped (${mode})`);
    }
  }
} finally {
  server.close();
}
