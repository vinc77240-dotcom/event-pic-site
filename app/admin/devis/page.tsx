"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  BRUNCH_OPTION,
  DeliveryDriver,
  DriverAvailabilitySnapshotItem,
  EVENT_PIC_QUOTE_STATUSES,
  EventPicContactRequest,
  formatEventPicOptions,
  EventPicQuoteRequest,
  EventPicQuoteStatus
} from "@/src/shared/eventPicPublic";

type AdminDevisResponse = {
  ok?: boolean;
  quote_requests?: EventPicQuoteRequest[];
  contact_requests?: EventPicContactRequest[];
  drivers?: DeliveryDriver[];
  error?: string;
};

type AdminDevisItem = {
  source: "quote" | "contact";
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date: string;
  event_address: string;
  estimated_total: number | null;
  estimated_total_without_delivery: number | null;
  estimated_total_with_delivery: number | null;
  distance_status: "calculated" | "manual_required" | "no_driver_available" | "error";
  availability_status: "calculated" | "manual_required" | "no_driver_available" | "error";
  recommended_driver_id: string;
  recommended_driver_name: string;
  driver_start_address: string;
  distance_km: number | null;
  travel_time_minutes: number | null;
  delivery_fee: number | null;
  booth_quantity: number;
  available_drivers_count: number;
  unavailable_drivers: DriverAvailabilitySnapshotItem[];
  package_label: string;
  package_id: string;
  option_ids: string[];
  options: string[];
  guest_count: number | null;
  estimated_prints_need: number | null;
  selected_formula: string;
  recommended_formula: string;
  recommended_formula_prints: number | null;
  formula_insufficient: boolean;
  message: string;
  status: EventPicQuoteStatus;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("fr-FR");
}

function statusLabel(status: EventPicQuoteStatus) {
  return EVENT_PIC_QUOTE_STATUSES.find((item) => item.id === status)?.label ?? status;
}

function distanceStatusLabel(
  status: "calculated" | "manual_required" | "no_driver_available" | "error"
) {
  if (status === "calculated") {
    return "Calcule";
  }
  if (status === "no_driver_available") {
    return "Aucun livreur disponible";
  }
  if (status === "manual_required") {
    return "Manuel requis";
  }
  return "Erreur";
}

function unavailableReasonLabel(reason: DriverAvailabilitySnapshotItem["reason"]) {
  if (reason === "absence") {
    return "absence";
  }
  if (reason === "stock_full") {
    return "stock complet";
  }
  return "desactive";
}

