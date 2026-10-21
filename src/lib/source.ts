import { loader } from "fumadocs-core/source";
import { docs } from "../../.source/server";
import { isPageVisible } from "./content-visibility.mjs";

const content = docs.toFumadocsSource();

// baseUrl "/" mounts the docs at the site root so cross-section links in the
// content (e.g. /platform, /sdk/js) resolve without a /docs prefix.
export const source = loader({
  baseUrl: "/",
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
