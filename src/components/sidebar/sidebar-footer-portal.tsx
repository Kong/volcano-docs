"use client";

import { createPortal } from "react-dom";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { useScrollViewportPortal } from "@/components/sidebar/use-scroll-viewport-portal";

// Injects SidebarFooter at the bottom of Fumadocs' scroll viewport so it
// scrolls with the nav tree instead of being pinned at the bottom.
export function SidebarFooterPortal() {
  const container = useScrollViewportPortal("end");
  if (!container) return null;
  return createPortal(<SidebarFooter />, container);
}
