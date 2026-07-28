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
      { label: "Enterprise", href: "https://volcano.dev/enterprise" },
      { label: "Educational discount", href: "https://volcano.dev/education" },
    ],
  },
  {
    heading: "Features",
    links: [
      { label: "AI Builder", href: "/ai/skills" },
      { label: "Edge functions", href: "/platform" },
      { label: "Postgres database", href: "/platform" },
      { label: "User authentication", href: "/platform" },
      { label: "File storage", href: "/platform" },
      { label: "Agentic workflows", href: "/ai/skills" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Getting started", href: "/get-started" },
      { label: "Documentation", href: "/" },
      { label: "Tutorials", href: "/get-started" },
      { label: "Webinars", href: "https://volcano.dev/webinars" },
      { label: "Videos", href: "https://volcano.dev/videos" },
      { label: "Blog", href: "https://volcano.dev/blog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "https://volcano.dev/about" },
      { label: "Terms of service", href: "https://volcano.dev/terms" },
      { label: "Privacy policy", href: "https://volcano.dev/privacy" },
      { label: "Contact us", href: "https://volcano.dev/contact" },
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
