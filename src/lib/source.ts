import { loader } from "fumadocs-core/source";
import { docs } from "../../.source/server";

// baseUrl "/" mounts the docs at the site root so cross-section links in the
// content (e.g. /platform, /sdk/js) resolve without a /docs prefix.
export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
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
