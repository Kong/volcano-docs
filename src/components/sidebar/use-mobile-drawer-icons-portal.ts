"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";

// Fumadocs has no slot for the mobile drawer's top icon-links row (the one
// beside its collapse button), and the drawer unmounts entirely while closed
// (via Presence), so the mount point has to be re-found each time it opens —
// same idea as useScrollViewportPortal, just a different target.
export function useMobileDrawerIconsPortal() {
  const { open } = useSidebar();
  const [container] = useState(function createContainer() {
    if (typeof document === "undefined") return null;
    return document.createElement("div");
  });

  useEffect(
    function attachContainer() {
      if (!container) return;
      const target = document.querySelector("#nd-sidebar-mobile .flex.flex-1");
      if (!(target instanceof HTMLElement)) return;

      target.appendChild(container);

      return function detach() {
        container.remove();
      };
    },
    [container, open],
  );

  return container;
}
