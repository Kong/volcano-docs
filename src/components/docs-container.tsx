"use client";

import type { ComponentProps } from "react";

// Custom layout container matching the design: it applies a grid whose leading
// `header` row spans every column, so the brand bar (and its bottom border)
// runs across the whole page above both the sidebar and content — unlike the
// default docs grid where the header sits above the content column only. The
// grid itself lives in the `docs-grid` utility in global.css.
export function DocsContainer(props: ComponentProps<"div">) {
  return (
    <div id="nd-docs-layout" {...props} className="docs-grid">
      {props.children}
    </div>
  );
}
