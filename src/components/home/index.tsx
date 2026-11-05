import "./index.css";

import { FeatureCard } from "./feature-card";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { BotIcon, BracesIcon, FlameIcon, PlugIcon, TerminalIcon } from "./icons";
import { IdePlatforms } from "./ide-platforms";
import { McpSetup } from "./mcp-setup";
import { SectionHeading } from "./section-heading";

const QUICKSTART_COPY =
  "Install the CLI, sign up, create a project, and start building.";
const CLI_COPY =
  "Deploy and manage functions, frontends, and databases from your terminal or CI.";
const API_COPY =
  "Do everything the dashboard does over HTTP, with an OpenAPI spec to generate clients.";
const MCP_COPY =
  "Connect your coding agent to a project to read its deployments and logs, and change it.";
const AGENT_COPY = "Install Volcano skills and plugins for your coding agent.";

// The Volcano docs landing page from the Figma design. Rendered inside the
// docs layout so it shares the real header + sidebar (driven by source.ts);
// the sections below are the design-specific content.
export function HomePage() {
  return (
    <div className="home-page">
      <Hero />

      {/* Primary feature cards: one row on wide screens, a grid below that. */}
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
          icon={<BracesIcon className="feature-card-glyph" />}
          title="Volcano API"
          description={API_COPY}
          href="/platform/api-reference/overview"
        />
        <FeatureCard
          icon={<PlugIcon className="feature-card-glyph" />}
          title="MCP server"
          description={MCP_COPY}
          href="/platform/interfaces/mcp"
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

      <SectionHeading>Connect your agent over MCP</SectionHeading>
      <McpSetup />

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
