"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  DOSSIER_STATUS,
  EventDossier,
  getDeliveryStatusLabel,
  getDepositStatusLabel,
  getDossierStatusLabel,
  getPostEventStatusLabel,
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

type DossierRemovalResponse = {
  ok?: boolean;
  mode?: "deleted" | "archived";
  dossier?: EventDossier | null;
  deleted_id?: string;
  blockers?: string[];
  message?: string;
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

type TimeFilter = "all" | "upcoming" | "past" | "this_week" | "missing";
type StatusFilter = "all" | EventDossier["global_status"];

const PIPELINE_COLUMNS: Array<{ id: PipelineKey; label: string }> = [
  { id: "nouveau", label: "Nouveau dossier" },
  { id: "devis_a_envoyer", label: "Devis à envoyer" },
  { id: "signature_en_attente", label: "Signature en attente" },
  { id: "acompte_en_attente", label: "Acompte en attente" },
  { id: "template_a_preparer", label: "Template à préparer" },
  { id: "template_a_valider", label: "Template à valider" },
  { id: "livraison_a_affecter", label: "Livraison à affecter" },
  { id: "pret_evenement", label: "Prêt événement" },
  { id: "post_evenement", label: "Post-événement" },
  { id: "cloture", label: "Clôture" }
];

const TIME_FILTERS: Array<{ id: TimeFilter; label: string }> = [
  { id: "all", label: "Toutes les dates" },
  { id: "upcoming", label: "À venir" },
  { id: "this_week", label: "Cette semaine" },
  { id: "past", label: "Passés" },
  { id: "missing", label: "Infos manquantes" }
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

function parseDate(value: string, withTime = false) {
  if (!value) {
    return null;
  }
  const parsed = new Date(withTime || value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(dateValue: string) {
  const parsed = parseDate(dateValue);
  if (!parsed) {
    return dateValue || "-";
  }
  return parsed.toLocaleDateString("fr-FR");
}

function formatDateTime(dateValue: string) {
  const parsed = parseDate(dateValue, true);
  if (!parsed) {
    return dateValue || "-";
  }
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(amount: number) {
  if (!amount) {
    return "À définir";
  }
  return `${amount.toLocaleString("fr-FR")} €`;
}

function formatOptionList(options: string[]) {
  if (!options.length) {
    return "Aucune option";
  }
  return formatEventPicOptions(options).join(", ");
}

function getDossierCity(dossier: EventDossier) {
  const address = cleanText(dossier.event.address);
  if (!address) {
    return "-";
  }
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || address;
}

function getMissingFields(dossier: EventDossier) {
  const missing: string[] = [];
  if (!cleanText(dossier.client.full_name)) missing.push("client");
  if (!cleanText(dossier.client.email)) missing.push("email");
  if (!cleanText(dossier.client.phone)) missing.push("téléphone");
  if (!cleanText(dossier.event.type)) missing.push("type événement");
  if (!cleanText(dossier.event.date)) missing.push("date");
  if (!cleanText(dossier.event.address)) missing.push("lieu");
  if (!cleanText(dossier.quote.package_label)) missing.push("formule");
  return missing;
}

function getEventTimestamp(dossier: EventDossier) {
  if (!dossier.event.date) {
    return Number.POSITIVE_INFINITY;
  }
  const time = dossier.event.start_time || "00:00";
  const parsed = new Date(`${dossier.event.date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function isThisWeek(dateValue: string) {
  const parsed = parseDate(dateValue);
  if (!parsed) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(today.getDate() + 7);
  return parsed >= today && parsed <= limit;
}

function getStatusTone(status: EventDossier["global_status"]) {
  if (status === "closed") return "done";
  if (status === "cancelled") return "danger";
  if (status === "ready" || status === "event_day") return "ready";
  if (status === "post_event") return "review";
  if (status === "deposit_pending" || status === "signature_pending") return "warning";
  return "neutral";
}

function getSearchText(dossier: EventDossier) {
  return [
    dossier.id,
    dossier.client.full_name,
    dossier.client.email,
    dossier.client.phone,
    dossier.event.type,
    dossier.event.date,
    dossier.event.address,
    dossier.quote.quote_id,
    dossier.quote.quote_number,
    dossier.quote.package_label,
    dossier.quote.options.join(" "),
    dossier.template.template_name,
    dossier.delivery.assigned_driver_name,
    dossier.internal_notes
  ]
    .join(" ")
    .toLowerCase();
}

export default function AdminDossiersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<EventDossier[]>([]);
  const [stats, setStats] = useState<DossiersResponse["stats"]>();
  const [selectedDossierId, setSelectedDossierId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
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

  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = dossiers
      .filter((dossier) => {
        const parsed = parseDate(dossier.event.date);
        return parsed ? parsed >= today : false;
      })
      .sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

    return {
      total: dossiers.length,
      newCount: dossiers.filter((dossier) => dossier.global_status === "new" || dossier.quote.status === "draft").length,
      preparing: dossiers.filter((dossier) => dossier.template.status === "to_prepare" || dossier.template.status === "in_progress" || dossier.global_status === "template_pending").length,
      followUp: dossiers.filter(
        (dossier) =>
          dossier.quote.status === "sent" ||
          dossier.signature.signature_status === "sent" ||
          dossier.payment.deposit_status === "requested"
      ).length,
      confirmed: dossiers.filter(
        (dossier) =>
          dossier.quote.status === "signed" ||
          dossier.signature.signature_status === "signed" ||
          dossier.payment.deposit_status === "received" ||
          dossier.global_status === "ready" ||
          dossier.global_status === "event_day"
      ).length,
      done: dossiers.filter((dossier) => dossier.global_status === "closed").length,
      missingInfo: dossiers.filter((dossier) => getMissingFields(dossier).length > 0).length,
      nextEvent: upcoming[0] ?? null
    };
  }, [dossiers]);

  const filteredDossiers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dossiers
      .filter((dossier) => {
        if (statusFilter !== "all" && dossier.global_status !== statusFilter) {
          return false;
        }
        if (query && !getSearchText(dossier).includes(query)) {
          return false;
        }
        const parsed = parseDate(dossier.event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (timeFilter === "upcoming" && (!parsed || parsed < today)) {
          return false;
        }
        if (timeFilter === "past" && (!parsed || parsed >= today)) {
          return false;
        }
        if (timeFilter === "this_week" && !isThisWeek(dossier.event.date)) {
          return false;
        }
        if (timeFilter === "missing" && getMissingFields(dossier).length === 0) {
          return false;
        }
        return true;
      })
      .sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
  }, [dossiers, searchQuery, statusFilter, timeFilter]);

  const selectedDossier = useMemo(() => {
    return (
      filteredDossiers.find((dossier) => dossier.id === selectedDossierId) ??
      filteredDossiers[0] ??
      dossiers.find((dossier) => dossier.id === selectedDossierId) ??
      null
    );
  }, [dossiers, filteredDossiers, selectedDossierId]);

  useEffect(() => {
    if (dossiers.length === 0) {
      setSelectedDossierId("");
      return;
    }
    if (!selectedDossierId || !dossiers.some((dossier) => dossier.id === selectedDossierId)) {
      setSelectedDossierId(dossiers[0].id);
    }
  }, [dossiers, selectedDossierId]);

  useEffect(() => {
    setNotesDraft(selectedDossier?.internal_notes ?? "");
  }, [selectedDossier?.id, selectedDossier?.internal_notes]);

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
        throw new Error(payload.error || "Création dossier impossible.");
      }
      setMessage("Dossier manuel créé.");
      setManualForm({
        full_name: "",
        email: "",
        phone: "",
        event_type: "",
        event_date: "",
        event_address: ""
      });
      setShowCreatePanel(false);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Création dossier impossible.");
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
        throw new Error(payload.error || "Création dossier depuis devis impossible.");
      }
      setMessage("Dossier créé depuis devis.");
      setQuoteId("");
      setShowCreatePanel(false);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Création dossier depuis devis impossible.");
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
        throw new Error(payload.error || "Mise à jour acompte impossible.");
      }
      setMessage("Acompte marqué comme reçu.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise à jour acompte impossible.");
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
        setMessage(payload.message ?? "Lien de signature envoyé.");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Envoi signature impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function quickCloseDossier(dossier: EventDossier) {
    if (!window.confirm("Clôturer ce dossier ?")) {
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
        throw new Error(payload.error || "Clôture dossier impossible.");
      }
      setMessage("Dossier clôturé.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Clôture dossier impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function requestDossierRemoval(dossier: EventDossier) {
    const confirmation = window.prompt(
      `Action sensible sur le dossier de ${dossier.client.full_name || "ce client"}.\n\nTapez SUPPRIMER pour confirmer. Les dossiers liés à un devis, une signature, un paiement, un template ou une livraison seront archivés au lieu d'être supprimés.`
    );
    if (confirmation === null) {
      return;
    }
    if (confirmation !== "SUPPRIMER") {
      setError("Suppression annulée : confirmation exacte non saisie.");
      return;
    }

    const reason =
      window.prompt("Raison interne de suppression/archivage (optionnel).", "Doublon ou dossier test") ?? "";

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossier.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, reason })
      });
      const payload = (await response.json()) as DossierRemovalResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression dossier impossible.");
      }

      if (payload.mode === "deleted") {
        setSelectedDossierId("");
        setMessage(payload.message || "Dossier supprimé définitivement.");
      } else {
        setSelectedDossierId(payload.dossier?.id ?? dossier.id);
        setMessage(
          `${payload.message || "Dossier archivé."}${
            payload.blockers?.length ? ` Conservation: ${payload.blockers.join(", ")}.` : ""
          }`
        );
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Suppression dossier impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateInternalNotes(dossier: EventDossier) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossier.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          updates: { internal_notes: cleanText(notesDraft) },
          note: "Note interne mise à jour"
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise à jour des notes impossible.");
      }
      setMessage("Notes internes mises à jour.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise à jour des notes impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page premium-page dossiers-page">
      <section className="admin-hero premium-hero dossiers-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Suivi des dossiers</h1>
          <p className="admin-hero-subtitle">
            Pilotez chaque événement Event Pic, du devis jusqu&apos;à la clôture.
          </p>
        </div>
        <div className="admin-hero-actions dossiers-admin-nav">
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

      <section className="dossier-kpi-grid" aria-label="Statistiques dossiers">
        <article className="dossier-kpi-card is-dark">
          <span>Total dossiers</span>
          <strong>{dashboardStats.total}</strong>
          <small>{stats?.open_count ?? 0} ouverts</small>
        </article>
        <article className="dossier-kpi-card">
          <span>Nouveaux</span>
          <strong>{dashboardStats.newCount}</strong>
          <small>À qualifier</small>
        </article>
        <article className="dossier-kpi-card">
          <span>En préparation</span>
          <strong>{dashboardStats.preparing}</strong>
          <small>{stats?.templates_pending_count ?? 0} templates à suivre</small>
        </article>
        <article className="dossier-kpi-card">
          <span>À relancer</span>
          <strong>{dashboardStats.followUp}</strong>
          <small>Signature ou acompte</small>
        </article>
        <article className="dossier-kpi-card">
          <span>Confirmés</span>
          <strong>{dashboardStats.confirmed}</strong>
          <small>Devis, signature ou acompte OK</small>
        </article>
        <article className="dossier-kpi-card">
          <span>Terminés</span>
          <strong>{dashboardStats.done}</strong>
          <small>{stats?.dossiers_to_close_count ?? 0} à clôturer</small>
        </article>
        <article className="dossier-kpi-card">
          <span>Prochain événement</span>
          <strong>{dashboardStats.nextEvent ? formatDate(dashboardStats.nextEvent.event.date) : "-"}</strong>
          <small>{dashboardStats.nextEvent?.client.full_name || "Aucun événement à venir"}</small>
        </article>
        <article className="dossier-kpi-card">
          <span>Infos manquantes</span>
          <strong>{dashboardStats.missingInfo}</strong>
          <small>Dossiers à compléter</small>
        </article>
      </section>

      <section className="dossier-create-card">
        <div className="dossier-section-heading">
          <div>
            <span>Création</span>
            <h2>Créer un dossier</h2>
            <p>Ajoutez un dossier manuel ou rattachez une demande déjà préparée depuis un devis.</p>
          </div>
          <div className="dossier-actions-row">
            <button type="button" onClick={() => setShowCreatePanel((current) => !current)}>
              {showCreatePanel ? "Masquer" : "Créer un dossier"}
            </button>
            <button type="button" onClick={() => void load()} disabled={saving || loading}>
              Actualiser
            </button>
          </div>
        </div>

        {showCreatePanel ? (
          <div className="dossier-create-panel">
            <div className="dossier-quote-create">
              <label>
                Créer depuis un devis
                <span className="dossier-field-row">
                  <input
                    placeholder="quote_id"
                    value={quoteId}
                    onChange={(event) => setQuoteId(event.target.value)}
                  />
                  <button type="button" onClick={() => void createFromQuote()} disabled={saving}>
                    Créer depuis devis
                  </button>
                </span>
              </label>
            </div>

            <div className="dossier-form-grid">
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
                Téléphone
                <input
                  value={manualForm.phone}
                  onChange={(event) => setManualForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Type événement
                <input
                  value={manualForm.event_type}
                  onChange={(event) => setManualForm((current) => ({ ...current, event_type: event.target.value }))}
                />
              </label>
              <label>
                Date événement
                <input
                  type="date"
                  value={manualForm.event_date}
                  onChange={(event) => setManualForm((current) => ({ ...current, event_date: event.target.value }))}
                />
              </label>
              <label>
                Adresse événement
                <input
                  value={manualForm.event_address}
                  onChange={(event) => setManualForm((current) => ({ ...current, event_address: event.target.value }))}
                />
              </label>
            </div>
            <div className="dossier-actions-row">
              <button type="button" className="button-primary" onClick={() => void createManualDossier()} disabled={saving}>
                Ajouter un dossier
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dossier-pipeline-overview" aria-label="Pipeline dossiers">
        {PIPELINE_COLUMNS.map((column) => {
          const columnItems = grouped.get(column.id) ?? [];
          return (
            <article key={column.id} className="dossier-pipeline-chip">
              <span>{column.label}</span>
              <strong>{columnItems.length}</strong>
            </article>
          );
        })}
      </section>

      <section className="dossier-workbench">
        <div className="dossier-list-panel">
          <div className="dossier-section-heading compact">
            <div>
              <span>Suivi opérationnel</span>
              <h2>Liste des dossiers</h2>
              <p>{filteredDossiers.length} dossier{filteredDossiers.length > 1 ? "s" : ""} affiché{filteredDossiers.length > 1 ? "s" : ""}</p>
            </div>
          </div>

          <div className="dossier-toolbar">
            <label>
              Recherche
              <input
                placeholder="Client, email, téléphone, lieu, formule..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label>
              Statut
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">Tous les statuts</option>
                {DOSSIER_STATUS.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
              >
                {TIME_FILTERS.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dossier-list">
            {loading ? <div className="dossier-empty-state">Chargement des dossiers...</div> : null}
            {!loading && dossiers.length === 0 ? (
              <div className="dossier-empty-state">
                <strong>Aucun dossier enregistré</strong>
                <p>Les dossiers créés depuis les devis ou ajoutés manuellement apparaîtront ici.</p>
                <button type="button" onClick={() => setShowCreatePanel(true)}>
                  Créer un dossier manuel
                </button>
              </div>
            ) : null}
            {!loading && dossiers.length > 0 && filteredDossiers.length === 0 ? (
              <div className="dossier-empty-state">
                <strong>Aucun résultat</strong>
                <p>Ajustez la recherche ou les filtres pour afficher les dossiers.</p>
              </div>
            ) : null}
            {filteredDossiers.map((dossier) => {
              const missingFields = getMissingFields(dossier);
              const isSelected = selectedDossier?.id === dossier.id;
              return (
                <button
                  key={dossier.id}
                  type="button"
                  className={`dossier-list-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => setSelectedDossierId(dossier.id)}
                >
                  <span className="dossier-list-main">
                    <strong>{dossier.client.full_name || "Client à compléter"}</strong>
                    <small>{dossier.event.type || "Événement"} · {formatDate(dossier.event.date)}</small>
                  </span>
                  <span className="dossier-list-meta">
                    <span>{dossier.client.email || "Email manquant"}</span>
                    <span>{getDossierCity(dossier)}</span>
                    <span>{formatMoney(dossier.quote.amount_total)}</span>
                  </span>
                  <span className="dossier-list-badges">
                    <span className={`dossier-status-pill tone-${getStatusTone(dossier.global_status)}`}>
                      {getDossierStatusLabel(dossier.global_status)}
                    </span>
                    {missingFields.length > 0 ? (
                      <span className="dossier-status-pill tone-warning">{missingFields.length} info{missingFields.length > 1 ? "s" : ""} manquante{missingFields.length > 1 ? "s" : ""}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="dossier-detail-panel">
          {selectedDossier ? (
            <>
              <div className="dossier-detail-header">
                <div>
                  <span>Dossier sélectionné</span>
                  <h2>{selectedDossier.client.full_name || "Client à compléter"}</h2>
                  <p>{selectedDossier.event.type || "Événement"} · {formatDate(selectedDossier.event.date)}</p>
                </div>
                <span className={`dossier-status-pill tone-${getStatusTone(selectedDossier.global_status)}`}>
                  {getDossierStatusLabel(selectedDossier.global_status)}
                </span>
              </div>

              <div className="dossier-detail-actions">
                <Link href={`/admin/dossiers/${encodeURIComponent(selectedDossier.id)}`}>Ouvrir dossier</Link>
                <Link href={`/admin/emails?requestId=${encodeURIComponent(selectedDossier.template.template_request_id || selectedDossier.quote.quote_id || selectedDossier.id)}`}>
                  Préparer email
                </Link>
                <Link href="/admin/planning">Planning</Link>
                <Link href="/admin/livraisons">Livraisons</Link>
                <a href={selectedDossier.quote.quote_pdf_url || `/admin/dossiers/${encodeURIComponent(selectedDossier.id)}/documents/devis`} target="_blank" rel="noreferrer">
                  Voir devis
                </a>
                <a href={`/admin/dossiers/${encodeURIComponent(selectedDossier.id)}/documents/devis/pdf`} download>
                  Télécharger PDF
                </a>
              </div>

              <div className="dossier-detail-grid">
                <article>
                  <span>Client</span>
                  <strong>{selectedDossier.client.full_name || "-"}</strong>
                  <small>{selectedDossier.client.email || "Email manquant"}</small>
                  <small>{selectedDossier.client.phone || "Téléphone manquant"}</small>
                </article>
                <article>
                  <span>Événement</span>
                  <strong>{selectedDossier.event.type || "-"}</strong>
                  <small>{formatDate(selectedDossier.event.date)}</small>
                  <small>{selectedDossier.event.address || "Lieu à compléter"}</small>
                </article>
                <article>
                  <span>Devis / paiement</span>
                  <strong>{formatMoney(selectedDossier.quote.amount_total)}</strong>
                  <small>{selectedDossier.quote.package_label || "Formule à définir"}</small>
                  <small>Acompte : {getDepositStatusLabel(selectedDossier.payment.deposit_status)}</small>
                </article>
                <article>
                  <span>Template</span>
                  <strong>{getTemplateStatusLabel(selectedDossier.template.status)}</strong>
                  <small>{selectedDossier.template.template_name || "Aucun template lié"}</small>
                  <small>{selectedDossier.template.canva_links_available} lien(s) Canva</small>
                </article>
                <article>
                  <span>Livraison</span>
                  <strong>{getDeliveryStatusLabel(selectedDossier.delivery.status)}</strong>
                  <small>{selectedDossier.delivery.assigned_driver_name || "Livreur non affecté"}</small>
                  <small>{selectedDossier.delivery.distance_km ? `${selectedDossier.delivery.distance_km} km` : "Distance non renseignée"}</small>
                </article>
                <article>
                  <span>Après événement</span>
                  <strong>{getPostEventStatusLabel(selectedDossier.post_event.status)}</strong>
                  <small>{selectedDossier.post_event.gallery_url || "Galerie non envoyée"}</small>
                  <small>Mis à jour : {formatDateTime(selectedDossier.updated_at)}</small>
                </article>
              </div>

              <div className="dossier-detail-section">
                <div className="dossier-section-heading compact">
                  <div>
                    <span>États clés</span>
                    <h3>Progression</h3>
                  </div>
                </div>
                <div className="dossier-badges">
                  <span className="dossier-status-pill">{getQuoteStatusLabel(selectedDossier.quote.status)}</span>
                  <span className="dossier-status-pill">{getSignatureStatusLabel(selectedDossier.signature.signature_status)}</span>
                  <span className="dossier-status-pill">{getDepositStatusLabel(selectedDossier.payment.deposit_status)}</span>
                  <span className="dossier-status-pill">{getTemplateStatusLabel(selectedDossier.template.status)}</span>
                  <span className="dossier-status-pill">{getDeliveryStatusLabel(selectedDossier.delivery.status)}</span>
                </div>
              </div>

              <div className="dossier-detail-section">
                <div className="dossier-section-heading compact">
                  <div>
                    <span>Formule</span>
                    <h3>Prestations</h3>
                  </div>
                </div>
                <p>{selectedDossier.quote.package_label || "Formule à définir"}</p>
                <small>{formatOptionList(selectedDossier.quote.options)}</small>
              </div>

              <div className="dossier-detail-section">
                <div className="dossier-section-heading compact">
                  <div>
                    <span>Notes</span>
                    <h3>Notes internes</h3>
                  </div>
                  <button type="button" onClick={() => void updateInternalNotes(selectedDossier)} disabled={saving}>
                    Enregistrer
                  </button>
                </div>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Notes internes visibles uniquement dans l'administration."
                />
              </div>

              <div className="dossier-detail-section">
                <div className="dossier-section-heading compact">
                  <div>
                    <span>Actions rapides</span>
                    <h3>Opérations</h3>
                  </div>
                </div>
                <div className="dossier-quick-actions">
                  <button type="button" onClick={() => void quickSendSignature(selectedDossier)} disabled={saving}>
                    Envoyer signature SMS
                  </button>
                  <button type="button" onClick={() => void quickMarkDepositReceived(selectedDossier)} disabled={saving}>
                    Marquer acompte reçu
                  </button>
                  <button type="button" onClick={() => void quickCloseDossier(selectedDossier)} disabled={saving}>
                    Clôturer dossier
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => void requestDossierRemoval(selectedDossier)}
                    disabled={saving}
                  >
                    Supprimer / archiver
                  </button>
                </div>
              </div>

              <div className="dossier-detail-section">
                <div className="dossier-section-heading compact">
                  <div>
                    <span>Historique</span>
                    <h3>Dernières actions</h3>
                  </div>
                </div>
                <div className="dossier-history-list">
                  {selectedDossier.history.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <strong>{item.label}</strong>
                      <small>{formatDateTime(item.at)}</small>
                      <small>{item.details}</small>
                    </div>
                  ))}
                  {selectedDossier.history.length === 0 ? <small>Aucune action historisée.</small> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="dossier-empty-state">
              <strong>Aucun dossier sélectionné</strong>
              <p>Sélectionnez un dossier dans la liste pour afficher le détail opérationnel.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
