import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared layout options. The brand (Volcano logo + "/ Docs") lives in the
// full-width DocsHeader slot, so the nav title is intentionally not set here to
// avoid a duplicate in the sidebar top. The header and sidebar chrome are
// driven by Fumadocs with the site's design tokens applied in global.css.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: "/",
    },
    // The design places search in the sidebar (our SearchBanner), so disable
    // Fumadocs' default search trigger to avoid a duplicate search box.
    searchToggle: { enabled: false },
  };
}
