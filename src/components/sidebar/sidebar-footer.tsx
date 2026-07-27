import Link from "next/link";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";

// Sidebar footer from the design: the "Volcano Pricing" / "Privacy Policy"
// links, then the theme switcher segmented control below them. Rendered as the
// sidebar `footer` slot (Fumadocs' own theme toggle is disabled in favor of
// the design's three-mode switcher here).
const FOOTER_LINKS = [
  { label: "Volcano Pricing", href: "https://volcano.dev/pricing" },
  { label: "Privacy Policy", href: "https://volcano.dev/privacy" },
];

export function SidebarFooter() {
  return (
    <div className="flex flex-col gap-space-60 border-t border-border-subtle pt-space-60">
      <div className="flex flex-col">
        {FOOTER_LINKS.map(function renderLink(link) {
          return (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center px-space-50 py-space-40 font-body text-sm text-neutral-strong transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <ThemeSwitcher />
    </div>
  );
}
