import { ReactNode } from "react";

type PublicCTAProps = {
  title: string;
  actions: ReactNode;
};

export function PublicCTA({ title, actions }: PublicCTAProps) {
  return (
    <section className="public-section premium-container public-cta-section">
      <h2>{title}</h2>
      <div className="public-actions-row">{actions}</div>
    </section>
  );
}

