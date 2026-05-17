import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { GoogleReviewsSection } from "@/app/components/public/GoogleReviewsSection";
import { PartnerLogoGrid } from "@/app/components/public/PartnerLogoGrid";
import { PublicSection } from "@/app/components/public/PublicSection";
import { PhotoboothShowcase } from "@/app/components/public/PhotoboothShowcase";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_WOOD_PREMIUM_IMAGE,
  EVENT_PIC_TEMPLATE_PICKER_LABEL
} from "@/src/shared/eventPicPublic";
import { EVENT_PIC_PARTNER_LOGOS } from "@/src/shared/partners";
import { listVisiblePhotoboothGalleryItems } from "@/src/server/photoboothGalleryService";

export const metadata: Metadata = {
  title: "Nos bornes - Event Pic",
  description:
    "Des bornes elegantes, intuitives et pensees pour s'integrer a vos plus beaux evenements."
};

const EXPERIENCE_POINTS = [
  "Ecran tactile",
  "Appareil photo haute qualite",
  "Flash externe",
  "Impression instantanee",
  "Accessoires",
  "Galerie numerique",
  "Modeles photo personnalises"
];

export default async function PhotoboothsPage() {
  const items = await listVisiblePhotoboothGalleryItems();

  return (
    <PublicSiteShell>
      <PublicHero
        title="Nos bornes"
        subtitle="Des bornes elegantes, intuitives et pensees pour s'integrer a vos plus beaux evenements."
        description="Chaque borne Event Pic est preparee pour offrir une experience professionnelle, fluide et memorable pour vos invites. Deux styles sont disponibles : borne bois premium et borne metal gris anthracite."
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
              <span className="hero-brand-eyebrow">Nos bornes</span>
              <strong>Borne bois ou metal gris anthracite</strong>
              <small>Un rendu chic pour mariages, anniversaires et evenements d'entreprise.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href="/contact">
              Demander un devis
            </Link>
            <Link className="public-button-outline" href="/tarifs">
              Voir les tarifs
            </Link>
            <Link className="public-button-outline" href="/choisir-template">
              {EVENT_PIC_TEMPLATE_PICKER_LABEL}
            </Link>
          </>
        }
      />

      <PublicSection
        eyebrow="Nos bornes Event Pic"
        title="Deux modeles pour deux ambiances"
        description="Choisissez la borne qui correspond le mieux a votre style d'evenement : chaleur vintage ou elegance moderne."
      >
        <div className="booth-model-stack">
          <article className="public-card booth-model-block">
            <div className="booth-model-grid">
              <div className="booth-model-media">
                <img
                  alt="Borne bois premium Event Pic en ambiance festive"
                  decoding="async"
                  loading="lazy"
                  src={EVENT_PIC_WOOD_PREMIUM_IMAGE}
                />
              </div>
              <div className="booth-model-content">
                <span className="booth-model-badge">Vintage - Champetre - Mariage</span>
                <h3>Borne bois premium</h3>
                <p>
                  Une borne elegante au design bois naturel, parfaite pour les mariages,
                  anniversaires et evenements haut de gamme dans une ambiance chaleureuse et
                  champetre.
                </p>
                <ul>
                  <li>Style bois chaleureux et authentique</li>
                  <li>Ideale pour les mariages champetres et decorations naturelles</li>
                  <li>Parfaite pour une ambiance vintage, douce et conviviale</li>
                  <li>Photos instantanees personnalisees selon votre evenement</li>
                </ul>
                <div className="public-actions-row">
                  <Link className="public-button-outline" href="/contact">
                    Demander un devis
                  </Link>
                </div>
              </div>
            </div>
          </article>

          <article className="public-card booth-model-block">
            <div className="booth-model-grid booth-model-grid-reverse">
              <div className="booth-model-content">
                <span className="booth-model-badge">Gris anthracite - Moderne - Chic</span>
                <h3>Borne metal premium</h3>
                <p>
                  Notre borne metal premium, avec sa finition gris anthracite, offre un rendu
                  moderne, sobre et haut de gamme. Elle s&apos;adapte parfaitement aux soirees
                  privees, evenements d&apos;entreprise, anniversaires et receptions elegantes.
                </p>
                <ul>
                  <li>Finition metal gris anthracite moderne</li>
                  <li>Presence visuelle forte en interieur</li>
                  <li>Parfaite pour les ambiances chic, corporate ou lounge</li>
                  <li>Ecran tactile et parcours invite fluide</li>
                </ul>
                <div className="public-actions-row">
                  <Link className="public-button-outline" href="/contact">
                    Demander un devis
                  </Link>
                </div>
              </div>
              <div className="booth-model-media booth-model-media-anthracite">
                <img
                  alt="Borne photobooth metal gris anthracite Event Pic en situation evenementielle"
                  decoding="async"
                  loading="lazy"
                  src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
                />
              </div>
            </div>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Galerie" title="Nos modeles de bornes en situation">
        <PhotoboothShowcase items={items} />
      </PublicSection>

      <PublicSection eyebrow="Experience invite" title="Une utilisation simple et professionnelle">
        <article className="public-card">
          <p>
            Les invites se placent devant la borne, se prennent en photo en quelques secondes et
            repartent avec un souvenir imprime ou numerique selon la formule choisie.
          </p>
          <ul>
            {EXPERIENCE_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </PublicSection>

      <GoogleReviewsSection />

      <PublicSection
        eyebrow="Entreprises"
        title="Ils nous ont fait confiance"
        description="Des entreprises, collectivites et lieux d'exception nous ont fait confiance pour animer leurs evenements avec une solution photobooth elegante, simple et memorable."
      >
        <PartnerLogoGrid logos={EVENT_PIC_PARTNER_LOGOS} />
      </PublicSection>
    </PublicSiteShell>
  );
}
