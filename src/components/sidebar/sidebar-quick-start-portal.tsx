"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QuickStart } from "@/components/sidebar/quick-start";

// Injects QuickStart at the top of Fumadocs' scroll viewport so it scrolls
// with the nav tree while the search banner (in the banner slot) stays sticky.
export function SidebarQuickStartPortal() {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(function injectMount() {
    const viewport = document.querySelector(
      "#nd-sidebar [data-radix-scroll-area-viewport] > div",
    );
    if (!(viewport instanceof HTMLElement)) return;

    const container = document.createElement("div");
    viewport.insertBefore(container, viewport.firstChild);
    setMount(container);

    return function cleanup() {
      container.remove();
    };
  }, []);

  if (!mount) return null;
  return createPortal(<QuickStart />, mount);
}
