type PricingCardProps = {
  title: string;
  priceLabel: string;
  featured?: boolean;
};

export function PricingCard({ title, priceLabel, featured = false }: PricingCardProps) {
  return (
    <article className={`pricing-card ${featured ? "is-featured" : ""}`.trim()}>
      {featured ? <span className="pricing-card-badge">{"Recommand\u00e9"}</span> : null}
      <h3>{title}</h3>
      <p>{priceLabel}</p>
    </article>
  );
}
