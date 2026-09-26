#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";

const hostingSha = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(hostingSha ?? "")) {
  console.error("Pass the full lowercase SHA deployed by volcano-hosting to production.");
  process.exit(1);
}

function run(command, ...args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

if (run("git", "rev-parse", "--is-shallow-repository") === "true") {
  run("git", "fetch", "--unshallow", "origin", "main");
} else {
  run("git", "fetch", "origin", "main");
}

let best;
const commits = run("git", "log", "origin/main", "--first-parent", "--format=%H").split("\n");
for (const docsSha of commits) {
  const file = `${docsSha}:source-revisions.json`;
  if (spawnSync("git", ["cat-file", "-e", file], { stdio: "ignore" }).status !== 0) continue;
  const sourceSha = JSON.parse(run("git", "show", file))["Kong/volcano-hosting"];
  if (!sourceSha) continue;
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error(`Invalid hosting SHA in ${docsSha}`);

  const comparison = JSON.parse(run("gh", "api", `repos/Kong/volcano-hosting/compare/${sourceSha}...${hostingSha}`, "--jq", "{status, ahead_by}"));
  if (!Number.isInteger(comparison.ahead_by)) throw new Error(`Invalid hosting comparison for ${sourceSha}`);
  if (!["ahead", "identical"].includes(comparison.status)) continue;
  if (!best || comparison.ahead_by < best.distance) {
    best = { docsSha, sourceSha, distance: comparison.ahead_by };
  }
}

if (!best) {
  console.error("No docs commit records a hosting revision that is an ancestor of the production SHA.");
  process.exit(1);
}
console.error(`Platform source: ${best.sourceSha} (${best.distance} hosting commits behind production)`);
console.log(best.docsSha);
