import type { Metadata } from "next";
import {
  FaEnvelope,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp
} from "react-icons/fa";
import { EVENT_PIC_CONTACT, EVENT_PIC_WOOD_PREMIUM_IMAGE } from "@/src/shared/eventPicPublic";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicSection } from "@/app/components/public/PublicSection";
import { ContactFormClient } from "./ContactFormClient";

export const metadata: Metadata = {
  title: "Contact Event Pic",
  description:
    "Contactez Event Pic pour votre mariage, anniversaire, soirée privée ou événement professionnel."
};

export default function ContactPage() {
  const instagramUrl = EVENT_PIC_CONTACT.instagramUrl || "#";

  return (
    <PublicSiteShell>
      <PublicHero
        title="Contact"
        subtitle="Parlons de votre événement."
        description="Expliquez votre besoin et nous revenons rapidement vers vous avec une proposition adaptée."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne Event Pic en situation événementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Contact rapide</span>
              <strong>Réponse claire et suivi personnalisé</strong>
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

      <PublicSection
        eyebrow="Coordonnées"
        title={
          <>
            <span className="event-pic-signature heading-brand-signature">Event Pic</span> vous répond rapidement
          </>
        }
      >
        <div className="public-grid public-grid-2">
          <article className="public-card contact-details-card">
            <h3>Nous contacter</h3>
            <div className="contact-lines">
              <a className="contact-line" href="tel:+33760421876">
                <span className="contact-line-icon" aria-hidden="true">
                  <FaPhoneAlt />
                </span>
                <span className="contact-line-copy">
                  <span className="contact-line-label">Téléphone</span>
                  <span className="contact-line-value">07 60 42 18 76</span>
                </span>
              </a>

              <a className="contact-line" href="mailto:contact@eventpic.fr">
                <span className="contact-line-icon" aria-hidden="true">
                  <FaEnvelope />
                </span>
                <span className="contact-line-copy">
                  <span className="contact-line-label">Email</span>
                  <span className="contact-line-value">contact@eventpic.fr</span>
                </span>
              </a>

              <a
                className="contact-line"
                href={instagramUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="contact-line-icon" aria-hidden="true">
                  <FaInstagram />
                </span>
                <span className="contact-line-copy">
                  <span className="contact-line-label">Instagram</span>
                  <span className="contact-line-value">Instagram</span>
                </span>
              </a>

              <a
                className="contact-line"
                href="https://wa.me/33760421876"
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="contact-line-icon" aria-hidden="true">
                  <FaWhatsapp />
                </span>
                <span className="contact-line-copy">
                  <span className="contact-line-label">WhatsApp</span>
                  <span className="contact-line-value">WhatsApp</span>
                </span>
              </a>

              <div className="contact-line contact-line-static">
                <span className="contact-line-icon" aria-hidden="true">
                  <FaMapMarkerAlt />
                </span>
                <span className="contact-line-copy">
                  <span className="contact-line-label">Zone</span>
                  <span className="contact-line-value">IDF &amp; limitrophes</span>
                </span>
              </div>
            </div>
            <p className="contact-reassurance">
              Nous vous aidons à choisir la formule adaptée et à préparer votre événement en toute
              clarté.
            </p>
          </article>
          <ContactFormClient />
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title={
          <>
            <span className="event-pic-signature heading-brand-signature">Event Pic</span> intervient en Île-de-France
          </>
        }
        description="Nous accompagnons vos événements en Île-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilité."
      />
    </PublicSiteShell>
  );
}
