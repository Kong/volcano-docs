# Volcano Developer Docs

Assembly point and format contract for the Volcano developer documentation
site. Content is authored **in each product repo** and pulled in here by CI;
this repo owns the shared structure, the markdown format contract, and the
cross-surface intro pages.

## How it works

```
source repos (own their docs, follow the contract)
        │  daily sync — a per-repo subtree copy into content/<section>/,
        │  committed by the bot (manual escape hatch available)
        ▼
volcano-docs (this repo: contract + assembly + get-started + synced content)
        │  build — Hugo / Docusaurus / Starlight / Next.js in volcano-web (TBD)
        ▼
developer docs site
```

Sync runs on a **daily schedule** rather than on every merge to `main`, to keep
commit noise low. Need it sooner? Trigger the **Sync docs** workflow manually
(`workflow_dispatch`) — optionally scoped to a single section via the `source`
input. Each run opens a PR that **auto-merges**. Source repos are internal, so
the job authenticates as the **Kong GitHub App**. See
[`.github/workflows/sync-docs.yml`](.github/workflows/sync-docs.yml).

The serving layer is intentionally **not decided yet**. The markdown format
([`spec/markdown-format.md`](spec/markdown-format.md)) uses neutral frontmatter
fields so any generator can consume it with a thin adapter — the choice between
a standalone static site and a route inside `volcano-web` stays open.

## Section → source repo

| Section | Source repo | Path | Owns |
| --- | --- | --- | --- |
| `content/get-started/` | **this repo** | — | Cross-surface intro |
| `content/platform/` | `Kong/volcano-hosting` | `docs/` | Platform concepts + API reference |
| `content/sdk/js/` | `Kong/volcano-sdk-js` | `docs/` | JavaScript/TypeScript SDK |
| `content/cli/` | `Kong/volcano-cli` | `docs/` | CLI reference |
| `content/ai/skills/` | `Kong/volcano-skills` | `*/SKILL.md` | Agent skills |
| `content/ai/plugins/` | `Kong/volcano-agentic-plugins` | READMEs | IDE / assistant plugins |

The mapping is defined machine-readably in [`docs.config.yaml`](docs.config.yaml).

## Editing docs

- **Product docs** (platform, sdk, cli, ai): edit them in their source repo,
  following [`spec/markdown-format.md`](spec/markdown-format.md). The sync bot
  commits them here — do not hand-edit `content/platform`, `content/sdk`,
  `content/cli`, or `content/ai`; they are overwritten on every sync.
- **Intro pages**: edit [`content/get-started/`](content/get-started) here.

## Rollout

1. Land the format contract + sync job + tooling (this repo). ← we are here
2. In each source repo: run [`scripts/migrate-docs.mjs`](scripts/migrate-docs.mjs)
   to reformat `docs/`, add the [`spec/ci-caller.example.yml`](spec/ci-caller.example.yml)
   lint workflow, and paste [`spec/AGENTS.snippet.md`](spec/AGENTS.snippet.md)
   into the repo's `AGENTS.md`.
3. Install the Kong GitHub App on `volcano-docs` and every source repo, and set
   `KONG_GH_APP_ID` + `KONG_GH_APP_PRIVATE_KEY` secrets.
4. Pick and wire the generator.

## Site (Fumadocs)

The site is a [Fumadocs](https://fumadocs.dev) app that reads the assembled
`content/` tree. Stack and conventions mirror `volcano-web`: pnpm, Node 24, Tailwind
v4, App Router with `src/`, ESLint flat config, and Conventional Commits.

```bash
make install
make dev      # http://localhost:4000  (override: make dev PORT=5000)
make build    # production build (also regenerates .source)
make lint     # eslint
make check    # lint + build (pre-PR)
make          # list all targets
```

Structure:

- `src/app` — App Router (`layout.tsx`, `(docs)` group, `[[...slug]]` renderer, `api/search`).
- `src/lib/source.ts` — Fumadocs loader over `content/` (mounted at `/`).
- `source.config.ts` — Fumadocs MDX config; `.source/` is generated (gitignored).
- Custom branding/UI is intentionally deferred — this is the default theme.

**Version note:** Fumadocs 16 hard-requires Next 16, so the site is on Next 16 +
React 19.2 rather than `volcano-web`'s Next 15.5. Every other convention matches.

## Tooling

- [`scripts/lint-docs.mjs`](scripts/lint-docs.mjs) — validates docs against the
  contract; run by every source repo via the reusable
  [`.github/workflows/lint-docs.yml`](.github/workflows/lint-docs.yml).
- [`scripts/migrate-docs.mjs`](scripts/migrate-docs.mjs) — one-time reformat of a
  repo's `docs/` (frontmatter, H1 removal, fence languages). Seeds are for review.
