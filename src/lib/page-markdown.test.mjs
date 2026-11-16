// Run: node src/lib/page-markdown.test.mjs
import assert from "node:assert/strict";
import pathToRegexp from "next/dist/compiled/path-to-regexp/index.js";

import { markdownRewrite } from "./markdown-rewrite.mjs";
import {
  canonicalLinkHeader,
  mapTreeUrls,
  markdownPath,
  pageSlugs,
  renderPageMarkdown,
  rewriteMarkdownLinks,
  rootPageMarkdownHref,
  treePages,
} from "./page-markdown.mjs";

// Frontmatter is replaced by a title/description header.
const raw = "---\ntitle: Install\ndescription: Get it\n---\n\nBody text.\n";
assert.equal(
  renderPageMarkdown({ title: "Install", description: "Get it", raw }),
  "# Install\n\nGet it\n\nBody text.\n",
);
assert.equal(
  renderPageMarkdown({ title: "Install", raw }),
  "# Install\n\nBody text.\n",
);
assert.equal(
  renderPageMarkdown({
    title: "Install",
    description: "Get it",
    raw,
    url: "https://docs.volcano.dev/cli/installation",
  }),
  "# Install\n\nURL: https://docs.volcano.dev/cli/installation\n\nGet it\n\nBody text.\n",
);
// A later horizontal rule is body, not frontmatter.
assert.equal(
  renderPageMarkdown({ title: "T", raw: "Intro\n\n---\n\nMore\n" }),
  "# T\n\nIntro\n\n---\n\nMore\n",
);

// Links, images and definitions are rewritten in place; code, autolinks to
// other targets, and the rest of the text are left byte for byte.
function toAbsolute(href) {
  if (href.endsWith(".md")) return `https://docs.volcano.dev/cli/${href.replace(/^\.\//, "")}`;
  return href;
}
const linked = [
  "See [Install](./install.md) and [Auth](auth.md \"Sign in\").",
  "",
  "A [ref][r] and ![shot](./shot.png) and [web](https://volcano.dev).",
  "",
  "[r]: ./ref.md",
  "",
  "```md",
  "[kept](./kept.md)",
  "```",
  "",
  "Inline `[kept](./kept.md)` too.",
  "",
].join("\n");
assert.equal(
  rewriteMarkdownLinks(linked, toAbsolute),
  [
    "See [Install](https://docs.volcano.dev/cli/install.md) and [Auth](https://docs.volcano.dev/cli/auth.md \"Sign in\").",
    "",
    "A [ref][r] and ![shot](./shot.png) and [web](https://volcano.dev).",
    "",
    "[r]: https://docs.volcano.dev/cli/ref.md",
    "",
    "```md",
    "[kept](./kept.md)",
    "```",
    "",
    "Inline `[kept](./kept.md)` too.",
    "",
  ].join("\n"),
);
// Link text that repeats the destination does not take the rewrite.
assert.equal(
  rewriteMarkdownLinks("[./a.md](./a.md)", toAbsolute),
  "[./a.md](https://docs.volcano.dev/cli/a.md)",
);
// A title that repeats the destination keeps its text; the destination is
// rewritten, for links, images and definitions alike.
assert.equal(
  rewriteMarkdownLinks('[Install](./install.md "See ./install.md")', toAbsolute),
  '[Install](https://docs.volcano.dev/cli/install.md "See ./install.md")',
);
assert.equal(
  rewriteMarkdownLinks('![./a.md](./a.md "./a.md")', toAbsolute),
  '![./a.md](https://docs.volcano.dev/cli/a.md "./a.md")',
);
assert.equal(
  rewriteMarkdownLinks('[r]\n\n[r]: ./ref.md "./ref.md"', toAbsolute),
  '[r]\n\n[r]: https://docs.volcano.dev/cli/ref.md "./ref.md"',
);
// Root-absolute links to pages point at the page's .md URL, keeping their
// query and fragment; assets, API routes, other routes and external or
// protocol-relative links are left alone.
const pageRoutes = new Set(["/docs", "/docs/cli", "/docs/platform/functions/overview"]);
function isPage(route) {
  return pageRoutes.has(route);
}
function toMdUrl(route) {
  return `https://docs.volcano.dev${markdownPath(route)}`;
}
function rootHref(href) {
  return rootPageMarkdownHref(href, isPage, toMdUrl);
}
assert.equal(
  rootHref("/docs/platform/functions/overview"),
  "https://docs.volcano.dev/docs/platform/functions/overview.md",
);
assert.equal(
  rootHref("/docs/platform/functions/overview#deploy"),
  "https://docs.volcano.dev/docs/platform/functions/overview.md#deploy",
);
assert.equal(rootHref("/docs/cli/?tab=npm#top"), "https://docs.volcano.dev/docs/cli.md?tab=npm#top");
assert.equal(rootHref("/docs"), "https://docs.volcano.dev/docs/index.md");
assert.equal(rootHref("/docs#intro"), "https://docs.volcano.dev/docs/index.md#intro");
for (const kept of [
  "/blog/introducing-volcano-sandbox/cover.png",
  "/api/llm/cli",
  "/llms.txt",
  "/llms-full.txt",
  "/nope",
  "/cli",
  "//cdn.example.com/cli",
  "https://volcano.dev/cli",
  "#section",
  "./install.md",
]) {
  assert.equal(rootHref(kept), kept);
}
assert.equal(
  rewriteMarkdownLinks(
    "[Overview](/docs/platform/functions/overview#deploy) ![x](/blog/x.png) [api](/api/llm/cli)\n\n[d]: /docs/cli",
    rootHref,
  ),
  "[Overview](https://docs.volcano.dev/docs/platform/functions/overview.md#deploy) ![x](/blog/x.png) [api](/api/llm/cli)\n\n[d]: https://docs.volcano.dev/docs/cli.md",
);

