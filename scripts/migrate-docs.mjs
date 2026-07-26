#!/usr/bin/env node
// One-time migration: bring a repo's docs into the Volcano docs format.
// Usage: node scripts/migrate-docs.mjs <dir>
//   - adds frontmatter: title (from the H1), description (seeded from the first
//     paragraph — REVIEW these), leaving the rest for authors
//   - removes the body H1
//   - gives bare code fences a language (heuristic; REVIEW bash/json guesses)
//   - deletes .DS_Store
// Idempotent: files that already have frontmatter are left untouched.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/migrate-docs.mjs <dir>");
  process.exit(2);
}

const q = (s) => JSON.stringify(s); // valid YAML double-quoted scalar
const stripMd = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> text
    .replace(/[`*]/g, "") // drop code/emphasis markers, but keep _ (identifiers)
    .replace(/\s+/g, " ")
    .trim();

function detectLang(line) {
  const t = line.trim().replace(/^\$\s*/, "");
  if (
    /^(curl|npm|pnpm|bun|yarn|brew|export|cd|volcano|git|docker|kubectl|psql|createdb|ls|cat|echo|mkdir|sudo|apt|pip|python|node|make|go|terraform)\b/.test(t)
  )
    return "bash";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "text";
}

function prettify(base) {
  return base
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Fence-aware line walk: calls fn(line, i, inFence).
function eachLine(lines, fn) {
  let inFence = false;
  let ch = "";
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^(`{3,}|~{3,})(.*)$/);
    if (f) {
      const opening = !inFence;
      if (opening) {
        inFence = true;
        ch = f[1][0];
      } else if (f[1][0] === ch) inFence = false;
      fn(lines[i], i, !opening && inFence, f);
      continue;
    }
    fn(lines[i], i, inFence, null);
  }
}

function migrate(file) {
  const text = fs.readFileSync(file, "utf8");
  if (text.startsWith("---\n")) return false; // already has frontmatter

  let lines = text.split("\n");

  // 1. title from first H1 (fence-aware); remove that line.
  let title = prettify(path.basename(file));
  let h1 = -1;
  eachLine(lines, (line, i, inFence) => {
    if (h1 === -1 && !inFence && /^# /.test(line)) {
      h1 = i;
      title = line.replace(/^#\s+/, "").replace(/\s+#+\s*$/, "").trim();
    }
  });
  if (h1 !== -1) lines.splice(h1, 1);

  // 2. description from the first prose paragraph (fence-aware).
  let paraStart = -1;
  eachLine(lines, (line, i, inFence) => {
    if (paraStart !== -1 || inFence) return;
    const t = line.trim();
    if (t === "" || /^[#>|\-*]/.test(t) || /^\d+\./.test(t) || /^(`{3,}|~{3,})/.test(t)) return;
    paraStart = i;
  });
  let desc = title;
  if (paraStart !== -1) {
    const para = [];
    for (let i = paraStart; i < lines.length && lines[i].trim() !== ""; i++) para.push(lines[i]);
    desc = stripMd(para.join(" "));
  }
  if (desc.length > 160) {
    const cut = desc.slice(0, 160);
    const sentence = cut.lastIndexOf(". ");
    if (sentence > 80) {
      desc = cut.slice(0, sentence + 1);
    } else {
      // truncate at a word boundary, never mid-word
      const word = cut.slice(0, 157).lastIndexOf(" ");
      desc = cut.slice(0, word > 0 ? word : 157).trimEnd() + "…";
    }
  }

  // 3. give bare opening fences a language.
  const out = [];
  let inFence = false;
  let ch = "";
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^(`{3,}|~{3,})(.*)$/);
    if (f && !inFence) {
      inFence = true;
      ch = f[1][0];
      if (f[2].trim() === "") {
        let lang = "text";
        for (let j = i + 1; j < lines.length && !/^(`{3,}|~{3,})/.test(lines[j]); j++) {
          if (lines[j].trim() !== "") {
            lang = detectLang(lines[j]);
            break;
          }
        }
        out.push(f[1] + lang);
        continue;
      }
    } else if (f && inFence && f[1][0] === ch) {
      inFence = false;
    }
    out.push(lines[i]);
  }

  // 4. drop leading blank lines, prepend frontmatter.
  let body = out.join("\n").replace(/^\n+/, "");
  const fm = `---\ntitle: ${q(title)}\ndescription: ${q(desc)}\n---\n\n`;
  fs.writeFileSync(file, fm + body);
  return true;
}

let changed = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === ".DS_Store") fs.rmSync(p);
    else if (e.name.endsWith(".md")) {
      if (migrate(p)) {
        changed++;
        console.log("migrated " + p);
      }
    }
  }
}

walk(dir);
console.log(`\n${changed} file(s) migrated. Review seeded descriptions and fence languages.`);
// ponytail: description seed = first paragraph, fence lang = keyword heuristic.
// Both are starting points for human/LLM review, not authoritative.
