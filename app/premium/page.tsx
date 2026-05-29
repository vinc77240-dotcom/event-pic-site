import type { Metadata } from "next";
import Link from "next/link";
import { PartnerLogoGrid } from "@/app/components/public/PartnerLogoGrid";
import { ImageWithFallback } from "@/app/components/public/ImageWithFallback";
import { PublicSection } from "@/app/components/public/PublicSection";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import {
  EVENT_PIC_AUDIO_GUESTBOOK_IMAGE,
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL,
  EVENT_PIC_WOOD_PREMIUM_IMAGE
} from "@/src/shared/eventPicPublic";
import { EVENT_PIC_PARTNER_LOGOS } from "@/src/shared/partners";

export const metadata: Metadata = {
  title: "Experience Event Pic Professionnelle",
  description:
    "Une animation photobooth haut de gamme pour mariages, entreprises et evenements professionnels."
};

const PREMIUM_REASONS = [
  "Rendu plus elegant",
  "Accompagnement renforce",
  "Personnalisation graphique avancee",
  "Assistance prioritaire",
  "Selection de designs photo professionnelle",
  "Preparation soignee avant evenement"
];

const PREMIUM_INCLUDED = [
  "Photobooth professionnelle",
  "Personnalisation avancee",
  "Ecran d'accueil personnalise",
  "Formats portrait, paysage et bandelette",
  "Galerie numerique",
  "Assistance technique",
  "Options sur demande"
];

const PREMIUM_TARGETS = [
  "Mariages",
  "Evenements d'entreprise",
  "Soirees privees haut de gamme",
  "Anniversaires haut de gamme",
  "Lancements de marque"
];

export default function PremiumPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title={
          <>
            L'experience <span className="event-pic-signature heading-brand-signature">Event Pic</span>{" "}
            Professionnelle
          </>
        }
        subtitle="Une animation photobooth elegante, personnalisee et pensee pour sublimer vos plus beaux evenements."
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
                <span className="event-pic-signature hero-brand-signature">Event Pic</span>
                <span>Professionnelle</span>
              </span>
              <strong>Borne metal gris anthracite professionnelle</strong>
              <small>Ambiance chic pour soirees privees et evenements d'entreprise.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/nos-bornes">
              Nos bornes
            </Link>
            <Link className="public-button-outline" href="/choisir-mon-design">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
            <Link className="public-button-outline" href="/calculateur-tarif">
              Calculer mon tarif
            </Link>
          </>
        }
      />

      <PublicSection eyebrow="Professionnelle" title="Un niveau de finition renforce">
        <div className="public-grid public-grid-2">
          <article className="public-card media-card">
            <div className="media-card-visual">
              <img
                alt="Borne bois premium Event Pic"
                loading="lazy"
                decoding="async"
                src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
              />
            </div>
          </article>
          <article className="public-card">
            <h3>Une animation professionnelle pour vos invites</h3>
            <p>
              L'offre Professionnelle renforce l'accompagnement avant evenement, la coherence visuelle et
              la qualite percue pendant toute la prestation.
            </p>
            <ul>
              <li>Choix de borne adapte a votre ambiance</li>
              <li>Design photo plus poussee</li>
              <li>Rendu final controle avant la date</li>
            </ul>
          </article>
        </div>
      </PublicSection>

      <PublicSection title="Pourquoi choisir l'offre Professionnelle ?">
        <div className="public-grid public-grid-3">
          <article className="public-card">
            <h3>Benefices</h3>
            <ul>
              {PREMIUM_REASONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="public-card">
            <h3>Inclus</h3>
            <ul>
              {PREMIUM_INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="public-card">
            <h3>Ideal pour</h3>
            <ul>
              {PREMIUM_TARGETS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Option professionnelle" title="Livre d'or audio">
        <div className="public-grid public-grid-2">
          <article className="public-card media-card">
            <div className="media-card-visual">
              <ImageWithFallback
                alt="Livre d'or audio vintage Event Pic pour mariage et evenement"
                className="hero-photo-image"
                fallbackSrc="/services/livre-or-audio.png"
                src={EVENT_PIC_AUDIO_GUESTBOOK_IMAGE}
              />
            </div>
          </article>
          <article className="public-card">
            <h3>Livre d&apos;or audio professionnel</h3>
            <p>
              Une alternative originale au livre d&apos;or classique : vos invites decrochent le
              telephone et vous laissent un message vocal que vous conservez comme souvenir
              unique.
            </p>
            <p className="public-price">A partir de 70 EUR</p>
            <div className="public-actions-row">
              <Link className="public-button-outline" href="/calculateur-tarif">
                Ajouter cette option au devis
              </Link>
            </div>
          </article>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Entreprises"
        title="Ils nous ont fait confiance"
        description="Des entreprises, collectivites et lieux d'exception nous ont fait confiance pour animer leurs evenements avec une solution photobooth elegante, simple et memorable."
      >
        <PartnerLogoGrid logos={EVENT_PIC_PARTNER_LOGOS} />
      </PublicSection>

      <PublicCTA
        title="Preparer votre evenement professionnel"
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/tarifs">
              Voir les tarifs
            </Link>
            <Link className="public-button-outline" href="/choisir-mon-design">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
