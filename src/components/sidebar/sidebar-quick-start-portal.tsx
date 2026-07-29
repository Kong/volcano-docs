"use client";

import { createPortal } from "react-dom";
import { QuickStart } from "@/components/sidebar/quick-start";
import { useScrollViewportPortal } from "@/components/sidebar/use-scroll-viewport-portal";

// Injects QuickStart at the top of Fumadocs' scroll viewport so it scrolls
// with the nav tree while the search banner (in the banner slot) stays sticky.
export function SidebarQuickStartPortal() {
  const container = useScrollViewportPortal("start");
  if (!container) return null;
  return createPortal(<QuickStart />, container);
}
