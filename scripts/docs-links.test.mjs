import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

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
    `---\ntitle: "Test"\ndescription: "Valid link forms."\n---\n\n[root](/)\n[root fragment](/#top)\n[fragment](/sdk#authentication)\n[query](/sdk?tab=js)\n[titled](/sdk "SDK docs")\n`,
  );
  fs.writeFileSync(
    path.join(content, "sdk", "index.md"),
    `---\ntitle: "SDK"\ndescription: "SDK route fixture."\n---\n`,
  );
  assert.match(run("lint-docs.mjs", content), /docs OK/);
  assert.match(run("check-links.mjs", content, publicDir), /links OK/);

  fs.writeFileSync(
    path.join(content, "index.md"),
    `---\ntitle: "Test"\ndescription: "Invalid titled link."\n---\n\n[bad](/bogus "details")\n`,
  );
  assert.throws(
    () => run("lint-docs.mjs", content),
    (error) => error.status === 1 && error.stderr.includes("/bogus"),
  );
  assert.throws(
    () => run("check-links.mjs", content, publicDir),
    (error) => error.status === 1 && error.stderr.includes("/bogus"),
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
