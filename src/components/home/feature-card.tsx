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
  let gradient = "feature-gradient";
  if (variant === "danger") {
    gradient = "feature-gradient-danger";
  }
  const cardClass = `group flex h-full min-w-0 flex-1 flex-col items-start gap-space-30 px-space-100 py-space-70 ${gradient} ${className ?? ""}`;

  const body = (
    <>
      {icon && (
        <div className="mb-space-30 flex size-8 items-center justify-center text-fg">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-base font-bold tracking-tight text-fg">
        {title}
      </h3>
      <p className="min-w-full font-body text-sm leading-normal text-neutral">
        {description}
      </p>
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
