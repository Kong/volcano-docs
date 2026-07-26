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
input. See [`.github/workflows/sync-docs.yml`](.github/workflows/sync-docs.yml).

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

1. Land the format contract + sync job (this repo). ← we are here
2. Reformat docs in each source repo to match; add the authoring note from
   [`spec/AGENTS.snippet.md`](spec/AGENTS.snippet.md) to each repo's `AGENTS.md`.
3. Set `DOCS_SYNC_TOKEN` (read access to source repos) if any are private.
4. Pick and wire the generator.
