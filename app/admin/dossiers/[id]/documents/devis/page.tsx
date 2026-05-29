"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { EventDossier, getQuoteStatusLabel } from "@/src/shared/eventPicDossiers";
import { EVENT_PIC_CONTACT, EVENT_PIC_OPTIONS, EVENT_PIC_PHOTOBOOTH_PACKAGES } from "@/src/shared/eventPicPublic";

type DossierResponse = {
  ok?: boolean;
  dossier?: EventDossier;
  error?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function displayText(value: unknown, fallback = "À confirmer") {
  return cleanText(value) || fallback;
}

function formatDate(value: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "À confirmer";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return cleaned;
  }

  return parsed.toLocaleDateString("fr-FR");
}

function formatEditionDate() {
  return new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatMoney(value: number, fallback = "À confirmer") {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return `${Math.round(value).toLocaleString("fr-FR")} €`;
}

function stripPriceSuffix(label: string) {
  return label.replace(/\s*[-–—]\s*\d+\s*(?:eur|€)\s*$/i, "").trim();
}

type QuoteLine = {
  designation: string;
  detail: string;
  amount: string;
  tone?: "strong" | "muted" | "deduction";
};

type EventPicOption = (typeof EVENT_PIC_OPTIONS)[number];

const OPTION_BY_ID = new Map<string, EventPicOption>(EVENT_PIC_OPTIONS.map((option) => [option.id, option]));
const OPTION_BY_LABEL = new Map<string, EventPicOption>(
  EVENT_PIC_OPTIONS.map((option) => [option.label.toLowerCase(), option])
);

function resolveOption(optionId: string | undefined, optionLabel: string | undefined) {
  const fromId = optionId ? OPTION_BY_ID.get(optionId) : undefined;

  if (fromId) {
    return fromId;
  }

  const normalizedLabel = stripPriceSuffix(cleanText(optionLabel)).toLowerCase();
  return normalizedLabel ? OPTION_BY_LABEL.get(normalizedLabel) : undefined;
}

function buildOptionLines(dossier: EventDossier): QuoteLine[] {
  const maxLength = Math.max(dossier.quote.option_ids.length, dossier.quote.options.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const option = resolveOption(dossier.quote.option_ids[index], dossier.quote.options[index]);
    const fallbackLabel = stripPriceSuffix(dossier.quote.options[index] ?? dossier.quote.option_ids[index] ?? "Option");

    return {
      designation: option?.label ?? fallbackLabel,
      detail: option?.description ?? "Option complémentaire sélectionnée pour l'événement.",
      amount: typeof option?.price === "number" ? formatMoney(option.price, "Inclus dans le total") : "Inclus dans le total"
    };
  }).filter((line) => cleanText(line.designation).length > 0);
}

function findPackage(dossier: EventDossier) {
  const byId = EVENT_PIC_PHOTOBOOTH_PACKAGES.find((item) => item.id === dossier.quote.package_id);

  if (byId) {
    return byId;
  }

  const packageLabel = cleanText(dossier.quote.package_label).toLowerCase();
  return EVENT_PIC_PHOTOBOOTH_PACKAGES.find((item) => item.label.toLowerCase() === packageLabel);
}

function buildQuoteLines(dossier: EventDossier): QuoteLine[] {
  const selectedPackage = findPackage(dossier);
  const packageAmount =
    typeof selectedPackage?.price === "number"
      ? formatMoney(selectedPackage.price)
      : dossier.quote.custom_quote
        ? "Sur devis"
        : "Inclus dans le total";
  const deliveryAmount =
    dossier.quote.delivery_fee > 0
      ? formatMoney(dossier.quote.delivery_fee)
      : cleanText(dossier.event.address)
        ? "Inclus / offert"
        : "À confirmer";

  return [
    {
      designation: "Formule principale",
      detail: displayText(dossier.quote.package_label, "Formule à définir"),
      amount: packageAmount,
      tone: "strong"
    },
    {
      designation: "Installation et reprise",
      detail: "Installation de la borne avant l'événement et reprise selon les horaires convenus.",
      amount: "Inclus"
    },
    {
      designation: "Personnalisation Event Pic",
      detail: "Cadre photo et écran d'accueil personnalisés selon les éléments transmis.",
      amount: "Inclus"
    },
    {
      designation: "Galerie numérique",
      detail: "Mise à disposition des photos après l'événement, selon la formule retenue.",
      amount: "Inclus"
    },
    ...buildOptionLines(dossier),
    {
      designation: "Frais de déplacement",
      detail: cleanText(dossier.event.address)
        ? `Adresse de référence : ${dossier.event.address}`
        : "Montant à confirmer selon l'adresse exacte de l'événement.",
      amount: deliveryAmount
    }
  ];
}

