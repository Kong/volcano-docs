"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Footer } from "@/components/home/footer";

// Custom layout container matching the design: it applies a grid whose leading
// `header` row spans every column, so the brand bar (and its bottom border)
// runs across the whole page above both the sidebar and content — unlike the
// default docs grid where the header sits above the content column only.
//
// The home page's footer is rendered here as a direct grid child in a
// full-width trailing `footer` row, so it spans under both the sidebar and
// content (the design's full-bleed footer). It is gated to the home route so
// doc pages keep Fumadocs' own page footer. The grid lives in the `docs-grid`
// utility in global.css.
export function DocsContainer(props: ComponentProps<"div">) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div id="nd-docs-layout" {...props} className="docs-grid">
      {props.children}
      {isHome && (
        <div className="[grid-area:footer]">
          <Footer />
        </div>
      )}
    </div>
  );
}
