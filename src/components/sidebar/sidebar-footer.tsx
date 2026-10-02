import "./sidebar-footer.css";

import Link from "next/link";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// Sidebar footer: "Volcano Pricing" / "Privacy Policy" links. The theme
// switcher itself lives in the header (DocsHeader) on desktop, but the mobile
// nav drawer sits above the header (higher z-index), so it's unreachable
// there — a second copy is shown here, hidden again at `md` and up.
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
