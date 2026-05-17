import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DELIVERY_STATUSES,
  DeliveryAssignment,
  DeliveryAssignmentSource,
  DeliveryAssignmentStatus,
  DeliveryDriver,
  EventPicQuoteRequest
} from "@/src/shared/eventPicPublic";
import { listContactRequests, listQuoteRequests } from "@/src/server/publicLeadService";
import { listEventPicTemplateRequests } from "@/src/server/eventPicTemplateRequests";
import { calculateDeliveryFee, listDeliveryDrivers } from "@/src/server/deliveryDistanceService";
import { getAvailableDriversForEvent, upsertDeliveryDrivers } from "@/src/server/driverAvailabilityService";

const assignmentsPath = path.join(process.cwd(), "data", "delivery-assignments.json");

type DeliveryEventSourceItem = {
  source: DeliveryAssignmentSource;
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
  assigned_driver_id: string;
  assigned_driver_name: string;
  distance_km: number | null;
  travel_time_minutes: number | null;
  delivery_fee: number | null;
};

const VALID_STATUSES = new Set<DeliveryAssignmentStatus>(
  DELIVERY_STATUSES.map((status) => status.id)
);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseStatus(value: unknown): DeliveryAssignmentStatus {
  if (typeof value === "string" && VALID_STATUSES.has(value as DeliveryAssignmentStatus)) {
    return value as DeliveryAssignmentStatus;
  }
  return "a_affecter";
}

