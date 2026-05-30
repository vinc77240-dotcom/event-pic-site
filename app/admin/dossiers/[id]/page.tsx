"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

type DossierResponse = {
  ok?: boolean;
  dossier?: EventDossier;
  error?: string;
};

type TabId =
  | "resume"
  | "quote"
  | "signature"
  | "payment"
  | "template"
  | "delivery"
  | "post_event"
  | "history";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "resume", label: "Resume" },
  { id: "quote", label: "Devis / CGV" },
  { id: "signature", label: "Signature SMS" },
  { id: "payment", label: "Paiement" },
  { id: "template", label: "Template" },
  { id: "delivery", label: "Livraison" },
  { id: "post_event", label: "Post-événement" },
  { id: "history", label: "Historique" }
];

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("fr-FR");
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildQuotePdfUrl(dossierId: string) {
  return `/admin/dossiers/${encodeURIComponent(dossierId)}/documents/devis/pdf`;
}

export default function AdminDossierDetailPage() {
  const params = useParams<{ id: string }>();
  const dossierId = cleanText(params?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("resume");
  const [dossier, setDossier] = useState<EventDossier | null>(null);
  const [internalNotes, setInternalNotes] = useState("");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [signatureManual, setSignatureManual] = useState<{
    mode?: "sms" | "manual";
    signature_url?: string;
    otp_code?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!dossierId) {
      return;
    }
    void loadDossier();
  }, [dossierId]);

  useEffect(() => {
    if (!dossier) {
      return;
    }
    setInternalNotes(dossier.internal_notes || "");
    setGalleryUrl(dossier.post_event.gallery_url || "");
  }, [dossier]);

  const nextAction = useMemo(() => {
    if (!dossier) {
      return "-";
    }
    if (dossier.quote.status === "draft" || dossier.quote.status === "not_created") {
      return "Envoyer le devis";
    }
    if (dossier.signature.signature_status !== "signed") {
      return "Envoyer le lien de validation SMS";
    }
    if (dossier.payment.deposit_status !== "received") {
      return "Confirmer la reception de l'acompte";
    }
    if (
      dossier.template.status !== "validated_by_client" &&
      dossier.template.status !== "sent_to_booth"
    ) {
      return "Finaliser la preparation template";
    }
    if (dossier.delivery.status === "not_created" || dossier.delivery.status === "to_assign") {
      return "Affecter la livraison";
    }
    if (dossier.post_event.status === "not_started") {
      return "Envoyer la galerie post-événement";
    }
    return "Cloturer le dossier";
  }, [dossier]);

  async function loadDossier() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossierId)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as DossierResponse;
      if (!response.ok || !payload.ok || !payload.dossier) {
        throw new Error(payload.error || "Dossier introuvable.");
      }
      setDossier(payload.dossier);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function patchAction(action: string, extra?: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossierId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(extra ?? {})
        })
      });
      const payload = (await response.json()) as DossierResponse;
      if (!response.ok || !payload.ok || !payload.dossier) {
        throw new Error(payload.error || "Mise à jour du dossier impossible.");
      }
      setDossier(payload.dossier);
      setMessage("Mise à jour enregistrée.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendSignatureSms() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/dossiers/${encodeURIComponent(dossierId)}/signature`, {
        method: "POST"
      });
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
      setSignatureManual(payload);
      setMessage(payload.message || "Lien de signature genere.");
      await loadDossier();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Envoi signature impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (!dossierId) {
    return (
      <main className="admin-page premium-page">
        <p className="notice">Identifiant dossier manquant.</p>
      </main>
    );
  }

  return (
    <main className="admin-page premium-page dossier-detail-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Dossier événement</h1>
          <p className="admin-hero-subtitle">
            Suivi complet du devis, validation, acompte, template, livraison et post-événement.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/planning">Planning</Link>
          <Link href="/admin/devis">Devis</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <Link href="/admin/templates">Classement templates</Link>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-template-diagnostic">
        {loading || !dossier ? (
          <p>Chargement du dossier...</p>
        ) : (
          <>
            <h2>{dossier.client.full_name || "Client"}</h2>
            <div className="dossier-summary-grid">
              <div>
                <strong>Événement</strong>
                <small>{`${dossier.event.type || "-"} - ${dossier.event.date || "-"}`}</small>
              </div>
              <div>
                <strong>Montant total</strong>
                <small>{`${dossier.quote.amount_total || 0} EUR`}</small>
              </div>
              <div>
                <strong>Statut global</strong>
                <small>{getDossierStatusLabel(dossier.global_status)}</small>
              </div>
              <div>
                <strong>Prochaine action</strong>
                <small>{nextAction}</small>
              </div>
            </div>
            <div className="table-actions" style={{ marginTop: 12 }}>
              <button type="button" disabled={saving} onClick={() => void sendSignatureSms()}>
                Envoyer lien signature SMS
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patchAction("mark_deposit_received", {
                    payment_method: "manual",
                    payment_reference: "Admin"
                  })
                }
              >
                Marquer acompte recu
              </button>
              <button type="button" disabled={saving} onClick={() => void patchAction("mark_template_ready")}>
                Marquer template fait
              </button>
              <button type="button" disabled={saving} onClick={() => void patchAction("mark_template_validated")}>
                Marquer valide client
              </button>
              <button type="button" disabled={saving} onClick={() => void patchAction("mark_template_sent_to_booth")}>
                Marquer envoye vers borne
              </button>
              <button type="button" disabled={saving} onClick={() => void patchAction("close_dossier")}>
                Cloturer dossier
              </button>
            </div>
          </>
        )}
      </section>

      {!loading && dossier ? (
        <section className="admin-template-diagnostic">
          <div className="table-actions">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "button-primary" : ""}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "resume" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Client</h3>
                <p>{dossier.client.full_name || "-"}</p>
                <small>{dossier.client.email || "-"}</small>
                <small>{dossier.client.phone || "-"}</small>
              </article>
              <article className="public-card">
                <h3>Événement</h3>
                <p>{dossier.event.type || "-"}</p>
                <small>{dossier.event.date || "-"}</small>
                <small>{dossier.event.address || "-"}</small>
              </article>
              <article className="public-card">
                <h3>Statuts</h3>
                <small>{`Devis: ${getQuoteStatusLabel(dossier.quote.status)}`}</small>
                <small>{`Signature: ${getSignatureStatusLabel(dossier.signature.signature_status)}`}</small>
                <small>{`Acompte: ${getDepositStatusLabel(dossier.payment.deposit_status)}`}</small>
                <small>{`Template: ${getTemplateStatusLabel(dossier.template.status)}`}</small>
                <small>{`Livraison: ${getDeliveryStatusLabel(dossier.delivery.status)}`}</small>
                <small>{`Post-event: ${getPostEventStatusLabel(dossier.post_event.status)}`}</small>
              </article>
              <article className="public-card">
                <h3>Rappels</h3>
                <div className="planning-reminders-list">
                  {dossier.reminders.map((reminder) => (
                    <label key={reminder.id}>
                      <input
                        type="checkbox"
                        checked={reminder.checked}
                        onChange={(event) =>
                          void patchAction("toggle_reminder", {
                            reminder_id: reminder.id,
                            checked: event.target.checked
                          })
                        }
                      />
                      <span>{`${reminder.label} (${reminder.due_date || "-"})`}</span>
                    </label>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {tab === "quote" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Devis / CGV</h3>
                <small>{`Numero devis: ${dossier.quote.quote_number || "-"}`}</small>
                <small>{`Statut devis: ${getQuoteStatusLabel(dossier.quote.status)}`}</small>
                <small>{`Statut CGV: ${dossier.terms.status}`}</small>
                <small>{`Formule: ${dossier.quote.package_label || "-"}`}</small>
                <small>{`Options: ${dossier.quote.options.length > 0 ? formatEventPicOptions(dossier.quote.options).join(", ") : "Aucune option"}`}</small>
                <small>{`Total: ${dossier.quote.amount_total} EUR`}</small>
                <small>{`Acompte: ${dossier.quote.deposit_amount} EUR`}</small>
                <small>{`Solde: ${dossier.quote.balance_amount} EUR`}</small>
                <div className="table-actions">
                  <Link
                    className="button-primary"
                    href={buildQuotePdfUrl(dossier.id)}
                    download
                    title="Télécharger un vrai fichier PDF du devis."
                  >
                    Télécharger le PDF
                  </Link>
                  <Link href={dossier.quote.quote_pdf_url} target="_blank" rel="noreferrer">
                    Ouvrir devis
                  </Link>
                  <Link href={dossier.terms.cgv_pdf_url} target="_blank" rel="noreferrer">
                    Ouvrir CGV
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      void patchAction("update", {
                        updates: {
                          "quote.status": "sent",
                          "quote.sent_at": new Date().toISOString(),
                          "terms.status": "sent"
                        }
                      })
                    }
                  >
                    Marquer devis envoye
                  </button>
                </div>
                <small className="quote-document-action-hint">
                  Le bouton PDF télécharge un fichier PDF. Le bouton Ouvrir devis conserve l'aperçu HTML imprimable.
                </small>
              </article>
            </div>
          ) : null}

          {tab === "signature" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Signature OTP SMS</h3>
                <small>{`Statut: ${getSignatureStatusLabel(dossier.signature.signature_status)}`}</small>
                <small>{`Telephone: ${dossier.client.phone || "-"}`}</small>
                <small>{`OTP envoye le: ${formatDateTime(dossier.signature.otp_sent_at)}`}</small>
                <small>{`OTP verifie le: ${formatDateTime(dossier.signature.otp_verified_at)}`}</small>
                <small>{`Lien expire le: ${formatDateTime(dossier.signature.signature_link_expires_at)}`}</small>
                <div className="table-actions">
                  <button type="button" onClick={() => void sendSignatureSms()} disabled={saving}>
                    Envoyer lien signature SMS
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void patchAction("update", {
                        updates: {
                          "signature.signature_status": "signed",
                          "quote.status": "signed",
                          "terms.status": "signed"
                        }
                      })
                    }
                  >
                    Marquer signe manuellement
                  </button>
                </div>
                {signatureManual?.mode === "manual" ? (
                  <div className="notice">
                    <p>Mode manuel active.</p>
                    <p>{`Lien: ${signatureManual.signature_url || "-"}`}</p>
                    <p>{`Code OTP: ${signatureManual.otp_code || "-"}`}</p>
                  </div>
                ) : null}
              </article>
              <article className="public-card">
                <h3>Audit trail</h3>
                <div className="dossier-history-list">
                  {dossier.signature.audit_trail.map((entry, index) => (
                    <div key={`${entry.at}-${entry.event}-${index}`}>
                      <strong>{entry.event}</strong>
                      <small>{formatDateTime(entry.at)}</small>
                      <small>{entry.details || "-"}</small>
                      <small>{`IP: ${entry.ip || "-"}`}</small>
                    </div>
                  ))}
                  {dossier.signature.audit_trail.length === 0 ? <small>Aucun événement de signature.</small> : null}
                </div>
              </article>
            </div>
          ) : null}

          {tab === "payment" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Acompte</h3>
                <small>{`Statut: ${getDepositStatusLabel(dossier.payment.deposit_status)}`}</small>
                <small>{`Demande le: ${formatDateTime(dossier.payment.deposit_requested_at)}`}</small>
                <small>{`Recu le: ${formatDateTime(dossier.payment.deposit_received_at)}`}</small>
                <small>{`Methode: ${dossier.payment.deposit_method}`}</small>
                <small>{`Reference: ${dossier.payment.deposit_reference || "-"}`}</small>
                <div className="table-actions">
                  <button type="button" onClick={() => void patchAction("mark_deposit_requested")} disabled={saving}>
                    Marquer acompte demande
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void patchAction("mark_deposit_received", {
                        payment_method: "manual",
                        payment_reference: "Admin"
                      })
                    }
                    disabled={saving}
                  >
                    Marquer acompte recu
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_balance_paid")} disabled={saving}>
                    Marquer solde paye
                  </button>
                </div>
              </article>
            </div>
          ) : null}

          {tab === "template" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Template</h3>
                <small>{`Demande template: ${dossier.template.template_request_id || "-"}`}</small>
                <small>{`Nom: ${dossier.template.template_name || "-"}`}</small>
                <small>{`Statut: ${getTemplateStatusLabel(dossier.template.status)}`}</small>
                <small>{`Canva disponibles: ${dossier.template.canva_links_available}`}</small>
                <small>{`PSD: ${dossier.template.psd_status || "-"}`}</small>
                <div className="table-actions">
                  {dossier.template.template_request_id ? (
                    <Link href={`/admin/demandes?requestId=${encodeURIComponent(dossier.template.template_request_id)}`}>
                      Ouvrir demande template
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => void patchAction("mark_template_ready")} disabled={saving}>
                    Marquer template fait
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_template_validated")} disabled={saving}>
                    Marquer valide client
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_template_sent_to_booth")} disabled={saving}>
                    Marquer envoye vers borne
                  </button>
                </div>
              </article>
            </div>
          ) : null}

          {tab === "delivery" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Livraison</h3>
                <small>{`Livraison ID: ${dossier.delivery.delivery_assignment_id || "-"}`}</small>
                <small>{`Livreur recommande: ${dossier.delivery.recommended_driver_id || "-"}`}</small>
                <small>{`Livreur affecte: ${dossier.delivery.assigned_driver_name || "-"}`}</small>
                <small>{`Statut: ${getDeliveryStatusLabel(dossier.delivery.status)}`}</small>
                <small>{`Livraison: ${dossier.delivery.delivery_time || "-"}`}</small>
                <small>{`Recuperation: ${dossier.delivery.pickup_time || "-"}`}</small>
                <small>{`Distance: ${dossier.delivery.distance_km || 0} km`}</small>
                <small>{`Frais: ${dossier.delivery.delivery_fee || 0} EUR`}</small>
                <div className="table-actions">
                  <Link href="/admin/livraisons">Ouvrir livraisons</Link>
                  <Link href={`/admin/planning?focus=${encodeURIComponent(`delivery:${dossier.delivery.delivery_assignment_id}`)}`}>
                    Ouvrir planning
                  </Link>
                </div>
              </article>
            </div>
          ) : null}

          {tab === "post_event" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Post-événement</h3>
                <small>{`Statut: ${getPostEventStatusLabel(dossier.post_event.status)}`}</small>
                <label>
                  Lien galerie
                  <input
                    value={galleryUrl}
                    onChange={(event) => setGalleryUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <div className="table-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void patchAction("update", {
                        updates: {
                          "post_event.gallery_url": cleanText(galleryUrl)
                        }
                      })
                    }
                  >
                    Enregistrer galerie
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_gallery_sent")}>
                    Envoyer galerie
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_review_requested")}>
                    Demander avis Google
                  </button>
                  <button type="button" onClick={() => void patchAction("mark_coupon_sent")}>
                    Envoyer offre 30 EUR
                  </button>
                </div>
              </article>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="dossier-section-grid">
              <article className="public-card">
                <h3>Timeline dossier</h3>
                <div className="dossier-history-list">
                  {dossier.history.map((entry) => (
                    <div key={entry.id}>
                      <strong>{entry.label}</strong>
                      <small>{formatDateTime(entry.at)}</small>
                      <small>{entry.details || "-"}</small>
                    </div>
                  ))}
                  {dossier.history.length === 0 ? <small>Aucun historique pour ce dossier.</small> : null}
                </div>
              </article>
              <article className="public-card">
                <h3>Notes internes</h3>
                <textarea
                  rows={8}
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                />
                <div className="table-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void patchAction("update", {
                        updates: { internal_notes: cleanText(internalNotes) },
                        note: "Note interne mise à jour"
                      })
                    }
                  >
                    Enregistrer note
                  </button>
                </div>
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && dossier ? (
        <section className="admin-template-diagnostic">
          <h2>Changer statut global</h2>
          <div className="table-actions">
            {DOSSIER_STATUS.map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() =>
                  void patchAction("set_global_status", {
                    global_status: status.id
                  })
                }
                className={dossier.global_status === status.id ? "button-primary" : ""}
              >
                {status.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
