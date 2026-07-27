"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";

// Custom sidebar page-tree renderers matching the Figma design. These receive
// the real page-tree nodes from Fumadocs (driven by source.ts), so the nav
// stays data-driven — only the presentation is design-specific.

function isActive(url: string, pathname: string) {
  return url === pathname;
}

// A leaf nav link (.L2 item). Neutral text; active item gets the warm tint
// background + bold white text, like the "Home" item in the design.
export function NavItem({ item }: { item: PageTree.Item }) {
  const pathname = usePathname();
  const active = isActive(item.url, pathname);

  let stateClass = "bg-surface text-neutral hover:text-fg";
  if (active) {
    stateClass = "bg-tint-weakest font-bold text-fg";
  }

  return (
    <Link
      href={item.url}
      data-active={active}
      className={`flex items-center px-space-50 py-space-40 font-body text-sm leading-5 transition-colors ${stateClass}`}
    >
      {item.name}
    </Link>
  );
}

// A section (.L2 tittle) with its indented children (.L2 item list). Section
// titles use Space Mono bold; the group is always visible, matching the design.
export function NavFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const pathname = usePathname();

  let title: ReactNode = (
    <p className="font-heading text-base font-bold leading-5 tracking-tight text-fg">
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
        className="font-heading text-base font-bold leading-5 tracking-tight text-fg transition-opacity hover:opacity-80"
      >
        {item.name}
      </Link>
    );
  }

  return (
    <div className="flex w-full flex-col gap-space-40">
      <div className="h-5 w-full">{title}</div>
      <div className="flex w-full flex-col gap-space-10 pl-space-40">
        {children}
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
