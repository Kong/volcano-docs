import { Logo } from "@/components/logo";

// Header brand: the Volcano logo followed by "/ Docs", matching the design.
export function NavTitle() {
  return (
    <span className="flex items-center gap-space-50">
      <Logo height={22} />
      <span className="font-heading text-lg font-bold tracking-tight text-fg">
        <span className="text-neutral">/</span> Docs
      </span>
    </span>
  );
}
