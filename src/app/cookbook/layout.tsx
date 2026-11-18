import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { getSectionTree } from "@/lib/sections";
import { DocsHeader } from "@/components/docs-header";
import { SearchBanner } from "@/components/sidebar/search-banner";
import { NavFolder, NavItem, NavSeparator } from "@/components/sidebar/nav-tree";

type CookbooksLayoutProps = { children: ReactNode };

export default function CookbooksLayout({ children }: CookbooksLayoutProps) {
  return (
    <DocsLayout
      {...baseOptions()}
      tree={getSectionTree("cookbooks")}
      tabs={false}
      slots={{ header: DocsHeader }}
      sidebar={{
        collapsible: false,
        banner: <SearchBanner />,
        components: { Item: NavItem, Folder: NavFolder, Separator: NavSeparator },
      }}
    >
      {children}
    </DocsLayout>
  );
}
