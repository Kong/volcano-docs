import type { Root, Node } from "fumadocs-core/page-tree";
import { source } from "@/lib/source";

export type ContentSection = "cookbooks" | "blog";

export function isStandaloneSection(slug?: string[]) {
  return slug?.[0] === "cookbooks" || slug?.[0] === "blog";
}

function belongsToSection(node: Node, section: ContentSection) {
  if (node.type === "page") {
    return node.url === `/${section}` || node.url.startsWith(`/${section}/`);
  }
  if (node.type === "folder") {
    return node.$ref?.folder === section || node.index?.url === `/${section}`;
  }
  return false;
}

export function getDocsTree(): Root {
  return {
    ...source.pageTree,
    children: source.pageTree.children.filter(function keepDocs(node) {
      return !belongsToSection(node, "cookbooks") && !belongsToSection(node, "blog");
    }),
  };
}

export function getSectionTree(section: ContentSection): Root {
  const folder = source.pageTree.children.find(function findSection(node) {
    return node.type === "folder" && belongsToSection(node, section);
  });
  const landing = source.getPage([section]);
  let children: Node[] = [];
  if (folder?.type === "folder") children = folder.children;
  if (landing) {
    children = [
      { type: "page", name: "Overview", url: landing.url },
      ...children.filter(function excludeLanding(node) {
        return node.type !== "page" || node.url !== landing.url;
      }),
    ];
  }
  return { name: section, children };
}

export function getSectionPages(section: ContentSection) {
  const pages = source.getPages().filter(function inSection(page) {
    return page.slugs[0] === section && page.slugs.length > 1;
  });
  const urls: string[] = [];
  function collectUrls(node: Node) {
    if (node.type === "page") urls.push(node.url);
    if (node.type === "folder") {
      if (node.index) urls.push(node.index.url);
      node.children.forEach(collectUrls);
    }
  }
  getSectionTree(section).children.forEach(collectUrls);
  return pages.sort(function byNavigationOrder(a, b) {
    return urls.indexOf(a.url) - urls.indexOf(b.url);
  });
}
