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
    text: "Partagez la date, le lieu et le type d'événement. Nous revenons avec une proposition adaptée.",
    icon: "quote"
  },
  {
    title: "Personnalisez votre expérience",
    text: "Choisissez la borne, le design photo, les textes et les options utiles.",
    icon: "design"
  },
  {
    title: "Profitez le jour J",
    text: "Event Pic installe le matériel, vos invités profitent, vous gardez les souvenirs.",
    icon: "event"
  }
] as const;

function HomeIcon({ type }: { type: string }) {
  if (type === "quote") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M9 4h6l1 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l1-2Z" />
        <path d="M9 4h6v3H9z" />
        <path d="m8.4 13.1 2.2 2.2 5-5" />
      </svg>
    );
  }

  if (type === "design") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3a9 9 0 0 0 0 18h1.1a2.2 2.2 0 0 0 0-4.4H12a2 2 0 0 1 0-4h5.2A2.8 2.8 0 0 0 20 9.8 6.8 6.8 0 0 0 12 3Z" />
        <circle cx="7.8" cy="11" r=".6" />
        <circle cx="10.2" cy="7.8" r=".6" />
        <circle cx="13.7" cy="7.3" r=".6" />
        <circle cx="16.1" cy="9.7" r=".6" />
      </svg>
    );
  }

  if (type === "event") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m5 20 4.2-10.8L15 15 5 20Z" />
        <path d="m9.2 9.2 5.6 5.6" />
        <path d="M14 5.5h.01M18.8 6.2l-1.6 1.6M18.5 12.5h.01M12.8 4l-.5 2.2" />
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

  if (type === "accessories") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <ellipse cx="7.6" cy="12.4" rx="2.8" ry="2.2" />
        <ellipse cx="16.2" cy="12.4" rx="2.8" ry="2.2" />
        <path d="M10.4 12.4h3.8" />
        <path d="M4.8 12.4h1.9" />
        <path d="M17.8 12.4h1.9" />
        <path d="M4.5 8.4h15M5.6 8.4h-1.6L4 10.7M18.4 8.4h1.6L20 10.7" />
        <path d="M6.8 10.7h10.4" />
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
            subtitle="Photobooths professionnels, livres d’or audio et vidéo, et animations événementielles en Île-de-France."
        description="Event Pic accompagne vos mariages, anniversaires, soirées privées et événements professionnels avec une mise en scène élégante et une organisation fluide."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth bois Event Pic dans une ambiance mariage premium"
              className="hero-photo-image home-hero-wood-image"
              decoding="async"
              loading="eager"
              src="/images/event-pic/photobooth-bois-premium-event-pic.png"
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow hero-brand-eyebrow-with-signature">
                <span className="event-pic-signature hero-brand-signature">Event Pic</span>
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
        <div className="public-grid public-grid-6">
          <ServiceCard
            title="Photobooth premium"
            description="Borne bois ou métal pour une animation élégante et fluide."
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
            imageFit="cover"
            href="/tarifs-formules"
          />
          <ServiceCard
            className="video-guestbook-card"
            title="Livre d'or vidéo"
            description="Vos invités enregistrent un message vidéo pour créer un souvenir vivant, personnel et émouvant."
            imageSrc="/images/event-pic/livre-or-video-premium-event-pic.webp"
            imageAlt="Téléphone vintage de livre d'or vidéo Event Pic"
            imageFit="cover"
            href="/tarifs-formules"
            ctaLabel="Découvrir"
          />
          <ServiceCard
            className="jbl-partybox-card"
            title="Enceintes JBL PartyBox"
            description="Une solution sonore puissante et lumineuse pour votre ambiance événementielle."
            imageSrc={EVENT_PIC_JBL_PARTYBOX_IMAGE}
            imageAlt="Enceinte JBL PartyBox 710 lumineuse pour soirée Event Pic"
            imageFit="cover"
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
          </figure>
          <div className="home-family-copy">
            <p>
              <span className="event-pic-signature family-brand-signature">Event Pic</span>, c’est l’histoire
              d’un frère et d’une sœur réunis autour d’une même idée : créer des souvenirs élégants, simples et
              mémorables.
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
        eyebrow="Entreprises"
        title="Ils nous ont fait confiance"
        description="Des entreprises, collectivités et lieux d'exception nous ont fait confiance pour animer leurs événements."
        className="home-partners-section"
      >
        <PartnerLogoGrid logos={EVENT_PIC_PARTNER_LOGOS} variant="marquee" />
      </PublicSection>

      <GoogleReviewsSection compact maxReviews={3} />

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
        <div className="home-included-strip" aria-label="Inclus dans nos prestations">
          <strong>Inclus dans nos prestations :</strong>
          <span>installation, impressions, galerie numérique, design personnalisé, accessoires, accompagnement.</span>
        </div>
      </PublicSection>

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
            <a className="public-button-outline" href={EVENT_PIC_CONTACT.whatsappUrl}>
              WhatsApp
            </a>
          </>
        }
      />
    </PublicSiteShell>
  );
}

