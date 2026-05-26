import { ReactNode } from "react";

type PublicCTAProps = {
  title: string;
  actions: ReactNode;
  className?: string;
};

export function PublicCTA({ title, actions, className }: PublicCTAProps) {
  return (
    <section className={["public-section premium-container public-cta-section", className].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      <div className="public-actions-row">{actions}</div>
    </section>
  );
}
