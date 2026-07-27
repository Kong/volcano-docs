import { FeatureCard } from "./feature-card";
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
    <div className="flex w-full flex-col">
      <Hero />

      {/* Primary feature cards row (fixed height, content top-aligned). */}
      <div className="flex h-[349px] w-full items-stretch border-b border-border-subtle">
        <FeatureCard
          icon={<FlameIcon className="size-8" />}
          title="Quick start"
          description={CARD_COPY}
          href="/get-started/quickstart"
          className="border-r border-border-subtle"
        />
        <FeatureCard
          icon={<TerminalIcon className="size-8" />}
          title="Volcano CLI"
          description={CARD_COPY}
          href="/cli"
          className="border-r border-border-subtle"
        />
        <FeatureCard
          icon={<BotIcon className="size-8" />}
          title="AI builder"
          description={CARD_COPY}
          href="/ai/skills"
          variant="danger"
        />
      </div>

      <SectionHeading>Get started with IDE</SectionHeading>
      <IdePlatforms />

      <SectionHeading>Tutorials</SectionHeading>
      <div className="flex h-[372px] w-full items-stretch border-b border-border-subtle">
        <FeatureCard
          title="Quick start"
          description={CARD_COPY}
          href="/get-started/quickstart"
          className="border-r border-border-subtle"
        />
        <FeatureCard
          title="AI builder"
          description={CARD_COPY}
          href="/ai/skills"
          variant="danger"
        />
      </div>
    </div>
  );
}
