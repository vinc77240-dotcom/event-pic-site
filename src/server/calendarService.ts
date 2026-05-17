import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listDeliveryAssignments } from "@/src/server/deliveryService";
import { listDriverUnavailabilities } from "@/src/server/driverAvailabilityService";
import { listEventPicTemplateRequests } from "@/src/server/eventPicTemplateRequests";
import { listContactRequests, listQuoteRequests } from "@/src/server/publicLeadService";
import {
  EventPicCalendarEvent,
  EventPicCalendarReminder,
  EventPicCalendarSource,
  EventPicCalendarStatus,
  isCalendarStatus
} from "@/src/shared/eventPicCalendar";
import { EventPicTemplateRequestStatus } from "@/src/shared/eventPicTemplates";

const calendarEventsPath = path.join(process.cwd(), "data", "calendar-events.json");

type CalendarStoredEvent = EventPicCalendarEvent & {
  reminder_checks?: Record<string, boolean>;
};

type CalendarListOptions = {
  include_conflicts?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return 0;
}

function normalizeBooleanRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return {} as Record<string, boolean>;
  }
  const next: Record<string, boolean> = {};
  for (const [key, recordValue] of Object.entries(value)) {
    next[key] = recordValue === true;
  }
  return next;
}

function isCalendarSource(value: unknown): value is EventPicCalendarSource {
  return (
    value === "quote" ||
    value === "template_request" ||
    value === "delivery" ||
    value === "manual" ||
    value === "blocked"
  );
}

function parseSourceFromId(value: string) {
  if (!value.includes(":")) {
    return null;
  }
  const [prefix, ...rest] = value.split(":");
  if (!isCalendarSource(prefix) || rest.length === 0) {
    return null;
  }
  const sourceId = rest.join(":").trim();
  if (!sourceId) {
    return null;
  }
  return {
    source: prefix,
    source_id: sourceId
  };
}

