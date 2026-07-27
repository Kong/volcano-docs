"use client";

import { NavTitle } from "@/components/nav-title";

// Full-width docs header from the design: the Volcano brand on the left with a
// continuous bottom border spanning the whole page (sidebar + content). It
// overrides Fumadocs' default header slot (which is mobile-only) and occupies
// the full-width `header` grid row added by DocsContainer.
export function DocsHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border-subtle bg-surface/80 px-space-100 backdrop-blur-sm [grid-area:header]">
      <NavTitle />
    </header>
  );
}
