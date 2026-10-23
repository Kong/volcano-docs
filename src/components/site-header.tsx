"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import type { ReactNode } from "react";
import { getSearchSection } from "@/lib/search-section.mjs";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/sidebar/theme-switcher";
import "./site-header.css";

type SiteHeaderProps = { children?: ReactNode };

const LINKS = [
  { label: "Docs", href: "/", section: "docs" },
  { label: "Cookbooks", href: "/cookbooks", section: "cookbooks" },
  { label: "Blog", href: "/blog", section: "blog" },
];

export function SiteHeader({ children }: SiteHeaderProps) {
  const pathname = usePathname();
  const section = getSearchSection(pathname);
  // `=== true` so the link stays hidden while the flag is loading (undefined),
  // off (false), or PostHog never starts.
  const blogEnabled = useFeatureFlagEnabled("sandbox-ff-blog") === true;
  const links = LINKS.filter(function isShown(link) {
    return link.section !== "blog" || blogEnabled;
  });

  return (
    <header data-slot="site-header" className="site-header">
      <div className="site-header-brand">
        {children}
        <a href="https://volcano.dev" aria-label="Volcano home" className="site-header-logo">
          <Logo />
        </a>
      </div>
      <nav aria-label="Main navigation" className="site-header-nav">
        {links.map(function renderLink(link) {
          let current: "page" | undefined;
          if (section === link.section) current = "page";
          return (
            <Link key={link.href} href={link.href} aria-current={current} className="site-header-link">
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div data-slot="header-actions" className="site-header-actions">
        <a href="https://volcano.dev/dashboard" data-slot="dashboard-link" className="site-header-dashboard">
          Dashboard
        </a>
        <ThemeSwitcher className="site-header-theme" />
      </div>
    </header>
  );
}
