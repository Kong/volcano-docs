import "./footer.css";

import Link from "next/link";
import { Logo } from "@/components/logo";

const MARKETING_URL = "https://volcano.dev";
const KONG_URL = "https://konghq.com/";

// The same four columns volcano.dev's footer lists, so the docs and the
// marketing site end on the same links. Product, Features and Legal point back
// at volcano.dev; Resources resolves to the docs routes those entries mean.
const LINK_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Home", href: MARKETING_URL },
      { label: "Pricing", href: `${MARKETING_URL}/pricing` },
    ],
  },
  {
    heading: "Features",
    links: [
      { label: "Functions & Agents", href: `${MARKETING_URL}/features/edge-functions` },
      { label: "Next.js Frontends", href: `${MARKETING_URL}/features/nextjs-hosting` },
      { label: "Databases & Vector", href: `${MARKETING_URL}/features/postgres` },
      { label: "File Storage", href: `${MARKETING_URL}/features/file-storage` },
      { label: "Authentication", href: `${MARKETING_URL}/features/authentication` },
      { label: "Realtime", href: `${MARKETING_URL}/features/realtime` },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Getting started", href: "/get-started" },
      { label: "Documentation", href: "/" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Customer Agreement", href: `${MARKETING_URL}/legal/customer-agreement` },
      { label: "Privacy Policy", href: `${MARKETING_URL}/legal/privacy` },
      { label: "Cookie Policy", href: `${MARKETING_URL}/legal/cookies` },
      { label: "Subprocessors", href: `${MARKETING_URL}/legal/subprocessors` },
      { label: "All legal documents", href: `${MARKETING_URL}/legal` },
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
            <a
              href={KONG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-footer-kong-link"
            >
              Kong
            </a>{" "}
            to bring production readiness to the AI world
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
