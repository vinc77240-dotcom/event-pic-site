"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  EVENT_PIC_CALENDAR_STATUSES,
  EventPicCalendarEvent,
  EventPicCalendarStatus,
  getCalendarStatusLabel
} from "@/src/shared/eventPicCalendar";
import { DeliveryDriver } from "@/src/shared/eventPicPublic";

type CalendarEventsResponse = {
  ok?: boolean;
  events?: EventPicCalendarEvent[];
  drivers?: DeliveryDriver[];
  dossier_map?: Record<string, { dossier_id: string; global_status: string; client_name: string }>;
  error?: string;
};

type CalendarActionResponse = {
  ok?: boolean;
  event?: EventPicCalendarEvent;
  error?: string;
};

type PlanningView = "month" | "week" | "list" | "today";

type PlanningFilter =
  | "all"
  | "reserve"
  | "template"
  | "delivery"
  | "drivers"
  | "stock"
  | "absences"
  | "conflicts"
  | "return"
  | "termine"
  | "blocked";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toDateKey(value: string) {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(value: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

function formatDateTime(dateValue: string, timeValue: string) {
  if (!dateValue) {
    return "-";
  }
  if (!timeValue) {
    return formatDay(dateValue);
  }
  return `${formatDay(dateValue)} ${timeValue}`;
}

function statusClass(status: EventPicCalendarStatus) {
  switch (status) {
    case "nouveau":
      return "cal-status-nouveau";
    case "devis_envoye":
      return "cal-status-devis";
    case "reserve":
      return "cal-status-reserve";
    case "template_a_preparer":
      return "cal-status-template";
    case "livraison_a_affecter":
      return "cal-status-livraison";
    case "affecte":
      return "cal-status-affecte";
    case "installe":
      return "cal-status-installe";
    case "termine":
      return "cal-status-termine";
    case "annule":
      return "cal-status-annule";
    case "bloque":
      return "cal-status-bloque";
    default:
      return "";
  }
}

function getWeekStart(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createMonthCells(currentMonth: Date) {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const start = getWeekStart(first);
  const cells: Array<{ date: string; inMonth: boolean }> = [];

  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    const inMonth =
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear();
    cells.push({
      date: toIsoDate(date),
      inMonth
    });
  }

  if (toIsoDate(addDays(start, 35)) > toIsoDate(last)) {
    return cells.slice(0, 35);
  }
  return cells;
}

function matchesFilter(event: EventPicCalendarEvent, filter: PlanningFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "reserve") {
    return event.status === "reserve";
  }
  if (filter === "template") {
    return event.status === "template_a_preparer" || event.source === "template_request";
  }
  if (filter === "delivery") {
    return event.source === "delivery" || event.status === "livraison_a_affecter" || event.delivery_time !== "";
  }
  if (filter === "drivers") {
    return event.source === "delivery" || event.assigned_driver_id !== "" || event.assigned_driver_name !== "";
  }
  if (filter === "stock") {
    const text = `${event.conflict_message || ""} ${event.notes || ""}`.toLowerCase();
    return text.includes("stock");
  }
  if (filter === "absences") {
    return event.source === "blocked" || event.event_type.toLowerCase().includes("indisponibilite");
  }
  if (filter === "conflicts") {
    return event.has_conflict === true;
  }
  if (filter === "return") {
    return event.return_date !== "" || event.return_time !== "";
  }
  if (filter === "termine") {
    return event.status === "termine";
  }
  return event.status === "bloque" || event.source === "blocked";
}

function getEventKey(event: EventPicCalendarEvent) {
  return event.id;
}

function buildCreatePayload(form: {
  source: "manual" | "blocked";
  title: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  event_address: string;
  package_label: string;
  notes: string;
  status: EventPicCalendarStatus;
}) {
  return {
    source: form.source,
    source_id: "",
    title: cleanText(form.title),
    client_name: cleanText(form.client_name),
    client_email: cleanText(form.client_email),
    client_phone: cleanText(form.client_phone),
    event_type: cleanText(form.event_type),
    event_date: cleanText(form.event_date),
    start_time: cleanText(form.start_time),
    end_time: cleanText(form.end_time),
    delivery_time: cleanText(form.delivery_time),
    return_date: cleanText(form.return_date),
    return_time: cleanText(form.return_time),
    event_address: cleanText(form.event_address),
    status: form.status,
    assigned_driver_id: "",
    assigned_driver_name: "",
    package_label: cleanText(form.package_label),
    estimated_total: 0,
    delivery_fee: 0,
    notes: cleanText(form.notes)
  };
}

export default function AdminPlanningPage() {
  const [focusEventId, setFocusEventId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<EventPicCalendarEvent[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [dossierMap, setDossierMap] = useState<
    Record<string, { dossier_id: string; global_status: string; client_name: string }>
  >({});
  const [view, setView] = useState<PlanningView>("month");
  const [filter, setFilter] = useState<PlanningFilter>("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [createForm, setCreateForm] = useState({
    source: "manual" as "manual" | "blocked",
    title: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    event_type: "",
    event_date: "",
    start_time: "",
    end_time: "",
    delivery_time: "",
    return_date: "",
    return_time: "",
    event_address: "",
    package_label: "",
    notes: "",
    status: "nouveau" as EventPicCalendarStatus
  });

  useEffect(() => {
    void loadEvents();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = new URLSearchParams(window.location.search);
    setFocusEventId(cleanText(query.get("focus")));
  }, []);

  useEffect(() => {
    if (!focusEventId) {
      return;
    }
    setSelectedEventId(focusEventId);
  }, [focusEventId]);

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar/events", {
        cache: "no-store"
      });
      const payload = (await response.json()) as CalendarEventsResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement du planning impossible.");
      }
      setEvents(payload.events ?? []);
      setDrivers(payload.drivers ?? []);
      setDossierMap(payload.dossier_map ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => matchesFilter(event, filter));
  }, [events, filter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventPicCalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = toDateKey(event.event_date);
      if (!key) {
        continue;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(event);
    }
    for (const [date, dateEvents] of map.entries()) {
      dateEvents.sort((a, b) => {
        const timeA = a.start_time || a.delivery_time || "";
        const timeB = b.start_time || b.delivery_time || "";
        return timeA.localeCompare(timeB);
      });
      map.set(date, dateEvents);
    }
    return map;
  }, [filteredEvents]);

  const listEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const byDate = toDateKey(a.event_date).localeCompare(toDateKey(b.event_date));
      if (byDate !== 0) {
        return byDate;
      }
      const byStart = (a.start_time || a.delivery_time).localeCompare(
        b.start_time || b.delivery_time
      );
      if (byStart !== 0) {
        return byStart;
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredEvents]);

  const todayKey = toIsoDate(new Date());
  const todayEvents = eventsByDate.get(todayKey) ?? [];
  const todayReminders = useMemo(() => {
    const tasks: Array<{ event: EventPicCalendarEvent; reminder: string }> = [];
    for (const event of filteredEvents) {
      for (const reminder of event.reminders ?? []) {
        if (reminder.due_date === todayKey && !reminder.checked) {
          tasks.push({ event, reminder: reminder.label });
        }
      }
    }
    return tasks;
  }, [filteredEvents, todayKey]);

  const selectedEvent =
    filteredEvents.find((event) => getEventKey(event) === selectedEventId) ??
    events.find((event) => getEventKey(event) === selectedEventId) ??
    null;
  const selectedEventDossier = selectedEvent
    ? dossierMap[`${selectedEvent.source}:${selectedEvent.source_id}`] ?? null
    : null;

  const monthCells = useMemo(() => createMonthCells(currentMonth), [currentMonth]);
  const weekStart = useMemo(() => getWeekStart(currentMonth), [currentMonth]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  async function createEvent() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildCreatePayload(createForm))
      });
      const payload = (await response.json()) as CalendarActionResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation evenement impossible.");
      }
      setMessage("Evenement ajoute au planning.");
      setShowCreateForm(false);
      setCreateForm({
        source: "manual",
        title: "",
        client_name: "",
        client_email: "",
        client_phone: "",
        event_type: "",
        event_date: "",
        start_time: "",
        end_time: "",
        delivery_time: "",
        return_date: "",
        return_time: "",
        event_address: "",
        package_label: "",
        notes: "",
        status: "nouveau"
      });
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Creation evenement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(event: EventPicCalendarEvent, status: EventPicCalendarStatus) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/calendar/events/${encodeURIComponent(event.id)}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      const payload = (await response.json()) as CalendarActionResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour statut impossible.");
      }
      setMessage("Statut evenement mis a jour.");
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise a jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(event: EventPicCalendarEvent, reminderId: string, checked: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/calendar/events/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reminder_checks: {
            [reminderId]: checked
          }
        })
      });
      const payload = (await response.json()) as CalendarActionResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise a jour rappel impossible.");
      }
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Mise a jour rappel impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedEvent() {
    if (!selectedEvent) {
      return;
    }
    const confirmed = window.confirm("Supprimer cet evenement du planning ?");
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/calendar/events/${encodeURIComponent(selectedEvent.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression impossible.");
      }
      setSelectedEventId("");
      setMessage("Evenement supprime.");
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function createDeliveryFromEvent(event: EventPicCalendarEvent) {
    if (event.source !== "quote" && event.source !== "template_request") {
      setError("Creation livraison disponible seulement depuis devis ou demande template.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/livraisons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "create_from_source",
          source: event.source,
          event_id: event.source_id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation livraison impossible.");
      }
      setMessage("Livraison creee.");
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Creation livraison impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function assignDriverToDelivery(event: EventPicCalendarEvent) {
    if (event.source !== "delivery") {
      return;
    }
    const driver = drivers.find((item) => item.id === assignDriverId);
    if (!driver) {
      setError("Selectionnez un livreur.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/livraisons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "assign_driver",
          assignment_id: event.source_id,
          driver_id: driver.id,
          driver_name: driver.name,
          status: "affecte"
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Affectation livreur impossible.");
      }
      setMessage("Livreur affecte.");
      await loadEvents();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Affectation impossible.");
    } finally {
      setSaving(false);
    }
  }

  function renderEventChip(event: EventPicCalendarEvent) {
    return (
      <button
        key={event.id}
        className={`planning-event-chip ${statusClass(event.status)}`}
        onClick={() => {
          setSelectedEventId(event.id);
          setAssignDriverId(event.assigned_driver_id || "");
        }}
        type="button"
      >
        <span>{event.start_time || event.delivery_time || "--:--"}</span>
        <strong>{event.title}</strong>
      </button>
    );
  }

  return (
    <main className="admin-page premium-page planning-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow admin-brand-line"><span className="event-pic-signature admin-brand-signature">Event Pic</span><span className="admin-brand-suffix">Admin</span></p>
          <h1>Planning evenements</h1>
          <p className="admin-hero-subtitle">
            Suivez les evenements, livraisons, recuperations et preparations Event Pic.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/devis">Devis clients</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <div className="admin-count">{events.length} evenements</div>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-template-diagnostic planning-toolbar-panel">
        <div className="planning-toolbar">
          <div className="table-actions">
            <button
              className={view === "month" ? "button-primary" : ""}
              onClick={() => setView("month")}
              type="button"
            >
              Vue mois
            </button>
            <button
              className={view === "week" ? "button-primary" : ""}
              onClick={() => setView("week")}
              type="button"
            >
              Vue semaine
            </button>
            <button
              className={view === "list" ? "button-primary" : ""}
              onClick={() => setView("list")}
              type="button"
            >
              Vue liste
            </button>
            <button
              className={view === "today" ? "button-primary" : ""}
              onClick={() => setView("today")}
              type="button"
            >
              Aujourd&apos;hui
            </button>
          </div>

          <div className="table-actions">
            <button onClick={() => setShowCreateForm((current) => !current)} type="button">
              Ajouter un evenement
            </button>
            <a className="public-button-outline" href="/api/admin/calendar/export-ics">
              Exporter ICS
            </a>
          </div>
        </div>

        <div className="planning-toolbar">
          <div className="table-actions">
            <button className={filter === "all" ? "button-primary" : ""} onClick={() => setFilter("all")} type="button">
              Tous
            </button>
            <button className={filter === "reserve" ? "button-primary" : ""} onClick={() => setFilter("reserve")} type="button">
              Reserves
            </button>
            <button className={filter === "template" ? "button-primary" : ""} onClick={() => setFilter("template")} type="button">
              A preparer
            </button>
            <button className={filter === "delivery" ? "button-primary" : ""} onClick={() => setFilter("delivery")} type="button">
              Livraisons
            </button>
            <button className={filter === "drivers" ? "button-primary" : ""} onClick={() => setFilter("drivers")} type="button">
              Livreurs
            </button>
            <button className={filter === "stock" ? "button-primary" : ""} onClick={() => setFilter("stock")} type="button">
              Stock sature
            </button>
            <button className={filter === "absences" ? "button-primary" : ""} onClick={() => setFilter("absences")} type="button">
              Absences
            </button>
            <button className={filter === "conflicts" ? "button-primary" : ""} onClick={() => setFilter("conflicts")} type="button">
              Conflits
            </button>
            <button className={filter === "return" ? "button-primary" : ""} onClick={() => setFilter("return")} type="button">
              Recuperations
            </button>
            <button className={filter === "termine" ? "button-primary" : ""} onClick={() => setFilter("termine")} type="button">
              Termines
            </button>
            <button className={filter === "blocked" ? "button-primary" : ""} onClick={() => setFilter("blocked")} type="button">
              Dates bloquees
            </button>
          </div>
          <small className="ai-brief-meta">Synchronisation Google Calendar non configuree.</small>
        </div>
      </section>

      {showCreateForm ? (
        <section className="admin-template-diagnostic">
          <h2>Ajouter un evenement</h2>
          <div className="calculator-grid">
            <label>
              Type de creation
              <select
                value={createForm.source}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    source: event.target.value === "blocked" ? "blocked" : "manual",
                    status: event.target.value === "blocked" ? "bloque" : current.status
                  }))
                }
              >
                <option value="manual">Evenement manuel</option>
                <option value="blocked">Date bloquee</option>
              </select>
            </label>
            <label>
              Statut
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: event.target.value as EventPicCalendarStatus
                  }))
                }
              >
                {EVENT_PIC_CALENDAR_STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titre
              <input
                type="text"
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              Nom client
              <input
                type="text"
                value={createForm.client_name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, client_name: event.target.value }))
                }
              />
            </label>
            <label>
              Telephone
              <input
                type="text"
                value={createForm.client_phone}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, client_phone: event.target.value }))
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={createForm.client_email}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, client_email: event.target.value }))
                }
              />
            </label>
            <label>
              Type evenement
              <input
                type="text"
                value={createForm.event_type}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, event_type: event.target.value }))
                }
              />
            </label>
            <label>
              Date evenement
              <input
                type="date"
                value={createForm.event_date}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, event_date: event.target.value }))
                }
              />
            </label>
            <label>
              Heure debut
              <input
                type="time"
                value={createForm.start_time}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, start_time: event.target.value }))
                }
              />
            </label>
            <label>
              Heure fin
              <input
                type="time"
                value={createForm.end_time}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, end_time: event.target.value }))
                }
              />
            </label>
            <label>
              Heure livraison
              <input
                type="time"
                value={createForm.delivery_time}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, delivery_time: event.target.value }))
                }
              />
            </label>
            <label>
              Date recuperation
              <input
                type="date"
                value={createForm.return_date}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, return_date: event.target.value }))
                }
              />
            </label>
            <label>
              Heure recuperation
              <input
                type="time"
                value={createForm.return_time}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, return_time: event.target.value }))
                }
              />
            </label>
            <label>
              Adresse evenement
              <input
                type="text"
                value={createForm.event_address}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, event_address: event.target.value }))
                }
              />
            </label>
            <label>
              Formule
              <input
                type="text"
                value={createForm.package_label}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, package_label: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="email-input-full">
            Notes
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
          <div className="table-actions">
            <button className="button-primary" disabled={saving} onClick={() => void createEvent()} type="button">
              Enregistrer evenement
            </button>
          </div>
        </section>
      ) : null}

      <section className="planning-layout">
        <article className="admin-template-diagnostic planning-main-panel">
          {view === "month" ? (
            <>
              <div className="planning-month-nav">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                >
                  Mois precedent
                </button>
                <strong>
                  {currentMonth.toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric"
                  })}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                >
                  Mois suivant
                </button>
              </div>
              <div className="planning-month-grid">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
                  <div className="planning-month-head" key={label}>
                    {label}
                  </div>
                ))}
                {monthCells.map((cell) => {
                  const cellEvents = eventsByDate.get(cell.date) ?? [];
                  return (
                    <div className={`planning-day-cell ${cell.inMonth ? "" : "is-outside"}`.trim()} key={cell.date}>
                      <div className="planning-day-label">{formatDay(cell.date)}</div>
                      <div className="planning-day-events">
                        {cellEvents.slice(0, 3).map((event) => renderEventChip(event))}
                        {cellEvents.length > 3 ? (
                          <small>{`+${cellEvents.length - 3} autres`}</small>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {view === "week" ? (
            <div className="planning-week-grid">
              {weekDays.map((day) => {
                const dayKey = toIsoDate(day);
                const dayEvents = eventsByDate.get(dayKey) ?? [];
                return (
                  <article className="planning-week-day" key={dayKey}>
                    <h3>{formatDay(dayKey)}</h3>
                    <div className="planning-day-events">
                      {dayEvents.length === 0 ? <small>Aucun evenement</small> : null}
                      {dayEvents.map((event) => renderEventChip(event))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {view === "list" ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Titre</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Livreur</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{event.event_date || "-"}</td>
                      <td>{event.start_time || event.delivery_time || "-"}</td>
                      <td>
                        <strong>{event.title}</strong>
                        {event.has_conflict ? <small className="notice-inline">{event.conflict_message}</small> : null}
                      </td>
                      <td>{event.client_name || "-"}</td>
                      <td>{event.event_type || "-"}</td>
                      <td>
                        <span className={`status-pill ${statusClass(event.status)}`}>
                          {getCalendarStatusLabel(event.status)}
                        </span>
                      </td>
                      <td>{event.assigned_driver_name || "-"}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" onClick={() => setSelectedEventId(event.id)}>
                            Ouvrir detail
                          </button>
                          <button type="button" onClick={() => void updateStatus(event, "termine")}>
                            Marquer termine
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === "today" ? (
            <div className="planning-today-grid">
              <article className="public-card">
                <h3>Evenements du jour</h3>
                <div className="planning-day-events">
                  {todayEvents.length === 0 ? <small>Aucun evenement aujourd&apos;hui.</small> : null}
                  {todayEvents.map((event) => renderEventChip(event))}
                </div>
              </article>
              <article className="public-card">
                <h3>Taches urgentes</h3>
                <ul>
                  {todayReminders.length === 0 ? <li>Aucun rappel urgent.</li> : null}
                  {todayReminders.map((item) => (
                    <li key={`${item.event.id}-${item.reminder}`}>
                      <strong>{item.event.title}</strong>
                      <small>{item.reminder}</small>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : null}
        </article>

        <aside className="admin-detail planning-detail-panel">
          <h2>Detail evenement</h2>
          {selectedEvent ? (
            <>
              <p className="eyebrow">{selectedEvent.source}</p>
              <h3>{selectedEvent.title}</h3>
              <div className="planning-detail-grid">
                <div>
                  <strong>Client</strong>
                  <small>{selectedEvent.client_name || "-"}</small>
                </div>
                <div>
                  <strong>Telephone</strong>
                  <small>{selectedEvent.client_phone || "-"}</small>
                </div>
                <div>
                  <strong>Email</strong>
                  <small>{selectedEvent.client_email || "-"}</small>
                </div>
                <div>
                  <strong>Type evenement</strong>
                  <small>{selectedEvent.event_type || "-"}</small>
                </div>
                <div>
                  <strong>Date evenement</strong>
                  <small>{selectedEvent.event_date || "-"}</small>
                </div>
                <div>
                  <strong>Adresse</strong>
                  <small>{selectedEvent.event_address || "-"}</small>
                </div>
                <div>
                  <strong>Formule</strong>
                  <small>{selectedEvent.package_label || "-"}</small>
                </div>
                <div>
                  <strong>Total estime</strong>
                  <small>{selectedEvent.estimated_total ? `${selectedEvent.estimated_total} EUR` : "-"}</small>
                </div>
                <div>
                  <strong>Frais deplacement</strong>
                  <small>{selectedEvent.delivery_fee ? `${selectedEvent.delivery_fee} EUR` : "0 EUR"}</small>
                </div>
                <div>
                  <strong>Livreur</strong>
                  <small>{selectedEvent.assigned_driver_name || "-"}</small>
                </div>
                <div>
                  <strong>Livraison</strong>
                  <small>{formatDateTime(selectedEvent.event_date, selectedEvent.delivery_time)}</small>
                </div>
                <div>
                  <strong>Recuperation</strong>
                  <small>{formatDateTime(selectedEvent.return_date, selectedEvent.return_time)}</small>
                </div>
                <div>
                  <strong>Dossier</strong>
                  <small>{selectedEventDossier ? selectedEventDossier.global_status : "Non lie"}</small>
                </div>
              </div>

              <label className="email-input-full">
                Statut
                <select
                  value={selectedEvent.status}
                  onChange={(event) =>
                    void updateStatus(selectedEvent, event.target.value as EventPicCalendarStatus)
                  }
                >
                  {EVENT_PIC_CALENDAR_STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedEvent.source === "delivery" ? (
                <div className="table-actions" style={{ marginTop: 10 }}>
                  <select
                    value={assignDriverId}
                    onChange={(event) => setAssignDriverId(event.target.value)}
                  >
                    <option value="">Choisir un livreur</option>
                    {drivers
                      .filter((driver) => driver.active)
                      .map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" onClick={() => void assignDriverToDelivery(selectedEvent)}>
                    Affecter livreur
                  </button>
                </div>
              ) : null}

              <div className="table-actions" style={{ marginTop: 12 }}>
                <Link href="/admin/devis">Ouvrir devis</Link>
                {selectedEventDossier ? (
                  <Link href={`/admin/dossiers/${encodeURIComponent(selectedEventDossier.dossier_id)}`}>
                    Ouvrir dossier
                  </Link>
                ) : (
                  <Link href="/admin/dossiers">Ouvrir dossier</Link>
                )}
                <Link href="/admin/livraisons">Ouvrir livraison</Link>
                <Link href="/admin/demandes">Ouvrir demande template</Link>
                <Link href={`/admin/emails${selectedEvent.source_id ? `?requestId=${encodeURIComponent(selectedEvent.source_id)}` : ""}`}>
                  Preparer email client
                </Link>
                <button
                  disabled={selectedEvent.source !== "quote" && selectedEvent.source !== "template_request"}
                  onClick={() => void createDeliveryFromEvent(selectedEvent)}
                  type="button"
                >
                  Creer livraison
                </button>
                {selectedEvent.event_address ? (
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(selectedEvent.event_address)}
                  >
                    Copier adresse
                  </button>
                ) : null}
                {selectedEvent.client_phone ? (
                  <>
                    <a href={`tel:${selectedEvent.client_phone.replace(/\s+/g, "")}`}>Appeler client</a>
                    <a
                      href={`https://wa.me/${selectedEvent.client_phone.replace(/[^\d]/g, "")}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      WhatsApp
                    </a>
                  </>
                ) : null}
              </div>

              <h3 style={{ marginTop: 18 }}>Rappels</h3>
              <div className="planning-reminders-list">
                {(selectedEvent.reminders ?? []).map((reminder) => (
                  <label key={reminder.id}>
                    <input
                      checked={reminder.checked}
                      onChange={(event) =>
                        void toggleReminder(selectedEvent, reminder.id, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>{`${reminder.label} (${reminder.due_date || "-"})`}</span>
                  </label>
                ))}
                {(selectedEvent.reminders ?? []).length === 0 ? <small>Aucun rappel sur cet evenement.</small> : null}
              </div>

              <label className="email-input-full" style={{ marginTop: 12 }}>
                Notes
                <textarea
                  defaultValue={selectedEvent.notes}
                  onBlur={(event) =>
                    void fetch(`/api/admin/calendar/events/${encodeURIComponent(selectedEvent.id)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ notes: event.target.value })
                    }).then(() => loadEvents())
                  }
                  rows={4}
                />
              </label>

              {selectedEvent.has_conflict ? (
                <p className="notice">{selectedEvent.conflict_message}</p>
              ) : null}

              <div className="table-actions" style={{ marginTop: 12 }}>
                <button
                  className="danger-button"
                  onClick={() => void deleteSelectedEvent()}
                  type="button"
                >
                  Supprimer evenement
                </button>
              </div>
            </>
          ) : (
            <p className="ai-brief-meta">Selectionnez un evenement pour afficher le detail.</p>
          )}
        </aside>
      </section>

      <section className="admin-template-diagnostic">
        <h2>Legendes statuts</h2>
        <div className="table-actions">
          {EVENT_PIC_CALENDAR_STATUSES.map((status) => (
            <span className={`status-pill ${statusClass(status.id)}`} key={status.id}>
              {status.label}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
