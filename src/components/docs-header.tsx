"use client";

import "./docs-header.css";

import { NavTitle } from "@/components/nav-title";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// Full-width docs header from the design: the Volcano brand on the left,
// theme switcher on the right, with a continuous bottom border spanning the
// whole page (sidebar + content).
export function DocsHeader() {
  return (
    <header className="docs-header">
      <NavTitle />
      <ThemeSwitcher />
    </header>
  );
}
