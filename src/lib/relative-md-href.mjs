// Fumadocs' relative-link resolver (createRelativeLink / source.resolveHref)
// only rewrites hrefs that start with "./" or "../". Synced docs (and their
// GitHub-rendered sources) also use *bare* relative links — "overview.md",
// "auth/config.md#section" — which the resolver leaves untouched, so they 404.
//
// Normalize those to "./"-relative so the resolver can map them to routes. This
// is route-agnostic on purpose: it never computes a route, so the file->route
// rules (index.md, README.md, slugs) stay entirely Fumadocs'. A bare "foo.md"
// and "./foo.md" resolve identically (both relative to the current file), so the
// prefix is a no-op semantically — it just satisfies the resolver's contract.

// href is left untouched when it is external/absolute/in-page, already
// "./"|"../"-relative, or not a Markdown target.
export function ensureRelativeMdHref(href) {
  if (!href) return href;
  if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return href; // scheme, root-absolute, or #anchor
  if (href.startsWith("./") || href.startsWith("../")) return href;
  if (!/\.md(#.*)?$/i.test(href)) return href; // only .md pages (optional #fragment)
  return "./" + href;
}
