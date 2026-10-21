/** @param {string} tag */
export function topicLabel(tag) {
  return tag.replaceAll("-", " ").replace(/^./, function capitalize(character) {
    return character.toUpperCase();
  });
}

/** @param {{ tags?: string[] }[]} posts */
export function collectTopics(posts) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const post of posts) {
    for (const tag of new Set(post.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts, function toTopic([tag, count]) {
    return { tag, label: topicLabel(tag), count };
  }).sort(function byLabel(a, b) {
    return a.label.localeCompare(b.label);
  });
}

/**
 * @param {string | null} topic
 * @param {string} [pathname]
 */
export function blogTopicHref(topic, pathname = "/blog") {
  if (!topic) return pathname;
  const url = new URL(pathname, "https://docs.invalid");
  url.searchParams.set("topic", topic);
  return `${url.pathname}${url.search}${url.hash}`;
}
