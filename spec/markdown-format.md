---
title: Volcano docs markdown format
description: The frontmatter schema and authoring rules every Volcano doc must follow so CI can assemble them into one site.
order: 1
---

This is the contract for every markdown file synced into the Volcano developer
docs. It is **generator-agnostic**: fields are neutral so Hugo, Docusaurus,
Astro Starlight, or a Next.js route in `volcano-web` can each consume it with a
thin adapter. Docs live in their product repo; CI validates against this spec
before syncing.

## Frontmatter

Every doc starts with a YAML frontmatter block delimited by `---`.

```yaml
---
title: Functions
description: Serverless functions that run your backend code on demand.
order: 3
---
```

### Fields

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `title` | string | **yes** | Page title. Rendered as the H1 — do not repeat it in the body. |
| `description` | string (≤ 160 chars) | **yes** | One-line summary for search, SEO, and nav cards. |
| `order` | integer | no | Sort position within its directory. Default: alphabetical. |
| `nav_title` | string | no | Short label for the sidebar when `title` is long. |
| `tags` | string[] | no | Topical grouping / filtering. |
| `keywords` | string[] | no | Extra search synonyms not in the prose. |
| `draft` | boolean | no | `true` hides the page from production builds. |
| `updated` | date (`YYYY-MM-DD`) | no | Last meaningful update. CI may auto-fill from git. |

### Reserved (CI-injected — do not set by hand)

| Field | Purpose |
| --- | --- |
| `source` | `{ repo, path, ref, commit }` stamped at sync time for provenance and "Edit this page" links. |

Generator adapters map the neutral fields: `order` → Hugo `weight` /
Docusaurus `sidebar_position` / Starlight `sidebar.order`; `nav_title` →
`linkTitle` / `sidebar_label`; `draft` is native to most.

## Body rules

- **No H1 in the body.** The title comes from frontmatter; start content at `##`.
- One topic per file. Split large pages rather than nesting many H2s.
- Every fenced code block declares a language (` ```bash `, ` ```ts `, ` ```json `).
- Prose is not hard-wrapped mid-sentence; one sentence or clause per source line is fine, but do not insert manual line breaks to hit a column width.

## Files and naming

- `kebab-case.md` filenames.
- `index.md` is the section (directory) landing page. Its `title`/`description`
  describe the whole section. (`README.md` is also accepted so the page renders
  on GitHub; the sync emits it as `index.md`.) Do not use Hugo's `_index.md` —
  the adapter produces the tool-specific landing name at build time.
- Images and other assets go in an `assets/` folder next to the doc and are
  referenced relatively: `![diagram](./assets/flow.png)`.
- No `.DS_Store` or editor cruft in `docs/`.

## Links

- Within the same section: relative, keep the `.md` extension — `./quickstart.md`.
  Relative `.md` links render on GitHub; the adapter rewrites them to site URLs
  (see below — not every generator does this natively).
- Across sections: site-absolute, no extension — `/sdk/js/authentication`.
- External: full `https://` URLs.

## Example

Before (today):

```markdown
# Functions

Functions are serverless code that runs on AWS Lambda...
```

After (contract):

```markdown
---
title: Functions
description: Serverless code that runs on AWS Lambda, invoked over HTTP.
order: 3
---

Functions are serverless code that runs on AWS Lambda...
```

## Validation

Frontmatter is validated against [`frontmatter.schema.json`](frontmatter.schema.json).
CI fails the sync on: missing `title`/`description`, an H1 in the body, a
fenced block with no language, or a non-kebab-case filename.

## Adapter responsibilities

The format is generator-agnostic: authors write it once, and a thin build-time
adapter normalizes it for whichever tool serves the site (Fumadocs, Docusaurus,
Starlight, Hugo, Nextra). No source doc changes when the tool changes — the
adapter absorbs the three differences below. None of these require
tool-specific fields in the source.

| Neutral input | Adapter must produce |
| --- | --- |
| `order` (frontmatter) | Docusaurus `sidebar_position` / Starlight `sidebar.order` / Hugo `weight` (field rename); **Fumadocs `meta.json` / Nextra `_meta.js`** (generate a per-folder ordering file from the `order` values). |
| `index.md` landing | Keep `index.md` (Docusaurus, Starlight) / `index.mdx` (Fumadocs, Nextra) / rename to `_index.md` (Hugo). |
| Relative `.md` links | Docusaurus rewrites natively; Hugo via render hooks; **Starlight needs the `astro-rehype-relative-markdown-links` rehype plugin**; Fumadocs/Nextra prefer route paths — the adapter rewrites `./x.md` to the final route URL. |

Fit: Fumadocs, Docusaurus, and Starlight support the format with the adapter
above and no source changes. Nextra is the weakest fit (it leans on an in-body
H1 for the title and orders via `_meta.js`), so it needs more adapter work and
cuts against the no-H1 rule.

## Consumer notes

- **`volcano` CLI**: `internal/docs` reads these files raw for `volcano docs
  search` and parses the frontmatter `title` (skipping the block so its YAML
  never becomes searchable text), falling back to the first H1, then the file
  name. Implemented in `Kong/volcano-cli`.
