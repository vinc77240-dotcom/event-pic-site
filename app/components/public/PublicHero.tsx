import { ReactNode } from "react";
import { EVENT_PIC_WOOD_PREMIUM_IMAGE } from "@/src/shared/eventPicPublic";

type PublicHeroProps = {
  title: ReactNode;
  subtitle: string;
  description?: string;
  actions?: ReactNode;
  visual?: ReactNode;
  eyebrow?: ReactNode;
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

export function PublicHero({
  title,
  subtitle,
  description,
  actions,
  visual,
  eyebrow = "Event Pic",
  className
}: PublicHeroProps) {
  const eyebrowClassName =
    typeof eyebrow === "string" && eyebrow.trim() === "Event Pic"
      ? "eyebrow event-pic-signature"
      : "eyebrow";

  return (
    <section className={`public-hero ${className ?? ""}`.trim()}>
      <div className="premium-container public-hero-grid">
        <div>
          <p className={eyebrowClassName}>{eyebrow}</p>
          <h1>{renderBrandText(title)}</h1>
          <p className="public-hero-subtitle">{subtitle}</p>
          {description ? <p className="public-hero-description">{description}</p> : null}
          {actions ? <div className="public-hero-actions">{actions}</div> : null}
        </div>
        {visual ?? (
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne bois premium Event Pic"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow event-pic-signature">Event Pic</span>
              <strong>Photobooth professionnelle en bois</strong>
              <small>Une animation elegante, simple et memorable.</small>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
