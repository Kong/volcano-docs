import "./nav-title.css";

import Link from "next/link";
import { Logo } from "@/components/logo";

// Header brand: the Volcano logo followed by "/ Docs" on one baseline,
// matching the design (18px Space Mono, tight tracking, never wrapping).
// Links to the docs base URL so clicking the brand returns home.
export function NavTitle() {
  return (
    <Link href="/" aria-label="Volcano Docs home" className="nav-title">
      <Logo height={22} />
      <span className="nav-title-label">
        <span className="nav-title-slash">/</span> Docs
      </span>
    </Link>
  );
}
