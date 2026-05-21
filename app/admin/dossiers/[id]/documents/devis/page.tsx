"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EventDossier } from "@/src/shared/eventPicDossiers";
import { formatEventPicOptions } from "@/src/shared/eventPicPublic";

type DossierResponse = {
  ok?: boolean;
  dossier?: EventDossier;
  error?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  if (error) {
    return (
      <main className="public-page">
        <section className="premium-section">
          <h1>Devis introuvable</h1>
          <p>{error}</p>
          <Link href="/admin/dossiers">Retour dossiers</Link>
        </section>
      </main>
    );
  }

  if (!dossier) {
    return (
      <main className="public-page">
        <section className="premium-section">
          <p>Chargement du devis...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="public-page">
      <section className="premium-section admin-template-diagnostic">
        <h1 className="admin-document-title">
          Devis <span className="event-pic-signature heading-brand-signature">Event Pic</span>
        </h1>
        <p>{`Numero: ${dossier.quote.quote_number || "-"}`}</p>
        <pre className="admin-error-log">
{`Event Pic
Client: ${dossier.client.full_name || "-"}
Email: ${dossier.client.email || "-"}
Telephone: ${dossier.client.phone || "-"}
Evenement: ${dossier.event.type || "-"} - ${dossier.event.date || "-"}
Adresse: ${dossier.event.address || "-"}
Formule: ${dossier.quote.package_label || "-"}
Options: ${dossier.quote.options.length > 0 ? formatEventPicOptions(dossier.quote.options).join(", ") : "Aucune option"}
Montant total: ${dossier.quote.amount_total || 0} EUR
Frais deplacement: ${dossier.quote.delivery_fee || 0} EUR
Acompte: ${dossier.quote.deposit_amount || 100} EUR
Solde: ${dossier.quote.balance_amount || 0} EUR
Date edition: ${new Date().toLocaleDateString("fr-FR")}
`}
        </pre>
        <div className="table-actions">
          <button type="button" onClick={() => window.print()}>
            Imprimer / Export PDF
          </button>
          <Link href={`/admin/dossiers/${encodeURIComponent(dossier.id)}`}>Retour dossier</Link>
        </div>
      </section>
    </main>
  );
}
