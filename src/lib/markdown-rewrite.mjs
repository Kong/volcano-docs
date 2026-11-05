// Kept free of imports so next.config.ts can load it.

/**
 * Serves `/<slug>.md` from the markdown route. `:path*` captures each segment,
 * so `/platform/guides/lavaflow.md` reaches `/api/llm/platform/guides/lavaflow`.
 * A single `:path` holding "/" fails destination validation in OpenNext.
 */
export const markdownRewrite = {
  source: "/:path*.md",
  destination: "/api/llm/:path*",
};