export default function AdminDevisPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<EventPicQuoteRequest[]>([]);
  const [contacts, setContacts] = useState<EventPicContactRequest[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [driverSelectionByRequest, setDriverSelectionByRequest] = useState<Record<string, string>>({});
  const [manualDistanceByRequest, setManualDistanceByRequest] = useState<Record<string, string>>({});
  const [boothQuantityByRequest, setBoothQuantityByRequest] = useState<Record<string, string>>({});

  const items = useMemo<AdminDevisItem[]>(() => {
    const quoteItems: AdminDevisItem[] = quotes.map((item) => ({
      source: "quote",
      id: item.id,
      created_at: item.created_at,
      name: item.name,
      email: item.email,
      phone: item.phone,
      event_type: item.event_type,
      event_date: item.event_date,
      estimated_total: item.estimated_total || null,
      estimated_total_without_delivery: item.estimated_total_without_delivery || null,
      estimated_total_with_delivery: item.estimated_total_with_delivery || null,
      distance_status: item.distance_status,
      availability_status: item.availability_status ?? item.distance_status,
      recommended_driver_id: item.recommended_driver_id || "",
      recommended_driver_name: item.recommended_driver_name || "",
      driver_start_address: item.driver_start_address || "",
      distance_km:
        typeof item.distance_km === "number" ? item.distance_km : null,
      travel_time_minutes:
        typeof item.travel_time_minutes === "number" ? item.travel_time_minutes : null,
      delivery_fee:
        typeof item.delivery_fee === "number" ? item.delivery_fee : null,
      booth_quantity:
        typeof item.booth_quantity === "number" && Number.isFinite(item.booth_quantity)
          ? item.booth_quantity
          : 1,
      available_drivers_count:
        typeof item.driver_availability_snapshot?.available_drivers_count === "number"
          ? item.driver_availability_snapshot.available_drivers_count
          : 0,
      unavailable_drivers: item.driver_availability_snapshot?.unavailable_drivers ?? [],
      event_address: item.event_address || "",
      package_label: item.package,
      package_id: item.package_id || "",
      option_ids: item.option_ids ?? [],
      options: item.options ?? [],
      guest_count: null,
      estimated_prints_need: null,
      selected_formula: "",
      recommended_formula: "",
      recommended_formula_prints: null,
      formula_insufficient: false,
      message: item.message,
      status: item.status
    }));

    const contactItems: AdminDevisItem[] = contacts.map((item) => ({
      source: "contact",
      id: item.id,
      created_at: item.created_at,
      name: item.name,
      email: item.email,
      phone: item.phone,
      event_type: item.event_type,
      event_date: item.event_date,
      event_address: item.event_address || "",
      estimated_total: null,
      estimated_total_without_delivery: null,
      estimated_total_with_delivery: null,
      distance_status: "manual_required",
      availability_status: "manual_required",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: null,
      travel_time_minutes: null,
      delivery_fee: null,
      booth_quantity: 1,
      available_drivers_count: 0,
      unavailable_drivers: [],
      package_label: item.selected_formula || "-",
      package_id: "",
      option_ids: [],
      options: [],
      guest_count:
        typeof item.guest_count === "number" && Number.isFinite(item.guest_count)
          ? item.guest_count
          : null,
      estimated_prints_need:
        typeof item.estimated_prints_need === "number" &&
        Number.isFinite(item.estimated_prints_need)
          ? item.estimated_prints_need
          : null,
      selected_formula: item.selected_formula || "",
      recommended_formula: item.recommended_formula || "",
      recommended_formula_prints:
        typeof item.recommended_formula_prints === "number"
          ? item.recommended_formula_prints
          : null,
      formula_insufficient: item.formula_insufficient === true,
      message: item.message,
      status: item.status
    }));

    return [...quoteItems, ...contactItems].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }, [contacts, quotes]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", { cache: "no-store" });
      const payload = (await response.json()) as AdminDevisResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement des devis impossible.");
      }

      setQuotes(payload.quote_requests ?? []);
      setContacts(payload.contact_requests ?? []);
      setDrivers(payload.drivers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(item: AdminDevisItem, status: EventPicQuoteStatus) {
    setSaving(`${item.source}:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "update_status",
          source: item.source,
          id: item.id,
          status
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour impossible.");
      }

      setMessage("Statut mis a jour.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise a jour impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function createDelivery(item: AdminDevisItem) {
    setSaving(`delivery:${item.source}:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/livraisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_source",
          source: item.source === "quote" ? "quote" : "quote",
          event_id: item.source === "contact" ? `contact:${item.id}` : item.id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation livraison impossible.");
      }
      setMessage("Livraison creee.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Creation livraison impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function addToPlanning(item: AdminDevisItem) {
    setSaving(`planning:${item.source}:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.source === "quote" ? "quote" : "quote",
          source_id: item.source === "quote" ? item.id : `contact:${item.id}`,
          title: `${item.event_type || "Evenement"} - ${item.name}`
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Ajout au planning impossible.");
      }
      setMessage("Evenement ajoute au planning.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Ajout au planning impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function createDossierFromQuote(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }
    setSaving(`dossier:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_quote",
          quote_id: item.id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation dossier impossible.");
      }
      setMessage("Dossier client cree depuis devis.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Creation dossier impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function recalculateDistance(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }
    setSaving(`distance:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recalculate_distance",
          source: "quote",
          id: item.id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Recalcul distance impossible.");
      }
      setMessage("Distance recalculee.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Recalcul distance impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function updateDriver(item: AdminDevisItem, forceWhenUnavailable = false) {
    if (item.source !== "quote") {
      return;
    }
    const selectedDriverId = (driverSelectionByRequest[item.id] || "").trim();
    if (!selectedDriverId) {
      setError("Selectionnez un livreur.");
      return;
    }
    setSaving(`driver:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_driver",
          source: "quote",
          id: item.id,
          driver_id: selectedDriverId,
          force_when_unavailable: forceWhenUnavailable
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Modification livreur impossible.");
      }
      setMessage(
        forceWhenUnavailable
          ? "Livreur force malgre indisponibilite. Verifiez le conflit avant validation finale."
          : "Livreur modifie et distance recalculee."
      );
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Modification livreur impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function setManualDistance(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }
    const distanceInput = (manualDistanceByRequest[item.id] || "").trim();
    const distanceValue = Number.parseFloat(distanceInput.replace(",", "."));
    if (!Number.isFinite(distanceValue) || distanceValue < 0) {
      setError("Distance manuelle invalide.");
      return;
    }

    setSaving(`manual-distance:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_manual_distance",
          source: "quote",
          id: item.id,
          distance_km: distanceValue
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Distance manuelle impossible.");
      }
      setMessage("Distance manuelle enregistree.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Distance manuelle impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function setBoothQuantity(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }
    const quantityInput = (boothQuantityByRequest[item.id] || "").trim();
    const quantityValue = Number.parseInt(quantityInput, 10);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setError("Nombre de bornes invalide.");
      return;
    }

    setSaving(`booth-qty:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_booth_quantity",
          source: "quote",
          id: item.id,
          booth_quantity: quantityValue
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour bornes impossible.");
      }
      setMessage("Nombre de bornes mis a jour et disponibilite recalculee.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise a jour bornes impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function validateDeliveryFee(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }
    const defaultValue =
      typeof item.delivery_fee === "number" ? String(item.delivery_fee) : "0";
    const prompted = window.prompt("Frais de deplacement a valider (EUR)", defaultValue);
    if (prompted === null) {
      return;
    }
    const fee = Number.parseFloat(prompted.replace(",", "."));
    if (!Number.isFinite(fee) || fee < 0) {
      setError("Frais de deplacement invalide.");
      return;
    }

    setSaving(`fee:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_delivery_fee",
          source: "quote",
          id: item.id,
          delivery_fee: fee
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Validation des frais impossible.");
      }
      setMessage("Frais de deplacement valides.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Validation des frais impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleBrunch(item: AdminDevisItem) {
    if (item.source !== "quote") {
      return;
    }

    const hasBrunch = item.option_ids.includes(BRUNCH_OPTION.id);
    setSaving(`brunch:${item.id}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_option_selection",
          source: "quote",
          id: item.id,
          option_id: BRUNCH_OPTION.id,
          enabled: !hasBrunch
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour option Brunch impossible.");
      }
      setMessage(hasBrunch ? "Option Brunch retiree." : "Option Brunch ajoutee.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Mise a jour option Brunch impossible."
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="admin-page premium-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow admin-brand-line"><span className="event-pic-signature admin-brand-signature">Event Pic</span><span className="admin-brand-suffix">Admin</span></p>
          <h1>Devis clients</h1>
          <p className="admin-hero-subtitle">
            Suivi des demandes du calculateur et des formulaires de contact.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/planning">Planning evenements</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <div className="admin-count">{items.length} demandes</div>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-table-wrap">
        <table className="admin-table admin-demandes-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Client</th>
              <th>Email</th>
              <th>Telephone</th>
              <th>Type evenement</th>
              <th>Date evenement</th>
              <th>Adresse evenement</th>
              <th>Bornes</th>
              <th>Livreur recommande</th>
              <th>Distance</th>
              <th>Temps</th>
              <th>Frais deplacement</th>
              <th>Total estime</th>
              <th>Disponibilite</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={17}>Chargement des demandes...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={17}>Aucune demande pour le moment.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.source}-${item.id}`}>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{item.source === "quote" ? "Calculateur" : "Contact"}</td>
                  <td>
                    <strong>{item.name}</strong>
                    {item.package_label !== "-" ? <small>{item.package_label}</small> : null}
                    {item.options.length > 0 ? (
                      <small>{`Options: ${formatEventPicOptions(item.options).join(", ")}`}</small>
                    ) : (
                      <small>Aucune option</small>
                    )}
                    {item.source === "contact" && item.guest_count ? (
                      <small>{`Invites: ${item.guest_count} - impressions conseillees: ${
                        item.estimated_prints_need ?? "-"
                      }`}</small>
                    ) : null}
                    {item.source === "contact" && item.recommended_formula ? (
                      <small>{`Formule recommandee: ${item.recommended_formula}`}</small>
                    ) : null}
                    {item.source === "contact" && item.formula_insufficient ? (
                      <small className="admin-formula-warning">
                        Alerte formule insuffisante: oui
                      </small>
                    ) : null}
                    {item.message ? <small>{item.message}</small> : null}
                  </td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>{item.event_type || "-"}</td>
                  <td>{item.event_date || "-"}</td>
                  <td>{item.event_address || "-"}</td>
                  <td>{item.booth_quantity || 1}</td>
                  <td>
                    <strong>{item.recommended_driver_name || "-"}</strong>
                    {item.driver_start_address ? <small>{item.driver_start_address}</small> : null}
                    <small>{`Disponibles: ${item.available_drivers_count}`}</small>
                    {item.unavailable_drivers.length > 0 ? (
                      <small>{`${item.unavailable_drivers.length} indisponible(s)`}</small>
                    ) : null}
                  </td>
                  <td>{item.distance_km === null ? "-" : `${item.distance_km} km`}</td>
                  <td>{item.travel_time_minutes === null ? "-" : `${item.travel_time_minutes} min`}</td>
                  <td>{item.delivery_fee === null ? "-" : `${item.delivery_fee} EUR`}</td>
                  <td>
                    {item.estimated_total_with_delivery === null
                      ? item.estimated_total === null
                        ? "-"
                        : `${item.estimated_total} EUR`
                      : `${item.estimated_total_with_delivery} EUR`}
                  </td>
                  <td>
                    <strong>{distanceStatusLabel(item.availability_status)}</strong>
                    {item.unavailable_drivers.slice(0, 2).map((driver) => (
                      <small key={`${item.id}-${driver.driver_id}-${driver.reason}`}>
                        {`${driver.driver_name}: ${unavailableReasonLabel(driver.reason)}`}
                      </small>
                    ))}
                  </td>
                  <td>
                    <span className={`status-pill ai-status-${item.status}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        disabled={saving === `delivery:${item.source}:${item.id}`}
                        onClick={() => void createDelivery(item)}
                        type="button"
                      >
                        Creer livraison
                      </button>
                      <Link href={`/admin/planning?focus=${encodeURIComponent(item.source === "quote" ? `quote:${item.id}` : `quote:contact:${item.id}`)}`}>
                        Voir dans le planning
                      </Link>
                      <button
                        disabled={saving === `planning:${item.source}:${item.id}`}
                        onClick={() => void addToPlanning(item)}
                        type="button"
                      >
                        Ajouter au planning
                      </button>
                      {item.source === "quote" ? (
                        <button
                          disabled={saving === `dossier:${item.id}`}
                          onClick={() => void createDossierFromQuote(item)}
                          type="button"
                        >
                          Creer dossier
                        </button>
                      ) : null}
                      <Link href="/admin/dossiers">Voir dossiers</Link>
                      {item.source === "quote" ? (
                        <>
                          <button
                            disabled={saving === `distance:${item.id}`}
                            onClick={() => void recalculateDistance(item)}
                            type="button"
                          >
                            Recalculer disponibilite
                          </button>
                          <input
                            type="number"
                            min={1}
                            placeholder="Bornes"
                            value={boothQuantityByRequest[item.id] ?? ""}
                            onChange={(event) =>
                              setBoothQuantityByRequest((current) => ({
                                ...current,
                                [item.id]: event.target.value
                              }))
                            }
                          />
                          <button
                            disabled={saving === `booth-qty:${item.id}`}
                            onClick={() => void setBoothQuantity(item)}
                            type="button"
                          >
                            Modifier nb bornes
                          </button>
                          <select
                            value={driverSelectionByRequest[item.id] ?? item.recommended_driver_id}
                            onChange={(event) =>
                              setDriverSelectionByRequest((current) => ({
                                ...current,
                                [item.id]: event.target.value
                              }))
                            }
                          >
                            <option value="">Choisir un livreur</option>
                            {drivers
                              .filter((driver) => driver.active)
                              .map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {`${driver.name} (stock ${driver.booth_stock})`}
                                </option>
                              ))}
                          </select>
                          <button
                            disabled={saving === `driver:${item.id}`}
                            onClick={() => void updateDriver(item)}
                            type="button"
                          >
                            Modifier livreur
                          </button>
                          <button
                            disabled={saving === `driver:${item.id}`}
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Forcer ce livreur meme si indisponible (absence/stock complet) ?"
                              );
                              if (confirmed) {
                                void updateDriver(item, true);
                              }
                            }}
                            type="button"
                          >
                            Forcer malgre indisponibilite
                          </button>
                          <input
                            type="number"
                            placeholder="Distance km"
                            value={manualDistanceByRequest[item.id] ?? ""}
                            onChange={(event) =>
                              setManualDistanceByRequest((current) => ({
                                ...current,
                                [item.id]: event.target.value
                              }))
                            }
                          />
                          <button
                            disabled={saving === `manual-distance:${item.id}`}
                            onClick={() => void setManualDistance(item)}
                            type="button"
                          >
                            Distance manuelle
                          </button>
                          <button
                            disabled={saving === `fee:${item.id}`}
                            onClick={() => void validateDeliveryFee(item)}
                            type="button"
                          >
                            Valider frais deplacement
                          </button>
                          <button
                            disabled={saving === `brunch:${item.id}`}
                            onClick={() => void toggleBrunch(item)}
                            type="button"
                          >
                            {item.option_ids.includes(BRUNCH_OPTION.id)
                              ? "Retirer Brunch (-100 EUR)"
                              : "Ajouter Brunch (+100 EUR)"}
                          </button>
                        </>
                      ) : null}
                      {EVENT_PIC_QUOTE_STATUSES.filter((status) => status.id !== "new").map((status) => (
                        <button
                          key={`${item.id}-${status.id}`}
                          disabled={saving === `${item.source}:${item.id}`}
                          onClick={() => void updateStatus(item, status.id)}
                          type="button"
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
