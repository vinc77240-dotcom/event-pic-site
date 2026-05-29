import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { EVENT_PIC_CONTACT, EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Avis clients Event Pic",
  description:
    "Retours d'experience clients Event Pic apres mariages, anniversaires et evenements professionnels."
};

export default function AvisClientsPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Avis clients"
        subtitle="Des retours d'experience apres des evenements Event Pic."
        description="Les vrais avis Google Event Pic sont recuperes automatiquement lorsque la connexion Google Places est configuree."
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
              <span className="hero-brand-eyebrow">Retours clients</span>
              <strong>Une experience claire, fluide et professionnelle</strong>
              <small>Mariage, anniversaire, bapteme, entreprise, soiree privee.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/nos-bornes">
              Voir nos bornes
            </Link>
          </>
        }
      />

      <GoogleReviewsSection />

      <PublicCTA
        title="Vous souhaitez verifier une date ?"
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />
    </PublicSiteShell>
  );
}
