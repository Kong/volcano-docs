// A recipe's card and header say what it builds (`kind`) and the Volcano
// resources it leans on most (`uses`, at most three, most important first).
// Both are small fixed vocabularies rather than free-form `tags`, so the pills
// stay consistent across recipes; `tags` stay free-form and only feed search.
//
// Shared with spec/frontmatter.schema.json, which validates authored recipes
// against the same lists; recipe-meta.test.mjs keeps the two in step.
export const RECIPE_KINDS = [
  { slug: "agent", label: "Agent" },
  { slug: "app", label: "App" },
];

export const RECIPE_RESOURCES = [
  { slug: "functions", label: "Functions" },
  { slug: "durable-functions", label: "Durable" },
  { slug: "database", label: "Database" },
  { slug: "auth", label: "Auth" },
  { slug: "storage", label: "Storage" },
  { slug: "realtime", label: "Realtime" },
  { slug: "sandboxes", label: "Sandboxes" },
];

export const RECIPE_USES_MAX = 3;

export const RECIPE_KIND_SLUGS = RECIPE_KINDS.map(function toSlug(kind) {
  return kind.slug;
});

export const RECIPE_RESOURCE_SLUGS = RECIPE_RESOURCES.map(function toSlug(resource) {
  return resource.slug;
});

/**
 * @param {{ slug: string, label: string }[]} list
 * @param {string} slug
 */
function labelIn(list, slug) {
  const match = list.find(function bySlug(entry) {
    return entry.slug === slug;
  });
  if (match) return match.label;
  return slug;
}

/** @param {string} slug */
export function recipeKindLabel(slug) {
  return labelIn(RECIPE_KINDS, slug);
}

/** @param {string} slug */
export function recipeResourceLabel(slug) {
  return labelIn(RECIPE_RESOURCES, slug);
}
