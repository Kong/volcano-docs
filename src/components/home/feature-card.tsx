import "./feature-card.css";

import Link from "next/link";
import type { ReactNode } from "react";

type FeatureCardProps = {
  icon?: ReactNode;
  image?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
  description: string;
  href?: string;
  variant?: "primary" | "danger" | "cover";
  className?: string;
  children?: ReactNode;
};

// A single feature card: gradient background, optional icon, title, and body.
// When `href` is set the whole card is a link. Gradient variant matches the
// design (warm primary vs. danger-tinted).
export function FeatureCard({
  icon,
  image,
  eyebrow,
  title,
  description,
  href,
  variant = "primary",
  className,
  children,
}: FeatureCardProps) {
  const cardClass = `feature-card feature-card--${variant} ${className ?? ""}`;

  const body = (
    <>
      {image && <div className="feature-card-image">{image}</div>}
      <div className="feature-card-content">
        {icon && <div className="feature-card-icon">{icon}</div>}
        {eyebrow}
        <h3 className="feature-card-title">{title}</h3>
        <p className="feature-card-body">{description}</p>
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} data-slot="feature-card" data-variant={variant} className={cardClass}>
        {body}
      </Link>
    );
  }

  return <div data-slot="feature-card" data-variant={variant} className={cardClass}>{body}</div>;
}
