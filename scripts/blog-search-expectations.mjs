import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { isPageVisible } from "../src/lib/content-visibility.mjs";

// Read expectations from authored content, independently of the search export.
// Losing every topic tag in the index must fail rather than skip the checks.
export function readTaggedBlogPages(directory = "content/blog") {
  const pages = [];
  function walk(relative = "") {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const markdown = fs.readFileSync(path.join(directory, file), "utf8");
      const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!frontmatter) throw new Error(`Missing blog frontmatter: ${file}`);
      const data = yaml.load(frontmatter[1]);
      if (!isPageVisible(data, "production")) continue;
      if (!data.tags?.length) continue;
      const slug = file.replace(/\.md$/, "").replace(/(^|\/)index$/, "");
      const url = `/blog/${slug}`.replace(/\/$/, "");
      pages.push({ url, title: data.title, tags: data.tags.map((tag) => `blog-topic:${tag}`) });
    }
  }
  walk();
  return pages;
}

export function assertBlogTopicIndex(expectedPages, indexedPages) {
  for (const expected of expectedPages) {
    const indexed = indexedPages.find((page) => page.url === expected.url);
    for (const tag of expected.tags) {
      if (!indexed?.tags?.includes(tag)) {
        throw new Error(`check-search-index: ${expected.url} is missing expected tag ${tag}.`);
      }
    }
  }
}
