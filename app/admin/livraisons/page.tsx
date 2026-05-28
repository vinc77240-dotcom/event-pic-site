"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  DELIVERY_STATUSES,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryDriver
} from "@/src/shared/eventPicPublic";

type DeliverySourceEvent = {
  source: "quote" | "template_request" | "manual";
  event_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  event_date: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  booth_quantity: number;
  event_address: string;
  event_type: string;
  package_label: string;
};

type LivraisonsResponse = {
  ok?: boolean;
  assignments?: DeliveryAssignment[];
  drivers?: DeliveryDriver[];
  source_events?: DeliverySourceEvent[];
  error?: string;
};

type LivraisonsActionResponse = {
  ok?: boolean;
  assignment?: DeliveryAssignment;
  drivers?: DeliveryDriver[];
  error?: string;
};

type DeliveryTab = "a_affecter" | "affectes" | "today" | "week" | "termine";

const OCCUPYING_STATUSES = new Set<DeliveryAssignmentStatus>([
  "a_affecter",
  "affecte",
  "en_livraison",
  "installe",
  "a_recuperer",
  "conflit_stock",
  "conflit_absence"
]);

function cleanText(value: string) {
  return value.trim();
}

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

function isToday(dateValue: string) {
  if (!dateValue) {
    return false;
  }
  const date = new Date(dateValue);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisWeek(dateValue: string) {
  if (!dateValue) {
    return false;
  }
  const date = new Date(dateValue);
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function deliveryStatusLabel(status: DeliveryAssignmentStatus) {
  return DELIVERY_STATUSES.find((item) => item.id === status)?.label ?? status;
}

function toDateWithTime(dateValue: string, timeValue: string, fallbackTime: string) {
  const safeDate = cleanText(dateValue);
  if (!safeDate) {
    return null;
  }
  const safeTime = cleanText(timeValue) || fallbackTime;
  const parsed = new Date(`${safeDate}T${safeTime}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getAssignmentRange(assignment: DeliveryAssignment) {
  const start = toDateWithTime(assignment.event_date, assignment.delivery_time, "09:00");
  const end = toDateWithTime(
    assignment.return_date || assignment.event_date,
    assignment.return_time,
    "23:00"
  );
  if (!start || !end) {
    return null;
  }
  if (end.getTime() <= start.getTime()) {
    return {
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000)
    };
  }
  return { start, end };
}

function rangesOverlap(
  first: { start: Date; end: Date },
  second: { start: Date; end: Date }
) {
  return first.start.getTime() < second.end.getTime() && second.start.getTime() < first.end.getTime();
}

export default function AdminLivraisonsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [sourceEvents, setSourceEvents] = useState<DeliverySourceEvent[]>([]);
  const [activeTab, setActiveTab] = useState<DeliveryTab>("a_affecter");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [manualForm, setManualForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    event_date: "",
    delivery_time: "",
    return_date: "",
    return_time: "",
    booth_quantity: "1",
    event_address: "",
    event_type: "",
    package_label: "",
    notes: ""
  });

  useEffect(() => {
    void load();
  }, []);

  const filteredAssignments = useMemo(() => {
    if (activeTab === "a_affecter") {
      return assignments.filter(
        (item) =>
          item.status === "a_affecter" ||
          item.status === "conflit_stock" ||
          item.status === "conflit_absence"
      );
    }
    if (activeTab === "affectes") {
      return assignments.filter(
        (item) =>
          item.status !== "a_affecter" &&
          item.status !== "conflit_stock" &&
          item.status !== "conflit_absence" &&
          item.status !== "termine"
      );
    }
    if (activeTab === "today") {
      return assignments.filter((item) => isToday(item.event_date));
    }
    if (activeTab === "week") {
      return assignments.filter((item) => isThisWeek(item.event_date));
    }
    return assignments.filter((item) => item.status === "termine");
  }, [activeTab, assignments]);

  const planningByDate = useMemo(() => {
    const grouped = new Map<string, DeliveryAssignment[]>();
    for (const assignment of assignments) {
      const key = assignment.event_date || "Date non renseignee";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(assignment);
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assignments]);

  const stockByAssignment = useMemo(() => {
    const driverStockMap = new Map(drivers.map((driver) => [driver.id, Math.max(1, driver.booth_stock || 1)]));
    const map = new Map<
      string,
      { stock: number; booked: number; remaining: number; overlappingAssignments: number }
    >();

    for (const assignment of assignments) {
      const driverId = cleanText(assignment.assigned_driver_id);
      if (!driverId) {
        continue;
      }
      const currentRange = getAssignmentRange(assignment);
      if (!currentRange) {
        continue;
      }
      const stock = driverStockMap.get(driverId) ?? 1;
      const overlaps = assignments.filter((candidate) => {
        if (cleanText(candidate.assigned_driver_id) !== driverId) {
          return false;
        }
        if (!OCCUPYING_STATUSES.has(candidate.status)) {
          return false;
        }
        const candidateRange = getAssignmentRange(candidate);
        if (!candidateRange) {
          return false;
        }
        return rangesOverlap(currentRange, candidateRange);
      });
      const booked = overlaps.reduce(
        (sum, row) => sum + Math.max(1, Number.parseInt(String(row.booth_quantity || 1), 10) || 1),
        0
      );
      const remaining = Math.max(0, stock - booked);
      map.set(assignment.id, {
        stock,
        booked,
        remaining,
        overlappingAssignments: Math.max(overlaps.length - 1, 0)
      });
    }
    return map;
  }, [assignments, drivers]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/livraisons", { cache: "no-store" });
      const payload = (await response.json()) as LivraisonsResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement des livraisons impossible.");
      }
      setAssignments(payload.assignments ?? []);
      setDrivers(payload.drivers ?? []);
      setSourceEvents(payload.source_events ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/livraisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as LivraisonsActionResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Operation livraison impossible.");
      }
      setMessage("Operation enregistree.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operation livraison impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function createFromSource(source: DeliverySourceEvent) {
    await runAction({
      action: "create_from_source",
      source: source.source,
      event_id: source.event_id
    });
  }

  async function createManual() {
    await runAction({
      action: "create_manual",
      assignment: {
        ...manualForm,
        booth_quantity: Math.max(1, Number.parseInt(manualForm.booth_quantity, 10) || 1),
        status: "a_affecter"
      }
    });
  }

  async function assignDriver(assignment: DeliveryAssignment, driver: DeliveryDriver) {
    await runAction({
      action: "assign_driver",
      assignment_id: assignment.id,
      driver_id: driver.id,
      driver_name: driver.name,
      status: "affecte"
    });
  }

  async function setStatus(assignmentId: string, status: DeliveryAssignmentStatus) {
    await runAction({
      action: "update_status",
      assignment_id: assignmentId,
      status
    });
  }

  async function quickAssignByName(
    assignment: DeliveryAssignment,
    driverName: string
  ) {
    const driver = drivers.find((item) => item.name.toLowerCase().includes(driverName.toLowerCase()));
    if (!driver) {
      setError(`Livreur introuvable: ${driverName}`);
      return;
    }
    await assignDriver(assignment, driver);
  }

  async function updateNotes(assignment: DeliveryAssignment, notes: string) {
    await runAction({
      action: "update_assignment",
      assignment_id: assignment.id,
      updates: {
        notes
      }
    });
  }

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId) ?? null;

  return (
    <main className="admin-page premium-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Livraisons</h1>
          <p className="admin-hero-subtitle">
            Affectez vos evenements a un livreur et suivez les statuts de livraison.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/devis">Devis clients</Link>
          <Link href="/admin/planning">Planning evenements</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <div className="admin-count">{assignments.length} livraisons</div>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-template-diagnostic">
        <h2>Evenements detectes (devis / templates)</h2>
        {loading ? (
          <p className="ai-brief-meta">Chargement des evenements...</p>
        ) : sourceEvents.length === 0 ? (
          <p className="ai-brief-meta">Aucun evenement detecte.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Prestation</th>
                  <th>Bornes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sourceEvents.map((event) => (
                  <tr key={`${event.source}:${event.event_id}`}>
                    <td>{event.event_date || "-"}</td>
                    <td>
                      <strong>{event.client_name || "-"}</strong>
                      <small>{event.client_phone || "-"}</small>
                    </td>
                    <td>{event.source}</td>
                    <td>{event.event_type || "-"}</td>
                    <td>{event.package_label || "-"}</td>
                    <td>{event.booth_quantity || 1}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          disabled={saving}
                          onClick={() => void createFromSource(event)}
                          type="button"
                        >
                          Creer livraison
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-template-diagnostic">
        <h2>Ajouter une livraison manuelle</h2>
        <div className="calculator-grid">
          <label>
            Client
            <input
              type="text"
              value={manualForm.client_name}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, client_name: event.target.value }))
              }
            />
          </label>
          <label>
            Telephone
            <input
              type="text"
              value={manualForm.client_phone}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, client_phone: event.target.value }))
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={manualForm.client_email}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, client_email: event.target.value }))
              }
            />
          </label>
          <label>
            Date evenement
            <input
              type="date"
              value={manualForm.event_date}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, event_date: event.target.value }))
              }
            />
          </label>
          <label>
            Heure livraison
            <input
              type="time"
              value={manualForm.delivery_time}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, delivery_time: event.target.value }))
              }
            />
          </label>
          <label>
            Date recuperation
            <input
              type="date"
              value={manualForm.return_date}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, return_date: event.target.value }))
              }
            />
          </label>
          <label>
            Heure recuperation
            <input
              type="time"
              value={manualForm.return_time}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, return_time: event.target.value }))
              }
            />
          </label>
          <label>
            Nb bornes
            <input
              type="number"
              min={1}
              value={manualForm.booth_quantity}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, booth_quantity: event.target.value }))
              }
            />
          </label>
          <label>
            Adresse evenement
            <input
              type="text"
              value={manualForm.event_address}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, event_address: event.target.value }))
              }
            />
          </label>
          <label>
            Type evenement
            <input
              type="text"
              value={manualForm.event_type}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, event_type: event.target.value }))
              }
            />
          </label>
          <label>
            Prestation
            <input
              type="text"
              value={manualForm.package_label}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, package_label: event.target.value }))
              }
            />
          </label>
          <label>
            Notes
            <input
              type="text"
              value={manualForm.notes}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="table-actions">
          <button className="button-primary" disabled={saving} onClick={() => void createManual()} type="button">
            Creer livraison manuelle
          </button>
        </div>
        <p className="ai-brief-meta">
          GOOGLE_MAPS_API_KEY non configure : distance et frais saisis manuellement.
        </p>
      </section>

      <section className="admin-template-diagnostic">
        <h2>Suivi des livraisons</h2>
        <div className="table-actions" style={{ marginBottom: 12 }}>
          <button
            className={activeTab === "a_affecter" ? "button-primary" : ""}
            onClick={() => setActiveTab("a_affecter")}
            type="button"
          >
            A affecter
          </button>
          <button
            className={activeTab === "affectes" ? "button-primary" : ""}
            onClick={() => setActiveTab("affectes")}
            type="button"
          >
            Affectes
          </button>
          <button
            className={activeTab === "today" ? "button-primary" : ""}
            onClick={() => setActiveTab("today")}
            type="button"
          >
            Aujourd&apos;hui
          </button>
          <button
            className={activeTab === "week" ? "button-primary" : ""}
            onClick={() => setActiveTab("week")}
            type="button"
          >
            Cette semaine
          </button>
          <button
            className={activeTab === "termine" ? "button-primary" : ""}
            onClick={() => setActiveTab("termine")}
            type="button"
          >
            Termines
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Adresse</th>
                <th>Prestation</th>
                <th>Bornes</th>
                <th>Statut</th>
                <th>Livreur</th>
                <th>Stock date</th>
                <th>Distance</th>
                <th>Temps</th>
                <th>Frais</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12}>Chargement des livraisons...</td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={12}>Aucune livraison pour ce filtre.</td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.event_date || "-"}</strong>
                      <small>{`Livraison: ${assignment.delivery_time || "-"}`}</small>
                      <small>{`Recuperation: ${assignment.return_date || "-"} ${assignment.return_time || ""}`}</small>
                    </td>
                    <td>
                      <strong>{assignment.client_name || "-"}</strong>
                      <small>{assignment.client_phone || "-"}</small>
                      <small>{assignment.client_email || "-"}</small>
                    </td>
                    <td>{assignment.event_address || "-"}</td>
                    <td>{assignment.package_label || "-"}</td>
                    <td>{assignment.booth_quantity || 1}</td>
                    <td>
                      <span className={`status-pill ai-status-${assignment.status}`}>
                        {deliveryStatusLabel(assignment.status)}
                      </span>
                    </td>
                    <td>{assignment.assigned_driver_name || "-"}</td>
                    <td>
                      {stockByAssignment.has(assignment.id) ? (
                        <>
                          <strong>
                            {`${stockByAssignment.get(assignment.id)!.booked}/${stockByAssignment.get(assignment.id)!.stock}`}
                          </strong>
                          <small>
                            {`Reste: ${stockByAssignment.get(assignment.id)!.remaining}`}
                          </small>
                          {stockByAssignment.get(assignment.id)!.overlappingAssignments > 0 ? (
                            <small>
                              {`Autres evenements: ${stockByAssignment.get(assignment.id)!.overlappingAssignments}`}
                            </small>
                          ) : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{assignment.distance_km === null ? "-" : `${assignment.distance_km} km`}</td>
                    <td>
                      {assignment.travel_time_minutes === null
                        ? "-"
                        : `${assignment.travel_time_minutes} min`}
                    </td>
                    <td>{assignment.delivery_fee === null ? "-" : `${assignment.delivery_fee} EUR`}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => void quickAssignByName(assignment, "Vincent")}
                        >
                          Affecter a Vincent
                        </button>
                        <button
                          type="button"
                          onClick={() => void quickAssignByName(assignment, "Aurelie")}
                        >
                          Affecter a Aurelie
                        </button>
                        <button
                          type="button"
                          onClick={() => void quickAssignByName(assignment, "externe")}
                        >
                          Affecter livreur externe
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(assignment.id, "installe")}
                        >
                          Marquer installe
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(assignment.id, "recupere")}
                        >
                          Marquer recupere
                        </button>
                        {assignment.status === "conflit_stock" || assignment.status === "conflit_absence" ? (
                          <small className="notice-inline">Conflit a verifier</small>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedAssignmentId(assignment.id)}
                        >
                          Modifier livraison
                        </button>
                        {assignment.event_address ? (
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard.writeText(assignment.event_address)}
                          >
                            Copier adresse
                          </button>
                        ) : null}
                        {assignment.client_phone ? (
                          <>
                            <a href={`tel:${assignment.client_phone.replace(/\s+/g, "")}`}>Appeler client</a>
                            <a
                              href={`https://wa.me/${assignment.client_phone.replace(/[^\d]/g, "")}`}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              SMS WhatsApp
                            </a>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedAssignment ? (
        <section className="admin-template-diagnostic">
          <h2>Modifier livraison</h2>
          <div className="calculator-grid">
            <label>
              Heure livraison
              <input
                defaultValue={selectedAssignment.delivery_time}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { delivery_time: cleanText(event.target.value) }
                  })
                }
                type="time"
              />
            </label>
            <label>
              Date recuperation
              <input
                defaultValue={selectedAssignment.return_date}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { return_date: cleanText(event.target.value) }
                  })
                }
                type="date"
              />
            </label>
            <label>
              Heure recuperation
              <input
                defaultValue={selectedAssignment.return_time}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { return_time: cleanText(event.target.value) }
                  })
                }
                type="time"
              />
            </label>
            <label>
              Adresse
              <input
                defaultValue={selectedAssignment.event_address}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { event_address: cleanText(event.target.value) }
                  })
                }
                type="text"
              />
            </label>
            <label>
              Distance (km)
              <input
                defaultValue={selectedAssignment.distance_km ?? ""}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { distance_km: cleanText(event.target.value) }
                  })
                }
                type="number"
              />
            </label>
            <label>
              Temps trajet (minutes)
              <input
                defaultValue={selectedAssignment.travel_time_minutes ?? ""}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { travel_time_minutes: cleanText(event.target.value) }
                  })
                }
                type="number"
              />
            </label>
            <label>
              Frais peage
              <input
                defaultValue={selectedAssignment.toll_cost ?? ""}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { toll_cost: cleanText(event.target.value) }
                  })
                }
                type="number"
              />
            </label>
            <label>
              Frais livraison
              <input
                defaultValue={selectedAssignment.delivery_fee ?? ""}
                onBlur={(event) =>
                  void runAction({
                    action: "update_assignment",
                    assignment_id: selectedAssignment.id,
                    updates: { delivery_fee: cleanText(event.target.value) }
                  })
                }
                type="number"
              />
            </label>
          </div>
          <label className="email-input-full">
            Notes
            <textarea
              defaultValue={selectedAssignment.notes}
              onBlur={(event) => void updateNotes(selectedAssignment, event.target.value)}
              rows={4}
            />
          </label>
          <div className="table-actions">
            <button type="button" onClick={() => setSelectedAssignmentId("")}>
              Fermer
            </button>
          </div>
        </section>
      ) : null}

      <section className="admin-template-diagnostic">
        <h2>Vue planning</h2>
        <div className="public-grid public-grid-2">
          {planningByDate.map(([date, dateAssignments]) => (
            <article className="public-card" key={date}>
              <h3>{date || "Date non renseignee"}</h3>
              <ul>
                {dateAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    <strong>{assignment.client_name || "Client"}</strong>{" "}
                    <span>{`(${deliveryStatusLabel(assignment.status)})`}</span>
                    <small>{`Livreur: ${assignment.assigned_driver_name || "A affecter"}`}</small>
                    <small>{`Livraison: ${assignment.delivery_time || "-"}`}</small>
                    <small>{`Recuperation: ${assignment.return_time || "-"}`}</small>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
