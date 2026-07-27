"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import { ChevronRightIcon } from "@/components/home/icons";

// Custom sidebar page-tree renderers matching the Figma design. These receive
// the real page-tree nodes from Fumadocs (driven by source.ts), so the nav
// stays data-driven — only the presentation is design-specific.

// Tracks whether a node is nested inside a section (folder). Top-level items
// (e.g. "Home") show a trailing chevron; nested sub-items do not. Fumadocs'
// own depth context isn't exported, so we track nesting ourselves.
const NestedContext = createContext(false);

function isActive(url: string, pathname: string) {
  return url === pathname;
}

// A leaf nav link (.L2 item). Neutral text; active item gets the warm tint
// background + bold white text, like the "Home" item in the design. Top-level
// items also show a trailing chevron, matching the design's standalone top item.
export function NavItem({ item }: { item: PageTree.Item }) {
  const pathname = usePathname();
  const nested = useContext(NestedContext);
  const active = isActive(item.url, pathname);

  let stateClass = "bg-surface text-neutral hover:text-fg";
  if (active) {
    stateClass = "bg-tint-weakest font-bold text-fg";
  }

  return (
    <Link
      href={item.url}
      data-active={active}
      className={`flex items-center justify-between gap-space-40 px-space-50 py-space-40 font-body text-sm leading-5 transition-colors ${stateClass}`}
    >
      <span>{item.name}</span>
      {!nested && (
        <ChevronRightIcon className="size-4 shrink-0 text-primary-text" />
      )}
    </Link>
  );
}

// A section (.L2 tittle) with its indented children (.L2 item list). Section
// titles use Space Mono bold; the group is always visible, matching the design.
// Children are marked nested so their items drop the top-level chevron.
export function NavFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const pathname = usePathname();

  let title: ReactNode = (
    <p className="font-heading text-base font-bold leading-6 tracking-tight text-fg">
      {item.name}
    </p>
  );

  // If the folder has an index page, make its title a link to it.
  if (item.index) {
    const active = isActive(item.index.url, pathname);
    title = (
      <Link
        href={item.index.url}
        data-active={active}
        className="block font-heading text-base font-bold leading-6 tracking-tight text-fg transition-opacity hover:opacity-80"
      >
        {item.name}
      </Link>
    );
  }

  return (
    <div className="flex w-full flex-col gap-space-40">
      <div className="w-full">{title}</div>
      <div className="flex w-full flex-col gap-space-10 pl-space-40">
        <NestedContext.Provider value={true}>{children}</NestedContext.Provider>
      </div>
    </div>
  );
}

// A separator label between sections.
export function NavSeparator({ item }: { item: PageTree.Separator }) {
  if (!item.name) return null;
  return (
    <p className="px-space-50 pt-space-40 font-heading text-base font-bold tracking-tight text-fg">
      {item.name}
    </p>
  );
}
