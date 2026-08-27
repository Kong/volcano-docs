import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const action = await readFile(
  new URL("../.github/actions/lint-docs/action.yml", import.meta.url),
  "utf8",
);
const setup = action.match(
  /- uses: pnpm\/action-setup@[^\n]+\n(?<inputs>(?: {6,}.+\n)*)/,
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

assert.ok(setup, "lint action must install pnpm");
const version = setup.groups.inputs.match(/^ {8}version: (?<value>\S+)$/m);
const manifest = setup.groups.inputs.match(
  /^ {8}package_json_file: (?<value>\S+)$/m,
);

assert.ok(version, "lint action must pin pnpm explicitly");
assert.equal(`pnpm@${version.groups.value}`, packageJson.packageManager);
assert.ok(manifest, "lint action must isolate caller package metadata");
assert.equal(manifest.groups.value, ".volcano-docs-lint/no-package.json");
assert.equal(path.isAbsolute(manifest.groups.value), false);
