import { loader } from "fumadocs-core/source";
import { docs } from "../../.source/server";
import { isPageVisible } from "./content-visibility.mjs";
import { pageUrl } from "./site-routes.mjs";

const content = docs.toFumadocsSource();

// Docs pages are served under /docs; blog and cookbooks keep their own prefix
// (see site-routes.mjs).
export const source = loader({
  baseUrl: "/",
  url: pageUrl,
  // Filter before loading so routes, navigation, search, sitemap, and raw
  // Markdown endpoints all share the same publication boundary.
  source: {
    ...content,
    files: content.files.filter(function visibleFile(file) {
      return file.type !== "page" || isPageVisible(file.data);
    }),
  },
  pageTree: {
    transformers: [
      {
        folder(node, folderPath) {
          if (folderPath === "platform/api-reference") {
            return { ...node, name: "API reference" };
          }
          return node;
        },
      },
    ],
  },
});
