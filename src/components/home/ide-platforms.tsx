import "./ide-platforms.css";

import Image from "next/image";
import Link from "next/link";

// IDE platforms row from the design: Claude Code, Codex, Cursor. Brand marks
// are kept as exported SVG assets (multicolor — not currentColor icons).
const PLATFORMS = [
  { name: "Claude Code", src: "/design/claude-code.svg", href: "/ai/plugins" },
  { name: "Codex", src: "/design/codex.svg", href: "/ai/plugins" },
  { name: "Cursor", src: "/design/cursor.svg", href: "/ai/plugins" },
];

export function IdePlatforms() {
  return (
    <div className="ide-platforms">
      {PLATFORMS.map(function renderPlatform(platform) {
        return (
          <Link
            key={platform.name}
            href={platform.href}
            className="ide-platform"
          >
            <span className="ide-platform-icon">
              <Image src={platform.src} alt="" width={32} height={32} />
            </span>
            <span className="ide-platform-label">{platform.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
