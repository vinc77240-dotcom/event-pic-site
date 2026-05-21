import { ReactNode } from "react";

type PublicSectionProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function renderBrandText(value: ReactNode) {
  if (typeof value !== "string" || !value.includes("Event Pic")) {
    return value;
  }

  const parts = value.split("Event Pic");

  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 ? (
        <span className="event-pic-signature heading-brand-signature">Event Pic</span>
      ) : null}
    </span>
  ));
}

export function PublicSection({
  eyebrow,
  title,
  description,
  children,
  className
}: PublicSectionProps) {
  const eyebrowClassName =
    typeof eyebrow === "string" && eyebrow.trim() === "Event Pic"
      ? "eyebrow event-pic-signature section-brand-signature"
      : "eyebrow";

  return (
    <section className={`public-section premium-container ${className ?? ""}`.trim()}>
      {eyebrow || title || description ? (
        <div className="public-section-heading">
          {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
          {title ? <h2>{renderBrandText(title)}</h2> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children ?? null}
    </section>
  );
}
