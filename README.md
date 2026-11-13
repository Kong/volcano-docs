# Volcano Developer Docs

The Volcano developer documentation site and all of its content. Every page is
written in this repository, and a push to `main` deploys it.

## How it works

```
volcano-docs (this repo: every page, the format contract, the site)
        │  push to main — Volcano Git auto-deploy builds the Fumadocs site
        ▼
developer docs site
```

The site is a standalone [Fumadocs](https://fumadocs.dev) app (see
[Site](#site-fumadocs)) that Volcano deploys from this repository (see
[Deployment](#deployment)). Pages follow the markdown format in
[`spec/markdown-format.md`](spec/markdown-format.md) and the writing rules in
[`spec/writing.md`](spec/writing.md).

## Sections

| Section | Covers | Product repo |
| --- | --- | --- |
| `content/get-started/` | Cross-surface intro | — |
| `content/platform/` | Platform concepts, guides, API reference, example apps | `Kong/volcano-hosting` |
| `content/sdk/index.md` | SDK language selector and runtime requirements | — |
| `content/sdk/js/` | JavaScript/TypeScript SDK | `Kong/volcano-sdk-js` |
| `content/sdk/python/` | Python SDK | `Kong/volcano-sdk-python` |
| `content/sdk/ruby/` | Ruby SDK | `Kong/volcano-sdk-ruby` |
| `content/cli/` | CLI reference | `Kong/volcano-cli` |
| `content/cookbooks/`, `content/blog/` | Recipes and posts | — |

The product repos no longer carry published docs. The full OpenAPI document is
served by the API at `https://api.volcano.dev/openapi.yaml`; the API reference
pages link to it instead of copying it.

## Editing docs

- **A product change that users see** (an endpoint, a CLI flag, an SDK method, a
  new limit) gets a companion PR here that updates the affected pages. Merge it
  when the change is released, not before: a push to `main` publishes it.
- **Docs-only fixes** go straight to a PR here.
- **SDK landing page**: edit [`content/sdk/index.md`](content/sdk/index.md) when a
  language's runtime requirements or shared capabilities change. Check the
  claims against its package metadata.
- **Example apps** in [`content/platform/examples/`](content/platform/examples)
  are type-checked by [`.github/workflows/examples.yml`](.github/workflows/examples.yml)
  when a PR changes them.

## Deployment

Volcano deploys the site from this repository. The staging and production
`volcano-docs` Volcano projects are connected to `Kong/volcano-docs` with Git
auto-deploy: every push to `main` builds and deploys the `docs` frontend from the
repository root, to [docs.staging.volcano.dev](https://docs.staging.volcano.dev)
and [docs.volcano.dev](https://docs.volcano.dev). Each deployment records the
commit it was built from. The build settings live in each project's **Project
settings → Git** page in the Volcano dashboard, and `DOCS_SITE_URL` is a project
variable there.

## Site (Fumadocs)

The site is a [Fumadocs](https://fumadocs.dev) app that reads the assembled
`content/` tree. Stack and conventions mirror `volcano-web`: pnpm, Node 24, Tailwind
v4, App Router with `src/`, ESLint flat config, and Conventional Commits.

```bash
make install
make dev      # http://localhost:3030  (override: make dev PORT=5000)
make build    # production build (also regenerates .source)
make lint     # eslint
make check    # lint + build (pre-PR)
make          # list all targets
```

Structure:

- `src/app` — App Router (`layout.tsx`, `(docs)` group, `[[...slug]]` renderer, `api/search`).
- `src/lib/source.ts` — Fumadocs loader over `content/` (mounted at `/`).
- `source.config.ts` — Fumadocs MDX config; `.source/` is generated (gitignored).
- Custom UI uses the design tokens in `src/app/theme.css` alongside Fumadocs primitives.

### Docs, Cookbooks, and Blog

The shared header links three sections while preserving existing docs URLs:

- `/` and the existing guide routes use the documentation sidebar.
- `/cookbooks` lists recipes; recipe pages use their own sidebar and table of contents.
- `/blog` lists posts; both the listing and articles share a Blog sidebar with search, All posts, and the categories with counts.

Author recipes in `content/cookbooks/` and posts in `content/blog/`.
Each section's `index.md` provides its introduction, and `meta.json` controls the card and navigation order.
Keep `"..."` at the end of each section's `meta.json` page list so new Markdown pages appear automatically after explicitly ordered pages in the listing and navigation tree, using their frontmatter title and description.
Cookbooks uses that tree for its sidebar; Blog lists its categories there.
All sections share search, sitemap generation, relative Markdown link handling, and the raw Markdown API.
Search is scoped to the active section.
The Blog listing and each category page show their title and then the post cards — no introduction, no post count — so `content/blog/index.md` carries only the title and description the page, its metadata and its search entry use.

Blog posts can also include optional metadata:

```yaml
author: Your name
published: "2026-10-19"
category: product
tags: [storage, authentication]
```

The blog displays these fields when provided and includes them in article metadata.
Follow [`spec/markdown-format.md`](spec/markdown-format.md) for the full content contract.

#### Categories and sharing

- **`category`** is a post's single category, from the fixed set in
  [`src/lib/blog-categories.mjs`](src/lib/blog-categories.mjs) (`product`,
  `engineering`, `research`, `company`). It shows on the post and on its card,
  and links to that category's own page at `/blog/category/<slug>`. The sidebar
  lists every category that has posts, with counts. `tags` stay free-form and
  are indexed for search; nothing filters by them in the UI.
- **Share** links on a post open X or LinkedIn with the post's canonical URL,
  or copy that URL. No third-party script is loaded to draw them.

**Version note:** Fumadocs 16 hard-requires Next 16, so the site is on Next 16 +
React 19.2 rather than `volcano-web`'s Next 15.5. Every other convention matches.

## Tooling

- [`scripts/lint-docs.mjs`](scripts/lint-docs.mjs) — validates docs against the
  contract (`pnpm lint:docs content`).
- [`scripts/check-api-drift.mjs`](scripts/check-api-drift.mjs) — checks that the
  pages listing function preview error codes, function runtimes and PostgreSQL
  versions match `https://api.volcano.dev` (`pnpm check:api`). CI runs it on PRs
  that change those pages and daily.
