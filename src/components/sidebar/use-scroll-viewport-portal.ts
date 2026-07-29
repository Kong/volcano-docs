"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";

// Fumadocs has no public slot *inside* the sidebar's scroll viewport, so to make
// content scroll with the nav tree we portal a container into it. Desktop renders
// the tree under `#nd-sidebar`; the mobile drawer renders a separate copy under
// `#nd-sidebar-mobile` (mounted only while open). We resolve the mount from the
// current sidebar `mode` (mirroring Fumadocs' own `useAutoScroll`) and re-attach
// whenever `mode`/`open` changes so both the desktop aside and the mobile drawer
// get the injected content — otherwise it silently vanishes on small viewports.
//
// The container is created during render (not in the effect) so the effect only
// syncs the DOM and never calls setState, satisfying react-hooks/set-state-in-effect.
export function useScrollViewportPortal(position: "start" | "end") {
  const { open, mode } = useSidebar();
  const [container] = useState(function createContainer() {
    if (typeof document === "undefined") return null;
    return document.createElement("div");
  });

  useEffect(
    function attachContainer() {
      if (!container) return;
      const root = mode === "drawer" ? "#nd-sidebar-mobile" : "#nd-sidebar";
      const viewport = document.querySelector(
        `${root} [data-radix-scroll-area-viewport] > div`,
      );
      if (!(viewport instanceof HTMLElement)) return;

      if (position === "start") {
        viewport.insertBefore(container, viewport.firstChild);
      } else {
        viewport.appendChild(container);
      }

      return function detach() {
        container.remove();
      };
    },
    [container, position, mode, open],
  );

  return container;
}
