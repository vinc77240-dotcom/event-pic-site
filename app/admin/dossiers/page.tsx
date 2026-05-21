"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  EventDossier,
  getDepositStatusLabel,
  getDossierStatusLabel,
  getQuoteStatusLabel,
  getSignatureStatusLabel,
  getTemplateStatusLabel
} from "@/src/shared/eventPicDossiers";
import { formatEventPicOptions } from "@/src/shared/eventPicPublic";

type DossiersResponse = {
  ok?: boolean;
  dossiers?: EventDossier[];
  stats?: {
    open_count: number;
    signatures_pending_count: number;
    deposits_pending_count: number;
    templates_pending_count: number;
    events_this_week_count: number;
    dossiers_to_close_count: number;
  };
  error?: string;
};

type PipelineKey =
  | "nouveau"
  | "devis_a_envoyer"
  | "signature_en_attente"
  | "acompte_en_attente"
  | "template_a_preparer"
  | "template_a_valider"
  | "livraison_a_affecter"
  | "pret_evenement"
  | "post_evenement"
  | "cloture";

const PIPELINE_COLUMNS: Array<{ id: PipelineKey; label: string }> = [
  { id: "nouveau", label: "Nouveau dossier" },
  { id: "devis_a_envoyer", label: "Devis a envoyer" },
  { id: "signature_en_attente", label: "Signature en attente" },
  { id: "acompte_en_attente", label: "Acompte en attente" },
  { id: "template_a_preparer", label: "Template a preparer" },
  { id: "template_a_valider", label: "Template a valider" },
  { id: "livraison_a_affecter", label: "Livraison a affecter" },
  { id: "pret_evenement", label: "Pret evenement" },
  { id: "post_evenement", label: "Post-evenement" },
  { id: "cloture", label: "Cloture" }
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPipelineColumn(dossier: EventDossier): PipelineKey {
  if (dossier.global_status === "closed" || dossier.global_status === "cancelled") {
    return "cloture";
  }
  if (dossier.post_event.status !== "not_started") {
    return "post_evenement";
  }
  if (dossier.delivery.status === "to_assign") {
    return "livraison_a_affecter";
  }
  if (dossier.template.status === "ready_for_review") {
    return "template_a_valider";
  }
  if (
    dossier.template.status === "not_started" ||
    dossier.template.status === "client_to_choose" ||
    dossier.template.status === "to_prepare" ||
    dossier.template.status === "in_progress"
  ) {
    return "template_a_preparer";
  }
  if (dossier.payment.deposit_status !== "received") {
    return "acompte_en_attente";
  }
  if (dossier.signature.signature_status !== "signed") {
    return "signature_en_attente";
  }
  if (dossier.quote.status === "not_created" || dossier.quote.status === "draft" || dossier.quote.status === "sent") {
    return "devis_a_envoyer";
  }
  if (dossier.global_status === "ready" || dossier.global_status === "event_day") {
    return "pret_evenement";
  }
  return "nouveau";
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "-";
  }
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString("fr-FR");
}

