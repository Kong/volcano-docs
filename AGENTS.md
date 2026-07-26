# Agent instructions

## Docs content

Authored content lives in `content/get-started` and `content/index.md`. The
`platform`, `sdk`, `cli`, and `ai` sections are synced from their source repos
(see `docs.config.yaml`) and must not be hand-edited here. All docs follow
[`spec/markdown-format.md`](spec/markdown-format.md).

## Code style (matches volcano-web)

App source in `src/` follows the Volcano house style, enforced by ESLint
(`eslint.config.mjs`, rules mirrored from volcano-web):

- Declare prop shapes with `type`, not `interface`.
- Declare React components with the `function` keyword, not an arrow-function const.
- No inline `style` props except CSS custom properties (`--var`).
- No arbitrary visual Tailwind values (`text-[#fff]`, `text-[12px]`) — use tokens/classes.
- Avoid ternaries (prefer if/else, early returns, or `&&` for JSX); nested ternaries are an error.
- Extract named handlers instead of inline arrow functions in JSX props.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` — ESLint (house style)
- `pnpm lint:docs <dir>` — validate markdown against the format contract

Conventional Commits are enforced via commitlint (husky `commit-msg` hook).
