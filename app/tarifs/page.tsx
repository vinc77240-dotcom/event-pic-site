import type { Metadata } from "next";
import Link from "next/link";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE
} from "@/src/shared/eventPicPublic";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicCTA } from "@/app/components/public/PublicCTA";
import { PublicSection } from "@/app/components/public/PublicSection";

export const metadata: Metadata = {
  title: "Tarifs & formules photobooth Event Pic",
  description:
    "Des formules photobooth simples avec ou sans impressions, options, inclusions et devis Event Pic."
};

const FORMULA_GUIDE = [
  {
    need: "Animation simple",
    recommendation: "Pack digital",
    detail: "Pour profiter de la borne et récupérer les photos en ligne."
  },
  {
    need: "Quelques impressions souvenirs",
    recommendation: "300 impressions",
    detail: "Une base confortable pour un petit événement."
  },
  {
    need: "Bon équilibre",
    recommendation: "400 impressions",
    detail: "La formule recommandée pour garder de la souplesse."
  },
  {
    need: "Beaucoup d’invités",
    recommendation: "500 ou 700 impressions",
    detail: "Pour limiter les frustrations pendant la soirée."
  },
  {
    need: "Gros événement",
    recommendation: "Impression illimitée sur devis",
    detail: "Pour les réceptions très fréquentées ou usages intensifs."
  }
] as const;

const PACKAGES = [
  {
    title: "Pack digital",
    description: "Photos illimitées sans impression.",
    price: "250 €"
  },
  {
    title: "300 impressions",
    description: "Idéal petit événement.",
    price: "330 €"
  },
  {
    title: "400 impressions",
    description: "Formule recommandée.",
    price: "380 €",
    featured: true
  },
  {
    title: "500 impressions",
    description: "Pour événement avec plus d’invités.",
    price: "430 €"
  },
  {
    title: "700 impressions",
    description: "Grande réception.",
    price: "500 €"
  },
  {
    title: "Impression illimitée",
    description: "Pour les gros volumes et événements spécifiques.",
    price: "Sur devis"
  }
] as const;

const INCLUDED = [
  "Livraison, installation et récupération",
  "Tests avant l’arrivée des invités",
  "Borne premium avec écran tactile",
  "Appareil photo + flash",
  "Personnalisation du cadre photo",
  "Écran d’accueil personnalisé",
  "Formats portrait, paysage et bandelette",
  "Accessoires",
  "Galerie numérique",
  "Assistance Event Pic"
] as const;

const OPTIONS = [
  {
    title: "Livre d’or audio",
    price: "à partir de 70 €",
    detail: "Vos invités laissent un message vocal à conserver après l’événement."
  },
  {
    title: "Décor photo / fond photo",
    price: "45 €",
    detail: "Un espace visuel plus élégant derrière vos invités."
  },
  {
    title: "Enceintes JBL PartyBox avec micros",
    price: "à partir de 50 €",
    detail: "Une option sonore pour renforcer l’ambiance de votre événement."
  },
  {
    title: "Option brunch / prolongation",
    price: "+100 €",
    detail: "Pour prolonger la prestation selon l’organisation prévue."
  }
] as const;

const FAQ_ITEMS = [
  {
    q: "Les impressions sont-elles incluses ?",
    a: "Oui, selon la formule choisie : 300, 400, 500, 700 impressions ou impression illimitée sur devis. Le pack digital ne comprend pas d’impression papier."
  },
  {
    q: "Peut-on choisir une formule sans impression ?",
    a: "Oui. Le pack digital permet de profiter de la borne avec photos illimitées et galerie numérique, sans tirages papier."
  },
  {
    q: "Peut-on ajouter des impressions ?",
    a: "Oui, la formule peut être ajustée avant confirmation du devis selon le nombre d’invités et le rythme attendu."
  },
  {
    q: "Y a-t-il des frais de déplacement ?",
    a: "Ils peuvent varier selon l’adresse, les horaires et les conditions d’accès. Ils sont toujours confirmés dans le devis."
  },
  {
    q: "La personnalisation est-elle incluse ?",
    a: "Oui, le cadre photo et l’écran d’accueil sont personnalisés selon votre thème ou votre identité visuelle."
  },
  {
    q: "Peut-on prolonger la location pour un brunch ?",
    a: "Oui, une option brunch ou prolongation peut être ajoutée sous réserve de disponibilité et d’organisation."
  },
  {
    q: "Une facture est-elle fournie ?",
    a: "Oui, une facture est fournie pour chaque prestation réservée auprès d’Event Pic."
  }
] as const;

