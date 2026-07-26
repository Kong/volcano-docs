import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared layout options. Branding/custom UI comes later.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Volcano Docs",
    },
  };
}
