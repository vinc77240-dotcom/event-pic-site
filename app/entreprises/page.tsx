import type { Metadata } from "next";
import Link from "next/link";
import { ContactFormClient } from "@/app/contact/ContactFormClient";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import {
  EVENT_PIC_CONTACT,
  EVENT_PIC_JBL_PARTYBOX_IMAGE,
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL
} from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Location de photobooth pour entreprise en Ile-de-France",
  description:
    "Photobooth premium pour afterwork, salon, séminaire, inauguration, CSE et événement professionnel en Île-de-France."
};

const EVENT_TYPES = [
  "Afterwork",
  "Seminaire",
  "Salon professionnel",
  "Inauguration",
  "Arbre de Noel / CSE",
  "Soiree client"
] as const;

const INCLUDED = [
  "Photobooth installe sur site",
  "Cadres photo personnalises avec logo entreprise",
  "Galerie numerique",
  "Impressions selon formule",
  "Devis rapide",
  "Facture possible",
  "Intervention en Ile-de-France : 77, 91, 94, Paris et alentours"
] as const;

const OPTIONS = [
  "Livre d'or audio ou video en option",
  "Enceintes JBL en option",
  "Fond photo",
  "Design personnalise pour votre marque",
  "Impressions supplementaires selon besoin"
] as const;

const FAQ = [
  {
    q: "Proposez-vous une facture pour les entreprises ?",
    a: "Oui, une facture peut etre fournie pour les entreprises, CSE, agences et collectivites."
  },
  {
    q: "Peut-on personnaliser le cadre avec un logo ?",
    a: "Oui, le cadre photo peut integrer votre logo, vos couleurs, le nom de l'evenement ou un message dedie."
  },
  {
    q: "Intervenez-vous sur les salons professionnels ?",
    a: "Oui, Event Pic peut intervenir sur salons, stands, inaugurations, soirees client et evenements corporate."
  },
  {
    q: "Quel delai pour recevoir un devis ?",
    a: "Nous visons un retour rapide, generalement sous 24h lorsque les informations principales sont completes."
  }
] as const;

function BrandDesignMockup() {
  return (
    <div className="brand-design-mockup" role="img" aria-label="Mockup de personnalisation marque">
      <div className="brand-design-card">
        <span className="brand-design-chip">Votre logo</span>
        <strong>Soiree d'entreprise</strong>
        <p>Votre message</p>
      </div>
      <div className="brand-screen-card">
        <small>Ecran d'accueil</small>
        <strong>Bienvenue</strong>
        <p>Event Pic x Votre marque</p>
      </div>
      <div className="brand-palette">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </div>
    </div>
  );
}

export default function EntreprisesPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Location de photobooth pour entreprise en Ile-de-France"
        subtitle="Une animation photo premium pour vos afterworks, salons, séminaires, inaugurations et événements CSE."
        description="Event Pic accompagne vos événements professionnels toute la semaine et le week-end, selon les disponibilités. Les demandes entreprises concernent souvent les afterworks, séminaires, salons, inaugurations, CSE et événements clients."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth metal gris anthracite Event Pic pour evenement entreprise"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Entreprise & CSE</span>
              <strong>Une animation premium, personnalisable et facturable</strong>
              <small>Afterwork, salon, séminaire, inauguration, arbre de Noël.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="#devis-entreprise">
              Recevoir un devis entreprise sous 24h
            </Link>
            <Link className="public-button-outline" href="/tarifs-formules">
              Tarifs & Formules
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />

      <PublicSection eyebrow="Evenements B2B" title="Pour quels evenements ?">
        <div className="public-grid public-grid-3">
          {EVENT_TYPES.map((item) => (
            <article className="public-card conversion-card" key={item}>
              <span className="conversion-card-kicker">Entreprise</span>
              <h3>{item}</h3>
              <p>Une animation photo simple a integrer, visible et memorisable pour vos invites.</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection eyebrow="Prestation" title="Ce qui est inclus pour votre entreprise">
        <div className="public-grid public-grid-2">
          <article className="public-card public-list-card">
            <h3>Base de prestation</h3>
            <ul>
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="public-card public-list-card">
            <h3>Options disponibles</h3>
            <ul>
              {OPTIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Options"
        title="Des animations complementaires pour renforcer l'experience"
        description="Ajoutez du son, des souvenirs vocaux, un decor photo ou des impressions supplementaires selon votre format d'evenement."
      >
        <div className="public-grid public-grid-2">
          <article className="public-card media-feature-card media-feature-card-jbl">
            <img
              alt="Enceinte JBL PartyBox Event Pic pour soiree entreprise"
              decoding="async"
              loading="lazy"
              src={EVENT_PIC_JBL_PARTYBOX_IMAGE}
            />
            <h3>Enceintes JBL en option</h3>
            <p>Une solution sonore puissante pour afterwork, soirée interne ou animation lounge.</p>
          </article>
          <article className="public-card media-feature-card media-feature-card-brand">
            <BrandDesignMockup />
            <h3>Design aux couleurs de votre marque</h3>
            <p>Cadre photo, visuels et écran d'accueil préparés avec votre logo, vos couleurs et votre message.</p>
          </article>
        </div>
      </PublicSection>

      <GoogleReviewsSection />

      <PublicSection eyebrow="FAQ entreprise" title="Questions frequentes entreprises">
        <div className="faq-accordion">
          {FAQ.map((item) => (
            <details className="faq-item public-card" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title="Event Pic intervient en Ile-de-France"
        description="Nous accompagnons vos evenements en Ile-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilite."
      >
        <article className="public-card">
          <p>
            Pour les entreprises, nous adaptons les horaires de livraison, installation et
            recuperation aux contraintes de votre lieu, de votre stand ou de votre reception, en
            semaine comme le week-end selon disponibilite.
          </p>
        </article>
      </PublicSection>

      <PublicSection eyebrow="Devis" title="Recevoir un devis entreprise sous 24h">
        <div id="devis-entreprise" className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Informations utiles pour une reponse rapide</h3>
            <ul>
              <li>Date, ville et horaires souhaites</li>
              <li>Type d'evenement et nombre d'invites</li>
              <li>Formule impressions ou digitale</li>
              <li>Options : logo, galerie, livre d'or audio, JBL, fond photo</li>
            </ul>
          </article>
          <ContactFormClient defaultEventType="Entreprise" title="Demande de devis entreprise" />
        </div>
      </PublicSection>

      <PublicCTA
        title="Besoin d'une animation entreprise rapide a cadrer ?"
        actions={
          <>
            <Link className="public-button-dark" href="#devis-entreprise">
              Demander un devis
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
