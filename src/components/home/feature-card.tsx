import "./feature-card.css";

import Link from "next/link";
import type { ReactNode } from "react";

type FeatureCardProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  href?: string;
  variant?: "primary" | "danger";
  className?: string;
};

// A single feature card: gradient background, optional icon, title, and body.
// When `href` is set the whole card is a link. Gradient variant matches the
// design (warm primary vs. danger-tinted).
export function FeatureCard({
  icon,
  title,
  description,
  href,
  variant = "primary",
  className,
}: FeatureCardProps) {
  const cardClass = `feature-card feature-card--${variant} ${className ?? ""}`;

  const body = (
    <>
      {icon && <div className="feature-card-icon">{icon}</div>}
      <h3 className="feature-card-title">{title}</h3>
      <p className="feature-card-body">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {body}
      </Link>
    );
  }

  return <div className={cardClass}>{body}</div>;
}
