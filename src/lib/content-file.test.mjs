// Run: node src/lib/content-file.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readContentFile } from "./content-file.mjs";

const tmp = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), "volcano-docs-content-file-")),
);
const root = path.join(tmp, "content");

try {
  fs.mkdirSync(path.join(root, "get-started"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.md"), "home");
  fs.writeFileSync(path.join(root, "get-started", "install.md"), "install");
  fs.writeFileSync(path.join(root, "100%.md"), "percent");
  fs.writeFileSync(path.join(root, "v1..v2.md"), "dots");
  fs.writeFileSync(path.join(tmp, "secret.txt"), "outside");
  // Sibling directory sharing the root's name as a prefix ("content" vs "content-evil").
  fs.mkdirSync(path.join(tmp, "content-evil"));
  fs.writeFileSync(path.join(tmp, "content-evil", "x.md"), "sibling");
  // Symlinks: two escaping the root, one staying inside it.
  fs.symlinkSync(
    path.join(tmp, "secret.txt"),
    path.join(root, "get-started", "leak.md"),
  );
  fs.symlinkSync(path.join(tmp, "content-evil"), path.join(root, "evil-dir"));
  fs.symlinkSync(
    path.join(root, "index.md"),
    path.join(root, "get-started", "alias.md"),
  );

  // Real page paths read their file, with or without a trailing slash on the root.
  assert.equal(await readContentFile(root, "index.md"), "home");
  assert.equal(
    await readContentFile(root, "get-started/install.md"),
    "install",
  );
  assert.equal(await readContentFile(root + path.sep, "index.md"), "home");

  // Traversal, absolute, NUL and encoded variants are rejected.
  const rejected = [
    "",
    ".",
    "..",
    "../secret.txt",
    "get-started/../../secret.txt",
    "get-started/../index.md", // `..` is refused even when it would stay inside
    "get-started/..",
    "..\\secret.txt",
    "get-started\\..\\..\\secret.txt",
    "%2e%2e/secret.txt",
    "%2E%2E%2Fsecret.txt",
    ".%2e/secret.txt",
    "..%2fsecret.txt",
    "..%5csecret.txt",
    "%252e%252e%252fsecret.txt",
    "%25252e%25252e/secret.txt",
    "/etc/passwd",
    "%2fetc%2fpasswd",
    "\\\\server\\share\\x.md",
    "C:\\Windows\\win.ini",
    "C:/Windows/win.ini",
    "index.md\0.png",
    "index.md%00.png",
    "../content-evil/x.md",
  ];
  for (const input of rejected) {
    assert.equal(
      await readContentFile(root, input),
      null,
      `should reject ${JSON.stringify(input)}`,
    );
  }
  assert.equal(await readContentFile(root, undefined), null);

  // Encoded traversal, NUL and absolute forms stay refused even when a file
  // with that literal name exists inside the root.
  fs.mkdirSync(path.join(root, "%2e%2e"));
  fs.writeFileSync(path.join(root, "%2e%2e", "page.md"), "literal");
  fs.mkdirSync(path.join(root, "%252e%252e"));
  fs.writeFileSync(path.join(root, "%252e%252e", "page.md"), "literal");
  fs.writeFileSync(path.join(root, "page.md%00"), "literal");
  fs.writeFileSync(path.join(root, "%2fpage.md"), "literal");
  fs.writeFileSync(path.join(root, "C:\\page.md"), "literal");
  for (const input of [
    "%2e%2e/page.md",
    "%252e%252e/page.md",
    "page.md%00",
    "%2fpage.md",
    "C:\\page.md",
  ]) {
    assert.equal(
      await readContentFile(root, input),
      null,
      `should reject literal ${JSON.stringify(input)}`,
    );
  }

  // `..` inside a name is not a traversal segment, and a malformed percent
  // sequence is not encoding: both read the literal file.
  assert.equal(await readContentFile(root, "v1..v2.md"), "dots");
  assert.equal(await readContentFile(root, "100%.md"), "percent");

  // Missing files and directories read as null.
  assert.equal(await readContentFile(root, "get-started/missing.md"), null);
  assert.equal(await readContentFile(root, "get-started"), null);

  // Symlinks are followed only when their real target stays inside the root.
  assert.equal(await readContentFile(root, "get-started/leak.md"), null);
  assert.equal(await readContentFile(root, "evil-dir/x.md"), null);
  assert.equal(await readContentFile(root, "get-started/alias.md"), "home");

  // The root itself may be reached through a symlink.
  const linkedRoot = path.join(tmp, "linked-content");
  fs.symlinkSync(root, linkedRoot);
  assert.equal(
    await readContentFile(linkedRoot, "get-started/install.md"),
    "install",
  );
  assert.equal(await readContentFile(linkedRoot, "get-started/leak.md"), null);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("content-file: OK");
