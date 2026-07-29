import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { SearchBanner } from "@/components/sidebar/search-banner";
import { SidebarQuickStartPortal } from "@/components/sidebar/sidebar-quick-start-portal";
import { SidebarFooterPortal } from "@/components/sidebar/sidebar-footer-portal";
import { NavFolder, NavItem, NavSeparator } from "@/components/sidebar/nav-tree";
import { DocsHeader } from "@/components/docs-header";

// Search stays in the banner slot (sticky, above the scroll viewport).
// QuickStart portals itself into the scroll viewport so it scrolls with the
// nav tree. The portal component renders nothing in the banner DOM.
function SidebarBanner() {
  return (
    <>
      <SearchBanner />
      <SidebarQuickStartPortal />
      <SidebarFooterPortal />
    </>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      slots={{
        header: DocsHeader,
      }}
      sidebar={{
        collapsible: false,
        defaultOpenLevel: 0,
        banner: <SidebarBanner key="sidebar-banner" />,
        components: {
          Item: NavItem,
          Folder: NavFolder,
          Separator: NavSeparator,
        },
      }}
    >
      {children}
    </DocsLayout>
  );
}
