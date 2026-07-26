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
    <div className="flex w-full items-stretch border-b border-border-subtle">
      {PLATFORMS.map(function renderPlatform(platform, index) {
        const isLast = index === PLATFORMS.length - 1;
        let borderClass = "border-r border-border-subtle";
        if (isLast) {
          borderClass = "";
        }
        return (
          <Link
            key={platform.name}
            href={platform.href}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-space-50 bg-surface px-space-90 py-space-80 transition-colors hover:bg-surface-raised ${borderClass}`}
          >
            <span className="flex size-8 items-center justify-center">
              <Image
                src={platform.src}
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
              />
            </span>
            <span className="font-body text-sm text-fg">{platform.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
