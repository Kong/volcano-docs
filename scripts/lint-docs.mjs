#!/usr/bin/env node
// Validate Volcano docs against spec/markdown-format.md.
// Usage: node scripts/lint-docs.mjs <dir> [<dir> ...]   (default: content)
// Exits non-zero and prints every violation. Missing dirs are skipped, not failed.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const schema = JSON.parse(
  fs.readFileSync(path.join(here, "..", "spec", "frontmatter.schema.json"), "utf8"),
);
const config = yaml.load(fs.readFileSync(path.join(here, "..", "docs.config.yaml"), "utf8"));
const siteSections = new Set(config.nav);
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;
const dirs = process.argv.slice(2);
if (dirs.length === 0) dirs.push("content");

const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: null, body: text, fmLines: 0 };
  return { fm: m[1], body: text.slice(m[0].length), fmLines: m[0].split("\n").length - 1 };
}

function checkBody(file, body, offset) {
  const lines = body.split("\n");
  let inFence = false;
  let fenceChar = "";
  lines.forEach((line, i) => {
    const f = line.match(/^(`{3,}|~{3,})(.*)$/);
    if (f) {
      if (!inFence) {
        inFence = true;
        fenceChar = f[1][0];
        if (f[2].trim() === "") err(file, `bare code fence (missing language) at line ${offset + i + 1}`);
      } else if (f[1][0] === fenceChar) {
        inFence = false;
      }
      return;
    }
    if (!inFence && /^# /.test(line)) err(file, `H1 in body at line ${offset + i + 1}; move it to the frontmatter title`);
    if (!inFence) {
      const links = line.matchAll(/\[[^\]]*\]\((\/[^)\s]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?[ \t]*\)/g);
      for (const match of links) {
        const url = match[1].split("#")[0].split("?")[0];
        const section = url.split("/", 2)[1];
        if (!siteSections.has(section)) {
          err(file, `site-absolute link must start with a docs section at line ${offset + i + 1}: ${match[1]}`);
        }
      }
    }
  });
}

function lintFile(file) {
  const base = path.basename(file);
  if (base !== "index.md" && base !== "README.md" && !KEBAB.test(base)) {
    err(file, "filename is not kebab-case");
  }
  const text = fs.readFileSync(file, "utf8");
  const { fm, body, fmLines } = splitFrontmatter(text);
  if (fm === null) {
    err(file, "missing YAML frontmatter block");
    return;
  }
  let data;
  try {
    data = yaml.load(fm);
  } catch (e) {
    err(file, `invalid YAML frontmatter: ${e.message}`);
    return;
  }
  if (!validate(data)) {
    for (const e of validate.errors) err(file, `frontmatter ${e.instancePath || "/"} ${e.message}`);
  }
  checkBody(file, body, fmLines);
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    // internal/ docs are not published; examples/ are reference code (READMEs
    // carry frontmatter for rendering but aren't held to the prose format).
    if (e.isDirectory() && (e.name === "internal" || e.name === "examples")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) lintFile(p);
  }
}

let linted = 0;
for (const d of dirs) {
  if (!fs.existsSync(d)) {
    console.log(`skip: ${d} (not found)`);
    continue;
  }
  walk(d);
  linted++;
}

if (errors.length) {
  console.error(`\n${errors.length} doc problem(s):\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(linted ? "docs OK" : "nothing to lint");
