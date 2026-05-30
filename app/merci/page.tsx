import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero, PublicSiteShell } from "@/app/components/PublicSiteShell";
import { EVENT_PIC_METAL_ANTHRACITE_IMAGE } from "@/src/shared/eventPicPublic";

export const metadata: Metadata = {
  title: "Demande envoyée - Event Pic",
  description: "Confirmation d'envoi de demande de devis Event Pic."
};

type MerciPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MerciPage({ searchParams }: MerciPageProps) {
  const params = searchParams ? await searchParams : {};
  const contactRequestId = readSearchParam(params, "contactRequestId") ?? "";
  const designHref = contactRequestId
    ? `/choisir-mon-design?contactRequestId=${encodeURIComponent(contactRequestId)}`
    : "/choisir-mon-design";

  return (
    <PublicSiteShell>
      <PublicHero
        title="Votre demande a bien été envoyée"
        subtitle="Nous revenons vers vous rapidement avec une proposition adaptée à votre événement."
        description="En attendant, vous pouvez déjà choisir votre design photo afin que nous puissions le rattacher à votre demande."
        visual={
          <figure className="hero-brand-visual hero-photo-visual">
            <img
              alt="Borne photobooth Event Pic en situation événementielle"
              className="hero-photo-image"
              decoding="async"
              loading="eager"
              src={EVENT_PIC_METAL_ANTHRACITE_IMAGE}
            />
            <figcaption className="hero-photo-content">
              <span className="hero-brand-eyebrow">Demande reçue</span>
              <strong>Nous revenons vers vous rapidement</strong>
              <small>Disponibilité, formule, options et organisation.</small>
            </figcaption>
          </figure>
        }
        actions={
          <>
            <Link className="public-button-dark" href={designHref}>
              Choisir mon design
            </Link>
            <Link className="public-button-outline" href="/">
              Retour à l'accueil
            </Link>
          </>
        }
      />
    </PublicSiteShell>
  );
}
