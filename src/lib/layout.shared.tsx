import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { NavTitle } from "@/components/nav-title";

// Shared layout options. The nav title renders the Volcano logo + "/ Docs"
// brand from the design; the header and sidebar chrome are driven by Fumadocs
// with the site's design tokens applied in global.css.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <NavTitle />,
      url: "/",
    },
    // The design places search in the sidebar (our SearchBanner), so disable
    // Fumadocs' default search trigger to avoid a duplicate search box.
    searchToggle: { enabled: false },
  };
}
