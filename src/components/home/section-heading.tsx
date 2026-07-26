import type { ReactNode } from "react";

// Section title used above the IDE and Tutorials rows ("Get started with IDE",
// "Tutorials"). Space Mono heading on the standard content background.
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col justify-center border-b border-border-subtle bg-surface p-space-100">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-fg">
        {children}
      </h2>
    </div>
  );
}
