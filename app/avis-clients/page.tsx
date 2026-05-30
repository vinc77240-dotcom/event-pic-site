import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { EVENT_PIC_CONTACT, EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Avis clients Event Pic",
  description:
    "Retours d'expérience clients Event Pic après mariages, anniversaires et événements professionnels."
};

export default function AvisClientsPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Avis clients"
        subtitle="Des retours d'expérience après des événements Event Pic."
        description="Les vrais avis Google Event Pic sont recuperes automatiquement lorsque la connexion Google Places est configuree."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth métal Event Pic en situation événementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Retours clients</span>
              <strong>Une expérience claire, fluide et professionnelle</strong>
              <small>Mariage, anniversaire, baptême, entreprise, soirée privée.</small>
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
        title="Vous souhaitez vérifier une date ?"
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