// renderPageMarkdown applies the rewrite to the body only.
assert.equal(
  renderPageMarkdown({ title: "T", raw: "[x](./x.md)\n", rewriteHref: toAbsolute }),
  "# T\n\n[x](https://docs.volcano.dev/cli/x.md)\n",
);

// Page routes map to .md paths. Section landings keep theirs inside the
// section's prefix, so a site mounted by path prefix still serves them.
assert.equal(markdownPath("/docs/cli/installation"), "/docs/cli/installation.md");
assert.equal(markdownPath("/docs/sdk"), "/docs/sdk.md");
assert.equal(markdownPath("/docs/sdk/"), "/docs/sdk.md");
assert.equal(markdownPath("/docs"), "/docs/index.md");
assert.equal(markdownPath("/blog"), "/blog/index.md");
assert.equal(markdownPath("/cookbooks/"), "/cookbooks/index.md");
assert.equal(markdownPath("/"), "/index.md");

// Every .md path, nested ones included, reaches the markdown route. Resolve the
// rewrite the way OpenNext does on Volcano: it validates the destination, so a
// single-segment parameter holding "/" throws and the page answers 500.
const { compile, match } = pathToRegexp;
function markdownRoute(pathname) {
  const matched = match(markdownRewrite.source)(pathname);
  return matched ? compile(markdownRewrite.destination)(matched.params) : null;
}
assert.equal(
  markdownRoute(markdownPath("/platform/guides/lavaflow")),
  "/api/llm/platform/guides/lavaflow",
);
assert.equal(
  markdownRoute("/platform/authentication/configuration/email-smtp.md"),
  "/api/llm/platform/authentication/configuration/email-smtp",
);
assert.equal(markdownRoute(markdownPath("/docs/platform")), "/api/llm/docs/platform");
assert.equal(markdownRoute(markdownPath("/")), "/api/llm/index");
assert.equal(markdownRoute(markdownPath("/docs")), "/api/llm/docs/index");
assert.equal(markdownRoute(markdownPath("/docs/cli/setup")), "/api/llm/docs/cli/setup");
assert.equal(markdownRoute("/platform/guides/lavaflow"), null);

// A page's markdown names its HTML page as canonical, root included.
assert.equal(
  canonicalLinkHeader("https://docs.volcano.dev/cli/installation"),
  '<https://docs.volcano.dev/cli/installation>; rel="canonical"',
);
assert.equal(
  canonicalLinkHeader("https://docs.volcano.dev/"),
  '<https://docs.volcano.dev/>; rel="canonical"',
);

// /index.md names the root page; every other slug passes through.
assert.deepEqual(pageSlugs(["index"]), []);
assert.deepEqual(pageSlugs(["cli", "installation"]), ["cli", "installation"]);
assert.deepEqual(pageSlugs(["cli", "index"]), ["cli"]);
assert.deepEqual(pageSlugs(["docs", "index"]), []);
assert.deepEqual(pageSlugs(["blog", "index"]), ["blog"]);
assert.deepEqual(pageSlugs(["docs"]), []);
assert.deepEqual(pageSlugs(["docs", "cli", "installation"]), ["cli", "installation"]);
assert.deepEqual(pageSlugs(["blog", "post"]), ["blog", "post"]);

// Trees are walked index-first, and only page URLs are rewritten.
const ref = { file: "cli/index.md" };
const tree = {
  name: "Docs",
  children: [
    { type: "page", url: "/docs", name: "Home" },
    {
      type: "folder",
      name: "CLI",
      index: { type: "page", url: "/docs/cli", name: "CLI", $ref: ref },
      children: [
        { type: "separator", name: "Guides" },
        { type: "page", url: "/docs/cli/installation", name: "Install" },
        { type: "page", url: "https://github.com/Kong", name: "GitHub", external: true },
      ],
    },
  ],
};
assert.deepEqual(
  treePages(tree).map(function url(node) {
    return node.url;
  }),
  ["/docs", "/docs/cli", "/docs/cli/installation", "https://github.com/Kong"],
);
const mapped = mapTreeUrls(tree, function toMd(url) {
  return `https://docs.volcano.dev${markdownPath(url)}`;
});
assert.deepEqual(
  treePages(mapped).map(function url(node) {
    return node.url;
  }),
  [
    "https://docs.volcano.dev/docs/index.md",
    "https://docs.volcano.dev/docs/cli.md",
    "https://docs.volcano.dev/docs/cli/installation.md",
    // External nodes keep their URL.
    "https://github.com/Kong",
  ],
);
assert.equal(mapped.children[1].index.$ref, ref);
assert.equal(mapped.children[1].children[0].name, "Guides");
// The input tree is left as it was.
assert.equal(tree.children[1].children[1].url, "/docs/cli/installation");

console.log("page-markdown: OK");