async function ensureArrayFile(filePath: string, fallback: unknown[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function readJsonArray<T>(filePath: string, fallback: unknown[]): Promise<T[]> {
  await ensureArrayFile(filePath, fallback);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as T[];
  if (!Array.isArray(parsed)) {
    return [] as T[];
  }
  return parsed;
}

async function writeJsonArray<T>(filePath: string, items: T[]) {
  await ensureArrayFile(filePath, []);
  await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function normalizeDriver(driver: DeliveryDriver): DeliveryDriver {
  const now = new Date().toISOString();
  return {
    id: cleanText(driver.id),
    name: cleanText(driver.name),
    address: cleanText(driver.address),
    phone: cleanText(driver.phone),
    email: cleanText(driver.email),
    zone: cleanText(driver.zone),
    active: typeof driver.active === "boolean" ? driver.active : true,
    booth_stock: Math.max(1, Math.floor(parseNumber(driver.booth_stock) ?? 1)),
    notes: cleanText(driver.notes),
    created_at: cleanText(driver.created_at) || now,
    updated_at: cleanText(driver.updated_at) || now
  };
}

function normalizeAssignment(item: DeliveryAssignment): DeliveryAssignment {
  const distance = parseNumber(item.distance_km);
  const fee = parseNumber(item.delivery_fee);

  return {
    ...item,
    id: cleanText(item.id),
    event_source:
      item.event_source === "manual" ||
      item.event_source === "quote" ||
      item.event_source === "template_request"
        ? item.event_source
        : "manual",
    event_id: cleanText(item.event_id),
    client_name: cleanText(item.client_name),
    client_phone: cleanText(item.client_phone),
    client_email: cleanText(item.client_email),
    event_date: cleanText(item.event_date),
    delivery_time: cleanText(item.delivery_time),
    return_date: cleanText(item.return_date),
    return_time: cleanText(item.return_time),
    booth_quantity: Math.max(1, Math.floor(parseNumber(item.booth_quantity) ?? 1)),
    event_address: cleanText(item.event_address),
    event_type: cleanText(item.event_type),
    package_label: cleanText(item.package_label),
    assigned_driver_id: cleanText(item.assigned_driver_id),
    assigned_driver_name: cleanText(item.assigned_driver_name),
    status: parseStatus(item.status),
    notes: cleanText(item.notes),
    distance_km: distance,
    travel_time_minutes: parseNumber(item.travel_time_minutes),
    toll_cost: parseNumber(item.toll_cost),
    delivery_fee:
      fee ??
      (distance === null ? null : calculateDeliveryFee(distance).delivery_fee),
    created_at: cleanText(item.created_at) || new Date().toISOString(),
    updated_at: cleanText(item.updated_at) || new Date().toISOString()
  };
}

export async function listDrivers() {
  const drivers = await listDeliveryDrivers();
  return drivers.map(normalizeDriver);
}

export async function listDeliveryAssignments() {
  const items = await readJsonArray<DeliveryAssignment>(assignmentsPath, []);
  return items
    .map(normalizeAssignment)
    .sort((a, b) => {
      if (a.event_date && b.event_date && a.event_date !== b.event_date) {
        return a.event_date.localeCompare(b.event_date);
      }
      return b.created_at.localeCompare(a.created_at);
    });
}

export async function listDeliverySourceEvents() {
  const [quotes, contacts, templateRequests] = await Promise.all([
    listQuoteRequests(),
    listContactRequests(),
    listEventPicTemplateRequests()
  ]);

  const quoteItems: DeliveryEventSourceItem[] = quotes.map((item) => ({
    source: "quote",
    event_id: item.id,
    client_name: item.name,
    client_phone: item.phone,
    client_email: item.email,
    event_date: item.event_date,
    delivery_time: item.delivery_time,
    return_date: item.return_date,
    return_time: item.return_time,
    booth_quantity: Math.max(1, Math.floor(parseNumber(item.booth_quantity) ?? 1)),
    event_address: item.event_address,
    event_type: item.event_type,
    package_label: item.package,
    assigned_driver_id: cleanText(item.recommended_driver_id),
    assigned_driver_name: cleanText(item.recommended_driver_name),
    distance_km:
      typeof item.distance_km === "number" && Number.isFinite(item.distance_km)
        ? item.distance_km
        : null,
    travel_time_minutes:
      typeof item.travel_time_minutes === "number" && Number.isFinite(item.travel_time_minutes)
        ? item.travel_time_minutes
        : null,
    delivery_fee:
      typeof item.delivery_fee === "number" && Number.isFinite(item.delivery_fee)
        ? item.delivery_fee
        : null
  }));

  const contactItems: DeliveryEventSourceItem[] = contacts.map((item) => ({
    source: "quote",
    event_id: `contact:${item.id}`,
    client_name: item.name,
    client_phone: item.phone,
    client_email: item.email,
    event_date: item.event_date,
    delivery_time: "",
    return_date: "",
    return_time: "",
    booth_quantity: 1,
    event_address: item.event_address,
    event_type: item.event_type,
    package_label: "Demande contact",
    assigned_driver_id: "",
    assigned_driver_name: "",
    distance_km: null,
    travel_time_minutes: null,
    delivery_fee: null
  }));

  const templateItems: DeliveryEventSourceItem[] = templateRequests.map((item) => ({
    source: "template_request",
    event_id: item.id,
    client_name: `${item.client.first_name} ${item.client.last_name}`.trim(),
    client_phone: item.client.phone,
    client_email: item.client.email,
    event_date: item.event.date,
    delivery_time: "",
    return_date: "",
    return_time: "",
    booth_quantity: 1,
    event_address: "",
    event_type: item.event.type,
    package_label: "Demande template",
    assigned_driver_id: "",
    assigned_driver_name: "",
    distance_km: null,
    travel_time_minutes: null,
    delivery_fee: null
  }));

  return [...quoteItems, ...contactItems, ...templateItems].sort((a, b) =>
    (a.event_date || "").localeCompare(b.event_date || "")
  );
}

function normalizeSourceFromQuoteId(
  source: DeliveryAssignmentSource,
  eventId: string
): DeliveryAssignmentSource {
  if (source === "quote" && eventId.startsWith("contact:")) {
    return "manual";
  }
  return source;
}

async function resolveAvailabilityStatusForAssignment(input: {
  assignment_id?: string;
  event_date: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  booth_quantity: number;
  assigned_driver_id: string;
  preferred_status: DeliveryAssignmentStatus;
}) {
  const assignedDriverId = cleanText(input.assigned_driver_id);
  if (!assignedDriverId) {
    return "a_affecter" as DeliveryAssignmentStatus;
  }

  const availability = await getAvailableDriversForEvent({
    event_date: cleanText(input.event_date),
    event_start_time: cleanText(input.delivery_time),
    delivery_time: cleanText(input.delivery_time),
    return_date: cleanText(input.return_date),
    return_time: cleanText(input.return_time),
    booth_quantity: Math.max(1, Math.floor(parseNumber(input.booth_quantity) ?? 1)),
    exclude_assignment_id: cleanText(input.assignment_id)
  });
  const isAvailable = availability.available_drivers.some(
    (driver) => driver.driver_id === assignedDriverId
  );
  if (isAvailable) {
    if (input.preferred_status === "a_affecter" || input.preferred_status === "conflit_absence" || input.preferred_status === "conflit_stock") {
      return "affecte" as DeliveryAssignmentStatus;
    }
    return input.preferred_status;
  }

  const unavailable = availability.unavailable_drivers.find(
    (driver) => driver.driver_id === assignedDriverId
  );
  if (unavailable?.reason === "absence") {
    return "conflit_absence" as DeliveryAssignmentStatus;
  }
  return "conflit_stock" as DeliveryAssignmentStatus;
}

export async function createDeliveryAssignmentFromSource(input: {
  source: DeliveryAssignmentSource;
  event_id: string;
}) {
  const source = input.source;
  const eventId = cleanText(input.event_id);
  if (!eventId) {
    throw new Error("event_id manquant.");
  }

  const [events, assignments] = await Promise.all([
    listDeliverySourceEvents(),
    listDeliveryAssignments()
  ]);

  const sourceEvent = events.find(
    (eventItem) =>
      eventItem.source === source && cleanText(eventItem.event_id) === eventId
  );

  if (!sourceEvent) {
    throw new Error("Evenement source introuvable pour la livraison.");
  }

  const existing = assignments.find(
    (assignment) =>
      assignment.event_source === source &&
      cleanText(assignment.event_id) === eventId
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const next: DeliveryAssignment = {
    id: randomUUID(),
    event_source: normalizeSourceFromQuoteId(source, eventId),
    event_id: sourceEvent.event_id,
    client_name: sourceEvent.client_name,
    client_phone: sourceEvent.client_phone,
    client_email: sourceEvent.client_email,
    event_date: sourceEvent.event_date,
    delivery_time: sourceEvent.delivery_time,
    return_date: sourceEvent.return_date || sourceEvent.event_date,
    return_time: sourceEvent.return_time,
    booth_quantity: Math.max(1, Math.floor(parseNumber(sourceEvent.booth_quantity) ?? 1)),
    event_address: sourceEvent.event_address,
    event_type: sourceEvent.event_type,
    package_label: sourceEvent.package_label,
    assigned_driver_id: sourceEvent.assigned_driver_id,
    assigned_driver_name: sourceEvent.assigned_driver_name,
    status: sourceEvent.assigned_driver_id ? "affecte" : "a_affecter",
    notes: "",
    distance_km: sourceEvent.distance_km,
    travel_time_minutes: sourceEvent.travel_time_minutes,
    toll_cost: null,
    delivery_fee: sourceEvent.delivery_fee,
    created_at: now,
    updated_at: now
  };

  next.status = await resolveAvailabilityStatusForAssignment({
    assignment_id: next.id,
    event_date: next.event_date,
    delivery_time: next.delivery_time,
    return_date: next.return_date,
    return_time: next.return_time,
    booth_quantity: next.booth_quantity,
    assigned_driver_id: next.assigned_driver_id,
    preferred_status: next.status
  });

  assignments.push(next);
  await writeJsonArray(assignmentsPath, assignments);
  return next;
}

export async function createManualDeliveryAssignment(
  input: Partial<DeliveryAssignment>
) {
  const now = new Date().toISOString();
  const assignments = await listDeliveryAssignments();
  const distance = parseNumber(input.distance_km);

  const next: DeliveryAssignment = {
    id: randomUUID(),
    event_source: "manual",
    event_id: cleanText(input.event_id) || `manual:${Date.now()}`,
    client_name: cleanText(input.client_name),
    client_phone: cleanText(input.client_phone),
    client_email: cleanText(input.client_email),
    event_date: cleanText(input.event_date),
    delivery_time: cleanText(input.delivery_time),
    return_date: cleanText(input.return_date),
    return_time: cleanText(input.return_time),
    booth_quantity: Math.max(1, Math.floor(parseNumber(input.booth_quantity) ?? 1)),
    event_address: cleanText(input.event_address),
    event_type: cleanText(input.event_type),
    package_label: cleanText(input.package_label),
    assigned_driver_id: cleanText(input.assigned_driver_id),
    assigned_driver_name: cleanText(input.assigned_driver_name),
    status: parseStatus(input.status),
    notes: cleanText(input.notes),
    distance_km: distance,
    travel_time_minutes: parseNumber(input.travel_time_minutes),
    toll_cost: parseNumber(input.toll_cost),
    delivery_fee:
      parseNumber(input.delivery_fee) ??
      (distance === null ? null : calculateDeliveryFee(distance).delivery_fee),
    created_at: now,
    updated_at: now
  };

  next.status = await resolveAvailabilityStatusForAssignment({
    assignment_id: next.id,
    event_date: next.event_date,
    delivery_time: next.delivery_time,
    return_date: next.return_date,
    return_time: next.return_time,
    booth_quantity: next.booth_quantity,
    assigned_driver_id: next.assigned_driver_id,
    preferred_status: next.status
  });

  assignments.push(next);
  await writeJsonArray(assignmentsPath, assignments);
  return next;
}

export async function updateDeliveryAssignment(
  id: string,
  updates: Partial<DeliveryAssignment>
) {
  const assignments = await listDeliveryAssignments();
  const index = assignments.findIndex((assignment) => assignment.id === id);
  if (index === -1) {
    throw new Error("Livraison introuvable.");
  }

  const current = assignments[index];
  const distance = updates.distance_km !== undefined ? parseNumber(updates.distance_km) : current.distance_km;

  const nextAssignment: DeliveryAssignment = {
    ...current,
    client_name:
      updates.client_name !== undefined
        ? cleanText(updates.client_name)
        : current.client_name,
    client_phone:
      updates.client_phone !== undefined
        ? cleanText(updates.client_phone)
        : current.client_phone,
    client_email:
      updates.client_email !== undefined
        ? cleanText(updates.client_email)
        : current.client_email,
    event_date:
      updates.event_date !== undefined
        ? cleanText(updates.event_date)
        : current.event_date,
    delivery_time:
      updates.delivery_time !== undefined
        ? cleanText(updates.delivery_time)
        : current.delivery_time,
    return_date:
      updates.return_date !== undefined
        ? cleanText(updates.return_date)
        : current.return_date,
    return_time:
      updates.return_time !== undefined
        ? cleanText(updates.return_time)
        : current.return_time,
    booth_quantity:
      updates.booth_quantity !== undefined
        ? Math.max(1, Math.floor(parseNumber(updates.booth_quantity) ?? 1))
        : current.booth_quantity,
    event_address:
      updates.event_address !== undefined
        ? cleanText(updates.event_address)
        : current.event_address,
    event_type:
      updates.event_type !== undefined
        ? cleanText(updates.event_type)
        : current.event_type,
    package_label:
      updates.package_label !== undefined
        ? cleanText(updates.package_label)
        : current.package_label,
    assigned_driver_id:
      updates.assigned_driver_id !== undefined
        ? cleanText(updates.assigned_driver_id)
        : current.assigned_driver_id,
    assigned_driver_name:
      updates.assigned_driver_name !== undefined
        ? cleanText(updates.assigned_driver_name)
        : current.assigned_driver_name,
    status: updates.status !== undefined ? parseStatus(updates.status) : current.status,
    notes: updates.notes !== undefined ? cleanText(updates.notes) : current.notes,
    distance_km: distance,
    travel_time_minutes:
      updates.travel_time_minutes !== undefined
        ? parseNumber(updates.travel_time_minutes)
        : current.travel_time_minutes,
    toll_cost:
      updates.toll_cost !== undefined ? parseNumber(updates.toll_cost) : current.toll_cost,
    delivery_fee:
      updates.delivery_fee !== undefined
        ? parseNumber(updates.delivery_fee)
        : current.delivery_fee ??
          (distance === null ? null : calculateDeliveryFee(distance).delivery_fee),
    updated_at: new Date().toISOString()
  };

  nextAssignment.status = await resolveAvailabilityStatusForAssignment({
    assignment_id: nextAssignment.id,
    event_date: nextAssignment.event_date,
    delivery_time: nextAssignment.delivery_time,
    return_date: nextAssignment.return_date,
    return_time: nextAssignment.return_time,
    booth_quantity: nextAssignment.booth_quantity,
    assigned_driver_id: nextAssignment.assigned_driver_id,
    preferred_status: nextAssignment.status
  });
  assignments[index] = nextAssignment;

  await writeJsonArray(assignmentsPath, assignments);
  return assignments[index];
}

export async function upsertDrivers(drivers: DeliveryDriver[]) {
  const normalized = drivers.map(normalizeDriver).filter((driver) => driver.id && driver.name);
  return await upsertDeliveryDrivers(normalized);
}

export function deliveryStatusLabel(status: DeliveryAssignmentStatus) {
  return DELIVERY_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function isDeliveryStatus(value: unknown): value is DeliveryAssignmentStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as DeliveryAssignmentStatus);
}

export function getDefaultDeliveryFeeForQuote(quote: EventPicQuoteRequest) {
  const kilometers = parseNumber((quote as { distance_km?: number | string | null }).distance_km);
  if (kilometers === null) {
    return null;
  }
  return calculateDeliveryFee(kilometers).delivery_fee;
}