function resolveCalendarStatus(input: unknown, fallback: EventPicCalendarStatus) {
  if (isCalendarStatus(input)) {
    return input;
  }
  return fallback;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateInput: string, delta: number) {
  if (!isIsoDate(dateInput)) {
    return "";
  }
  const [year, month, day] = dateInput.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function normalizeTime(value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  if (/^\d{2}:\d{2}$/.test(text)) {
    return text;
  }
  return "";
}

function toMinutes(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const [hours, minutes] = time.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

function normalizeStoredEvent(value: Partial<CalendarStoredEvent>): CalendarStoredEvent {
  const now = new Date().toISOString();
  const fallbackStatus = value.source === "blocked" ? "bloque" : "nouveau";
  return {
    id: cleanText(value.id),
    source: isCalendarSource(value.source) ? value.source : "manual",
    source_id: cleanText(value.source_id),
    title: cleanText(value.title),
    client_name: cleanText(value.client_name),
    client_email: cleanText(value.client_email),
    client_phone: cleanText(value.client_phone),
    event_type: cleanText(value.event_type),
    event_date: cleanText(value.event_date),
    start_time: normalizeTime(value.start_time),
    end_time: normalizeTime(value.end_time),
    delivery_time: normalizeTime(value.delivery_time),
    return_date: cleanText(value.return_date),
    return_time: normalizeTime(value.return_time),
    event_address: cleanText(value.event_address),
    status: resolveCalendarStatus(value.status, fallbackStatus),
    assigned_driver_id: cleanText(value.assigned_driver_id),
    assigned_driver_name: cleanText(value.assigned_driver_name),
    package_label: cleanText(value.package_label),
    estimated_total: normalizeMoney(value.estimated_total),
    delivery_fee: normalizeMoney(value.delivery_fee),
    notes: cleanText(value.notes),
    created_at: cleanText(value.created_at) || now,
    updated_at: cleanText(value.updated_at) || now,
    reminder_checks: normalizeBooleanRecord(value.reminder_checks)
  };
}

async function ensureCalendarEventsFile() {
  await fs.mkdir(path.dirname(calendarEventsPath), { recursive: true });
  try {
    await fs.access(calendarEventsPath);
  } catch {
    await fs.writeFile(calendarEventsPath, "[]\n", "utf8");
  }
}

async function readStoredEvents() {
  await ensureCalendarEventsFile();
  const raw = await fs.readFile(calendarEventsPath, "utf8");
  const parsed = JSON.parse(raw) as Array<Partial<CalendarStoredEvent>>;
  if (!Array.isArray(parsed)) {
    return [] as CalendarStoredEvent[];
  }
  return parsed
    .map((entry) => normalizeStoredEvent(entry))
    .filter((entry) => entry.id);
}

async function writeStoredEvents(events: CalendarStoredEvent[]) {
  await ensureCalendarEventsFile();
  await fs.writeFile(calendarEventsPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
}

function quoteStatusToCalendarStatus(status: string): EventPicCalendarStatus {
  if (status === "gagne") {
    return "reserve";
  }
  if (status === "perdu") {
    return "annule";
  }
  if (status === "devis_envoye" || status === "contacte" || status === "a_traiter") {
    return "devis_envoye";
  }
  return "nouveau";
}

function templateStatusToCalendarStatus(status: EventPicTemplateRequestStatus) {
  if (status === "a_preparer" || status === "en_cours" || status === "a_verifier") {
    return "template_a_preparer";
  }
  if (status === "valide") {
    return "reserve";
  }
  return "termine";
}

function deliveryStatusToCalendarStatus(status: string): EventPicCalendarStatus {
  if (status === "a_affecter") {
    return "livraison_a_affecter";
  }
  if (status === "conflit_stock" || status === "conflit_absence") {
    return "livraison_a_affecter";
  }
  if (status === "affecte" || status === "en_livraison" || status === "a_recuperer") {
    return "affecte";
  }
  if (status === "installe") {
    return "installe";
  }
  if (status === "termine" || status === "recupere") {
    return "termine";
  }
  return "nouveau";
}

function buildBaseReminders(eventDate: string, reminderChecks: Record<string, boolean>) {
  if (!isIsoDate(eventDate)) {
    return [] as EventPicCalendarReminder[];
  }

  const entries: Array<{ id: string; label: string; offset: number }> = [
    { id: "j_minus_7_template", label: "J-7 : verifier template", offset: -7 },
    { id: "j_minus_2_materiel", label: "J-2 : preparer materiel", offset: -2 },
    { id: "j_minus_1_caution", label: "J-1 : rappeler caution 1000 EUR", offset: -1 },
    { id: "j_day_delivery", label: "Jour J : livraison / installation", offset: 0 },
    { id: "j_plus_1_gallery", label: "J+1 : envoyer galerie", offset: 1 },
    { id: "j_plus_2_review", label: "J+2 : demander avis Google", offset: 2 },
    { id: "j_plus_7_offer", label: "J+7 : offre 30 EUR prochaine reservation", offset: 7 }
  ];

  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    due_date: addDays(eventDate, entry.offset),
    checked: reminderChecks[entry.id] === true
  }));
}

function pushPreparationReminders(
  reminders: EventPicCalendarReminder[],
  eventDate: string,
  reminderChecks: Record<string, boolean>
) {
  if (!isIsoDate(eventDate)) {
    return reminders;
  }
  const extra: Array<{ id: string; label: string; offset: number }> = [
    { id: "template_ia", label: "Verifier taches IA", offset: -5 },
    { id: "template_canva", label: "Verifier Canva", offset: -4 },
    { id: "template_psd", label: "Verifier PSD", offset: -4 }
  ];

  return [
    ...reminders,
    ...extra.map((entry) => ({
      id: entry.id,
      label: entry.label,
      due_date: addDays(eventDate, entry.offset),
      checked: reminderChecks[entry.id] === true
    }))
  ];
}

function buildDefaultTitle(source: EventPicCalendarSource, eventType: string, clientName: string) {
  const safeEventType = cleanText(eventType) || "Evenement";
  const safeClientName = cleanText(clientName) || "Client";
  if (source === "delivery") {
    return `Livraison - ${safeClientName}`;
  }
  if (source === "template_request") {
    return `Template - ${safeClientName}`;
  }
  if (source === "blocked") {
    return "Date bloquee";
  }
  if (source === "manual") {
    return `${safeEventType} - ${safeClientName}`;
  }
  return `${safeEventType} - ${safeClientName}`;
}

