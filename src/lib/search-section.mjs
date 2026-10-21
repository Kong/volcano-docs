/**
 * @param {string} pathname
 * @returns {"docs" | "cookbooks" | "blog"}
 */
export function getSearchSection(pathname) {
  const path = pathname.split(/[?#]/, 1)[0];
  if (path === "/cookbooks" || path.startsWith("/cookbooks/")) return "cookbooks";
  if (path === "/blog" || path.startsWith("/blog/")) return "blog";
  return "docs";
}

/** @param {ReturnType<typeof getSearchSection>} section */
export function getSearchLabel(section) {
  if (section === "cookbooks") return "Search cookbooks";
  if (section === "blog") return "Search blog";
  return "Search docs";
}

/**
 * @param {ReturnType<typeof getSearchSection>} section
 * @param {string | null} [topic]
 */
export function getSearchTags(section, topic = null) {
  if (section === "blog" && topic) return [section, `blog-topic:${topic}`];
  return [section];
}
