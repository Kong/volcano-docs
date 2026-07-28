import type { ComponentProps } from "react";
import Image from "next/image";
import Link from "next/link";

// IDE platforms row from the design: Claude Code, Codex, Cursor. Claude Code and
// Codex are multicolor brand marks kept as exported SVG assets. Cursor is a
// monochrome mark, so it is inlined with `fill="currentColor"` to follow the
// theme text color — a white-fill asset was invisible on light backgrounds.
function CursorMark(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 21.3333 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.9067 5.67912L11.1728 0.133716C11.0191 0.0461172 10.8447 0 10.6672 0C10.4897 0 10.3153 0.0461172 10.1615 0.133716L0.424579 5.67912C0.295589 5.75285 0.188479 5.85872 0.113968 5.98614C0.0394568 6.11356 0.000156755 6.25806 0 6.40517V17.592C0 17.892 0.162131 18.169 0.425593 18.319L10.1605 23.8664C10.3143 23.9539 10.4887 24 10.6662 24C10.8437 24 11.018 23.9539 11.1718 23.8664L20.9077 18.319C21.0371 18.2453 21.1445 18.1394 21.2192 18.0118C21.2939 17.8841 21.3333 17.7394 21.3333 17.592V6.40617C21.3331 6.25896 21.2936 6.1144 21.2189 5.98697C21.1442 5.85954 21.0369 5.75373 20.9077 5.68012L20.9067 5.67912ZM20.2957 6.8552L10.8972 22.9204C10.8334 23.0284 10.6662 22.9844 10.6662 22.8594V12.3396C10.666 12.2362 10.6383 12.1346 10.5858 12.0451C10.5334 11.9556 10.458 11.8813 10.3672 11.8296L1.13593 6.56918C1.0275 6.50718 1.07209 6.34117 1.19875 6.34117H19.9958C20.2633 6.34117 20.4295 6.62719 20.2957 6.8552Z"
      />
    </svg>
  );
}

const PLATFORMS = [
  {
    name: "Claude Code",
    href: "/ai/plugins",
    mark: (
      <Image
        src="/design/claude-code.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
    ),
  },
  {
    name: "Codex",
    href: "/ai/plugins",
    mark: (
      <Image
        src="/design/codex.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
    ),
  },
  {
    name: "Cursor",
    href: "/ai/plugins",
    mark: <CursorMark className="size-8 object-contain text-fg" />,
  },
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
              {platform.mark}
            </span>
            <span className="font-body text-sm text-fg">{platform.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
