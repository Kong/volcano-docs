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
    <footer className="relative flex w-full flex-wrap items-start overflow-hidden border-t border-border-subtle bg-surface">
      {/* Ambient glow behind the footer, from the design. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[270px] h-[168px] w-[1482px] -translate-x-1/2 rounded-full bg-danger-weaker/10 blur-[120px]"
      />
      <div className="relative flex w-full min-w-[280px] flex-1 flex-col self-stretch p-space-100">
        <div className="flex w-full flex-col gap-space-60">
          <Logo height={18} />
          <p className="min-w-full font-body text-base italic leading-relaxed text-neutral">
            Created by{" "}
            <span className="font-bold text-primary-text underline">Kong</span>{" "}
            to bring production readiness to the AI world
          </p>
        </div>
      </div>
      {LINK_COLUMNS.map(function renderColumn(column) {
        return (
          <div
            key={column.heading}
            className="relative flex min-w-[160px] flex-1 flex-col gap-space-60 self-stretch px-space-80 py-space-100"
          >
            <h3 className="whitespace-nowrap font-heading text-base font-bold text-fg">
              {column.heading}
            </h3>
            {column.links.map(function renderLink(link) {
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-body text-sm text-neutral transition-colors hover:text-fg"
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