function getClientCompany(dossier: EventDossier) {
  const client = dossier.client as EventDossier["client"] & {
    company?: string;
    company_name?: string;
    society?: string;
  };

  return cleanText(client.company) || cleanText(client.company_name) || cleanText(client.society);
}

function printDocument() {
  window.print();
}

export default function DossierQuoteDocumentPage() {
  const params = useParams<{ id: string }>();
  const dossierId = cleanText(params?.id);
  const [dossier, setDossier] = useState<EventDossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dossierId) {
      return;
    }
    void (async () => {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossierId)}`, { cache: "no-store" });
      const payload = (await response.json()) as DossierResponse;
      if (!response.ok || !payload.ok || !payload.dossier) {
        setError(payload.error || "Devis introuvable.");
        return;
      }
      setDossier(payload.dossier);
    })();
  }, [dossierId]);

  useEffect(() => {
    const shouldAutoPrint = new URLSearchParams(window.location.search).get("print") === "1";

    if (!dossier || !shouldAutoPrint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [dossier]);

  if (error) {
    return (
      <main className="quote-document-page public-page">
        <section className="quote-document-shell quote-document-state">
          <h1>Devis introuvable</h1>
          <p>{error}</p>
          <Link href="/admin/dossiers">Retour dossiers</Link>
        </section>
      </main>
    );
  }

  if (!dossier) {
    return (
      <main className="quote-document-page public-page">
        <section className="quote-document-shell quote-document-state">
          <p>Chargement du devis...</p>
        </section>
      </main>
    );
  }

  const quoteLines = buildQuoteLines(dossier);
  const clientCompany = getClientCompany(dossier);
  const totalAmount = formatMoney(dossier.quote.amount_total);
  const depositAmount = formatMoney(dossier.quote.deposit_amount);
  const balanceAmount = formatMoney(dossier.quote.balance_amount);
  const subtotalAmount =
    dossier.quote.amount_total > 0 && dossier.quote.delivery_fee > 0
      ? formatMoney(Math.max(dossier.quote.amount_total - dossier.quote.delivery_fee, 0))
      : totalAmount;

  return (
    <main className="quote-document-page public-page">
      <div className="quote-document-toolbar" aria-label="Actions document devis">
        <Link href={`/admin/dossiers/${encodeURIComponent(dossier.id)}`}>Retour dossier</Link>
        <button type="button" className="quote-document-download-button" onClick={printDocument}>
          Télécharger / enregistrer le PDF
        </button>
        <button type="button" onClick={printDocument}>
          Imprimer
        </button>
      </div>

      <article className="quote-document-shell" aria-label="Devis Event Pic">
        <header className="quote-document-header">
          <div className="quote-document-brand">
            <BrandLogo alt="Event Pic" className="quote-document-logo" />
            <div>
              <strong>Event Pic</strong>
              <span>Photobooth & animations événementielles</span>
            </div>
          </div>
          <div className="quote-document-heading">
            <p>Document commercial</p>
            <h1>Devis</h1>
            <span>{getQuoteStatusLabel(dossier.quote.status)}</span>
          </div>
        </header>

        <section className="quote-document-meta-grid" aria-label="Informations du devis">
          <div>
            <span>Numéro de devis</span>
            <strong>{displayText(dossier.quote.quote_number, "À générer")}</strong>
          </div>
          <div>
            <span>Date d'édition</span>
            <strong>{formatEditionDate()}</strong>
          </div>
          <div>
            <span>Date événement</span>
            <strong>{formatDate(dossier.event.date)}</strong>
          </div>
        </section>

        <section className="quote-document-parties">
          <div className="quote-document-panel quote-document-company-panel">
            <span className="quote-document-kicker">Entreprise</span>
            <h2>Event Pic</h2>
            <p>Photobooth & animations événementielles</p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{EVENT_PIC_CONTACT.email}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{EVENT_PIC_CONTACT.phoneDisplay}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>Île-de-France & départements limitrophes</dd>
              </div>
            </dl>
          </div>

          <div className="quote-document-panel">
            <span className="quote-document-kicker">Client</span>
            <h2>{displayText(dossier.client.full_name, "Client à confirmer")}</h2>
            <dl>
              {clientCompany ? (
                <div>
                  <dt>Société</dt>
                  <dd>{clientCompany}</dd>
                </div>
              ) : null}
              <div>
                <dt>Email</dt>
                <dd>{displayText(dossier.client.email)}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{displayText(dossier.client.phone)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="quote-document-panel quote-document-event-panel">
          <span className="quote-document-kicker">Événement</span>
          <div className="quote-document-event-grid">
            <div>
              <span>Type d'événement</span>
              <strong>{displayText(dossier.event.type)}</strong>
            </div>
            <div>
              <span>Horaires</span>
              <strong>
                {cleanText(dossier.event.start_time) || cleanText(dossier.event.end_time)
                  ? `${displayText(dossier.event.start_time, "Début à confirmer")} - ${displayText(
                      dossier.event.end_time,
                      "fin à confirmer"
                    )}`
                  : "À confirmer"}
              </strong>
            </div>
            <div>
              <span>Invités</span>
              <strong>{dossier.event.guest_count > 0 ? `${dossier.event.guest_count} invités` : "À confirmer"}</strong>
            </div>
            <div>
              <span>Formule choisie</span>
              <strong>{displayText(dossier.quote.package_label, "Formule à définir")}</strong>
            </div>
            <div className="quote-document-event-address">
              <span>Adresse événement</span>
              <strong>{displayText(dossier.event.address)}</strong>
            </div>
          </div>
        </section>

        <section className="quote-document-lines-section">
          <div className="quote-document-section-heading">
            <span className="quote-document-kicker">Prestations</span>
            <h2>Détail de la proposition</h2>
          </div>
          <div className="quote-document-table-wrap">
            <table className="quote-document-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Détail</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {quoteLines.map((line) => (
                  <tr key={`${line.designation}-${line.amount}`} className={line.tone ? `is-${line.tone}` : undefined}>
                    <td data-label="Désignation">
                      <strong>{line.designation}</strong>
                    </td>
                    <td data-label="Détail">{line.detail}</td>
                    <td data-label="Montant">
                      <strong>{line.amount}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="quote-document-bottom-grid">
          <div className="quote-document-panel quote-document-conditions">
            <span className="quote-document-kicker">Conditions</span>
            <ul>
              <li>La date est bloquée après validation du devis et réception de l'acompte.</li>
              <li>Les prestations sont confirmées selon disponibilité au moment de la validation.</li>
              <li>Les détails définitifs peuvent être ajustés avant l'événement.</li>
            </ul>
          </div>

          <aside className="quote-document-total-card" aria-label="Synthèse financière">
            <div>
              <span>Sous-total prestations</span>
              <strong>{subtotalAmount}</strong>
            </div>
            {dossier.quote.delivery_fee > 0 ? (
              <div>
                <span>Frais de déplacement</span>
                <strong>{formatMoney(dossier.quote.delivery_fee)}</strong>
              </div>
            ) : null}
            <div className="quote-document-total-main">
              <span>Total estimé</span>
              <strong>{totalAmount}</strong>
            </div>
            <div>
              <span>Acompte</span>
              <strong>{depositAmount}</strong>
            </div>
            <div>
              <span>Solde à régler</span>
              <strong>{balanceAmount}</strong>
            </div>
          </aside>
        </section>

        <footer className="quote-document-footer">
          <p>Merci pour votre confiance. Event Pic vous accompagne pour une animation élégante, fluide et mémorable.</p>
          <span>{`Dossier ${dossier.id}`}</span>
        </footer>
      </article>

      <div className="quote-document-toolbar quote-document-toolbar-bottom" aria-label="Actions document devis">
        <Link href={`/admin/dossiers/${encodeURIComponent(dossier.id)}`}>Retour dossier</Link>
        <button type="button" className="quote-document-download-button" onClick={printDocument}>
          Télécharger / enregistrer le PDF
        </button>
        <button type="button" onClick={printDocument}>
          Imprimer
        </button>
      </div>
    </main>
  );
}
