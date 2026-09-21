import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { relocatedIndexHref, remarkRelocatedIndex } from "./relocated-index.mjs";
import { loader } from "fumadocs-core/source";
import { resolveRelativeMdHref } from "../src/lib/relative-md-href.mjs";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "volcano-docs-links-"));
const content = path.join(tmp, "content");
const publicDir = path.join(tmp, "public");
fs.mkdirSync(content);
fs.mkdirSync(path.join(content, "sdk"));
fs.mkdirSync(publicDir);

function run(script, ...args) {
  return execFileSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

try {
  fs.writeFileSync(
    path.join(content, "index.md"),
    `---\ntitle: "Test"\ndescription: "Valid link forms."\n---\n\n[root](/)\n[root fragment](/#top)\n[fragment](/sdk#authentication)\n[query](/sdk?tab=js)\n[titled](/sdk "SDK docs")\n\`[ignored](/bogus)\`\n\n\`\`\`text\n[ignored](/bogus)\n\`\`\`\n`,
  );
  fs.writeFileSync(
    path.join(content, "sdk", "index.md"),
    `---\ntitle: "SDK"\ndescription: "SDK route fixture."\n---\n`,
  );
  assert.match(run("lint-docs.mjs", content), /docs OK/);
  assert.match(run("check-links.mjs", content, publicDir), /links OK/);

  const guide = path.join(content, "sdk", "guide.md");
  const links = "[landing](./README.md#install)\n[reference][home]\n\n[home]: README.md?tab=python#install\n\n`[example](./README.md)`\n";
  fs.writeFileSync(guide, links);
  assert.match(run("check-links.mjs", content, publicDir), /links OK/);
  const tree = fromMarkdown(links);
  remarkRelocatedIndex()(tree, { path: guide });
  assert.equal(tree.children[0].children[0].url, "./index.md#install");
  assert.equal(tree.children[1].url, "index.md?tab=python#install");
  const source = loader({ baseUrl: "/", source: { files: [
    { type: "page", path: "sdk/index.md", data: { title: "SDK" } },
    { type: "page", path: "sdk/guide.md", data: { title: "Guide" } },
  ] } });
  const page = source.getPage(["sdk", "guide"]);
  assert.equal(resolveRelativeMdHref(tree.children[0].children[0].url, source, page), "/sdk#install");
  assert.equal(resolveRelativeMdHref(tree.children[1].url, source, page), "/sdk?tab=python#install");
  assert.equal(resolveRelativeMdHref("./index.md?tab=python#install", source, page), "/sdk?tab=python#install");
  assert.equal(resolveRelativeMdHref("https://example.com/README.md?q=1#top", source, page), "https://example.com/README.md?q=1#top");
  assert.equal(tree.children[2].children[0].value, "[example](./README.md)");
  assert.equal(relocatedIndexHref("../README.md#top", guide), "../index.md#top");
  assert.equal(relocatedIndexHref("https://example.com/README.md", guide), "https://example.com/README.md");
  assert.equal(relocatedIndexHref("/sdk/README.md", guide), "/sdk/README.md");
  assert.equal(relocatedIndexHref("missing/README.md", guide), "missing/README.md");
  fs.writeFileSync(path.join(content, "sdk", "README.md"), "Existing page");
  assert.equal(relocatedIndexHref("./README.md", guide), "./README.md");
  fs.unlinkSync(path.join(content, "sdk", "README.md"));
  fs.unlinkSync(guide);

  const invalidLinks = [
    `[bad](/bogus "details")`,
    `[bad][target]\n\n[target]: /bogus`,
    `[bad](</bogus>)`,
    `[bad [nested]](/bogus)`,
  ];
  for (const markdown of invalidLinks) {
    fs.writeFileSync(
      path.join(content, "index.md"),
      `---\ntitle: "Test"\ndescription: "Invalid link form."\n---\n\n${markdown}\n`,
    );
    assert.throws(
      () => run("lint-docs.mjs", content),
      (error) => error.status === 1 && error.stderr.includes("/bogus"),
    );
    assert.throws(
      () => run("check-links.mjs", content, publicDir),
      (error) => error.status === 1 && error.stderr.includes("/bogus"),
    );
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
