"use client";

import { createPortal } from "react-dom";
import { NavTitle } from "@/components/nav-title";
import { useMobileDrawerIconsPortal } from "@/components/sidebar/use-mobile-drawer-icons-portal";

// Portals the brand wordmark into the mobile drawer's top icon-links row
// (beside its collapse button) — the drawer overlays the full page including
// the header, so without this it has no branding of its own. Desktop doesn't
// need it: that row is empty there too, but the header is always visible.
export function MobileDrawerBrand() {
  const container = useMobileDrawerIconsPortal();
  if (!container) return null;
  return createPortal(<NavTitle />, container);
}
