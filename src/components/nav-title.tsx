import Link from "next/link";
import { Logo } from "@/components/logo";

// Header brand: the Volcano logo followed by "/ Docs" on one baseline,
// matching the design (18px Space Mono, tight tracking, never wrapping).
// Links to the docs base URL so clicking the brand returns home.
export function NavTitle() {
  return (
    <Link
      href="/"
      aria-label="Volcano Docs home"
      className="flex shrink-0 items-center gap-space-50 whitespace-nowrap transition-opacity hover:opacity-80"
    >
      <Logo height={22} />
      <span className="font-heading text-lg font-bold leading-6 tracking-tight text-fg">
        <span className="text-neutral">/</span> Docs
      </span>
    </Link>
  );
}
