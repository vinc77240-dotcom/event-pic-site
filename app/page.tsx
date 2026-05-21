import type { Metadata } from "next";
import Link from "next/link";
import {
  EVENT_PIC_AUDIO_GUESTBOOK_IMAGE,
  EVENT_PIC_CONTACT,
  EVENT_PIC_JBL_PARTYBOX_IMAGE,
  EVENT_PIC_METAL_PREMIUM_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL,
  EVENT_PIC_WOOD_PREMIUM_IMAGE
} from "@/src/shared/eventPicPublic";
import { EVENT_PIC_PARTNER_LOGOS } from "@/src/shared/partners";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PartnerLogoGrid } from "@/app/components/public/PartnerLogoGrid";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import { ServiceCard } from "@/app/components/public/ServiceCard";

export const metadata: Metadata = {
  title: "Event Pic - Photobooth professionnelle en Île-de-France",
  description:
    "Location de photobooths professionnels, livre d'or audio et animations événementielles pour mariages, anniversaires et entreprises en Île-de-France."
};

const PROOF_BADGES = [
  "5,0/5 Google",
  "63 avis",
  "Installation incluse",
  "Cadres personnalisés",
  "Galerie numérique",
  "Devis sous 24h",
  "Île-de-France"
] as const;

const HOME_STEPS = [
  {
    title: "Demandez votre devis",
    text: "Indiquez la date, le lieu et le type d'événement. Event Pic vérifie les disponibilités et prépare une proposition adaptée.",
    icon: "quote"
  },
  {
    title: "Personnalisez votre expérience",
    text: "Choisissez votre borne, votre design photo, vos textes et les options souhaitées.",
    icon: "design"
  },
  {
    title: "Profitez le jour J",
    text: "Nous installons le matériel, vos invités profitent de l'animation et vous récupérez vos souvenirs numériques.",
    icon: "event"
  }
] as const;

const BENEFITS = [
  { title: "Installation incluse", icon: "setup" },
  { title: "Qualité photo professionnelle", icon: "camera" },
  { title: "Impressions instantanées", icon: "print" },
  { title: "Design personnalisé", icon: "design" },
  { title: "Galerie numérique", icon: "gallery" },
  { title: "Accessoires festifs inclus", icon: "party" },
  { title: "Options audio & JBL", icon: "audio" },
  { title: "Accompagnement Event Pic", icon: "support" }
] as const;

function HomeIcon({ type }: { type: string }) {
  if (type === "quote") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 4h8l4 4v11a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M14 4v4h4" />
        <path d="M8.5 12.5h6M8.5 15.5h6" />
      </svg>
    );
  }

  if (type === "design") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 0-4.6H12a2 2 0 0 1 0-4h5.3A2.7 2.7 0 0 0 20 9.7 6.7 6.7 0 0 0 12 3Z" />
        <path d="M8 10h.01M10 7.5h.01M13.2 7h.01M15.8 9.2h.01" />
      </svg>
    );
  }

  if (type === "event") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 17V8.8a1.8 1.8 0 0 1 3-1.3l2.2 1.8 2.5-2 2.5 2 2.2-1.8a1.8 1.8 0 0 1 3 1.3V17" />
        <path d="M4 17h16M8.5 12.5v2.5M12 11v4M15.5 12.5v2.5" />
      </svg>
    );
  }

  if (type === "setup") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 6h11v9H3zM14 9h3.5l2.5 2.7V15h-6V9Z" />
        <path d="M7 18.2a1.8 1.8 0 1 0 0-.01ZM17 18.2a1.8 1.8 0 1 0 0-.01Z" />
      </svg>
    );
  }

  if (type === "camera") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 8h16v10H4zM8 8l1.4-2h5.2L16 8" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    );
  }

  if (type === "print") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 4h10v4H7zM6 10h12a2 2 0 0 1 2 2v4H4v-4a2 2 0 0 1 2-2Z" />
        <path d="M7 14h10v6H7z" />
      </svg>
    );
  }

  if (type === "gallery") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5h16v14H4z" />
        <path d="m8 13 2.5 2.5L14 12l4 4" />
        <circle cx="9" cy="9" r="1.2" />
      </svg>
    );
  }

  if (type === "party") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 17V8.8a1.8 1.8 0 0 1 3-1.3l2.2 1.8 2.5-2 2.5 2 2.2-1.8a1.8 1.8 0 0 1 3 1.3V17" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (type === "audio") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 9h2a3 3 0 0 1 3 3v6H9a3 3 0 0 1-3-3V9Zm12 0h-2a3 3 0 0 0-3 3v6h2a3 3 0 0 0 3-3V9Z" />
        <path d="M8 9a4 4 0 1 1 8 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3Z" />
      <path d="m9.2 11.7 2.1 2.1 3.8-3.8" />
    </svg>
  );
}

