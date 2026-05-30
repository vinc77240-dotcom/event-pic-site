import Link from "next/link";

import { BrandLogo } from "@/app/components/BrandLogo";

type TemplateConfirmationContentProps = {
  contactRequestId?: string;
  requestId?: string;
};

export function TemplateConfirmationContent({
  contactRequestId,
  requestId
}: TemplateConfirmationContentProps) {
  const cleanContactRequestId = contactRequestId?.trim();
  const cleanRequestId = requestId?.trim();
  const modifyHref = cleanContactRequestId
    ? `/choisir-mon-design?contactRequestId=${encodeURIComponent(cleanContactRequestId)}`
    : "/choisir-mon-design";

  return (
    <main className="confirmation-page template-confirmation-page">
      <section className="confirmation-panel template-confirmation-panel">
        <BrandLogo alt="Event Pic" className="confirmation-logo" />
        <p className="eyebrow confirmation-kicker">Design Event Pic</p>
        <h1>Votre design a bien été transmis</h1>
        <p className="confirmation-lead">
          Merci, votre choix de design a bien été rattaché à votre demande. Event Pic vérifie
          maintenant le rendu, les textes et les formats sélectionnés avant votre événement.
        </p>

        {cleanContactRequestId ? (
          <p className="confirmation-linked-note">Ce design est bien lié à votre demande de devis.</p>
        ) : null}

        {cleanRequestId ? (
          <p className="request-reference">
            Référence de demande : <span>{cleanRequestId}</span>
          </p>
        ) : null}

        <div className="confirmation-actions">
          <Link className="primary-link" href={modifyHref}>
            Modifier mon choix
          </Link>
          <Link className="confirmation-secondary-link" href="/">
            Retour à l'accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
