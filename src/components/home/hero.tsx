import "./hero.css";

import Link from "next/link";
import type { ReactNode } from "react";
import InlineLink from "fumadocs-core/link";
import { DocsBody } from "fumadocs-ui/page";

type HeroProps = {
  title?: string;
  /** `null` renders the hero without its intro line. */
  description?: string | null;
  /** `null` renders the hero without its call to action. */
  actionHref?: string | null;
  actionLabel?: string;
  children?: ReactNode;
};

// Landing hero: title, intro copy, and the primary "Get started" CTA.
// Copy and CTA target mirror the Figma design; the CTA points at the real
// get-started section in the docs tree.
export function Hero({
  title = "Volcano docs",
  description = "Build AI agents and modern applications with the platform for the AI era, fully integrated with your agentic coding tools.",
  actionHref = "/get-started",
  actionLabel = "Get started",
  children,
}: HeroProps) {
  // `undefined` means "no children were passed", so the landing blurb below is
  // the default. An explicit `null` means the caller wants the hero without it.
  let details = children;
  if (details === undefined) details = (
    <DocsBody>
      <p>
      Functions, frontends, databases, and the rest of the platform are
      documented under{" "}
      <InlineLink href="/platform">Platform</InlineLink>.
      <br />
      The same docs are in your terminal with{" "}
      <InlineLink href="/cli/docs-search"><code>volcano docs</code></InlineLink>.
      <br />
      For step-by-step recipes you can build, explore the{" "}
      <InlineLink href="/cookbooks">Cookbooks</InlineLink>.
      <br />
      For application design ideas and practical perspectives, visit the{" "}
      <InlineLink href="/blog">Blog</InlineLink>.
      </p>
    </DocsBody>
  );
  return (
    <section data-slot="hero" className="hero">
      <div className="hero-content">
        <div className="hero-copy-stack">
          <h1 className="hero-title">{title}</h1>
          {description && <p className="hero-lede">{description}</p>}
          {details}
        </div>
        {actionHref && (
          <Link href={actionHref} className="hero-cta">
            {actionLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
