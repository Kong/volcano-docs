import Link from "next/link";

// Landing hero: title, intro copy, and the primary "Get started" CTA.
// Copy and CTA target mirror the Figma design; the CTA points at the real
// get-started section in the docs tree.
export function Hero() {
  return (
    <section className="relative flex w-full items-center gap-space-80 overflow-hidden border-b border-border-subtle px-space-100 py-16">
      {/* Ambient radial glow behind the hero, from the design. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-231px] h-[896px] w-[1132px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-space-80">
        <div className="flex w-full flex-col gap-space-80">
          <h1 className="font-heading text-5xl font-bold leading-tight tracking-tight text-fg">
            Volcano docs
          </h1>
          <p className="w-[530px] max-w-full font-body text-base leading-relaxed text-fg">
            Volcano provides a serverless cloud for engineers and researchers
            who want to build compute-intensive applications without thinking
            about infrastructure.
            <br />
            <br />
            Run generative AI models, large-scale batch workflows, job queues,
            and more, all faster than ever before.
          </p>
        </div>
        <Link
          href="/get-started"
          className="flex w-fit items-center justify-center gap-space-40 bg-primary px-space-50 py-space-30 font-body text-sm font-semibold text-fg-inverse transition-colors hover:opacity-90"
        >
          Get started
        </Link>
      </div>
    </section>
  );
}
