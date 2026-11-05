import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

import { markdownRewrite } from "./src/lib/markdown-rewrite.mjs";

const withMDX = createMDX();

// The social card reads its logo from public/ when it renders (see
// src/app/_og/social-card.tsx). Next.js does not trace that read, and the
// server runs from its traces, so name the file here.
// scripts/check-server-traces.mjs fails the build if it goes missing.
const socialCardFiles = ["./public/design/logo-mark.svg"];

const config: NextConfig = {
  outputFileTracingIncludes: {
    "/opengraph-image": socialCardFiles,
    "/twitter-image": socialCardFiles,
  },
  async rewrites() {
    return [
      // /<slug>.md serves the page's markdown for agents (see the alternate
      // link in each page's head).
      markdownRewrite,
    ];
  },
};

export default withMDX(config);