export default function AdminDossiersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<EventDossier[]>([]);
  const [stats, setStats] = useState<DossiersResponse["stats"]>();
  const [manualForm, setManualForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    event_type: "",
    event_date: "",
    event_address: ""
  });
  const [quoteId, setQuoteId] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dossiers", { cache: "no-store" });
      const payload = (await response.json()) as DossiersResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement des dossiers impossible.");
      }
      setDossiers(payload.dossiers ?? []);
      setStats(payload.stats);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<PipelineKey, EventDossier[]>();
    for (const column of PIPELINE_COLUMNS) {
      map.set(column.id, []);
    }
    for (const dossier of dossiers) {
      const key = getPipelineColumn(dossier);
      map.get(key)?.push(dossier);
    }
    return map;
  }, [dossiers]);

  async function createManualDossier() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_manual",
          dossier: {
            client: {
              full_name: cleanText(manualForm.full_name),
              email: cleanText(manualForm.email),
              phone: cleanText(manualForm.phone)
            },
            event: {
              type: cleanText(manualForm.event_type),
              date: cleanText(manualForm.event_date),
              address: cleanText(manualForm.event_address)
            },
            quote: {
              status: "draft"
            }
          }
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation dossier impossible.");
      }
      setMessage("Dossier manuel cree.");
      setManualForm({
        full_name: "",
        email: "",
        phone: "",
        event_type: "",
        event_date: "",
        event_address: ""
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Creation dossier impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function createFromQuote() {
    const id = cleanText(quoteId);
    if (!id) {
      setError("Renseignez un quote_id.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_quote",
          quote_id: id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation dossier depuis devis impossible.");
      }
      setMessage("Dossier cree depuis devis.");
      setQuoteId("");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Creation dossier depuis devis impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function quickMarkDepositReceived(dossier: EventDossier) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossier.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_deposit_received",
          payment_method: "manual",
          payment_reference: "Admin"
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour acompte impossible.");
      }
      setMessage("Acompte marque comme recu.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise a jour acompte impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function quickSendSignature(dossier: EventDossier) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/dossiers/${encodeURIComponent(dossier.id)}/signature`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        mode?: "sms" | "manual";
        message?: string;
        signature_url?: string;
        otp_code?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Envoi signature impossible.");
      }

      if (payload.mode === "manual") {
        setMessage(
          `${payload.message} Lien: ${payload.signature_url ?? "-"} | OTP: ${payload.otp_code ?? "-"}`
        );
      } else {
        setMessage(payload.message ?? "Lien de signature envoye.");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Envoi signature impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function quickCloseDossier(dossier: EventDossier) {
    if (!window.confirm("Cloturer ce dossier ?")) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossier.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_dossier" })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Cloture dossier impossible.");
      }
      setMessage("Dossier cloture.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Cloture dossier impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page premium-page dossiers-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow admin-brand-line"><span className="event-pic-signature admin-brand-signature">Event Pic</span><span className="admin-brand-suffix">Admin</span></p>
          <h1>Suivi des dossiers</h1>
          <p className="admin-hero-subtitle">
            Pilotez chaque evenement Event Pic depuis le devis jusqu&apos;a la cloture.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/planning">Planning</Link>
          <Link href="/admin/devis">Devis</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <div className="admin-count">{dossiers.length} dossiers</div>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="dossier-stats-grid">
        <article className="public-card">
          <strong>Dossiers ouverts</strong>
          <p>{stats?.open_count ?? 0}</p>
        </article>
        <article className="public-card">
          <strong>Signatures en attente</strong>
          <p>{stats?.signatures_pending_count ?? 0}</p>
        </article>
        <article className="public-card">
          <strong>Acomptes en attente</strong>
          <p>{stats?.deposits_pending_count ?? 0}</p>
        </article>
        <article className="public-card">
          <strong>Templates a preparer</strong>
          <p>{stats?.templates_pending_count ?? 0}</p>
        </article>
        <article className="public-card">
          <strong>Evenements cette semaine</strong>
          <p>{stats?.events_this_week_count ?? 0}</p>
        </article>
        <article className="public-card">
          <strong>Dossiers a cloturer</strong>
          <p>{stats?.dossiers_to_close_count ?? 0}</p>
        </article>
      </section>

      <section className="admin-template-diagnostic">
        <h2>Creer un dossier</h2>
        <div className="table-actions">
          <input
            placeholder="quote_id (creation depuis devis)"
            value={quoteId}
            onChange={(event) => setQuoteId(event.target.value)}
          />
          <button type="button" onClick={() => void createFromQuote()} disabled={saving}>
            Creer dossier depuis devis
          </button>
        </div>
        <div className="calculator-grid">
          <label>
            Nom client
            <input
              value={manualForm.full_name}
              onChange={(event) => setManualForm((current) => ({ ...current, full_name: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              value={manualForm.email}
              onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Telephone
            <input
              value={manualForm.phone}
              onChange={(event) => setManualForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            Type evenement
            <input
              value={manualForm.event_type}
              onChange={(event) => setManualForm((current) => ({ ...current, event_type: event.target.value }))}
            />
          </label>
          <label>
            Date evenement
            <input
              type="date"
              value={manualForm.event_date}
              onChange={(event) => setManualForm((current) => ({ ...current, event_date: event.target.value }))}
            />
          </label>
          <label>
            Adresse evenement
            <input
              value={manualForm.event_address}
              onChange={(event) => setManualForm((current) => ({ ...current, event_address: event.target.value }))}
            />
          </label>
        </div>
        <div className="table-actions">
          <button type="button" className="button-primary" onClick={() => void createManualDossier()} disabled={saving}>
            Ajouter un dossier
          </button>
          <button type="button" onClick={() => void load()} disabled={saving || loading}>
            Actualiser
          </button>
        </div>
      </section>

      <section className="dossier-pipeline-grid">
        {PIPELINE_COLUMNS.map((column) => {
          const columnItems = grouped.get(column.id) ?? [];
          return (
            <article className="dossier-pipeline-column" key={column.id}>
              <header>
                <h3>{column.label}</h3>
                <span>{columnItems.length}</span>
              </header>
              <div className="dossier-pipeline-cards">
                {loading ? <small>Chargement...</small> : null}
                {!loading && columnItems.length === 0 ? <small>Aucun dossier</small> : null}
                {columnItems.map((dossier) => (
                  <div key={dossier.id} className="dossier-card">
                    <div className="dossier-card-head">
                      <strong>{dossier.client.full_name || "Client"}</strong>
                      <small>{formatDate(dossier.event.date)}</small>
                    </div>
                    <small>{dossier.event.type || "Evenement"}</small>
                    <small>{`${dossier.quote.amount_total || 0} EUR`}</small>
                    <small>{`Options: ${dossier.quote.options.length > 0 ? formatEventPicOptions(dossier.quote.options).join(", ") : "Aucune option"}`}</small>
                    <div className="dossier-badges">
                      <span className="status-pill">{getQuoteStatusLabel(dossier.quote.status)}</span>
                      <span className="status-pill">{getSignatureStatusLabel(dossier.signature.signature_status)}</span>
                      <span className="status-pill">{getDepositStatusLabel(dossier.payment.deposit_status)}</span>
                      <span className="status-pill">{getTemplateStatusLabel(dossier.template.status)}</span>
                      <span className="status-pill">{getDossierStatusLabel(dossier.global_status)}</span>
                    </div>
                    <div className="table-actions">
                      <Link href={`/admin/dossiers/${encodeURIComponent(dossier.id)}`}>Ouvrir dossier</Link>
                      <button type="button" onClick={() => void quickSendSignature(dossier)} disabled={saving}>
                        Envoyer signature SMS
                      </button>
                      <button type="button" onClick={() => void quickMarkDepositReceived(dossier)} disabled={saving}>
                        Marquer acompte recu
                      </button>
                      <Link href={`/admin/emails?requestId=${encodeURIComponent(dossier.template.template_request_id || dossier.quote.quote_id)}`}>
                        Preparer email client
                      </Link>
                      <button type="button" onClick={() => void quickCloseDossier(dossier)} disabled={saving}>
                        Cloturer dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
