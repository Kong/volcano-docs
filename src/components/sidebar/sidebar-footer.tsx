import "./sidebar-footer.css";

import Link from "next/link";

// Sidebar footer: "Volcano Pricing" / "Privacy Policy" links. The theme
// switcher has moved to the top-right of the header (DocsHeader).
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
    </div>
  );
}
