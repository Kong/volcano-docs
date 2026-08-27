import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const action = await readFile(
  new URL("../.github/actions/lint-docs/action.yml", import.meta.url),
  "utf8",
);
const setup = action.match(
  /- uses: pnpm\/action-setup@[^\n]+\n(?<inputs>(?: {6,}.+\n)*)/,
);

assert.ok(setup, "lint action must install pnpm");
assert.doesNotMatch(
  setup.groups.inputs,
  /^ {8}version:/m,
  "lint action must not force a pnpm version over the caller package",
);
assert.match(
  setup.groups.inputs,
  /^ {8}package_json_file: \$\{\{ github\.action_path \}\}\/\.\.\/\.\.\/\.\.\/package\.json$/m,
  "lint action must resolve pnpm from volcano-docs",
);
