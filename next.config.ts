import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
  async redirects() {
    return [
      // Autofix was renamed LavaFlow; keep links to the old guide working.
      {
        source: "/platform/guides/autofix",
        destination: "/platform/guides/lavaflow",
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
