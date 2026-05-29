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

const FAQ_SECTIONS = [
  {
    title: "Réservation & devis",
    description: "Les informations essentielles pour obtenir une proposition claire et réserver votre date.",
    items: [
      {
        q: "Quel délai pour recevoir un devis ?",
        a: "Lorsque les informations principales sont complètes, nous préparons un retour rapide, généralement sous 24h."
      },
      {
        q: "Y a-t-il une caution ?",
        a: "Une caution peut être demandée selon la prestation. Son montant et ses modalités sont toujours précisés dans le devis."
      },
      {
        q: "Une facture est-elle fournie ?",
        a: "Oui. Une facture est fournie pour chaque événement réservé auprès d'Event Pic et transmise par email."
      },
      {
        q: "Comment réserver ?",
        a: "Vous nous envoyez votre demande, nous confirmons la disponibilité, puis la date est bloquée après validation du devis et de l'acompte."
      }
    ]
  },
  {
    title: "Livraison & installation",
    description: "Nous préparons l'installation pour que l'animation soit fluide le jour de votre événement.",
    items: [
      {
        q: "Comment se passe l'installation ?",
        a: "Nous livrons la borne, réalisons l'installation complète, faisons les tests et vous expliquons le fonctionnement avant l'arrivée des invités."
      },
      {
        q: "Est-ce que vous livrez ?",
        a: "Oui, la livraison est proposée en Île-de-France et dans les zones limitrophes selon la formule et la localisation de l'événement."
      },
      {
        q: "Quels sont les horaires de location ?",
        a: "La location couvre généralement la journée ou la soirée. La récupération est organisée selon le lieu, les accès et le planning convenu."
      },
      {
        q: "Combien de temps faut-il prévoir pour l'installation ?",
        a: "Il faut généralement prévoir entre 30 et 60 minutes selon l'accès, le lieu et les options choisies."
      },
      {
        q: "Intervenez-vous en Île-de-France ?",
        a: "Oui, nous intervenons en Île-de-France, notamment en Essonne, Seine-et-Marne, Val-de-Marne, Paris et alentours selon disponibilité."
      }
    ]
  },
  {
    title: "Photos, impressions & galerie",
    description: "Formats, personnalisation et souvenirs numériques sont préparés pour s'intégrer à votre ambiance.",
    items: [
      {
        q: "Combien d'impressions sont incluses ?",
        a: "Cela dépend de la formule choisie : 300, 400, 500, 700 impressions, sans impression ou impression illimitée sur devis."
      },
      {
        q: "Les invités peuvent-ils récupérer les photos en ligne ?",
        a: "Oui, une galerie numérique est prévue après l'événement pour récupérer et partager les photos."
      },
      {
        q: "Peut-on personnaliser le cadre photo ?",
        a: "Oui. Vous choisissez votre modèle photo, puis Event Pic adapte les textes et prépare le rendu final pour votre date."
      },
      {
        q: "Peut-on personnaliser le cadre avec un logo ?",
        a: "Oui, le cadre photo peut intégrer un logo, des couleurs de marque, un message événementiel ou une charte graphique."
      }
    ]
  },
  {
    title: "Options & animations",
    description: "Des options complémentaires permettent d'enrichir l'expérience sans alourdir l'organisation.",
    items: [
      {
        q: "Proposez-vous le livre d'or audio ou vidéo ?",
        a: "Oui. Le livre d'or audio et le livre d'or vidéo permettent de conserver les messages et émotions de vos invités."
      },
      {
        q: "Proposez-vous les enceintes JBL ?",
        a: "Oui. Nous proposons les enceintes JBL PartyBox 310 et JBL PartyBox 710, avec micro sans fil possible selon votre besoin."
      },
      {
        q: "Proposez-vous un décor photo ?",
        a: "Oui, un décor photo ou fond photo peut être ajouté pour structurer l'espace et sublimer le rendu des souvenirs."
      },
      {
        q: "Peut-on choisir entre borne bois et borne métal ?",
        a: "Oui. Vous pouvez choisir entre la borne bois premium et la borne métal selon l'ambiance de votre événement."
      },
      {
        q: "Peut-on prolonger la prestation ?",
        a: "Oui, une demi-journée photobooth supplémentaire peut être prévue selon les disponibilités et l'organisation de votre événement."
      }
    ]
  },
  {
    title: "Entreprises & événements professionnels",
    description: "Event Pic accompagne aussi les marques, CSE et événements professionnels avec une approche soignée.",
    items: [
      {
        q: "Intervenez-vous sur les salons professionnels ?",
        a: "Oui, nous intervenons sur salons, stands, inaugurations, séminaires, afterworks et soirées clients."
      },
      {
        q: "Peut-on réserver pour un CSE ou un arbre de Noël ?",
        a: "Oui, Event Pic accompagne les CSE et arbres de Noël avec photobooth, galerie, impressions et options selon le besoin."
      }
    ]
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
              alt="Borne photobooth métal Event Pic en situation événementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow hero-brand-eyebrow-with-signature">
                <span>FAQ</span>
                <span className="event-pic-signature hero-brand-signature">Event Pic</span>
              </span>
              <strong>Des reponses claires pour reserver sereinement</strong>
              <small>Livraison, installation, options et personnalisation.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact-reserver">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/nos-bornes">
              Voir nos bornes
            </Link>
          </>
        }
      />

      <PublicSection
        eyebrow="Questions fréquentes"
        title="Des réponses simples, classées par thème"
        description="Parcourez les sujets les plus demandés pour préparer votre photobooth, vos impressions, vos options et votre réservation."
        className="faq-premium-section"
      >
        <div className="faq-theme-grid">
          {FAQ_SECTIONS.map((section, sectionIndex) => (
            <article className="public-card faq-theme-card" key={section.title}>
              <div className="faq-theme-heading">
                <span>{`0${sectionIndex + 1}`}</span>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
              </div>
              <div className="faq-accordion faq-premium-accordion">
                {section.items.map((item, itemIndex) => (
                  <details
                    className="faq-item faq-premium-item"
                    key={item.q}
                    open={sectionIndex === 0 && itemIndex === 0}
                  >
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </article>
          ))}
        </div>
      </PublicSection>

      <section className="public-section premium-container faq-final-cta">
        <p>Vous avez encore une question ?</p>
        <h2>Nous vous accompagnons pour choisir la formule, les options et le format le plus adapté à votre événement.</h2>
        <div className="public-actions-row">
          <Link className="public-button-dark" href="/contact-reserver">
            Demander un devis
          </Link>
          <Link className="public-button-outline" href="/nos-bornes">
            Voir nos bornes
          </Link>
        </div>
      </section>
    </PublicSiteShell>
  );
}
