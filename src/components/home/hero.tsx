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
            Volcano provides a serverless cloud for engineers and researchers
            who want to build compute-intensive applications without thinking
            about infrastructure.
            <br />
            <br />
            Run generative AI models, large-scale batch workflows, job queues,
            and more, all faster than ever before.
          </p>
        </div>
        <Link href="/get-started" className="hero-cta">
          Get started
        </Link>
      </div>
    </section>
  );
}
