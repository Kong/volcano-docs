"use client";

import "./docs-header.css";

import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { NavTitle } from "@/components/nav-title";
import { SidebarToggleIcon } from "@/components/home/icons";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// Full-width docs header from the design: the Volcano brand on the left,
// theme switcher on the right, with a continuous bottom border spanning the
// whole page (sidebar + content). Replacing Fumadocs' own header slot also
// drops its built-in mobile sidebar trigger, so it's re-added here (visible
// only below the `md` breakpoint where the sidebar panel itself is hidden).
// The theme switcher is the opposite: it's hidden below `md` because the
// mobile nav drawer renders above the header and would block it — that
// breakpoint has its own copy instead (see SidebarFooter).
export function DocsHeader() {
  const { slots } = useDocsLayout();
  const SidebarTrigger = slots.sidebar.trigger;

  return (
    <header className="docs-header">
      <div className="docs-header-start">
        <SidebarTrigger className="docs-header-sidebar-trigger" aria-label="Toggle sidebar">
          <SidebarToggleIcon className="docs-header-sidebar-trigger-icon" />
        </SidebarTrigger>
        <NavTitle />
      </div>
      <ThemeSwitcher className="docs-header-theme-switcher" />
    </header>
  );
}
