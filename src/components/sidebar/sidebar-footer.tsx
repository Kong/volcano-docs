import "./sidebar-footer.css";

import Link from "next/link";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// The shared header includes the theme switcher at every viewport size.
// Repeat it in the mobile drawer because the open drawer covers the header.
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
            <Link
              key={link.label}
              href={link.href}
              className="sidebar-footer-link"
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <ThemeSwitcher className="sidebar-footer-theme-switcher" />
    </div>
  );
}
