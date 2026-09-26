import "./footer.css";

import Link from "next/link";
import { Logo } from "@/components/logo";

// Footer link columns from the design. Hrefs point at real docs/marketing
// destinations where one exists; external marketing links use absolute URLs.
const LINK_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Pricing", href: "https://volcano.dev/pricing" },
    ],
  },
  {
    heading: "Features",
    links: [
      { label: "Agent skills", href: "/cli/setup" },
      { label: "Edge functions", href: "/platform" },
      { label: "Postgres database", href: "/platform" },
      { label: "User authentication", href: "/platform" },
      { label: "File storage", href: "/platform" },
      { label: "MCP server", href: "/platform/interfaces/mcp" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Getting started", href: "/get-started" },
      { label: "Documentation", href: "/" },
      { label: "Tutorials", href: "/get-started" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Terms of service", href: "https://volcano.dev/terms" },
      { label: "Privacy policy", href: "https://volcano.dev/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="home-footer">
      {/* Ambient glow behind the footer, from the design. */}
      <div aria-hidden className="home-footer-glow" />
      <div className="home-footer-brand">
        <div className="home-footer-brand-inner">
          <Logo height={18} />
          <p className="home-footer-lede">
            Created by{" "}
            <span className="home-footer-lede-accent">Kong</span> to bring
            production readiness to the AI world
          </p>
        </div>
      </div>
      {LINK_COLUMNS.map(function renderColumn(column) {
        return (
          <div key={column.heading} className="home-footer-column">
            <h3 className="home-footer-column-heading">{column.heading}</h3>
            {column.links.map(function renderLink(link) {
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="home-footer-link"
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </footer>
  );
}
