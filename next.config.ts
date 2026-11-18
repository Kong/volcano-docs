import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

import { markdownRewrite } from "./src/lib/markdown-rewrite.mjs";
import { DOCS_SECTIONS } from "./src/lib/site-routes.mjs";

const withMDX = createMDX();

const docsSections = DOCS_SECTIONS.join("|");

// The social card reads its logo from public/ when it renders (see
// src/app/_og/social-card.tsx). Next.js does not trace that read, and the
// server runs from its traces, so name the file here.
// scripts/check-server-traces.mjs fails the build if it goes missing.
const socialCardFiles = ["./public/docs/design/logo-mark.svg"];

const config: NextConfig = {
  outputFileTracingIncludes: {
    "/docs/opengraph-image": socialCardFiles,
    "/docs/twitter-image": socialCardFiles,
  },
  // Docs pages moved under /docs and recipes to /cookbook so the site can be
  // mounted on volcano.dev at /docs, /blog, and /cookbook (see
  // src/lib/site-routes.mjs). Keep links to the old paths working.
  async redirects() {
    return [
      { source: "/", destination: "/docs", permanent: true },
      {
        source: `/:section(${docsSections})/:path*`,
        destination: "/docs/:section/:path*",
        permanent: true,
      },
      {
        source: `/:section(${docsSections}).md`,
        destination: "/docs/:section.md",
        permanent: true,
      },
      // search-index.gz too: tabs opened before the move still fetch it there.
      // The social cards and design assets moved with the docs; shared links
      // and cached previews still name the old paths.
      {
        source: "/:file(llms.txt|llms-full.txt|sitemap.xml|search-index.gz|opengraph-image|twitter-image)",
        destination: "/docs/:file",
        permanent: true,
      },
      { source: "/design/:path*", destination: "/docs/design/:path*", permanent: true },
      { source: "/cookbooks", destination: "/cookbook", permanent: true },
      { source: "/cookbooks/:path*", destination: "/cookbook/:path*", permanent: true },
      // Short links volcano.dev redirected itself before it mounted /docs.
      ...Object.entries({
        "/docs/api/sdk": "/docs/sdk/js",
        "/docs/durable-approvals": "/docs/platform/functions/durable-approvals",
        "/docs/durable-functions": "/docs/platform/functions/durable-functions",
        "/docs/edge-functions": "/docs/platform/functions/overview",
        "/docs/getting-started": "/docs/get-started",
        "/docs/quick-start": "/docs/get-started/quickstart",
      }).map(([source, destination]) => ({ source, destination, permanent: false })),
    ];
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
