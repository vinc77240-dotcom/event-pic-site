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
  title: "Photobooth pour mariage et evenement prive",
  description:
    "Photobooth premium pour mariage, anniversaire, bapteme et soiree privee avec impressions, galerie et design personnalise."
};

const PRIVATE_EVENTS = ["Mariage", "Anniversaire", "Bapteme", "Soiree privee"] as const;

const BENEFITS = [
  "Borne bois vintage / champetre",
  "Borne metal gris anthracite",
  "Impressions instantanees",
  "Design photo personnalise",
  "Galerie numerique",
  "Accessoires festifs inclus",
  "Livre d'or audio en option",
  "Enceintes JBL en option"
] as const;

export default function EvenementsPrivesPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Photobooth pour mariage et evenement prive"
        subtitle="Des souvenirs imprimes et digitaux, avec une borne elegante, installee et personnalisee pour votre evenement."
        description="Event Pic prepare une experience photobooth fluide, conviviale et premium pour vos mariages, anniversaires, baptemes et soirees privees, en semaine comme le week-end selon disponibilite."
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
              <span className="hero-brand-eyebrow">Evenements prives</span>
              <strong>Une animation elegante, installee et personnalisee</strong>
              <small>Borne bois, borne metal, impressions, galerie et accessoires.</small>
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

      <PublicSection eyebrow="Evenements prives" title="Pour vos moments importants">
        <div className="public-grid public-grid-4">
          {PRIVATE_EVENTS.map((item) => (
            <article className="public-card conversion-card" key={item}>
              <span className="conversion-card-kicker">{item}</span>
              <h3>{item}</h3>
              <p>Une animation simple a utiliser, belle en photo et facile a partager.</p>
            </article>
          ))}
        </div>
        <p className="public-section-description">
          Les evenements prives sont souvent organises du vendredi au dimanche, mais une
          reservation reste possible sur d'autres jours selon disponibilite.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Experience" title="Tout est prevu pour vos invites">
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
              alt="Borne metal gris anthracite Event Pic en reception"
              decoding="async"
              loading="lazy"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <h3>Deux styles selon votre ambiance</h3>
            <p>
              Choisissez la chaleur champetre de la borne bois ou le rendu moderne de la borne
              metal gris anthracite.
            </p>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Options" title="Completer votre evenement">
        <div className="public-grid public-grid-3 evenements-prives-options">
          <ServiceCard
            className="audio-guestbook-card"
            title="Livre d'or audio"
            description="Vos invites laissent un message vocal que vous conservez comme souvenir unique."
            imageAlt="Livre d'or audio vintage Event Pic"
            imageFit="contain"
            imageSrc={EVENT_PIC_AUDIO_GUESTBOOK_IMAGE}
            href="/tarifs-formules"
          />
          <ServiceCard
            className="jbl-partybox-card"
            title="Enceintes JBL PartyBox"
            description="Une solution sonore lumineuse pour completer l'ambiance de votre soiree."
            imageAlt="Enceinte JBL PartyBox 710 Event Pic"
            imageFit="contain"
            imageSrc={EVENT_PIC_JBL_PARTYBOX_IMAGE}
            href="/tarifs-formules"
          />
          <ServiceCard
            title="Design photo personnalise"
            description="Choisissez votre modele photo, vos textes et votre ecran d'accueil."
            imageSrc="/template-previews/atelier-portrait-4x6.svg"
            href="/choisir-mon-design"
            ctaLabel={EVENT_PIC_TEMPLATE_PICKER_LABEL}
          />
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title="Event Pic intervient en Ile-de-France"
        description="Nous accompagnons vos evenements en Ile-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilite."
      />

      <PublicSection eyebrow="Devis" title="Demander une proposition pour votre evenement">
        <div id="devis-prive" className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Pour une reponse precise</h3>
            <ul>
              <li>Indiquez la date, la ville et les horaires.</li>
              <li>Precisez le nombre d'invites et la formule souhaitee.</li>
              <li>Ajoutez les options utiles : audio, JBL, fond photo, design.</li>
            </ul>
          </article>
          <ContactFormClient defaultEventType="Mariage" title="Demande de devis evenement prive" />
        </div>
      </PublicSection>

      <PublicCTA
        title="Vous preparez un mariage ou une soiree privee ?"
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
