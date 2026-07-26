# Volcano Docs — Agent Instructions

The Volcano developer docs site: a [Fumadocs](https://fumadocs.dev) app (Next.js
16, React 19, Tailwind v4) that assembles documentation from across the Volcano
repos. Styles and conventions **mirror `volcano-web`** so the two stay visually
and structurally consistent.

---

## Start here (the non-negotiables)

1. **Docs content follows the format contract.** Every doc obeys
   [`spec/markdown-format.md`](spec/markdown-format.md): frontmatter `title` +
   `description`, no body H1, `kebab-case` filenames, fenced code with a language.
2. **Never hardcode a visual value.** In custom UI, every color, spacing, border,
   shadow, radius, and typography value references a design token — never a raw
   `#hex`/`rgb()`, never a Tailwind visual utility, never an inline `style` value.
3. **Match the existing pattern.** New components follow the
   [Component pattern](#component-pattern) and reuse Fumadocs / shared primitives
   before creating new ones.
4. **Keep PRs small and single-purpose.**
5. **Before a PR, run `pnpm lint` and `pnpm build`** (and `pnpm lint:docs <dir>`
   if you touched content).

> Every code rule below is **machine-enforced** (see [Enforcement](#enforcement)).
> The tooling is the authority — if a gate flags you, fix the code, don't work
> around it.

```bash
pnpm lint            # ESLint house style (mirrors volcano-web)
pnpm build           # Next build (also regenerates .source)
pnpm lint:docs <dir> # validate markdown against spec/markdown-format.md
```

---

## Repo layout

| Path | Purpose |
|------|---------|
| `content/` | The docs tree. `get-started` + `index.md` are authored here; `platform`, `sdk`, `cli`, `ai` are **synced** from source repos (`docs.config.yaml`) — do not hand-edit them. |
| `src/app/` | App Router: root layout, `(docs)` group, `[[...slug]]` renderer, `api/search`. |
| `src/lib/` | `source.ts` (Fumadocs loader over `content/`), `layout.shared.tsx`. |
| `source.config.ts` | Fumadocs MDX config; `.source/` is generated (gitignored). |
| `spec/` | Docs format contract + JSON schema. |
| `scripts/` | `lint-docs.mjs`, `migrate-docs.mjs`. |
| `eslint-rules/` | The `volcano/*` custom rules (copied from volcano-web). |

---

## Styling: three-layer token system

The docs currently render with the default Fumadocs theme; **custom UI is
deferred**. When it lands, it follows volcano-web's token model so the docs match
the product.

| Layer | What it is | In components? |
|-------|-----------|----------------|
| **Layer 1 — base units** | Raw scale values (`--space-*`, `--color-<name>-<shade>`, …) | ❌ Never reference directly — they feed Layer 2 |
| **Layer 2 — design tokens** | Semantic intent (`--color-primary*`, `--surface-*`, `--text-*`, `--spacing-*`, …) | ✅ Use these for every visual value |
| **Layer 3 — component vars** | Per-component `--cmp-*` vars declared at the component root, referencing Layer 2 | ✅ Define + apply |

> **Token source (decision for the custom-UI phase):** volcano-docs has no
> `theme.css` yet. Adopt volcano-web's tokens by either depending on
> `@volcano-web/ui` (if published to the internal registry) or vendoring
> `libs/ui/src/theme.css`. Until then, the token rules below are documented but
> only the generic ESLint gates (no inline styles / no arbitrary Tailwind) run.

**Tailwind policy (same as volcano-web):** Tailwind is for **layout/structure
only** (`flex`, `grid`, `gap-*`, `p-*`, `w-*`, …). Never for
color/border/shadow/radius/typography, and never as arbitrary visual values
(`text-[#hex]`, `text-[12px]`). Visuals live in component CSS via tokens.

---

## Component pattern

Every custom component matches this structure.

### CSS (`component-name.css`)

```css
.component-name {
  --cmp-bg: var(--system-bg);
  --cmp-fg: var(--system-fg);
  --cmp-padding: var(--system-padding);

  background: var(--cmp-bg);
  color: var(--cmp-fg);
  padding: var(--cmp-padding);
}

/* Variants/sizes override ONLY the --cmp-* variables, never properties */
.component-name[data-variant="primary"] { --cmp-bg: var(--color-primary); --cmp-fg: var(--color-primary-foreground); }
.component-name[data-size="sm"]          { --cmp-padding: var(--spacing-xs); }
```

### TSX (`component-name.tsx`)

```tsx
import { cn } from "@/lib/cn"; // small classnames merge helper; add when custom UI starts
import "./component-name.css";

type ComponentNameProps = React.ComponentProps<"div"> & {
  variant?: "default" | "primary";
  size?: "default" | "sm";
};

function ComponentName({ className, variant = "default", size = "default", ...props }: ComponentNameProps) {
  return (
    <div
      data-slot="component-name"
      data-variant={variant === "default" ? undefined : variant}
      data-size={size === "default" ? undefined : size}
      className={cn("component-name", className)}
      {...props}
    />
  );
}

export { ComponentName };
```

### Key rules (enforced)

- **Props:** `type` (not `interface`), declared above the function — never inline.
- **Components:** `function` keyword, not arrow-const. Prefer `function` for local helpers too (arrow args to `useCallback`/`useMemo` stay arrows).
- **No inline arrow functions in JSX props** — extract a named handler.
- **Avoid the ternary operator** — prefer early returns / `if`-`else` for values and `&&` for conditional JSX. **Never nest ternaries.**
- **Styling hooks:** `data-variant` / `data-size` (not className variants); `data-slot` on the root.
- **Variants override `--cmp-*` variables only**, never CSS properties directly.

---

## Reuse before building

- **Fumadocs first** — it provides the layout, sidebar, TOC, search, and MDX
  components. Prefer its slots/components over rebuilding chrome.
- For product-consistent UI beyond Fumadocs, follow `@volcano-web/ui` patterns
  (and depend on the package if it's published) rather than re-implementing
  primitives.

---

## Enforcement

Conventions are caught by tooling, not reviewers. Config: `eslint.config.mjs`.

| Gate | Catches | Severity |
|------|---------|----------|
| `volcano/no-inline-styles` | inline `style={{}}` with visual values (only `--var`-only allowed) | error |
| `volcano/no-arbitrary-tailwind` | Tailwind arbitrary **visual** values (`text-[#hex]`, `text-[12px]`) | error |
| `volcano/no-interface-props` | `interface …Props` → require a `type` alias | error |
| `volcano/prefer-function-component` | arrow-const components → require `function` | error |
| `volcano/prefer-function-methods` | arrow-const local helpers → prefer `function` | warn |
| `no-nested-ternary` / `no-ternary` | nested ternaries (error); any ternary (warn) | error / warn |
| `react/jsx-no-bind` | inline arrow / `.bind()` in JSX props | warn (ref callbacks exempt) |
| `jsx-a11y/*` | interactive-element / ARIA problems | warn (`aria-props`/`aria-role` error) |
| `lint:docs` | markdown format contract | error (source repos' PR CI) |
| commitlint | Conventional Commits | error (husky `commit-msg` hook) |

**Why this exists:** prose conventions drift in LLM-generated code. A rule is
reliable only when it is **executable** (lint/CI) or **verified before PR**
(`pnpm lint` + `pnpm build`). When a gate and this doc ever disagree, the gate
wins — update the doc.
