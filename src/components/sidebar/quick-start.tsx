"use client";

import "./quick-start.css";

import Link from "next/link";
import { usePathname } from "next/navigation";

const QUICK_START_LINKS = [
  { label: "What is Volcano", href: "/get-started/what-is-volcano" },
  { label: "Install", href: "/get-started/install" },
  { label: "Quickstart", href: "/get-started/quickstart" },
  { label: "JS SDK", href: "/sdk/js" },
  { label: "CLI Setup", href: "/cli/setup" },
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
