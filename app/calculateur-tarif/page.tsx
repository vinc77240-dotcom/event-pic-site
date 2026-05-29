import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";
import { QuoteCalculatorClient } from "./QuoteCalculatorClient";

export const metadata: Metadata = {
  title: "Calculateur de tarif Event Pic",
  description:
    "Estimez rapidement votre tarif photobooth Event Pic et envoyez votre demande de devis."
};

export default function CalculateurTarifPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Calculateur de tarif client"
        subtitle="Preparez votre estimation et envoyez votre demande de devis."
        description="Ce calculateur fonctionne comme un assistant de devis : type d'evenement, invites, formule conseillee, options, adresse et total estime."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth metal gris anthracite Event Pic en situation evenementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Estimation rapide</span>
              <strong>Formule conseillee selon vos invites</strong>
              <small>Le total reste indicatif avant validation finale Event Pic.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/tarifs">
              Voir les tarifs
            </Link>
          </>
        }
      />
      <section className="public-section premium-container" id="devis-form">
        <QuoteCalculatorClient />
      </section>
    </PublicSiteShell>
  );
}