function buildQuoteEvent(entry: Awaited<ReturnType<typeof listQuoteRequests>>[number]) {
  const id = `quote:${entry.id}`;
  return normalizeStoredEvent({
    id,
    source: "quote",
    source_id: entry.id,
    title: buildDefaultTitle("quote", entry.event_type, entry.name),
    client_name: entry.name,
    client_email: entry.email,
    client_phone: entry.phone,
    event_type: entry.event_type,
    event_date: entry.event_date,
    start_time: entry.delivery_time,
    end_time: "",
    delivery_time: entry.delivery_time,
    return_date: entry.return_date,
    return_time: entry.return_time,
    event_address: entry.event_address,
    status: quoteStatusToCalendarStatus(entry.status),
    assigned_driver_id: entry.recommended_driver_id,
    assigned_driver_name: entry.recommended_driver_name,
    package_label: entry.package,
    estimated_total: entry.estimated_total_with_delivery || entry.estimated_total,
    delivery_fee: entry.delivery_fee,
    notes: entry.message,
    created_at: entry.created_at,
    updated_at: entry.created_at
  });
}

function buildContactEvent(entry: Awaited<ReturnType<typeof listContactRequests>>[number]) {
  const sourceId = `contact:${entry.id}`;
  const id = `quote:${sourceId}`;
  return normalizeStoredEvent({
    id,
    source: "quote",
    source_id: sourceId,
    title: `Contact - ${entry.name}`,
    client_name: entry.name,
    client_email: entry.email,
    client_phone: entry.phone,
    event_type: entry.event_type,
    event_date: entry.event_date,
    start_time: "",
    end_time: "",
    delivery_time: "",
    return_date: "",
    return_time: "",
    event_address: entry.event_address,
    status: quoteStatusToCalendarStatus(entry.status),
    assigned_driver_id: "",
    assigned_driver_name: "",
    package_label: "Demande contact",
    estimated_total: 0,
    delivery_fee: 0,
    notes: entry.message,
    created_at: entry.created_at,
    updated_at: entry.created_at
  });
}

function buildTemplateRequestEvent(
  entry: Awaited<ReturnType<typeof listEventPicTemplateRequests>>[number]
) {
  const id = `template_request:${entry.id}`;
  const clientName = `${entry.client.first_name} ${entry.client.last_name}`.trim();
  const notes = [entry.customization.notes, entry.customization.secondary_text]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(" | ");
  return normalizeStoredEvent({
    id,
    source: "template_request",
    source_id: entry.id,
    title: buildDefaultTitle("template_request", entry.event.type, clientName),
    client_name: clientName,
    client_email: entry.client.email,
    client_phone: entry.client.phone,
    event_type: entry.event.type,
    event_date: entry.event.date,
    start_time: "",
    end_time: "",
    delivery_time: "",
    return_date: "",
    return_time: "",
    event_address: "",
    status: templateStatusToCalendarStatus(entry.status),
    assigned_driver_id: "",
    assigned_driver_name: "",
    package_label: "Demande template",
    estimated_total: 0,
    delivery_fee: 0,
    notes,
    created_at: entry.created_at,
    updated_at: entry.updated_at
  });
}

function buildDeliveryEvent(entry: Awaited<ReturnType<typeof listDeliveryAssignments>>[number]) {
  const id = `delivery:${entry.id}`;
  const event = normalizeStoredEvent({
    id,
    source: "delivery",
    source_id: entry.id,
    title: buildDefaultTitle("delivery", entry.event_type, entry.client_name),
    client_name: entry.client_name,
    client_email: entry.client_email,
    client_phone: entry.client_phone,
    event_type: entry.event_type,
    event_date: entry.event_date,
    start_time: entry.delivery_time,
    end_time: entry.return_date === entry.event_date ? entry.return_time : "",
    delivery_time: entry.delivery_time,
    return_date: entry.return_date,
    return_time: entry.return_time,
    event_address: entry.event_address,
    status: deliveryStatusToCalendarStatus(entry.status),
    assigned_driver_id: entry.assigned_driver_id,
    assigned_driver_name: entry.assigned_driver_name,
    package_label: entry.package_label,
    estimated_total: 0,
    delivery_fee: normalizeMoney(entry.delivery_fee),
    notes: entry.notes,
    created_at: entry.created_at,
    updated_at: entry.updated_at
  });
  if (entry.status === "conflit_stock") {
    event.has_conflict = true;
    event.conflict_message = "Conflit stock livreur a verifier.";
  } else if (entry.status === "conflit_absence") {
    event.has_conflict = true;
    event.conflict_message = "Conflit absence livreur a verifier.";
  }
  return event;
}

