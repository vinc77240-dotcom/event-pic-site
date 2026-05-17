import { ReactNode } from "react";

type PublicSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export function PublicSection({
  eyebrow,
  title,
  description,
  children,
  className
}: PublicSectionProps) {
  return (
    <section className={`public-section premium-container ${className ?? ""}`.trim()}>
      {eyebrow || title || description ? (
        <div className="public-section-heading">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children ?? null}
    </section>
  );
}
