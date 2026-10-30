import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
  async rewrites() {
    return [
      // /<slug>.md serves the page's markdown for agents (see the alternate
      // link in each page's head).
      { source: "/:path(.+)\\.md", destination: "/api/llm/:path" },
    ];
  },
};

export default withMDX(config);
