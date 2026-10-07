import "./hero.css";

import Link from "next/link";

// Landing hero: title, intro copy, and the primary "Get started" CTA.
// Copy and CTA target mirror the Figma design; the CTA points at the real
// get-started section in the docs tree.
export function Hero() {
  return (
    <section className="hero">
      {/* Ambient radial glow behind the hero, from the design. */}
      <div aria-hidden className="hero-glow" />
      <div className="hero-content">
        <div className="hero-copy-stack">
          <h1 className="hero-title">Volcano docs</h1>
          <p className="hero-lede">
            Build AI agents and modern applications with the platform for the
            AI era, fully integrated with your agentic coding tools.
          </p>
          <p className="hero-lede">
            Functions, frontends, databases, and the rest of the platform are
            documented under{" "}
            <Link href="/platform" className="hero-link">
              Platform
            </Link>
            . The same docs are in your terminal with{" "}
            <Link href="/cli/docs-search" className="hero-link">
              <code>volcano docs</code>
            </Link>
            .
          </p>
        </div>
        <Link href="/get-started" className="hero-cta">
          Get started
        </Link>
      </div>
    </section>
  );
}
