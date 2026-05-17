import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Demande envoyee - Event Pic",
  description: "Confirmation d'envoi de demande de devis Event Pic."
};

export default function MerciPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Votre demande a bien ete envoyee"
        subtitle="Event Pic revient vers vous rapidement pour confirmer les disponibilites et preparer une proposition adaptee a votre evenement."
        description="Vous pouvez continuer a parcourir le site pendant que nous preparons votre retour."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth Event Pic en situation evenementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Demande recue</span>
              <strong>Nous revenons vers vous rapidement</strong>
              <small>Disponibilite, formule, options et organisation.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/">
              Retour a l'accueil
            </Link>
            <Link className="public-button-outline" href="/avis-clients">
              Voir nos avis clients
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
