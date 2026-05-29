import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";
import galleryManifest from "@/public/images/visuels-situation/optimized/manifest.json";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL,
  EVENT_PIC_WOOD_PREMIUM_IMAGE
} from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Nos bornes photobooth - Event Pic",
  description:
    "Comparez la borne bois premium et la borne métal Event Pic pour choisir le photobooth adapté à votre événement."
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
    title: "Borne métal",
    badge: "Moderne · Corporate · Chic",
    image: EVENT_PIC_METAL_ANTHRACITE_IMAGE,
    alt: "Borne métal Event Pic en événement professionnel",
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
    metal: "Métal moderne et sobre"
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
  {
    title: "Cadre photo portrait 10x15",
    description: "Un format vertical élégant, idéal pour les portraits et les souvenirs individuels."
  },
  {
    title: "Cadre photo paysage 10x15",
    description: "Un rendu horizontal parfait pour les groupes, les familles et les photos d'ambiance."
  },
  {
    title: "Bandelette photobooth 2x6",
    description: "Le format photobooth iconique, compact, ludique et très apprécié des invités."
  },
  {
    title: "Écran d'accueil personnalisé",
    description: "Une première impression soignée avec vos prénoms, votre logo ou votre ambiance graphique."
  },
  {
    title: "Galerie numérique après l'événement",
    description: "Un accès simple aux souvenirs pour retrouver, partager et conserver les photos."
  }
] as const;

const OPTIONS = [
  {
    title: "Livre d'or audio",
    description: "Les messages vocaux de vos invités à conserver après l'événement."
  },
  {
    title: "Livre d'or vidéo",
    description: "Des souvenirs en image pour revivre les émotions de vos proches."
  },
  {
    title: "Enceintes JBL PartyBox",
    description: "Une ambiance musicale puissante pour faire vibrer votre soirée."
  },
  {
    title: "Décor photo",
    description: "Un fond élégant pour sublimer vos photos et structurer l'espace."
  },
  {
    title: "Accessoires festifs",
    description: "Lunettes, pancartes et détails amusants pour des photos plus vivantes."
  }
] as const;

type SituationPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
  focus?: "audio-phone";
};

type GalleryManifestImage = {
  optimized: string;
  width: number;
  height: number;
};

type GalleryCardStyle = CSSProperties & {
  "--gallery-photo": string;
};

const AUDIO_GUESTBOOK_PHOTO_NUMBERS = new Set([19, 28, 37, 38, 43, 56, 66, 68, 69, 71]);

const SITUATION_PHOTOS: SituationPhoto[] = (galleryManifest.images as GalleryManifestImage[]).map((image, index) => ({
  src: image.optimized,
  alt: `Visuel Event Pic en situation ${index + 1}`,
  width: image.width,
  height: image.height,
  focus: AUDIO_GUESTBOOK_PHOTO_NUMBERS.has(index + 1) ? "audio-phone" : undefined
}));

const GALLERY_ROW_ONE = SITUATION_PHOTOS.filter((_, index) => index % 2 === 0);
const GALLERY_ROW_TWO = SITUATION_PHOTOS.filter((_, index) => index % 2 === 1);

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
        subtitle="Deux styles premium pour s'adapter à votre événement : borne bois chaleureuse ou borne métal au style moderne."
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
              <strong>Borne bois ou métal</strong>
              <small>Deux finitions, une même expérience photobooth premium.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/choisir-mon-design">
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
                <Link className="public-button-outline" href="/contact-reserver">
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
        title="Ce que vous pouvez personnaliser"
        description="Chaque événement est unique. Nous préparons vos supports photo et votre écran d'accueil pour créer une expérience cohérente avec votre ambiance."
        className="booth-formats-section"
      >
        <div className="public-grid public-grid-5 booth-feature-grid">
          {FORMATS.map((item) => (
            <article className="public-card booth-feature-card" key={item.title}>
              <span className="booth-feature-mark" aria-hidden="true">•</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Options"
        title="Ajoutez une touche en plus à votre événement"
        description="Complétez votre photobooth avec des options pensées pour enrichir l'expérience de vos invités, sans compliquer l'organisation."
        className="booth-options-section"
      >
        <div className="public-grid public-grid-5 booth-feature-grid booth-options-grid">
          {OPTIONS.map((item) => (
            <article className="public-card booth-feature-card booth-option-card" key={item.title}>
              <span className="booth-feature-mark" aria-hidden="true">•</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Galerie"
        title="Quelques visuels en situation"
        description="Un aperçu vivant des bornes Event Pic, des ambiances et des souvenirs créés pendant les événements."
        className="booth-gallery-section"
      >
        <div className="booth-gallery-carousel" aria-label="Carrousel de visuels Event Pic en situation">
          <BoothGalleryRail direction="right" label="Première ligne de visuels" photos={GALLERY_ROW_ONE} />
          <BoothGalleryRail direction="left" label="Deuxième ligne de visuels" photos={GALLERY_ROW_TWO} />
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
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
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

function BoothGalleryRail({
  direction,
  label,
  photos
}: {
  direction: "left" | "right";
  label: string;
  photos: SituationPhoto[];
}) {
  return (
    <div className={`booth-gallery-rail booth-gallery-rail-${direction}`} aria-label={label}>
      <div className="booth-gallery-track">
        {[0, 1].map((groupIndex) => (
          <div className="booth-gallery-track-group" aria-hidden={groupIndex === 1} key={`${direction}-${groupIndex}`}>
            {photos.map((item, index) => {
              const shouldLoadFast =
                direction === "right"
                  ? (groupIndex === 1 && index < 6) || (groupIndex === 0 && index >= photos.length - 6)
                  : groupIndex === 0 && index < 6;
              return (
                <figure
                  className="booth-gallery-card"
                  data-gallery-focus={item.focus}
                  data-orientation={item.height > item.width ? "portrait" : "landscape"}
                  key={`${item.src}-${groupIndex}`}
                  style={{ "--gallery-photo": `url(${item.src})` } as GalleryCardStyle}
                >
                  <img
                    alt={groupIndex === 0 ? item.alt : ""}
                    decoding="async"
                    fetchPriority={shouldLoadFast ? "high" : "auto"}
                    height={item.height}
                    loading={shouldLoadFast ? "eager" : "lazy"}
                    src={item.src}
                    width={item.width}
                  />
                </figure>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
