"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type PublicDossierView = {
  dossier_id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  quote_number: string;
  amount_total: number;
  deposit_amount: number;
  balance_amount: number;
  quote_pdf_url: string;
  cgv_pdf_url: string;
  signature_status: string;
  token_expires_at: string;
};

type PublicDossierResponse = {
  ok?: boolean;
  dossier?: PublicDossierView;
  error?: string;
  message?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("fr-FR");
}

export default function PublicDossierPage() {
  const params = useParams<{ token: string }>();
  const token = cleanText(params?.token);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dossier, setDossier] = useState<PublicDossierView | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/public/dossier/${encodeURIComponent(token)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as PublicDossierResponse;
      if (!response.ok || !payload.ok || !payload.dossier) {
        setError(payload.error || "Lien invalide ou expire.");
        setLoading(false);
        return;
      }
      setDossier(payload.dossier);
      setLoading(false);
    })();
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/public/dossier/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp,
          accepted
        })
      });
      const payload = (await response.json()) as PublicDossierResponse;
      if (!response.ok || !payload.ok || !payload.dossier) {
        throw new Error(payload.error || "Validation impossible.");
      }
      setDossier(payload.dossier);
      setMessage(
        "Votre devis et les CGV ont bien ete valides. Event Pic vous recontactera pour la suite de la preparation."
      );
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Validation impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="public-page">
      <section className="premium-section">
        <div className="premium-container">
          <h1>Votre dossier Event Pic</h1>
          <p>Validation par code SMS du devis et des CGV.</p>
        </div>
      </section>

      <section className="premium-section">
        <div className="premium-container">
          {loading ? <p>Chargement du dossier...</p> : null}
          {error ? <p className="notice">{error}</p> : null}
          {message ? <p className="inline-feedback">{message}</p> : null}

          {!loading && dossier ? (
            <article className="public-card">
              <h2>{dossier.client_name || "Client"}</h2>
              <p>{`${dossier.event_type || "Evenement"} - ${formatDate(dossier.event_date)}`}</p>
              <small>{`Devis: ${dossier.quote_number || "-"}`}</small>
              <small>{`Montant total: ${dossier.amount_total || 0} EUR`}</small>
              <small>{`Acompte: ${dossier.deposit_amount || 0} EUR`}</small>
              <small>{`Solde: ${dossier.balance_amount || 0} EUR`}</small>
              <small>{`Statut signature: ${dossier.signature_status || "-"}`}</small>
              <small>{`Lien valable jusqu'au ${formatDate(dossier.token_expires_at)}`}</small>

              <div className="table-actions" style={{ marginTop: 12 }}>
                {dossier.quote_pdf_url ? (
                  <a href={dossier.quote_pdf_url} target="_blank" rel="noreferrer">
                    Consulter le devis
                  </a>
                ) : null}
                {dossier.cgv_pdf_url ? (
                  <a href={dossier.cgv_pdf_url} target="_blank" rel="noreferrer">
                    Consulter les CGV
                  </a>
                ) : null}
              </div>

              {dossier.signature_status !== "signed" ? (
                <form className="public-form" onSubmit={submit} style={{ marginTop: 14 }}>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(event) => setAccepted(event.target.checked)}
                    />
                    <span>J&apos;ai lu et j&apos;accepte le devis et les CGV.</span>
                  </label>
                  <label>
                    Code SMS (OTP)
                    <input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="6 chiffres"
                      inputMode="numeric"
                    />
                  </label>
                  <div className="table-actions">
                    <button type="submit" className="button-primary" disabled={saving}>
                      {saving ? "Validation..." : "Signer / Valider"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="inline-feedback">
                  Votre devis et les CGV ont bien ete valides. Event Pic vous recontactera pour la
                  suite de la preparation.
                </p>
              )}
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}
