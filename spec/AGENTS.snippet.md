<!-- Paste this section into each source repo's AGENTS.md. -->

## Documentation

Docs in `docs/` are synced to the developer docs site (`Kong/volcano-docs`) by
CI. When you change behavior, update the matching doc in the same PR.

Every doc must follow the Volcano docs format
(https://github.com/Kong/volcano-docs/blob/main/spec/markdown-format.md):

- YAML frontmatter with **`title`** and **`description`** (both required).
- **No H1 in the body** — the title comes from frontmatter; start at `##`.
- `kebab-case.md` filenames; `_index.md` for a section landing.
- Every fenced code block declares a language.

CI validates frontmatter against the schema and fails the sync on malformed docs.
