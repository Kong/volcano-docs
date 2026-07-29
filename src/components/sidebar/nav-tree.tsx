"use client";

import "./nav-tree.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, type ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import {
  SidebarFolder as BaseSidebarFolder,
  SidebarItem as BaseSidebarItem,
  SidebarSeparator as BaseSidebarSeparator,
  useFolder,
} from "fumadocs-ui/components/sidebar/base";
import {
  CollapsibleTrigger,
  CollapsibleContent,
} from "fumadocs-ui/components/ui/collapsible";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { ChevronRightIcon } from "@/components/home/icons";

// Fumadocs only tracks folder depth through its own SidebarFolder, but our
// top-level groups render as plain <div> labels (no SidebarFolder), so its
// useFolderDepth() would stay 0 for every descendant and nested folders would
// never reach the collapsible branch. We track depth ourselves and bump it
// around each folder's children so nested folders collapse as intended.
const NavDepthContext = createContext(0);

function useNavDepth() {
  return use(NavDepthContext);
}

function isActive(url: string, pathname: string) {
  return url === pathname;
}

// A leaf nav link. The root "/" (Home) is hidden — it's accessed via the logo.
export function NavItem({ item }: { item: PageTree.Item }) {
  const pathname = usePathname();
  const depth = useNavDepth();
  const active = isActive(item.url, pathname);

  if (item.url === "/") return null;

  return (
    <BaseSidebarItem
      href={item.url}
      active={active}
      className="nav-item"
    >
      <span>{item.name}</span>
      {depth === 0 && <ChevronRightIcon className="nav-item-chevron" />}
    </BaseSidebarItem>
  );
}

// Depth 0: renders as an uppercase group label with children always visible.
// Depth 1+: renders as a collapsible section using Fumadocs' SidebarFolder.
export function NavFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const depth = useNavDepth();
  const path = useTreePath();

  if (depth === 0) {
    return (
      <NavDepthContext value={depth + 1}>
        <div className="nav-group">
          <p className="nav-group-label">{item.name}</p>
          <div className="nav-group-children">{children}</div>
        </div>
      </NavDepthContext>
    );
  }

  return (
    <NavDepthContext value={depth + 1}>
      <BaseSidebarFolder
        collapsible={item.collapsible}
        active={path.includes(item)}
        defaultOpen={item.defaultOpen}
        className="nav-folder"
      >
        <NavFolderHeader item={item} />
        <CollapsibleContent className="nav-folder-children">
          {children}
        </CollapsibleContent>
      </BaseSidebarFolder>
    </NavDepthContext>
  );
}

// Folder header: either a link (if folder has index page) or a plain trigger.
// Both use Radix CollapsibleTrigger for toggle, with our custom chevron.
function NavFolderHeader({ item }: { item: PageTree.Folder }) {
  const pathname = usePathname();
  const folder = useFolder();
  const open = folder?.open ?? false;

  if (item.index) {
    const active = isActive(item.index.url, pathname);
    return (
      <div className="nav-folder-title-row">
        <Link
          href={item.index.url}
          data-active={active}
          className="nav-folder-title nav-folder-title-link"
        >
          {item.name}
        </Link>
        <CollapsibleTrigger className="nav-folder-toggle" aria-label={open ? "Collapse" : "Expand"}>
          <ChevronRightIcon
            className={`nav-folder-chevron ${open ? "nav-folder-chevron-open" : ""}`}
          />
        </CollapsibleTrigger>
      </div>
    );
  }

  return (
    <CollapsibleTrigger className="nav-folder-title-row">
      <span className="nav-folder-title">{item.name}</span>
      <ChevronRightIcon
        className={`nav-folder-chevron ${open ? "nav-folder-chevron-open" : ""}`}
      />
    </CollapsibleTrigger>
  );
}

// A separator label between sections.
export function NavSeparator({ item }: { item: PageTree.Separator }) {
  if (!item.name) return null;
  return (
    <BaseSidebarSeparator className="nav-separator">
      {item.name}
    </BaseSidebarSeparator>
  );
}
