import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { SearchBanner } from "@/components/sidebar/search-banner";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { NavFolder, NavItem, NavSeparator } from "@/components/sidebar/nav-tree";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      sidebar={{
        // The design's search box at the top and pricing/privacy links at the
        // bottom, above Fumadocs' theme toggle.
        banner: <SearchBanner />,
        footer: <SidebarFooter />,
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
