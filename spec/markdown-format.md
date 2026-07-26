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
- `_index.md` is the section (directory) landing page. Its `title`/`description`
  describe the whole section.
- Images and other assets go in an `assets/` folder next to the doc and are
  referenced relatively: `![diagram](./assets/flow.png)`.
- No `.DS_Store` or editor cruft in `docs/`.

## Links

- Within the same section: relative, keep the `.md` extension — `./quickstart.md`.
  The builder rewrites these to site URLs.
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

## Consumer notes

- **Generators**: any of the above map cleanly from the neutral fields; the
  serving layer is not chosen yet, which is why the schema avoids
  tool-specific field names.
- **`volcano` CLI**: `internal/docs` reads these files raw for `volcano docs
  search` and currently derives the title from the first H1 with no frontmatter
  support. Rolling out this format requires that parser to (1) skip a leading
  frontmatter block and (2) prefer the frontmatter `title`. Track as a
  follow-up in `Kong/volcano-cli` before removing H1s there.
