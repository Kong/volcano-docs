/**
 * @param {string} pathname
 * @returns {"docs" | "cookbooks" | "blog"}
 */
export function getSearchSection(pathname) {
  const path = pathname.split(/[?#]/, 1)[0];
  if (path === "/cookbook" || path.startsWith("/cookbook/")) return "cookbooks";
  if (path === "/blog" || path.startsWith("/blog/")) return "blog";
  return "docs";
}

/** @param {ReturnType<typeof getSearchSection>} section */
export function getSearchLabel(section) {
  if (section === "cookbooks") return "Search the cookbook";
  if (section === "blog") return "Search blog";
  return "Search docs";
}

/** @param {ReturnType<typeof getSearchSection>} section */
export function getSearchTags(section) {
  return [section];
}
