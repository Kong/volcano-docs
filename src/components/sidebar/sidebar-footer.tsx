import Link from "next/link";

// Sidebar footer links from the design ("Volcano Pricing", "Privacy Policy").
// Sits above Fumadocs' own theme toggle, separated by the design's top border.
// Rendered as the sidebar `footer` slot.
const FOOTER_LINKS = [
  { label: "Volcano Pricing", href: "https://volcano.dev/pricing" },
  { label: "Privacy Policy", href: "https://volcano.dev/privacy" },
];

export function SidebarFooter() {
  return (
    <div className="flex flex-col border-t border-border-subtle pt-space-60">
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
  );
}
