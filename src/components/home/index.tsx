import "./index.css";

import { FeatureCard } from "./feature-card";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { BotIcon, FlameIcon, TerminalIcon } from "./icons";
import { IdePlatforms } from "./ide-platforms";
import { SectionHeading } from "./section-heading";

const CARD_COPY =
  "Provision PostgreSQL databases in seconds and use them for your agentic and application workloads.";

// The Volcano docs landing page from the Figma design. Rendered inside the
// docs layout so it shares the real header + sidebar (driven by source.ts);
// the sections below are the design-specific content.
export function HomePage() {
  return (
    <div className="home-page">
      <Hero />

      {/* Primary feature cards row (fixed height, content top-aligned). */}
      <div className="home-card-row home-card-row--primary">
        <FeatureCard
          icon={<FlameIcon className="feature-card-glyph" />}
          title="Quick start"
          description={CARD_COPY}
          href="/get-started/quickstart"
        />
        <FeatureCard
          icon={<TerminalIcon className="feature-card-glyph" />}
          title="Volcano CLI"
          description={CARD_COPY}
          href="/cli"
        />
        <FeatureCard
          icon={<BotIcon className="feature-card-glyph" />}
          title="AI builder"
          description={CARD_COPY}
          href="/ai/skills"
          variant="danger"
        />
      </div>

      <SectionHeading>Get started with IDE</SectionHeading>
      <IdePlatforms />

      <SectionHeading>Tutorials</SectionHeading>
      <div className="home-card-row home-card-row--tutorials">
        <FeatureCard
          title="Quick start"
          description={CARD_COPY}
          href="/get-started/quickstart"
        />
        <FeatureCard
          title="AI builder"
          description={CARD_COPY}
          href="/ai/skills"
          variant="danger"
        />
      </div>

      <Footer />
    </div>
  );
}
