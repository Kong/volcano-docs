import "./sidebar-footer.css";

import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// The shared header includes the theme switcher at every viewport size.
// Repeat it in the mobile drawer because the open drawer covers the header.
// Plain anchors: once this site is mounted on volcano.dev these links are
// same-origin, and next/link would try a client-side navigation into another
// Next.js app, which fails before falling back to a full page load.
const FOOTER_LINKS = [
  { label: "Volcano Pricing", href: "https://volcano.dev/pricing" },
  { label: "Privacy Policy", href: "https://volcano.dev/privacy" },
];

export function SidebarFooter() {
  return (
    <div className="sidebar-footer">
      <div className="sidebar-footer-links">
        {FOOTER_LINKS.map(function renderLink(link) {
          return (
            <a
              key={link.label}
              href={link.href}
              className="sidebar-footer-link"
            >
              {link.label}
            </a>
          );
        })}
      </div>
      <ThemeSwitcher className="sidebar-footer-theme-switcher" />
    </div>
  );
}