function buildDriverUnavailabilityEvents(
  entries: Awaited<ReturnType<typeof listDriverUnavailabilities>>
) {
  return entries.map((entry) =>
    normalizeStoredEvent({
      id: `blocked:driver-unavailability:${entry.id}`,
      source: "blocked",
      source_id: `driver-unavailability:${entry.id}`,
      title: `Indisponibilite - ${entry.driver_name || entry.driver_id}`,
      client_name: "",
      client_email: "",
      client_phone: "",
      event_type: "Indisponibilite livreur",
      event_date: entry.start_date,
      start_time: entry.all_day ? "" : entry.start_time,
      end_time: entry.all_day ? "" : entry.end_time,
      delivery_time: "",
      return_date: entry.end_date,
      return_time: "",
      event_address: "",
      status: "bloque",
      assigned_driver_id: entry.driver_id,
      assigned_driver_name: entry.driver_name,
      package_label: "Indisponibilite",
      estimated_total: 0,
      delivery_fee: 0,
      notes: `${entry.reason}${entry.notes ? ` - ${entry.notes}` : ""}`,
      created_at: entry.created_at,
      updated_at: entry.updated_at
    })
  );
}

function mergeOverride(base: CalendarStoredEvent, override: CalendarStoredEvent | undefined) {
  if (!override) {
    return base;
  }

  const merged = normalizeStoredEvent({
    ...base,
    ...override,
    id: base.id,
    source: base.source,
    source_id: base.source_id,
    title: override.title || base.title,
    updated_at: override.updated_at || base.updated_at,
    created_at: base.created_at
  });

  return merged;
}

function attachReminders(event: CalendarStoredEvent, reminderChecks: Record<string, boolean>) {
  const baseReminders = buildBaseReminders(event.event_date, reminderChecks);
  const reminders =
    event.source === "template_request"
      ? pushPreparationReminders(baseReminders, event.event_date, reminderChecks)
      : baseReminders;
  return {
    ...event,
    reminders
  };
}

function applyConflictFlags(events: EventPicCalendarEvent[]) {
  const eventsByDate = new Map<string, EventPicCalendarEvent[]>();
  for (const event of events) {
    if (!event.event_date) {
      continue;
    }
    if (!eventsByDate.has(event.event_date)) {
      eventsByDate.set(event.event_date, []);
    }
    eventsByDate.get(event.event_date)!.push(event);
  }

  for (const [date, dateEvents] of eventsByDate.entries()) {
    if (dateEvents.length > 1) {
      for (const event of dateEvents) {
        event.has_conflict = true;
        if (!cleanText(event.conflict_message)) {
          event.conflict_message =
            "Plusieurs evenements sur cette date : verifier disponibilite materiel/livreur.";
        }
      }
    }

    for (let i = 0; i < dateEvents.length; i += 1) {
      for (let j = i + 1; j < dateEvents.length; j += 1) {
        const first = dateEvents[i];
        const second = dateEvents[j];
        const firstStart = toMinutes(first.start_time || first.delivery_time);
        const secondStart = toMinutes(second.start_time || second.delivery_time);
        const firstEnd = toMinutes(first.end_time || first.return_time);
        const secondEnd = toMinutes(second.end_time || second.return_time);

        if (firstStart === null || secondStart === null) {
          continue;
        }

        const safeFirstEnd = firstEnd ?? firstStart + 60;
        const safeSecondEnd = secondEnd ?? secondStart + 60;
        const overlaps = firstStart < safeSecondEnd && secondStart < safeFirstEnd;

        if (overlaps) {
          first.has_conflict = true;
          second.has_conflict = true;
          if (!cleanText(first.conflict_message)) {
            first.conflict_message = "Chevauchement horaire a verifier.";
          }
          if (!cleanText(second.conflict_message)) {
            second.conflict_message = "Chevauchement horaire a verifier.";
          }
        }
      }
    }
  }

  return events;
}

