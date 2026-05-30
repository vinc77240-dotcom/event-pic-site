import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { getEventPicCategory, normalizeEventPicFormatId } from "@/src/shared/eventPicTemplates";
import { TemplateGridClient } from "./TemplateGridClient";

type ChoisirMonDesignPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TEMPLATE_STEPS = [
  "Choisissez un modèle photo",
  "Renseignez vos informations",
  "Indiquez les textes à afficher",
  "Validez votre demande",
  "Event Pic prépare et vérifie le rendu"
];

function readSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChoisirMonDesignPage({ searchParams }: ChoisirMonDesignPageProps) {
  const params = searchParams ? await searchParams : {};
  const initialFormatId = normalizeEventPicFormatId(readSearchParam(params, "format"));
  const initialCategoryId = getEventPicCategory(readSearchParam(params, "category")).id;

  return (
    <PublicSiteShell>
      <div className="widget-page premium-page choose-template-page">
        <section className="widget-hero premium-hero">
          <div>
            <p className="eyebrow">Photobooth professionnelle</p>
            <h1>Choisir mon design photo</h1>
            <p>
              Choisissez votre design, indiquez vos textes et Event Pic prépare le rendu avant
              votre événement.
            </p>
          </div>
        </section>

        <section className="steps-panel premium-section" aria-labelledby="template-steps-title">
          <div>
            <p className="eyebrow">Votre demande</p>
            <h2 id="template-steps-title">Comment ça fonctionne ?</h2>
            <p className="steps-intro">
              Tout se fait ici, dans l'espace Event Pic. Une fois votre demande envoyée, notre
              équipe contrôle le rendu pour garantir un résultat propre le jour de votre événement.
            </p>
          </div>
          <ol className="steps-list">
            {TEMPLATE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <TemplateGridClient initialFormatId={initialFormatId} initialCategoryId={initialCategoryId} />
      </div>
    </PublicSiteShell>
  );
}