export default function TarifsPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Tarifs & formules photobooth"
        subtitle="Des formules simples pour profiter d’une borne photo premium, avec ou sans impressions, selon votre événement."
        description="Choisissez le volume d’impressions adapté, ajoutez vos options, puis recevez un devis confirmé pour votre date."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth métal gris anthracite Event Pic en situation événementielle"
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
              <strong>Des formules claires, un rendu premium</strong>
              <small>Acompte de 100 € pour bloquer votre date.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="#formules">
              Voir les formules
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              Choisir mon design
            </Link>
          </>
        }
      />

      <PublicSection
        eyebrow="Guide"
        title="Quelle formule choisir ?"
        description="Une règle simple : plus il y a d’invités, plus le volume d’impressions doit être confortable."
        className="tariffs-guide-section"
      >
        <div className="tariffs-guide-grid">
          {FORMULA_GUIDE.map((item) => (
            <article className="public-card tariffs-guide-card" key={item.need}>
              <span>{item.need}</span>
              <strong>{item.recommendation}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Formules"
        title="Formules photobooth"
        description="Des prix lisibles pour préparer votre budget. Le devis final confirme la disponibilité, la livraison et les options."
        className="tariffs-packages-section"
      >
        <div className="tariffs-packages-grid" id="formules">
          {PACKAGES.map((item) => (
            <article
              className={`pricing-card tariffs-package-card ${
                "featured" in item && item.featured ? "is-featured" : ""
              }`.trim()}
              key={item.title}
            >
              {"featured" in item && item.featured ? (
                <span className="pricing-card-badge">Recommandée</span>
              ) : null}
              <h3>{item.title}</h3>
              <p className="tariffs-package-description">{item.description}</p>
              <p className="tariffs-package-price">{item.price}</p>
              <Link className="public-button-outline" href="/contact">
                Choisir cette formule
              </Link>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Inclus"
        title="Ce qui est inclus"
        description="Chaque formule conserve le niveau de service Event Pic : installation propre, personnalisation et accompagnement."
        className="tariffs-included-section"
      >
        <article className="public-card tariffs-included-card">
          <ul>
            {INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </PublicSection>

      <PublicSection
        eyebrow="Options"
        title="Options complémentaires"
        description="Ajoutez uniquement ce qui renforce votre événement : souvenir audio, décor photo, sonorisation ou prolongation."
        className="tariffs-options-section"
      >
        <div className="public-grid public-grid-4 tariffs-options-grid">
          {OPTIONS.map((item) => (
            <article className="public-card tariffs-option-card" key={item.title}>
              <h3>{item.title}</h3>
              <p className="public-price">{item.price}</p>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection className="tariffs-info-section">
        <div className="public-grid public-grid-2 tariffs-info-grid">
          <article className="public-card tariffs-info-card">
            <span>Déplacement</span>
            <h2>Livraison en Île-de-France</h2>
            <p>
              Les frais de déplacement peuvent varier selon le lieu de l’événement. Ils sont
              confirmés dans le devis selon l’adresse, les horaires et les conditions d’accès.
            </p>
          </article>
          <article className="public-card tariffs-info-card">
            <span>Réservation</span>
            <h2>Réservation de la date</h2>
            <p>
              Un acompte de 100 € permet de bloquer définitivement votre créneau. Le solde est
              précisé dans votre devis selon la formule choisie.
            </p>
          </article>
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="FAQ"
        title="Questions fréquentes sur les tarifs"
        className="tariffs-faq-section"
      >
        <div className="faq-accordion tariffs-faq-list">
          {FAQ_ITEMS.map((item) => (
            <details className="faq-item public-card" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </PublicSection>

      <PublicCTA
        title="Besoin d’un tarif confirmé pour votre date ?"
        className="tariffs-final-cta"
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              Choisir mon design
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
