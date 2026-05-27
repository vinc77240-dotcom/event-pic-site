import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL,
  EVENT_PIC_WOOD_PREMIUM_IMAGE
} from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Nos bornes photobooth - Event Pic",
  description:
    "Comparez la borne bois premium et la borne métal gris anthracite Event Pic pour choisir le photobooth adapté à votre événement."
};

const BOOTH_STYLES = [
  {
    title: "Borne bois premium",
    badge: "Chaleureuse · Mariage · Privé",
    image: EVENT_PIC_WOOD_PREMIUM_IMAGE,
    alt: "Borne bois premium Event Pic en ambiance mariage",
    description:
      "Un design naturel et élégant qui s'intègre facilement dans une décoration de mariage, de baptême ou de réception privée.",
    recommended:
      "Idéale pour les mariages, baptêmes, anniversaires et événements privés.",
    strengths: [
      "Rendu chaleureux et premium",
      "Très cohérente avec les décors champêtres ou élégants",
      "Présence discrète et photogénique",
      "Personnalisation du cadre photo et de l'écran d'accueil"
    ]
  },
  {
    title: "Borne métal gris anthracite",
    badge: "Moderne · Corporate · Chic",
    image: EVENT_PIC_METAL_ANTHRACITE_IMAGE,
    alt: "Borne métal gris anthracite Event Pic en événement professionnel",
    description:
      "Une finition sobre et moderne pour une animation photobooth professionnelle, élégante et bien intégrée aux événements d'entreprise.",
    recommended:
      "Idéale pour les entreprises, soirées corporate, salons, inaugurations et événements modernes.",
    strengths: [
      "Style contemporain et professionnel",
      "Très adaptée aux espaces corporate ou lounge",
      "Borne stable avec écran tactile fluide",
      "Rendu premium pour les photos de marque"
    ]
  }
] as const;

const COMPARISON_ROWS = [
  {
    label: "Style",
    wood: "Bois naturel, chaleureux et élégant",
    metal: "Gris anthracite, moderne et sobre"
  },
  {
    label: "Événements conseillés",
    wood: "Mariages, baptêmes, anniversaires, événements privés",
    metal: "Entreprises, salons, inaugurations, soirées modernes"
  },
  {
    label: "Impression selon formule",
    wood: "Oui, selon la formule choisie",
    metal: "Oui, selon la formule choisie"
  },
  {
    label: "Galerie numérique",
    wood: "Incluse après l'événement",
    metal: "Incluse après l'événement"
  },
  {
    label: "Personnalisation",
    wood: "Cadre photo et écran d'accueil personnalisés",
    metal: "Cadre photo et écran d'accueil personnalisés"
  },
  {
    label: "Installation incluse",
    wood: "Livraison, installation et test sur place",
    metal: "Livraison, installation et test sur place"
  }
] as const;

const INCLUDED = [
  "Installation sur place",
  "Test avant l'arrivée des invités",
  "Impressions selon formule",
  "Galerie numérique",
  "Cadre photo personnalisé",
  "Écran d'accueil personnalisé",
  "Accessoires festifs",
  "Assistance Event Pic"
] as const;

const FORMATS = [
  "Portrait 10x15",
  "Paysage 10x15",
  "Bandelette 2x6",
  "Écran d'accueil personnalisé",
  "Galerie numérique après événement"
] as const;

const OPTIONS = [
  "Livre d'or audio",
  "Livre d'or vidéo",
  "Enceintes JBL PartyBox",
  "Décor photo / fond photo",
  "Accessoires"
] as const;

const GALLERY = [
  {
    src: EVENT_PIC_WOOD_PREMIUM_IMAGE,
    alt: "Borne bois Event Pic en situation premium"
  },
  {
    src: "/photobooths/borne-bois-premium.jpg",
    alt: "Borne bois Event Pic dans une réception"
  },
  {
    src: EVENT_PIC_METAL_ANTHRACITE_IMAGE,
    alt: "Borne métal gris anthracite Event Pic"
  },
  {
    src: "/photobooths/borne-metal-premium.png",
    alt: "Borne métal premium Event Pic en ambiance événementielle"
  }
] as const;

