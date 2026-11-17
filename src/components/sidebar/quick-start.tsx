"use client";

import "./quick-start.css";

import Link from "next/link";
import { usePathname } from "next/navigation";

const QUICK_START_LINKS = [
  { label: "What is Volcano", href: "/docs/get-started/what-is-volcano" },
  { label: "Install", href: "/docs/get-started/install" },
  { label: "Quickstart", href: "/docs/get-started/quickstart" },
  { label: "JS SDK", href: "/docs/sdk/js" },
  { label: "CLI Setup", href: "/docs/cli/setup" },
];

export function QuickStart() {
  const pathname = usePathname();

  return (
    <div className="quick-start">
      {QUICK_START_LINKS.map(function renderLink(link) {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active}
            className="quick-start-link"
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
