import { fromMarkdown } from "mdast-util-from-markdown";

function visit(node, callback) {
  callback(node);
  for (const child of node.children || []) visit(child, callback);
}

export function markdownLinks(text) {
  const tree = fromMarkdown(text);
  const definitions = new Map();
  visit(tree, (node) => {
    if (node.type === "definition") definitions.set(node.identifier, node.url);
  });

  const links = [];
  visit(tree, (node) => {
    let url;
    if (node.type === "link" || node.type === "image") url = node.url;
    if (node.type === "linkReference" || node.type === "imageReference") {
      url = definitions.get(node.identifier);
    }
    if (url) links.push({ url, line: node.position?.start.line || 1 });
  });
  return links;
}

export function routePath(url) {
  return url.split("#")[0].split("?")[0];
}
