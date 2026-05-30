import type { Metadata } from "next";
import Link from "next/link";
import { ContactFormClient } from "@/app/contact/ContactFormClient";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import { ServiceCard } from "@/app/components/public/ServiceCard";
import {
  EVENT_PIC_AUDIO_GUESTBOOK_IMAGE,
  EVENT_PIC_CONTACT,
  EVENT_PIC_JBL_PARTYBOX_IMAGE,
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL,
  EVENT_PIC_WOOD_PREMIUM_IMAGE
} from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Photobooth pour mariage et événement privé",
  description:
    "Photobooth premium pour mariage, anniversaire, baptême et soirée privée avec impressions, galerie et design personnalisé."
};

const PRIVATE_EVENTS = ["Mariage", "Anniversaire", "Baptême", "Soirée privée"] as const;

const BENEFITS = [
  "Borne bois vintage / champêtre",
  "Borne métal",
  "Impressions instantanées",
  "Design photo personnalisé",
  "Galerie numérique",
  "Accessoires festifs inclus",
  "Livre d'or audio en option",
  "Enceintes JBL en option"
] as const;

export default function EvenementsPrivesPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Photobooth pour mariage et événement privé"
        subtitle="Des souvenirs imprimés et digitaux, avec une borne élégante, installée et personnalisée pour votre événement."
        description="Event Pic prépare une expérience photobooth fluide, conviviale et premium pour vos mariages, anniversaires, baptêmes et soirées privées, en semaine comme le week-end selon disponibilité."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne bois premium Event Pic pour mariage"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Événements privés</span>
              <strong>Une animation élégante, installée et personnalisée</strong>
              <small>Borne bois, borne métal, impressions, galerie et accessoires.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="#devis-prive">
              Demander mon devis
            </Link>
            <Link className="public-button-outline" href="/choisir-mon-design">
              Choisir mon design
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />

      <PublicSection eyebrow="Événements privés" title="Pour vos moments importants">
        <div className="public-grid public-grid-4">
          {PRIVATE_EVENTS.map((item) => (
            <article className="public-card conversion-card" key={item}>
              <span className="conversion-card-kicker">{item}</span>
              <h3>{item}</h3>
              <p>Une animation simple à utiliser, belle en photo et facile à partager.</p>
            </article>
          ))}
        </div>
        <p className="public-section-description">
          Les événements privés sont souvent organisés du vendredi au dimanche, mais une
          réservation reste possible sur d'autres jours selon disponibilité.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Expérience" title="Tout est prévu pour vos invités">
        <div className="public-grid public-grid-2">
          <article className="public-card public-list-card">
            <h3>Inclus et disponible</h3>
            <ul>
              {BENEFITS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="public-card media-feature-card">
            <img
              alt="Borne métal Event Pic en reception"
              decoding="async"
              loading="lazy"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <h3>Deux styles selon votre ambiance</h3>
            <p>
              Choisissez la chaleur champêtre de la borne bois ou le rendu moderne de la borne
              métal.
            </p>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Options" title="Completer votre événement">
        <div className="public-grid public-grid-3 evenements-prives-options">
          <ServiceCard
            className="audio-guestbook-card"
            title="Livre d'or audio"
            description="Vos invités laissent un message vocal que vous conservez comme souvenir unique."
            imageAlt="Livre d'or audio vintage Event Pic"
            imageFit="contain"
            imageSrc={EVENT_PIC_AUDIO_GUESTBOOK_IMAGE}
            href="/tarifs-et-formules"
          />
          <ServiceCard
            className="jbl-partybox-card"
            title="Enceintes JBL PartyBox"
            description="Une solution sonore lumineuse pour compléter l'ambiance de votre soirée."
            imageAlt="Enceinte JBL PartyBox 710 Event Pic"
            imageFit="contain"
            imageSrc={EVENT_PIC_JBL_PARTYBOX_IMAGE}
            href="/tarifs-et-formules"
          />
          <ServiceCard
            title="Design photo personnalisé"
            description="Choisissez votre modèle photo, vos textes et votre Écran d'accueil."
            imageSrc="/template-previews/atelier-portrait-4x6.svg"
            href="/choisir-mon-design"
            ctaLabel={EVENT_PIC_TEMPLATE_PICKER_LABEL}
          />
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title="Event Pic intervient en Île-de-France"
        description="Nous accompagnons vos événements en Île-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilité."
      />

      <PublicSection eyebrow="Devis" title="Demander une proposition pour votre événement">
        <div id="devis-prive" className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Pour une réponse précise</h3>
            <ul>
              <li>Indiquez la date, la ville et les horaires.</li>
              <li>Précisez le nombre d'invités et la formule souhaitée.</li>
              <li>Ajoutez les options utiles : audio, JBL, fond photo, design.</li>
            </ul>
          </article>
          <ContactFormClient defaultEventType="Mariage" title="Demande de devis événement privé" />
        </div>
      </PublicSection>

      <PublicCTA
        title="Vous préparez un mariage ou une soirée privée ?"
        actions={
          <>
            <Link className="public-button-dark" href="#devis-prive">
              Demander mon devis
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <Link className="public-button-outline" href="/choisir-mon-design">
              Choisir mon design
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
