import fs from "node:fs";
import path from "node:path";

// Section landings were copied in from product repos as README.md and renamed
// to index.md. Pages still link the README.md names; translate only
// destinations that were actually relocated.
export function relocatedIndexHref(href, file) {
  if (!href || !file || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return href;
  const [, destination, suffix] = href.match(/^([^?#]*)(.*)$/);
  if (path.basename(destination) !== "README.md") return href;
  const target = path.resolve(path.dirname(file), destination);
  if (fs.existsSync(target)) return href;
  if (!fs.existsSync(path.join(path.dirname(target), "index.md"))) return href;
  return destination.slice(0, -"README.md".length) + "index.md" + suffix;
}

export function remarkRelocatedIndex() {
  return function transform(tree, file) {
    function visit(node) {
      if (node.type === "link" || node.type === "definition") {
        node.url = relocatedIndexHref(node.url, file.path);
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}
