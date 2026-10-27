import "./ide-platforms.css";

import Link from "next/link";

// The coding agents Volcano supports, in the same order as the agent strip on
// volcano.dev. Each mark is a monochrome SVG in /design/agent-logos, painted
// through a CSS mask (mapped by `data-logo` in ide-platforms.css) so every
// brand mark takes the theme's text color in both light and dark mode.
// `volcano setup` installs Volcano into all five, so every tile points at the
// setup guide that documents them.
const SETUP_HREF = "/cli/setup";

const PLATFORMS = [
  { id: "claude-code", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "cursor", name: "Cursor" },
  { id: "opencode", name: "OpenCode" },
  { id: "pi", name: "Pi" },
];

export function IdePlatforms() {
  return (
    <div className="ide-platforms">
      {PLATFORMS.map(function renderPlatform(platform) {
        return (
          <Link
            key={platform.id}
            href={SETUP_HREF}
            aria-label={`Set up Volcano in ${platform.name}`}
            className="ide-platform"
          >
            <span aria-hidden="true" data-logo={platform.id} className="ide-platform-mark" />
            <span className="ide-platform-label">{platform.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
