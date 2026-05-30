import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { getEventPicCategory, normalizeEventPicFormatId } from "@/src/shared/eventPicTemplates";
import { TemplateGridClient } from "./TemplateGridClient";

type ChoisirMonDesignPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TEMPLATE_STEPS = [
  "Choisissez un modele photo",
  "Renseignez vos informations",
  "Indiquez les textes a afficher",
  "Validez votre demande",
  "Event Pic prepare et verifie le rendu"
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
              Choisissez votre design, indiquez vos textes et Event Pic prepare le rendu avant
              votre evenement.
            </p>
          </div>
        </section>

        <section className="steps-panel premium-section" aria-labelledby="template-steps-title">
          <div>
            <p className="eyebrow">Votre demande</p>
            <h2 id="template-steps-title">Comment ca fonctionne ?</h2>
            <p className="steps-intro">
              Tout se fait ici, dans l'espace Event Pic. Une fois votre demande envoyee, notre
              equipe controle le rendu pour garantir un resultat propre le jour de votre evenement.
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
