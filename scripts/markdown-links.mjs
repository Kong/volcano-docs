const markdownLinkRe = /\[[^\]]*\]\(([^)\s]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?[ \t]*\)/g;

export function* markdownLinks(text) {
  for (const match of text.matchAll(markdownLinkRe)) yield match[1];
}

export function routePath(url) {
  return url.split("#")[0].split("?")[0];
}
