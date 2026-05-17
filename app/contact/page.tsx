import type { Metadata } from "next";
import { EVENT_PIC_CONTACT, EVENT_PIC_WOOD_PREMIUM_IMAGE } from "@/src/shared/eventPicPublic";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicSection } from "@/app/components/public/PublicSection";
import { ContactFormClient } from "./ContactFormClient";

export const metadata: Metadata = {
  title: "Contact Event Pic",
  description:
    "Contactez Event Pic pour votre mariage, anniversaire, soiree privee ou evenement professionnel."
};

export default function ContactPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Contact"
        subtitle="Parlons de votre evenement."
        description="Expliquez votre besoin et nous revenons rapidement vers vous avec une proposition adaptee."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne Event Pic en situation evenementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Contact rapide</span>
              <strong>Reponse claire et suivi personnalise</strong>
              <small>IDF &amp; limitrophes - retour rapide sur vos demandes.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <a className="public-button-dark" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />

      <PublicSection eyebrow="Coordonnees" title="Event Pic vous repond rapidement">
        <div className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Nous contacter</h3>
            <ul>
              <li>
                <a href={EVENT_PIC_CONTACT.phoneHref}>{EVENT_PIC_CONTACT.phoneDisplay}</a>
              </li>
              <li>
                <a href={EVENT_PIC_CONTACT.emailHref}>{EVENT_PIC_CONTACT.email}</a>
              </li>
              <li>
                <a
                  href={EVENT_PIC_CONTACT.instagramUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={EVENT_PIC_CONTACT.whatsappUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  WhatsApp
                </a>
              </li>
              <li>{EVENT_PIC_CONTACT.zone}</li>
            </ul>
            <p className="contact-reassurance">
              Nous vous aidons a choisir la formule adaptee et a preparer votre evenement en toute
              clarte.
            </p>
          </article>
          <ContactFormClient />
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title="Event Pic intervient en Ile-de-France"
        description="Nous accompagnons vos evenements en Ile-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilite."
      />
    </PublicSiteShell>
  );
}
