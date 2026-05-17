import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { PublicSection } from "@/app/components/public/PublicSection";

const CGV_PDF_PUBLIC_URL = "/documents/CGV_Event_Pic_CGV.pdf";

const ARTICLES = Array.from({ length: 22 }, (_, i) => i + 1);

export const metadata: Metadata = {
  title: "CGV Event Pic",
  description:
    "Consultez les Conditions Generales de Location et de Prestation de Services Event Pic."
};

export default function CgvPage() {
  return (
    <PublicSiteShell>
      <PublicSection
        eyebrow="Informations legales"
        title="Conditions Generales de Location et de Prestation de Services"
        description="Retrouvez les CGV Event Pic (articles 1 a 22) dans leur version officielle."
      >
        <article className="public-card cgv-card">
          <div className="cgv-top-row">
            <div>
              <h3>CGV Event Pic</h3>
              <p>
                Le document ci-dessous reprend la structure complete des articles 1 a 22 du PDF
                officiel.
              </p>
            </div>
            <a
              className="public-button-dark"
              href={CGV_PDF_PUBLIC_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Telecharger les CGV en PDF
            </a>
          </div>

          <div className="cgv-articles-strip" aria-label="Articles des CGV">
            {ARTICLES.map((article) => (
              <span className="cgv-article-pill" key={`article-${article}`}>
                {`Article ${article}`}
              </span>
            ))}
          </div>

          <div className="cgv-pdf-wrap">
            <iframe
              className="cgv-pdf-frame"
              src={CGV_PDF_PUBLIC_URL}
              title="Conditions Generales de Location et de Prestation de Services Event Pic"
            />
          </div>
        </article>

        <div className="public-actions-row">
          <Link className="public-button-outline" href="/contact">
            Demander un devis
          </Link>
          <Link className="public-button-outline" href="/choisir-template">
            Choisir mon design
          </Link>
        </div>
      </PublicSection>
    </PublicSiteShell>
  );
}