const FAQ_ITEMS = [
  {
    q: "Quelle place faut-il prévoir ?",
    a: "Un espace d'environ 2 m par 2 m est confortable pour installer la borne, les invités et les accessoires."
  },
  {
    q: "Faut-il une prise électrique ?",
    a: "Oui, une prise électrique standard à proximité suffit pour alimenter la borne et le flash."
  },
  {
    q: "Peut-on choisir la borne ?",
    a: "Oui, vous pouvez indiquer votre préférence entre borne bois et borne métal selon votre événement."
  },
  {
    q: "Les impressions sont-elles incluses ?",
    a: "Elles sont incluses selon la formule choisie. Le pack digital reste disponible sans impression papier."
  },
  {
    q: "À quelle heure se fait la récupération ?",
    a: "L'horaire de récupération est défini dans le devis selon votre lieu, votre planning et les conditions d'accès."
  },
  {
    q: "Peut-on prolonger pour un brunch ?",
    a: "Oui, une prolongation ou option brunch peut être ajoutée selon les disponibilités et l'organisation prévue."
  }
] as const;

export default function NosBornesPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Nos bornes photobooth"
        subtitle="Deux styles premium pour s'adapter à votre événement : borne bois chaleureuse ou borne métal gris anthracite au style moderne."
        description="Choisissez la borne qui correspond le mieux à votre ambiance, puis personnalisez vos photos avec un cadre sur mesure."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne bois premium Event Pic en ambiance mariage"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Nos bornes</span>
              <strong>Borne bois ou métal gris anthracite</strong>
              <small>Deux finitions, une même expérience photobooth premium.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />

      <PublicSection
        eyebrow="Choisir sa borne"
        title="Deux styles, une expérience premium"
        description="La borne change l'ambiance visuelle, mais le niveau de service reste le même : installation, personnalisation, impressions selon formule et galerie numérique."
        className="booth-choice-section"
      >
        <div className="booth-choice-grid">
          {BOOTH_STYLES.map((booth) => (
            <article className="public-card booth-choice-card" key={booth.title}>
              <div className="booth-choice-media">
                <img alt={booth.alt} decoding="async" loading="lazy" src={booth.image} />
              </div>
              <div className="booth-choice-content">
                <span className="booth-model-badge">{booth.badge}</span>
                <h3>{booth.title}</h3>
                <p>{booth.description}</p>
                <strong>{booth.recommended}</strong>
                <ul>
                  {booth.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className="public-button-outline" href="/contact">
                  Demander cette borne
                </Link>
              </div>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Comparatif"
        title="Quelle borne pour votre événement ?"
        description="Les deux bornes proposent la même qualité d'animation. Le choix se fait surtout sur le style et le contexte de votre événement."
        className="booth-comparison-section"
      >
        <div className="public-card booth-comparison-grid" role="table" aria-label="Comparatif borne bois et borne métal">
          <div className="booth-comparison-heading" role="row">
            <span role="columnheader">Critère</span>
            <span role="columnheader">Borne bois</span>
            <span role="columnheader">Borne métal</span>
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div className="booth-comparison-row" role="row" key={row.label}>
              <strong role="rowheader">{row.label}</strong>
              <span data-label="Borne bois" role="cell">{row.wood}</span>
              <span data-label="Borne métal" role="cell">{row.metal}</span>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Inclus"
        title="Ce qui est inclus"
        description="Une prestation pensée pour rester fluide le jour J, de l'installation jusqu'à la récupération des souvenirs."
        className="booth-included-section"
      >
        <article className="public-card tariffs-included-card booth-included-card">
          <ul>
            {INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </PublicSection>

      <PublicSection
        eyebrow="Formats"
        title="Formats disponibles"
        description="Vos invités repartent avec un format adapté à votre événement, et vous récupérez aussi les souvenirs en numérique."
        className="booth-formats-section"
      >
        <div className="public-grid public-grid-5 booth-chip-grid">
          {FORMATS.map((item) => (
            <article className="public-card booth-chip-card" key={item}>
              {item}
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Options"
        title="Options compatibles"
        description="Complétez votre photobooth avec des options qui renforcent l'expérience sans compliquer l'organisation."
        className="booth-options-section"
      >
        <div className="public-grid public-grid-5 booth-chip-grid">
          {OPTIONS.map((item) => (
            <article className="public-card booth-chip-card" key={item}>
              {item}
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Galerie"
        title="Quelques visuels en situation"
        description="Une galerie courte pour visualiser les deux styles de bornes sans alourdir la page."
        className="booth-gallery-section"
      >
        <div className="booth-gallery-grid">
          {GALLERY.map((item) => (
            <figure className="booth-gallery-card" key={item.src}>
              <img alt={item.alt} decoding="async" loading="lazy" src={item.src} />
            </figure>
          ))}
        </div>
      </PublicSection>

      <PublicSection eyebrow="FAQ" title="Questions fréquentes" className="booth-faq-section">
        <div className="faq-accordion booth-faq-list">
          {FAQ_ITEMS.map((item) => (
            <details className="faq-item public-card" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </PublicSection>

      <PublicCTA
        title="Prêt à choisir votre borne ?"
        className="booth-final-cta"
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
