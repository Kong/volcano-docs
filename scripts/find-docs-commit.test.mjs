import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./find-docs-commit.mjs", import.meta.url));

test("selects the newest docs commit for the closest hosting ancestor", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-source-revisions-"));
  const repo = join(root, "docs");
  const remote = join(root, "origin.git");
  const bin = join(root, "bin");
  const hostingSha = "d".repeat(40);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  function git(...args) {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", env }).trim();
  }
  function commit(message) {
    git("add", ".");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  }

  try {
    mkdirSync(repo);
    mkdirSync(bin);
    execFileSync("git", ["init", "-q", "--bare", remote]);
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    git("remote", "add", "origin", remote);
    writeFileSync(join(bin, "gh"), `#!/usr/bin/env node
const source = process.argv[3].split("/compare/")[1].split("...")[0];
const target = process.argv[3].split("...")[1];
let result = { status: "diverged", ahead_by: 0 };
if (target === "${hostingSha}" && source === "${"c".repeat(40)}") result = { status: "ahead", ahead_by: 1 };
if (target === "${hostingSha}" && source === "${"a".repeat(40)}") result = { status: "ahead", ahead_by: 3 };
if (target === "${hostingSha}" && source === target) result = { status: "identical", ahead_by: 0 };
console.log(JSON.stringify(result));
`);
    chmodSync(join(bin, "gh"), 0o755);

    writeFileSync(join(repo, "page.md"), "Site before source tracking");
    commit("site before tracking");
    writeFileSync(join(repo, "source-revisions.json"), "{}\n");
    commit("start tracking");
    writeFileSync(join(repo, "source-revisions.json"), JSON.stringify({ "Kong/volcano-hosting": "a".repeat(40) }));
    commit("initial sync");
    writeFileSync(join(repo, "source-revisions.json"), JSON.stringify({ "Kong/volcano-hosting": "b".repeat(40) }));
    commit("diverged sync");
    writeFileSync(join(repo, "source-revisions.json"), JSON.stringify({ "Kong/volcano-hosting": "c".repeat(40) }));
    commit("closest sync");
    writeFileSync(join(repo, "page.md"), "Updated site metadata");
    const docsSha = commit("site update");
    git("push", "-q", "-u", "origin", "main");

    assert.equal(execFileSync(process.execPath, [script, hostingSha], { cwd: repo, env, encoding: "utf8" }).trim(), docsSha);
    writeFileSync(join(repo, "source-revisions.json"), JSON.stringify({ "Kong/volcano-hosting": hostingSha }));
    const exactDocsSha = commit("exact sync");
    git("push", "-q", "origin", "main");
    assert.equal(execFileSync(process.execPath, [script, hostingSha], { cwd: repo, env, encoding: "utf8" }).trim(), exactDocsSha);
    assert.equal(spawnSync(process.execPath, [script, "e".repeat(40)], { cwd: repo, env }).status, 1);
    assert.equal(spawnSync(process.execPath, [script, "bad"], { cwd: repo, env }).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
