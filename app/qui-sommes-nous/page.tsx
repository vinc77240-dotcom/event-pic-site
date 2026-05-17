import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicSection } from "@/app/components/public/PublicSection";
import { EVENT_PIC_WOOD_PREMIUM_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Qui sommes-nous - Event Pic",
  description:
    "Decouvrez l'histoire Event Pic, notre exigence qualite et notre accompagnement pour vos evenements en Ile-de-France."
};

export default function QuiSommesNousPage() {
  return (
    <PublicSiteShell>
      <PublicHero
        title="Qui sommes-nous ?"
        subtitle="Une aventure familiale au service de vos souvenirs."
        description="Event Pic, c'est avant tout l'histoire d'un frere et d'une soeur qui ont decide de se lancer ensemble dans un projet qui leur ressemble : creer des souvenirs, sublimer les evenements et offrir une experience simple, elegante et memorable."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne Event Pic en ambiance mariage"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Event Pic</span>
              <strong>Une equipe proche de vous</strong>
              <small>Serieux, simplicite et accompagnement de la preparation a l'evenement.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/nos-bornes">
              Decouvrir nos bornes
            </Link>
            <Link className="public-button-outline" href="/contact">
              Demander un devis
            </Link>
          </>
        }
      />

      <PublicSection eyebrow="Event Pic" title="Notre histoire">
        <article className="public-card">
          <p>
            Notre souhait est clair : transformer vos evenements en souvenirs inoubliables.
            Bases en Ile-de-France, nous proposons des animations haut de gamme pour vos
            mariages, anniversaires, soirees privees et evenements professionnels.
          </p>
        </article>
      </PublicSection>

      <PublicSection title="Notre exigence qualite">
        <div className="public-grid public-grid-2">
          <article className="public-card">
            <h3>Une prestation soignee</h3>
            <ul>
              <li>Materiel premium et verifie</li>
              <li>Installation propre et explicative</li>
              <li>Design photo harmonise avec votre evenement</li>
            </ul>
          </article>
          <article className="public-card">
            <h3>Un accompagnement reactif</h3>
            <ul>
              <li>Echanges clairs avant la date</li>
              <li>Validation du rendu avant l'evenement</li>
              <li>Suivi post-evenement avec galerie et avis</li>
            </ul>
          </article>
        </div>
      </PublicSection>

      <PublicSection title="Notre zone d'intervention">
        <article className="public-card">
          <h3>IDF &amp; limitrophes</h3>
          <p>
            Que vous prepariez une reception intime, une grande fete ou un evenement d'entreprise,
            Event Pic vous accompagne avec serieux, simplicite et passion.
          </p>
          <div className="public-actions-row">
            <Link className="public-button-dark" href="/nos-bornes">
              Voir les bornes
            </Link>
            <Link className="public-button-outline" href="/calculateur-tarif">
              Calculer mon tarif
            </Link>
          </div>
        </article>
      </PublicSection>
    </PublicSiteShell>
  );
}
