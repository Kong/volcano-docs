import "./section-heading.css";

import type { ReactNode } from "react";

// Section title used above the IDE and Tutorials rows ("Get started with IDE",
// "Tutorials"). Space Mono heading on the standard content background.
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="section-heading">
      <h2 className="section-heading-title">{children}</h2>
    </div>
  );
}
