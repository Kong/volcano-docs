"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";

// Injects SidebarFooter at the bottom of Fumadocs' scroll viewport so it
// scrolls with the nav tree instead of being pinned at the bottom.
export function SidebarFooterPortal() {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(function injectMount() {
    const viewport = document.querySelector(
      "#nd-sidebar [data-radix-scroll-area-viewport] > div",
    );
    if (!(viewport instanceof HTMLElement)) return;

    const container = document.createElement("div");
    viewport.appendChild(container);
    setMount(container);

    return function cleanup() {
      container.remove();
    };
  }, []);

  if (!mount) return null;
  return createPortal(<SidebarFooter />, mount);
}
