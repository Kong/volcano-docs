"use client";

import "./docs-header.css";

import { NavTitle } from "@/components/nav-title";

// Full-width docs header from the design: the Volcano brand on the left with a
// continuous bottom border spanning the whole page (sidebar + content). It
// overrides Fumadocs' default header slot (which is mobile-only) and occupies
// the full-width `header` grid row added by DocsContainer.
export function DocsHeader() {
  return (
    <header className="docs-header">
      <NavTitle />
    </header>
  );
}
