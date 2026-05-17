import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicSection } from "@/app/components/public/PublicSection";
import { EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "FAQ Event Pic",
  description:
    "Questions frequentes sur la location des bornes Event Pic, la livraison, les impressions et la personnalisation."
};

const FAQ_ITEMS = [
  {
    q: "Comment se passe l'installation ?",
    a: "Nous livrons la borne, faisons l'installation complete sur place, realisons les tests et vous expliquons le fonctionnement avant l'arrivee des invites."
  },
  {
    q: "Est-ce que vous livrez ?",
    a: "Oui, la livraison est proposee en Ile-de-France et zones limitrophes selon la formule et la localisation de l'evenement."
  },
  {
    q: "Quels sont les horaires de location ?",
    a: "Les horaires sont adaptes a votre evenement. Nous validons ensemble le creneau de livraison, d'installation et de recuperation."
  },
  {
    q: "Y a-t-il une caution ?",
    a: "Oui, une caution peut etre demandee selon la prestation. Le montant et les modalites sont precises dans votre devis."
  },
  {
    q: "Combien d'impressions sont incluses ?",
    a: "Cela depend de la formule choisie : 300, 400, 500, 700 impressions ou formule sans impression / sur devis."
  },
  {
    q: "Peut-on personnaliser le cadre photo ?",
    a: "Oui. Vous choisissez votre modele photo, puis Event Pic adapte les textes et prepare le rendu final pour votre date."
  },
  {
    q: "Les invites peuvent-ils recuperer les photos en ligne ?",
    a: "Oui, une galerie numerique est prevue apres l'evenement pour recuperer et partager les photos."
  },
  {
    q: "Combien de temps faut-il prevoir pour l'installation ?",
    a: "En general, prevoir entre 30 et 60 minutes selon l'acces, le lieu et les options choisies."
  },
  {
    q: "Peut-on choisir entre borne bois et borne metal ?",
    a: "Oui. Vous pouvez choisir entre la borne bois premium et la borne metal gris anthracite selon l'ambiance de votre evenement."
  },
  {
    q: "Proposez-vous le livre d'or audio ou les enceintes JBL ?",
    a: "Oui. Le livre d'or audio, les enceintes JBL PartyBox et l'option brunch sont disponibles en options."
  },
  {
    q: "Proposez-vous une facture pour les entreprises ?",
    a: "Oui, une facture peut etre fournie pour les entreprises, CSE, agences evenementielles et collectivites."
  },
  {
    q: "Peut-on personnaliser le cadre avec un logo ?",
    a: "Oui, le cadre photo peut integrer un logo, des couleurs de marque, un message evenementiel ou une charte graphique."
  },
  {
    q: "Intervenez-vous sur les salons professionnels ?",
    a: "Oui, nous pouvons intervenir sur salons, stands, inaugurations, seminaires, afterworks et soirees client."
  },
  {
    q: "Peut-on reserver pour un CSE ou un arbre de Noel ?",
    a: "Oui, Event Pic accompagne les CSE et arbres de Noel avec photobooth, galerie, impressions et options selon le besoin."
  },
  {
    q: "Quel delai pour recevoir un devis ?",
    a: "Lorsque les informations principales sont completes, nous visons un retour rapide, generalement sous 24h."
  },
  {
    q: "Intervenez-vous en Ile-de-France ?",
    a: "Oui, nous intervenons en Ile-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilite."
  }
] as const;

export default function FaqPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="FAQ"
        subtitle="Tout ce qu'il faut savoir avant de reserver."
        description="Retrouvez les reponses aux questions les plus frequentes sur l'organisation, les formules et la personnalisation."
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
              <span className="hero-brand-eyebrow">FAQ Event Pic</span>
              <strong>Des reponses claires pour reserver sereinement</strong>
              <small>Livraison, installation, options et personnalisation.</small>
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
          </>
        }
      />

      <PublicSection eyebrow="Questions frequentes" title="Informations utiles">
        <div className="faq-accordion">
          {FAQ_ITEMS.map((item) => (
            <details className="faq-item public-card" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </PublicSection>
    </PublicSiteShell>
  );
}
