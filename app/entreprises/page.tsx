import type { Metadata } from "next";
import Link from "next/link";
import { ContactFormClient } from "@/app/contact/ContactFormClient";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PartnerLogoGrid } from "@/app/components/public/PartnerLogoGrid";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import { EVENT_PIC_PARTNER_LOGOS } from "@/src/shared/partners";
import {
  EVENT_PIC_CONTACT,
  EVENT_PIC_JBL_PARTYBOX_IMAGE,
  EVENT_PIC_METAL_PREMIUM_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL
} from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Location de photobooth pour entreprise en Île-de-France",
  description:
    "Photobooth premium pour afterwork, salon, séminaire, inauguration, CSE et événement professionnel en Île-de-France."
};

const EVENT_TYPES = [
  "Afterwork",
  "Séminaire",
  "Salon professionnel",
  "Inauguration",
  "Arbre de Noël / CSE",
  "Soirée client"
] as const;

const INCLUDED = [
  "Photobooth installé sur site",
  "Cadres photo personnalisés avec logo entreprise",
  "Galerie numérique",
  "Impressions selon formule",
  "Devis rapide",
  "Facture possible",
  "Intervention en Île-de-France : 77, 91, 94, Paris et alentours"
] as const;

const OPTIONS = [
  "Livre d'or audio ou vidéo en option",
  "Enceintes JBL en option",
  "Fond photo",
  "Design personnalisé pour votre marque",
  "Impressions supplémentaires selon besoin"
] as const;

const FAQ = [
  {
    q: "Proposez-vous une facture pour les entreprises ?",
    a: "Oui, une facture peut être fournie pour les entreprises, CSE, agences et collectivités."
  },
  {
    q: "Peut-on personnaliser le cadre avec un logo ?",
    a: "Oui, le cadre photo peut intégrer votre logo, vos couleurs, le nom de l'événement ou un message dédié."
  },
  {
    q: "Intervenez-vous sur les salons professionnels ?",
    a: "Oui, Event Pic peut intervenir sur salons, stands, inaugurations, soirées client et événements corporate."
  },
  {
    q: "Quel délai pour recevoir un devis ?",
    a: "Nous visons un retour rapide, généralement sous 24h lorsque les informations principales sont complètes."
  }
] as const;

function BrandDesignMockup() {
  return (
    <div className="brand-design-mockup" role="img" aria-label="Mockup de personnalisation marque">
      <div className="brand-design-card">
        <span className="brand-design-chip">Votre logo</span>
        <strong>Soirée d'entreprise</strong>
        <p>Votre message</p>
      </div>
      <div className="brand-screen-card">
        <small>Écran d'accueil</small>
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
        title="Location de photobooth pour entreprise en Île-de-France"
        subtitle="Une animation photo premium pour vos afterworks, salons, séminaires, inaugurations et événements CSE."
        description="Event Pic accompagne vos événements professionnels toute la semaine et le week-end, selon les disponibilités. Les demandes entreprises concernent souvent les afterworks, séminaires, salons, inaugurations, CSE et événements clients."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth métal Event Pic dans un décor premium"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_PREMIUM_IMAGE}
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
            <Link className="public-button-outline" href="/tarifs-et-formules">
              Tarifs & Formules
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />

      <PublicSection eyebrow="Événements B2B" title="Pour quels événements ?">
        <div className="public-grid public-grid-3">
          {EVENT_TYPES.map((item) => (
            <article className="public-card conversion-card" key={item}>
              <h3>{item}</h3>
              <p>Une animation photo simple à intégrer, visible et mémorisable pour vos invités.</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Références clients"
        title="Ils nous ont fait confiance"
        description="Entreprises, collectivités et lieux d'exception : une ligne de références Event Pic fluide et premium."
      >
        <PartnerLogoGrid logos={EVENT_PIC_PARTNER_LOGOS} variant="marquee" />
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
        title="Des animations complémentaires pour renforcer l'expérience"
        description="Ajoutez du son, des souvenirs vocaux, un décor photo ou des impressions supplémentaires selon votre format d'événement."
      >
        <div className="public-grid public-grid-2">
          <article className="public-card media-feature-card media-feature-card-jbl">
            <img
              alt="Enceinte JBL PartyBox Event Pic pour soirée entreprise"
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

      <PublicSection eyebrow="FAQ entreprise" title="Questions fréquentes entreprises">
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
        title="Event Pic intervient en Île-de-France"
        description="Nous accompagnons vos événements en Île-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilité."
      >
        <article className="public-card">
          <p>
            Pour les entreprises, nous adaptons les horaires de livraison, installation et
            récupération aux contraintes de votre lieu, de votre stand ou de votre réception, en
            semaine comme le week-end selon disponibilité.
          </p>
        </article>
      </PublicSection>

      <PublicSection eyebrow="Devis" title="Recevoir un devis entreprise sous 24h">
        <div id="devis-entreprise" className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Informations utiles pour une réponse rapide</h3>
            <ul>
              <li>Date, ville et horaires souhaités</li>
              <li>Type d'événement et nombre d'invités</li>
              <li>Formule impressions ou digitale</li>
              <li>Options : logo, galerie, livre d'or audio, JBL, fond photo</li>
            </ul>
          </article>
          <ContactFormClient
            defaultEventType="Entreprise"
            excludedOptionIds={["impressions"]}
            showCompanyField
            title="Demande de devis entreprise"
          />
        </div>
      </PublicSection>

      <PublicCTA
        title="Besoin d'une animation entreprise rapide à cadrer ?"
        actions={
          <>
            <Link className="public-button-dark" href="#devis-entreprise">
              Demander un devis
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <Link className="public-button-outline" href="/choisir-mon-design">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
