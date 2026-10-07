import "./index.css";

import { FeatureCard } from "./feature-card";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { BotIcon, FlameIcon, TerminalIcon } from "./icons";
import { IdePlatforms } from "./ide-platforms";
import { SectionHeading } from "./section-heading";

const QUICKSTART_COPY =
  "Install the CLI, sign up, create a project, and start building.";
const CLI_COPY =
  "Deploy and manage functions, frontends, and databases from your terminal or CI.";
const AGENT_COPY = "Install Volcano skills and plugins for your coding agent.";

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
          description={QUICKSTART_COPY}
          href="/get-started/quickstart"
        />
        <FeatureCard
          icon={<TerminalIcon className="feature-card-glyph" />}
          title="Volcano CLI"
          description={CLI_COPY}
          href="/cli"
        />
        <FeatureCard
          icon={<BotIcon className="feature-card-glyph" />}
          title="Agent skills"
          description={AGENT_COPY}
          href="/cli/setup"
          variant="danger"
        />
      </div>

      <SectionHeading>Get started with IDE</SectionHeading>
      <IdePlatforms />

      <SectionHeading>Tutorials</SectionHeading>
      <div className="home-card-row home-card-row--tutorials">
        <FeatureCard
          title="Quick start"
          description={QUICKSTART_COPY}
          href="/get-started/quickstart"
        />
        <FeatureCard
          title="Agent setup"
          description={AGENT_COPY}
          href="/cli/setup"
          variant="danger"
        />
      </div>

      <Footer />
    </div>
  );
}
