// Run: node scripts/refuse-symlinks.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const script = url.fileURLToPath(new URL("./refuse-symlinks.sh", import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "volcano-docs-refuse-symlinks-"));

// Fixture trees, relative to tmp.
const fixtures = String.raw`
set -eu
page() { mkdir -p "$(dirname "$1")"; printf -- '---\ntitle: T\n---\n' > "$1"; }
page package.json
page clean/docs/README.md
page clean/docs/guide/intro.md

# Links anywhere under the path: to a file outside, dangling, to a directory.
page tree/docs/README.md
page tree/internal/runbook.md
mkdir -p tree/docs/guide
ln -s ../../../package.json tree/docs/guide/leak.md
ln -s /nonexistent tree/docs/gone.md
ln -s ../internal tree/docs/internal

# The path itself, or a directory on it, is a link: cp would copy the target.
page final/internal/README.md
ln -s internal final/public
page component/real/public/README.md
ln -s real component/docs

# A name with a newline and an encoded one.
mkdir weird
ln -s ../package.json $'weird/a b\n::warning::x%0Ay.md'
`;

function check(...paths) {
  const r = spawnSync("bash", [script, ...paths], { cwd: tmp, encoding: "utf8" });
  const lines = r.stderr.split("\n").filter(Boolean);
  return { status: r.status, lines };
}

try {
  const setup = spawnSync("bash", ["-c", fixtures], { cwd: tmp, encoding: "utf8" });
  assert.equal(setup.status, 0, setup.stderr);

  // A tree without links passes, however the path is spelled.
  assert.deepEqual(check("clean/docs"), { status: 0, lines: [] });
  assert.deepEqual(check("./clean/docs/", "clean"), { status: 0, lines: [] });

  let r = check("tree/docs");
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines.sort(), [
    "::error::tree/docs/gone.md is a symlink to /nonexistent; docs must not contain symlinks",
    "::error::tree/docs/guide/leak.md is a symlink to ../../../package.json; docs must not contain symlinks",
    "::error::tree/docs/internal is a symlink to ../internal; docs must not contain symlinks",
  ]);

  assert.deepEqual(check("final/public"), {
    status: 1,
    lines: ["::error::final/public is a symlink to internal; docs must not contain symlinks"],
  });
  assert.deepEqual(check("component/docs/public"), {
    status: 1,
    lines: ["::error::component/docs is a symlink to real; docs must not contain symlinks"],
  });

  // Every path is checked, not just the first.
  r = check("final/public", "clean/docs", "component/docs/public");
  assert.equal(r.status, 1);
  assert.deepEqual(
    r.lines.map((l) => l.split(" ")[0]),
    ["::error::final/public", "::error::component/docs"],
  );

  // Names with newlines or %0A stay one annotation line and cannot inject commands.
  r = check("weird");
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1);
  assert.match(r.lines[0], /^::error::\$'weird\/a b\\n::warning::x%250Ay\.md' is a symlink/);

  // A path that cannot be scanned fails closed, still reporting the other links.
  r = check("missing", "clean");
  assert.equal(r.status, 1);
  assert.deepEqual(
    r.lines.filter((l) => l.startsWith("::")),
    ["::error::could not scan missing for symlinks"],
  );
  r = check("missing", "final/public");
  assert.equal(r.status, 1);
  assert.ok(r.lines.includes("::error::could not scan missing for symlinks"));
  assert.ok(r.lines.some((l) => l.startsWith("::error::final/public is a symlink")));

  // Paths must stay inside the current directory.
  for (const outside of [path.join(tmp, "clean"), "..", "../x", "clean/../..", "clean/..", "a\nb"]) {
    assert.equal(check(outside).status, 2, outside);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("refuse-symlinks: OK");
