import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// Reads the assembled docs tree. get-started is authored here; platform, sdk,
// cli, and ai are synced from their source repos (see docs.config.yaml).
export const docs = defineDocs({
  dir: "content",
});

export default defineConfig();