function PersonalizedDesignMockup() {
  return (
    <div className="home-design-mockup" role="img" aria-label="Mockup cadre photo personnalisé">
      <div className="home-design-card">
        <span>Votre logo</span>
        <strong>Votre texte</strong>
        <small>Format 10x15 ou bande 2x6</small>
      </div>
      <div className="home-screen-card">
        <small>Écran d'accueil</small>
        <strong>Bienvenue</strong>
        <p className="event-pic-signature home-screen-signature">Event Pic</p>
      </div>
      <div className="home-design-palette">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function BackdropDecorMockup() {
  return (
    <div className="home-backdrop-mockup" role="img" aria-label="Décor fond photo événementiel">
      <div className="home-backdrop-arch" />
      <div className="home-backdrop-stage">
        <span>Espace photo</span>
      </div>
      <div className="home-backdrop-lights">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicSiteShell>
      <PublicHero
        className="home-hero-signature"
        title="Transformez vos événements en souvenirs inoubliables"
        subtitle="Photobooths professionnels, livre d'or audio et animations événementielles en Île-de-France."
        description="Event Pic accompagne vos mariages, anniversaires, soirées privées et événements professionnels avec une mise en scène élégante et une organisation fluide."
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
              <span className="hero-brand-eyebrow hero-brand-eyebrow-with-signature">
                <span className="event-pic-signature hero-brand-signature">Event Pic</span>
                <span>Professionnelle</span>
              </span>
              <strong>Borne bois &amp; borne métal gris anthracite</strong>
              <small>Deux styles premium pour événements privés et professionnels.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/nos-bornes">
              Voir nos bornes
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
            <div className="hero-proof-bar" aria-label="Preuves Event Pic">
              {PROOF_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </>
        }
      />

      <PublicSection eyebrow="Nos animations" title="Des expériences pensées pour vos invités" className="home-animations-section">
        <div className="public-grid public-grid-5">
          <ServiceCard
            title="Photobooth premium"
            description="Borne bois ou métal gris anthracite pour une animation élégante et fluide."
            imageSrc={EVENT_PIC_METAL_PREMIUM_IMAGE}
            fallbackImageSrc={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            imageAlt="Borne photobooth métal Event Pic dans un décor premium"
            imageFit="contain"
            mediaClassName="service-card-media-metal-premium"
            href="/nos-bornes"
          />
          <ServiceCard
            className="audio-guestbook-card"
            title="Livre d'or audio"
            description="Vos invités laissent un message vocal que vous conservez comme souvenir unique."
            imageSrc={EVENT_PIC_AUDIO_GUESTBOOK_IMAGE}
            imageAlt="Livre d'or audio vintage Event Pic pour mariage et événement"
            imageFit="contain"
            href="/tarifs-formules"
          />
          <ServiceCard
            className="jbl-partybox-card"
            title="Enceintes JBL PartyBox"
            description="Une solution sonore puissante et lumineuse pour votre ambiance événementielle."
            imageSrc={EVENT_PIC_JBL_PARTYBOX_IMAGE}
            imageAlt="Enceinte JBL PartyBox 710 lumineuse pour soirée Event Pic"
            imageFit="contain"
            href="/tarifs-formules"
          />
          <ServiceCard
            title="Cadres photos personnalisés"
            description="Personnalisez le cadre photo, l'écran d'accueil et les textes de votre événement."
            mediaClassName="home-mockup-media"
            mediaContent={<PersonalizedDesignMockup />}
            href="/choisir-template"
            ctaLabel={EVENT_PIC_TEMPLATE_PICKER_LABEL}
          />
          <ServiceCard
            title="Fonds photos"
            description="Un décor photo élégant pour sublimer chaque prise de vue."
            mediaClassName="home-mockup-media"
            mediaContent={<BackdropDecorMockup />}
            href="/tarifs-formules"
          />
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Entreprise familiale"
        title="L’histoire d’un frère et d’une sœur"
        description="Une entreprise familiale, une exigence de qualité."
        className="home-family-section"
      >
        <div className="home-family-card">
          <figure className="home-family-visual">
            <img
              src="/images/event-pic-famille-frere-soeur.webp"
              alt="Frère et sœur fondateurs d’Event Pic"
              loading="lazy"
            />
            <span className="home-family-photo-badge">Entreprise familiale</span>
          </figure>
          <div className="home-family-copy">
            <p>
              Event Pic, c’est l’histoire d’un frère et d’une sœur réunis autour d’une même idée :
              créer des souvenirs élégants, simples et mémorables.
            </p>
            <p>
              De la préparation du design à l’installation sur place, nous apportons une attention
              particulière aux détails pour que chaque prestation soit fluide, soignée et fidèle à
              votre événement.
            </p>
            <p className="home-family-signature">
              Une approche familiale, un service soigné, des souvenirs qui restent.
            </p>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
          </div>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Événements"
        title="Deux parcours pour demander le bon devis"
        description="Choisissez la page adaptée à votre événement pour recevoir une proposition plus rapide et plus précise."
        className="home-paths-section"
      >
        <div className="home-path-grid">
          <article className="home-path-card">
            <img
              className="home-path-image-metal-premium"
              src={EVENT_PIC_METAL_PREMIUM_IMAGE}
              alt="Borne photobooth métal Event Pic dans un décor premium"
              loading="lazy"
            />
            <div className="home-path-overlay">
              <span>Événements professionnels</span>
              <h3>Afterworks, séminaires, salons, inaugurations, CSE et événements clients.</h3>
              <Link className="public-button-outline" href="/entreprises">
                Devis entreprise
              </Link>
            </div>
          </article>
          <article className="home-path-card">
            <img src={EVENT_PIC_WOOD_PREMIUM_IMAGE} alt="Événements privés Event Pic" loading="lazy" />
            <div className="home-path-overlay">
              <span>Événements privés</span>
              <h3>
                Mariages, anniversaires, baptêmes et soirées privées, en semaine comme le week-end
                selon disponibilité.
              </h3>
              <Link className="public-button-outline" href="/evenements-prives">
                Devis événement privé
              </Link>
            </div>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Réservation" title="Une réservation simple et sans stress" className="home-steps-section">
        <div className="home-steps-grid">
          {HOME_STEPS.map((step, index) => (
            <article className="public-card home-step-card" key={step.title}>
              <div className="home-step-top">
                <span className="home-step-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="home-step-icon">
                  <HomeIcon type={step.icon} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="public-actions-row">
          <Link className="public-button-outline" href="/faq">
            Voir la FAQ
          </Link>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Inclus"
        title="Tout est prévu pour une expérience fluide"
        className="home-benefits-section"
      >
        <div className="home-benefits-grid">
          {BENEFITS.map((item) => (
            <article className="public-card home-benefit-item" key={item.title}>
              <span className="home-benefit-icon" aria-hidden="true">
                <HomeIcon type={item.icon} />
              </span>
              <strong>{item.title}</strong>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Entreprises"
        title="Ils nous ont fait confiance"
        description="Des entreprises, collectivités et lieux d'exception nous ont fait confiance pour animer leurs événements."
        className="home-partners-section"
      >
        <PartnerLogoGrid logos={EVENT_PIC_PARTNER_LOGOS} />
      </PublicSection>

      <GoogleReviewsSection compact maxReviews={3} />

      <PublicCTA
        title="Prêt à créer des souvenirs inoubliables ?"
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/calculateur-tarif">
              Calculer mon tarif
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
              Appeler Event Pic
            </a>
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
            <a className="public-button-outline cta-desktop-only" href={EVENT_PIC_CONTACT.emailHref}>
              Envoyer un email
            </a>
          </>
        }
      />
    </PublicSiteShell>
  );
}
