import type { Metadata } from "next";
import Link from "next/link";
import {
  EVENT_PIC_AUDIO_GUESTBOOK_IMAGE,
  EVENT_PIC_BACKDROP_IMAGE,
  EVENT_PIC_CONTACT,
  EVENT_PIC_JBL_PARTYBOX_IMAGE,
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_WOOD_PREMIUM_IMAGE,
  EVENT_PIC_OPTIONS
} from "@/src/shared/eventPicPublic";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { ImageWithFallback } from "@/app/components/public/ImageWithFallback";
import { PricingCard } from "@/app/components/public/PricingCard";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";

export const metadata: Metadata = {
  title: "Tarifs photobooth Event Pic",
  description:
    "Decouvrez les formules de location photobooth Event Pic, avec impressions, personnalisation, galerie et options."
};

const INCLUDED = [
  "Livraison, installation et recuperation",
  "Personnalisation des cadres photos",
  "Ecran d'accueil personnalise",
  "3 formats photo",
  "Accessoires",
  "Photos digitales illimitees",
  "Assistance technique"
];

const PACKAGES = [
  { id: "digital", label: "Pack digital", priceLabel: "250 EUR" },
  { id: "300", label: "300 impressions", priceLabel: "330 EUR" },
  { id: "400", label: "400 impressions", priceLabel: "380 EUR", featured: true },
  { id: "500", label: "500 impressions", priceLabel: "430 EUR" },
  { id: "700", label: "700 impressions", priceLabel: "500 EUR" },
  { id: "illimitee", label: "Impression illimitee", priceLabel: "Sur devis" }
] as const;

export default function TarifsPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title={
          <>
            Tarifs <span className="event-pic-signature heading-brand-signature">Event Pic</span>
          </>
        }
        subtitle="Des formules claires, adaptables a votre evenement."
        description="Choisissez votre formule photobooth et vos options selon vos besoins."
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
              <span className="hero-brand-eyebrow hero-brand-eyebrow-with-signature">
                <span>Tarifs</span>
                <span className="event-pic-signature hero-brand-signature">Event Pic</span>
              </span>
              <strong>Formules simples, rendu premium</strong>
              <small>Acompte de 100 EUR pour bloquer la date.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-outline" href="/nos-bornes">
              Nos bornes
            </Link>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />

      <PublicSection
        eyebrow="Formules"
        title="Tarifs & Formules photobooth"
        description="Tarifs indicatifs, devis personnalise selon date, lieu, horaires et options."
      >
        <div className="public-grid public-grid-3">
          {PACKAGES.map((item) => (
            <PricingCard
              key={item.id}
              title={item.label}
              priceLabel={item.priceLabel}
              featured={"featured" in item && item.featured === true}
            />
          ))}
        </div>
        <div className="public-actions-row pricing-actions-row">
          <Link className="public-button-dark" href="/contact">
            Demander un devis
          </Link>
          <Link className="public-button-outline" href="/entreprises">
            Devis entreprise
          </Link>
          <Link className="public-button-outline" href="/evenements-prives">
            Devis evenement prive
          </Link>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Options" title="Services complementaires">
        <div className="public-grid public-grid-2">
          {EVENT_PIC_OPTIONS.map((option) => (
            <article className="public-card option-service-card" key={option.id}>
              {option.id === "livre-audio" ? (
                <figure className="media-card-visual option-media-audio">
                  <ImageWithFallback
                    alt="Livre d'or audio vintage Event Pic pour mariage et evenement"
                    className="option-media-image"
                    fallbackSrc="/services/livre-or-audio.png"
                    src={EVENT_PIC_AUDIO_GUESTBOOK_IMAGE}
                  />
                </figure>
              ) : null}
              {option.id === "fond-photo" ? (
                <figure className="media-card-visual option-media-fond">
                  <ImageWithFallback
                    alt="Fond photo elegant Event Pic en ambiance evenementielle"
                    className="option-media-image"
                    fallbackSrc="/photobooths/visuel-premium.jpg"
                    src={EVENT_PIC_BACKDROP_IMAGE}
                  />
                </figure>
              ) : null}
              {option.id === "jbl-partybox" ? (
                <figure className="media-card-visual option-media-jbl">
                  <ImageWithFallback
                    alt="Enceinte JBL PartyBox 710 lumineuse pour soiree Event Pic"
                    className="option-media-image"
                    fallbackSrc="/images/event-pic/jbl-partybox-710-premium.png"
                    src={EVENT_PIC_JBL_PARTYBOX_IMAGE}
                  />
                </figure>
              ) : null}
              {option.id === "brunch" ? (
                <figure className="media-card-visual option-media-brunch">
                  <ImageWithFallback
                    alt="Ambiance brunch evenementielle Event Pic"
                    className="option-media-image"
                    fallbackSrc={EVENT_PIC_WOOD_PREMIUM_IMAGE}
                    src="/photobooths/visuel-premium.jpg"
                  />
                </figure>
              ) : null}
              <h3>
                {option.id === "brunch"
                  ? `Option Brunch : +${option.price} EUR`
                  : option.label}
              </h3>
              <p>{option.description}</p>
              {option.id === "brunch" ? (
                <p className="public-price">{`+${option.price} EUR`}</p>
              ) : option.id === "jbl-partybox" ? (
                <p className="public-price">{`A partir de ${option.price} EUR avec micros`}</p>
              ) : (
                <p className="public-price">{`A partir de ${option.price} EUR`}</p>
              )}
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection title="Inclus dans chaque prestation">
        <article className="public-card public-list-card">
          <ul>
            {INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="public-highlight">Acompte de 100 EUR demande pour bloquer la date.</p>
        </article>
        <div className="public-actions-row">
          <Link className="public-button-dark" href="/calculateur-tarif">
            Calculer mon tarif
          </Link>
          <Link className="public-button-outline" href="/contact">
            Demander un devis
          </Link>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Zone"
        title="Event Pic intervient en Ile-de-France"
        description="Nous accompagnons vos evenements en Ile-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilite."
      />

      <PublicCTA
        title="Besoin d'un tarif confirme pour votre date ?"
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
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
