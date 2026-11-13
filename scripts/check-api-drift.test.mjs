// Run: node --test scripts/check-api-drift.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  missingPreviewCodes,
  missingRuntimes,
  postgresExampleProblems,
  postgresOverviewProblems,
  previewErrorCodes,
} from "./check-api-drift.mjs";

const openapi = {
  paths: {
    "/projects/{id}/functions/{functionId}/candidates": {
      post: {
        responses: {
          404: { description: "Not found (`code: feature_unavailable`)" },
          409: { description: "`code: candidate_name_taken` - taken. `code: function_deleting` - deleting." },
          429: { description: "Too many requests (code `build_minutes_exceeded`)" },
        },
      },
    },
    "/projects/{id}/functions/{functionId}/serving/rollback": {
      post: { responses: { 409: { description: "`code: nothing_to_roll_back` - nothing." } } },
    },
    "/projects/{id}/functions/{functionId}/variables": {
      put: { responses: { 409: { description: "`code: function_served_by_candidate` - served." } } },
    },
    "/projects/{id}/frontends/{frontendId}/candidates": {
      post: { responses: { 409: { description: "`code: frontend_served_by_candidate` - other page." } } },
    },
    "/projects/{id}/functions/{functionId}/serving": {
      get: { responses: { 409: { description: "`code: serving_only` - not the rollback." } } },
    },
    "/projects/{id}/functions/{functionId}": {
      delete: { responses: { 409: { description: "`code: deployment_in_progress` - not a preview." } } },
    },
  },
};

test("collects the codes of the function preview operations", () => {
  assert.deepEqual(previewErrorCodes(openapi), {
    operationCodes: [
      "build_minutes_exceeded",
      "candidate_name_taken",
      "feature_unavailable",
      "function_deleting",
      "nothing_to_roll_back",
    ],
    writeCodes: ["function_served_by_candidate"],
  });
});

test("keeps the variable write code apart when no preview route matches", () => {
  const spec = {
    paths: {
      "/projects/{projectId}/functions/{functionId}/candidates": {
        post: { responses: { 409: { description: "`code: candidate_name_taken` - renamed path." } } },
      },
      "/projects/{id}/functions/{functionId}/variables": openapi.paths["/projects/{id}/functions/{functionId}/variables"],
    },
  };
  assert.deepEqual(previewErrorCodes(spec), {
    operationCodes: [],
    writeCodes: ["function_served_by_candidate"],
  });
});

test("ignores success responses", () => {
  const spec = {
    paths: {
      "/projects/{id}/functions/{functionId}/candidates": {
        get: { responses: { 200: { description: "Unlike `code: stale_revision`." } } },
      },
    },
  };
  assert.deepEqual(previewErrorCodes(spec), { operationCodes: [], writeCodes: [] });
});

test("finds codes without a row in the Code column", () => {
  const page = [
    "Prose naming `code: stale_revision` is not a row.",
    "",
    "| Status | Code | Why |",
    "| ------ | ---- | --- |",
    "| `409`  | `candidate_in_use` | In use. |",
    "| `409`  | `function_deleting` | `already_serving` starts this cell, but is not a code row. |",
  ].join("\n");
  assert.deepEqual(
    missingPreviewCodes(page, ["already_serving", "candidate_in_use", "function_deleting", "stale_revision"]),
    ["already_serving", "stale_revision"],
  );
});

test("finds runtimes a page does not name", () => {
  const runtimes = [{ name: "nodejs24.x" }, { name: "ruby4.0" }];
  assert.deepEqual(missingRuntimes("Use nodejs24.x.", runtimes), ["ruby4.0"]);
});

const versions = [
  { version: "18", default: true },
  { version: "17" },
  { version: "16" },
];

const overview = `
| Feature    | Description                                   |
| ---------- | --------------------------------------------- |
| PostgreSQL | Full compatibility (versions 16, 17, and 18) |

### PostgreSQL versions

| Version | Status                         |
| ------- | ------------------------------ |
| 18      | Latest; marked \`default\`     |
| 17      | Supported                      |
| 16      | Supported                      |

Text after the table.

## Next section

| 15 | not part of the versions table |
`;

test("accepts an overview that matches", () => {
  assert.deepEqual(postgresOverviewProblems(overview, versions), []);
});

test("reports a stale feature row and versions table", () => {
  const stale = [{ version: "19", default: true }, ...versions.map((v) => ({ version: v.version }))];
  assert.deepEqual(postgresOverviewProblems(overview, stale), [
    'the "| PostgreSQL |" feature row names 16, 17, 18',
    "the PostgreSQL versions table lists 18, 17, 16",
    "the PostgreSQL versions table marks 18 as default, not 19",
  ]);
});

test("reports a missing versions section", () => {
  assert.deepEqual(postgresOverviewProblems("| PostgreSQL | 16, 17, 18 |", versions), [
    'has no "### PostgreSQL versions" section',
  ]);
});

function creating(example) {
  return [
    "## List Available PostgreSQL Versions",
    "",
    "```bash",
    "# A shell comment is not a heading.",
    "curl https://api.volcano.dev/databases/postgres-versions",
    "```",
    "",
    "```json",
    JSON.stringify(example),
    "```",
    "",
    "## Create a Database",
    "",
  ].join("\n");
}

test("accepts an example response that matches", () => {
  const example = [{ version: "18", default: true }, { version: "17" }, { version: "16" }];
  assert.deepEqual(postgresExampleProblems(creating(example), versions), []);
});

test("reports a stale example response", () => {
  const example = [{ version: "17", default: true }, { version: "16" }];
  assert.deepEqual(postgresExampleProblems(creating(example), versions), [
    "the example response lists 17, 16",
    "the example response marks 17 as default",
  ]);
});

test("reports an example response that is not JSON", () => {
  const page = "## List Available PostgreSQL Versions\n\n```json\n[{,]\n```\n";
  const [problem] = postgresExampleProblems(page, versions);
  assert.match(problem, /^the example response is not valid JSON/);
});
