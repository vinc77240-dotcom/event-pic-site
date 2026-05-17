import { headers } from "next/headers";
import { TemplateBoothWidget } from "../TemplateBoothWidget";
import { BrandLogo } from "@/app/components/BrandLogo";

const TEMPLATE_STEPS = [
  "Choisissez un modele photo",
  "Renseignez vos informations",
  "Indiquez les textes a afficher",
  "Validez votre demande",
  "Event Pic prepare et verifie le rendu"
];

async function getSiteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (!host) {
    return "";
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

async function getWidgetUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_TEMPLATEBOOTH_WIDGET_URL?.trim();

  if (!configuredUrl) {
    return "";
  }

  const origin = await getSiteOrigin();

  if (!origin) {
    return configuredUrl;
  }

  try {
    const url = new URL(configuredUrl);

    if (!url.searchParams.has("redirect_url")) {
      url.searchParams.set("redirect_url", `${origin}/template-confirmation`);
    }

    return url.toString();
  } catch {
    return configuredUrl;
  }
}

export default async function ChoisirTemplateWidgetPage() {
  const widgetUrl = await getWidgetUrl();

  return (
    <main className="widget-page">
      <section className="widget-hero">
        <BrandLogo alt="Event Pic" className="event-pic-logo" />
        <div>
          <p className="eyebrow">Photobooth professionnelle</p>
          <h1>Personnalisation de votre modele photo</h1>
          <p>Choisissez votre design, indiquez vos textes et Event Pic verifie le rendu avant votre evenement.</p>
        </div>
      </section>

      <section className="steps-panel" aria-labelledby="template-steps-title">
        <div>
          <p className="eyebrow">Votre demande</p>
          <h2 id="template-steps-title">Comment ca fonctionne ?</h2>
          <p className="steps-intro">
            Tout se fait ici, dans l'espace Event Pic. Une fois votre demande envoyee, notre equipe controle le rendu
            pour garantir un resultat propre le jour de votre evenement.
          </p>
        </div>
        <ol className="steps-list">
          {TEMPLATE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <TemplateBoothWidget widgetUrl={widgetUrl} />
    </main>
  );
}
