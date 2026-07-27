import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { SearchBanner } from "@/components/sidebar/search-banner";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { NavFolder, NavItem, NavSeparator } from "@/components/sidebar/nav-tree";
import { DocsHeader } from "@/components/docs-header";
import { DocsContainer } from "@/components/docs-container";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      slots={{
        // Full-width brand header + a container that reserves a header row so
        // the header spans the whole page, matching the design.
        header: DocsHeader,
        container: DocsContainer,
      }}
      sidebar={{
        // The design has no desktop collapse control, so hide it.
        collapsible: false,
        // The design's search box at the top and pricing/privacy links at the
        // bottom, above Fumadocs' theme toggle.
        banner: <SearchBanner key="sidebar-search" />,
        footer: <SidebarFooter key="sidebar-footer" />,
        // Custom node renderers matching the design; nodes still come from the
        // real page tree (source.ts).
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
