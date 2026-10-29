// Run: node src/lib/page-markdown.test.mjs
import assert from "node:assert/strict";
import {
  mapTreeUrls,
  markdownPath,
  pageSlugs,
  renderPageMarkdown,
  rewriteMarkdownLinks,
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
// renderPageMarkdown applies the rewrite to the body only.
assert.equal(
  renderPageMarkdown({ title: "T", raw: "[x](./x.md)\n", rewriteHref: toAbsolute }),
  "# T\n\n[x](https://docs.volcano.dev/cli/x.md)\n",
);

// Page routes map to .md paths; the root is /index.md.
assert.equal(markdownPath("/cli/installation"), "/cli/installation.md");
assert.equal(markdownPath("/sdk"), "/sdk.md");
assert.equal(markdownPath("/sdk/"), "/sdk.md");
assert.equal(markdownPath("/"), "/index.md");

// /index.md names the root page; every other slug passes through.
assert.deepEqual(pageSlugs(["index"]), []);
assert.deepEqual(pageSlugs(["cli", "installation"]), ["cli", "installation"]);
assert.deepEqual(pageSlugs(["cli", "index"]), ["cli", "index"]);

// Trees are walked index-first, and only page URLs are rewritten.
const ref = { file: "cli/index.md" };
const tree = {
  name: "Docs",
  children: [
    { type: "page", url: "/", name: "Home" },
    {
      type: "folder",
      name: "CLI",
      index: { type: "page", url: "/cli", name: "CLI", $ref: ref },
      children: [
        { type: "separator", name: "Guides" },
        { type: "page", url: "/cli/installation", name: "Install" },
        { type: "page", url: "https://github.com/Kong", name: "GitHub", external: true },
      ],
    },
  ],
};
assert.deepEqual(
  treePages(tree).map(function url(node) {
    return node.url;
  }),
  ["/", "/cli", "/cli/installation", "https://github.com/Kong"],
);
const mapped = mapTreeUrls(tree, function toMd(url) {
  return `https://docs.volcano.dev${markdownPath(url)}`;
});
assert.deepEqual(
  treePages(mapped).map(function url(node) {
    return node.url;
  }),
  [
    "https://docs.volcano.dev/index.md",
    "https://docs.volcano.dev/cli.md",
    "https://docs.volcano.dev/cli/installation.md",
    // External nodes keep their URL.
    "https://github.com/Kong",
  ],
);
assert.equal(mapped.children[1].index.$ref, ref);
assert.equal(mapped.children[1].children[0].name, "Guides");
// The input tree is left as it was.
assert.equal(tree.children[1].children[1].url, "/cli/installation");

console.log("page-markdown: OK");
