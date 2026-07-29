import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// Reads the assembled docs tree. get-started is authored here; platform, sdk,
// cli, and ai are synced from their source repos (see docs.config.yaml).
export const docs = defineDocs({
  dir: "content",
});

// Synced docs use fence languages Shiki doesn't ship (e.g. env, cron). Rewrite
// them to a real grammar in the markdown AST so external content can't crash the
// build. Done in remark (deterministic per file) rather than Shiki langAlias,
// which races across Turbopack's parallel workers.
const CODE_LANG_ALIAS: Record<string, string> = {
  env: "bash",
  dotenv: "bash",
  conf: "bash",
  properties: "bash",
  cron: "bash",
};

type MdastNode = { type?: string; lang?: string | null; children?: MdastNode[] };

function remarkCodeLangAlias() {
  function walk(node: MdastNode) {
    if (node.type === "code" && node.lang) {
      const alias = CODE_LANG_ALIAS[node.lang.toLowerCase()];
      if (alias) node.lang = alias;
    }
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }
  return walk;
}

// Rehype plugin: replace <script> elements in rendered HTML with <template> to
// suppress React's dev-mode "script tag inside component" console warning.
// Script tags appear in HTML code examples and are harmless (rendered as text
// inside <code>), but React flags them regardless.
function rehypeScriptToTemplate() {
  function walk(node: { tagName?: string; children?: unknown[] }) {
    if (node.tagName === "script") {
      node.tagName = "template";
    }
    if (node.children) {
      for (const child of node.children) {
        if (child && typeof child === "object") walk(child as typeof node);
      }
    }
  }
  return walk;
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkCodeLangAlias],
    rehypePlugins: [rehypeScriptToTemplate],
  },
});
