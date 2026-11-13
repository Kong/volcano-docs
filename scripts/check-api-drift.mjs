// Checks pages that list values the production API serves against that API.
// Hosting kept these checks while the pages lived there; docs merge when a
// change reaches production, so production is the reference.
//
// Run: node scripts/check-api-drift.mjs [content-dir]
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import yaml from "js-yaml";

const API = "https://api.volcano.dev";

// Function preview operations: creating, listing, deploying and deleting
// previews, promoting one, and rolling back.
const PREVIEW_PATH = /^\/projects\/\{id\}\/functions\/\{functionId\}\/(candidates|serving)(\/|$)/;
// The code refusing a variable write because a promoted preview serves the
// function. Frontend and source previews have codes of their own.
const SERVED_BY_PREVIEW_CODE = /^function_served_by_candidate$/;
const CODE = /`code: ([a-z_]+)`|code `([a-z_]+)`/g;

function codesIn(text) {
  return [...text.matchAll(CODE)].map((m) => m[1] ?? m[2]);
}

// Every error code the OpenAPI document names for the function preview API.
export function previewErrorCodes(openapi) {
  const codes = new Set();
  for (const [route, operations] of Object.entries(openapi.paths ?? {})) {
    for (const operation of Object.values(operations)) {
      for (const [status, response] of Object.entries(operation?.responses ?? {})) {
        if (!/^4\d\d$/.test(status)) continue;
        for (const code of codesIn(JSON.stringify(response))) {
          if (PREVIEW_PATH.test(route) || SERVED_BY_PREVIEW_CODE.test(code)) codes.add(code);
        }
      }
    }
  }
  return [...codes].sort();
}

// Codes with no table row in the previews guide.
export function missingPreviewCodes(previewsPage, codes) {
  const rows = previewsPage.split("\n").filter((line) => line.startsWith("|"));
  return codes.filter((code) => !rows.some((row) => row.includes(`| \`${code}\``)));
}

// Runtime IDs a page does not mention.
export function missingRuntimes(page, runtimes) {
  return runtimes.map((r) => r.name).filter((name) => !page.includes(name));
}

// The text under a heading, up to the next heading of the same or higher level.
function section(page, heading) {
  const lines = page.split("\n");
  const start = lines.indexOf(heading);
  if (start === -1) return undefined;
  const level = heading.match(/^#+/)[0].length;
  const rest = lines.slice(start + 1).join("\n");
  const end = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  if (end === -1) return rest;
  return rest.slice(0, end);
}

function sameList(a, b) {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

// Problems in databases/overview.md against GET /databases/postgres-versions.
export function postgresOverviewProblems(page, versions) {
  const supported = versions.map((v) => v.version);
  const preferred = versions.find((v) => v.default)?.version;
  const problems = [];

  const feature = page.split("\n").find((line) => /^\| PostgreSQL\s*\|/.test(line));
  const named = feature?.match(/\b\d{2}\b/g) ?? [];
  if (!sameList(named, supported)) {
    problems.push(`the "| PostgreSQL |" feature row names ${named.join(", ") || "no versions"}`);
  }

  const table = section(page, "### PostgreSQL versions");
  if (table === undefined) {
    problems.push(`has no "### PostgreSQL versions" section`);
    return problems;
  }
  const rows = table
    .split("\n")
    .map((line) => line.match(/^\|\s*(\d+)\s*\|(.*)\|\s*$/))
    .filter(Boolean);
  const listed = rows.map((row) => row[1]);
  if (!sameList(listed, supported)) {
    problems.push(`the PostgreSQL versions table lists ${listed.join(", ") || "no versions"}`);
  }
  const markedDefault = rows.filter((row) => /\bdefault\b/.test(row[2])).map((row) => row[1]);
  if (!sameList(markedDefault, [preferred])) {
    problems.push(
      `the PostgreSQL versions table marks ${markedDefault.join(", ") || "no version"} as default, not ${preferred}`,
    );
  }
  return problems;
}

// Problems in the example response in databases/creating-databases.md.
export function postgresExampleProblems(page, versions) {
  const body = section(page, "## List Available PostgreSQL Versions");
  if (body === undefined) return [`has no "## List Available PostgreSQL Versions" section`];
  const block = body.match(/```json\n([\s\S]*?)```/);
  if (!block) return ["the List Available PostgreSQL Versions section has no JSON example"];
  let example;
  try {
    example = JSON.parse(block[1]);
  } catch (error) {
    return [`the example response is not valid JSON: ${error.message}`];
  }
  const problems = [];
  const listed = example.map((v) => v.version);
  if (!sameList(listed, versions.map((v) => v.version))) {
    problems.push(`the example response lists ${listed.join(", ")}`);
  }
  const exampleDefault = example.filter((v) => v.default === true).map((v) => v.version);
  const preferred = versions.filter((v) => v.default).map((v) => v.version);
  if (!sameList(exampleDefault, preferred)) {
    problems.push(`the example response marks ${exampleDefault.join(", ") || "no version"} as default`);
  }
  return problems;
}

async function get(route, parse) {
  const response = await fetch(`${API}${route}`);
  if (!response.ok) throw new Error(`GET ${API}${route} answered ${response.status}`);
  return parse(await response.text());
}

async function main() {
  const content = path.resolve(process.argv[2] ?? "content/platform");
  const read = (page) => fs.readFileSync(path.join(content, page), "utf8");

  const [openapi, runtimes, versions] = await Promise.all([
    get("/openapi.yaml", (text) => yaml.load(text)),
    get("/functions/runtimes", (text) => JSON.parse(text).runtimes),
    get("/databases/postgres-versions", (text) => JSON.parse(text)),
  ]);

  const failures = [];
  function report(page, problems) {
    for (const problem of problems) failures.push(`${page}: ${problem}`);
  }

  const codes = previewErrorCodes(openapi);
  if (codes.length === 0) {
    failures.push("the production OpenAPI document names no function preview error codes");
  }
  report(
    "functions/previews.md",
    missingPreviewCodes(read("functions/previews.md"), codes).map(
      (code) => `the error code table has no row for \`${code}\``,
    ),
  );

  for (const page of ["functions/overview.md", "functions/upload-api.md"]) {
    report(page, missingRuntimes(read(page), runtimes).map((name) => `does not list the ${name} runtime`));
  }

  const served = `production serves ${versions.map((v) => v.version).join(", ")}`;
  report(
    "databases/overview.md",
    postgresOverviewProblems(read("databases/overview.md"), versions).map((p) => `${p}; ${served}`),
  );
  report(
    "databases/creating-databases.md",
    postgresExampleProblems(read("databases/creating-databases.md"), versions).map((p) => `${p}; ${served}`),
  );

  if (failures.length > 0) {
    console.error(`These pages disagree with ${API}:\n`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Pages match ${API}: ${codes.length} preview error codes, ${runtimes.length} runtimes, ` +
      `${versions.length} PostgreSQL versions.`,
  );
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  await main();
}