export async function listCalendarEvents(options: CalendarListOptions = {}) {
  const [quotes, contacts, templates, deliveries, unavailabilities, storedEvents] = await Promise.all([
    listQuoteRequests(),
    listContactRequests(),
    listEventPicTemplateRequests(),
    listDeliveryAssignments(),
    listDriverUnavailabilities(),
    readStoredEvents()
  ]);

  const manualEvents = storedEvents.filter(
    (event) => event.source === "manual" || event.source === "blocked"
  );
  const overrides = storedEvents.filter(
    (event) =>
      event.source === "quote" || event.source === "template_request" || event.source === "delivery"
  );

  const overrideById = new Map<string, CalendarStoredEvent>();
  for (const override of overrides) {
    overrideById.set(override.id, override);
    if (override.source && override.source_id) {
      overrideById.set(`${override.source}:${override.source_id}`, override);
    }
  }

  const sourceEvents = [
    ...quotes.map((entry) => buildQuoteEvent(entry)),
    ...contacts.map((entry) => buildContactEvent(entry)),
    ...templates.map((entry) => buildTemplateRequestEvent(entry)),
    ...deliveries.map((entry) => buildDeliveryEvent(entry)),
    ...buildDriverUnavailabilityEvents(unavailabilities)
  ];

  const mergedSourceEvents = sourceEvents.map((event) => {
    const override = overrideById.get(event.id);
    const merged = mergeOverride(event, override);
    return attachReminders(merged, override?.reminder_checks ?? {});
  });

  const normalizedManual = manualEvents.map((event) =>
    attachReminders(event, event.reminder_checks ?? {})
  );

  const events = [...mergedSourceEvents, ...normalizedManual].sort((a, b) => {
    const byDate = (a.event_date || "").localeCompare(b.event_date || "");
    if (byDate !== 0) {
      return byDate;
    }
    const byTime = (a.start_time || a.delivery_time || "").localeCompare(
      b.start_time || b.delivery_time || ""
    );
    if (byTime !== 0) {
      return byTime;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const nextEvents = options.include_conflicts ? applyConflictFlags(events) : events;
  return nextEvents;
}

function buildEventFromInput(input: Partial<EventPicCalendarEvent>) {
  const source = isCalendarSource(input.source) ? input.source : "manual";
  const sourceId =
    source === "manual" || source === "blocked"
      ? cleanText(input.source_id)
      : cleanText(input.source_id) || cleanText(input.id);
  const id =
    source === "manual" || source === "blocked"
      ? cleanText(input.id) || randomUUID()
      : `${source}:${sourceId}`;

  if (!id) {
    throw new Error("Identifiant evenement invalide.");
  }

  const fallbackStatus: EventPicCalendarStatus =
    source === "blocked" ? "bloque" : "nouveau";

  return normalizeStoredEvent({
    ...input,
    id,
    source,
    source_id: sourceId,
    title:
      cleanText(input.title) ||
      buildDefaultTitle(source, cleanText(input.event_type), cleanText(input.client_name)),
    status: resolveCalendarStatus(input.status, fallbackStatus)
  });
}

export async function createCalendarEvent(input: Partial<EventPicCalendarEvent>) {
  const nextEvent = buildEventFromInput(input);
  const stored = await readStoredEvents();

  const existingIndex = stored.findIndex((event) => event.id === nextEvent.id);
  if (existingIndex >= 0) {
    stored[existingIndex] = {
      ...stored[existingIndex],
      ...nextEvent,
      updated_at: new Date().toISOString(),
      created_at: stored[existingIndex].created_at
    };
  } else {
    stored.unshift(nextEvent);
  }

  await writeStoredEvents(stored);
  return nextEvent;
}

export async function updateCalendarEvent(
  id: string,
  updates: Partial<EventPicCalendarEvent> & { reminder_checks?: Record<string, boolean> }
) {
  const eventId = cleanText(id);
  if (!eventId) {
    throw new Error("id evenement manquant.");
  }

  const stored = await readStoredEvents();
  const index = stored.findIndex((event) => event.id === eventId);

  if (index >= 0) {
    const current = stored[index];
    const merged = normalizeStoredEvent({
      ...current,
      ...updates,
      id: current.id,
      source: current.source,
      source_id: current.source_id,
      reminder_checks: {
        ...(current.reminder_checks ?? {}),
        ...(updates.reminder_checks ?? {})
      },
      updated_at: new Date().toISOString(),
      created_at: current.created_at
    });
    stored[index] = merged;
    await writeStoredEvents(stored);
    return merged;
  }

  const parsed = parseSourceFromId(eventId);
  if (!parsed || (parsed.source !== "quote" && parsed.source !== "template_request" && parsed.source !== "delivery")) {
    throw new Error("Evenement introuvable.");
  }

  const created = normalizeStoredEvent({
    id: eventId,
    source: parsed.source,
    source_id: parsed.source_id,
    ...updates,
    reminder_checks: normalizeBooleanRecord(updates.reminder_checks),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });
  stored.unshift(created);
  await writeStoredEvents(stored);
  return created;
}

export async function deleteCalendarEvent(id: string) {
  const eventId = cleanText(id);
  if (!eventId) {
    throw new Error("id evenement manquant.");
  }

  const stored = await readStoredEvents();
  const next = stored.filter((event) => event.id !== eventId);
  if (next.length === stored.length) {
    throw new Error("Evenement introuvable.");
  }
  await writeStoredEvents(next);
  return true;
}

export async function updateCalendarEventStatus(id: string, status: EventPicCalendarStatus) {
  if (!isCalendarStatus(status)) {
    throw new Error("Statut calendrier invalide.");
  }
  return await updateCalendarEvent(id, { status });
}

function escapeIcsValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatDateForIcs(dateInput: string, timeInput: string) {
  if (!isIsoDate(dateInput)) {
    return "";
  }
  if (!timeInput || !/^\d{2}:\d{2}$/.test(timeInput)) {
    return dateInput.replace(/-/g, "");
  }

  const iso = `${dateInput}T${timeInput}:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return dateInput.replace(/-/g, "");
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

export async function exportCalendarEventsToIcs() {
  const events = await listCalendarEvents({ include_conflicts: false });
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}` +
    `${`${now.getUTCMonth() + 1}`.padStart(2, "0")}` +
    `${`${now.getUTCDate()}`.padStart(2, "0")}` +
    "T" +
    `${`${now.getUTCHours()}`.padStart(2, "0")}` +
    `${`${now.getUTCMinutes()}`.padStart(2, "0")}` +
    `${`${now.getUTCSeconds()}`.padStart(2, "0")}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Pic//Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const event of events) {
    if (!isIsoDate(event.event_date)) {
      continue;
    }

    const startValue = formatDateForIcs(event.event_date, event.start_time || event.delivery_time);
    const endDate = isIsoDate(event.return_date) ? event.return_date : event.event_date;
    const endTime =
      event.end_time ||
      (event.return_date === event.event_date ? event.return_time : "") ||
      event.start_time ||
      event.delivery_time;
    const endValue = formatDateForIcs(endDate, endTime);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsValue(event.id)}@eventpic.local`);
    lines.push(`DTSTAMP:${stamp}`);
    if (startValue.length === 8) {
      lines.push(`DTSTART;VALUE=DATE:${startValue}`);
      lines.push(`DTEND;VALUE=DATE:${addDays(event.event_date, 1).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${startValue}`);
      lines.push(`DTEND:${endValue || startValue}`);
    }
    lines.push(`SUMMARY:${escapeIcsValue(event.title)}`);
    if (event.event_address) {
      lines.push(`LOCATION:${escapeIcsValue(event.event_address)}`);
    }
    const description = [
      event.client_name ? `Client: ${event.client_name}` : "",
      event.client_phone ? `Telephone: ${event.client_phone}` : "",
      event.client_email ? `Email: ${event.client_email}` : "",
      event.package_label ? `Prestation: ${event.package_label}` : "",
      event.notes ? `Notes: ${event.notes}` : ""
    ]
      .filter(Boolean)
      .join("\\n");
    if (description) {
      lines.push(`DESCRIPTION:${escapeIcsValue(description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
