import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DeliveryAssignment,
  DeliveryDistanceStatus,
  DeliveryDriver,
  DriverAvailabilityReason,
  DriverAvailabilitySnapshotItem,
  DriverUnavailability,
  DriverUnavailabilityReason
} from "@/src/shared/eventPicPublic";
import { calculateDeliveryFee } from "@/src/server/deliveryFeeService";
import { readAdminJsonArray, writeAdminJsonArray } from "@/src/server/adminJsonBlobStore";

const driversPath = path.join(process.cwd(), "data", "drivers.json");
const assignmentsPath = path.join(process.cwd(), "data", "delivery-assignments.json");
const unavailabilitiesPath = path.join(process.cwd(), "data", "driver-unavailabilities.json");

const DEFAULT_DRIVERS: DeliveryDriver[] = [
  {
    id: "aurelie",
    name: "Aurelie",
    address: "11 rue des Erables, Corbeil-Essonnes",
    phone: "",
    email: "",
    zone: "IDF",
    active: true,
    booth_stock: 1,
    notes: "",
    created_at: "",
    updated_at: ""
  },
  {
    id: "vincent",
    name: "Vincent",
    address: "5 Ferme des Tournelles, 77610 Fontenay-Tresigny",
    phone: "",
    email: "",
    zone: "IDF",
    active: true,
    booth_stock: 1,
    notes: "",
    created_at: "",
    updated_at: ""
  },
  {
    id: "dylan",
    name: "Dylan",
    address: "3 rue du Puits, Salins 77",
    phone: "",
    email: "",
    zone: "IDF",
    active: true,
    booth_stock: 1,
    notes: "",
    created_at: "",
    updated_at: ""
  }
];

const DRIVERS_STORE = {
  localPath: driversPath,
  blobPath: "admin/drivers.json",
  backupBlobPrefix: "admin/backups/drivers",
  fallback: DEFAULT_DRIVERS,
  missingTokenMessage: "BLOB_READ_WRITE_TOKEN manquant: les livreurs doivent utiliser Vercel Blob en production."
};

const DRIVER_UNAVAILABILITIES_STORE = {
  localPath: unavailabilitiesPath,
  blobPath: "admin/driver-unavailabilities.json",
  backupBlobPrefix: "admin/backups/driver-unavailabilities",
  fallback: [],
  missingTokenMessage:
    "BLOB_READ_WRITE_TOKEN manquant: les indisponibilites livreurs doivent utiliser Vercel Blob en production."
};

const DELIVERY_ASSIGNMENTS_STORE = {
  localPath: assignmentsPath,
  blobPath: "admin/delivery-assignments.json",
  backupBlobPrefix: "admin/backups/delivery-assignments",
  fallback: [],
  missingTokenMessage:
    "BLOB_READ_WRITE_TOKEN manquant: les affectations livraison doivent utiliser Vercel Blob en production."
};

const ACTIVE_ASSIGNMENT_STATUSES = new Set([
  "a_affecter",
  "affecte",
  "en_livraison",
  "installe",
  "a_recuperer",
  "conflit_stock",
  "conflit_absence"
]);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
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
  return 0;
}

function normalizeBoothStock(value: unknown) {
  const parsed = Math.floor(parseNumber(value));
  if (parsed <= 0) {
    return 1;
  }
  return parsed;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeDriver(input: Partial<DeliveryDriver>): DeliveryDriver {
  const now = nowIso();
  return {
    id: cleanText(input.id),
    name: cleanText(input.name),
    address: cleanText(input.address),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    zone: cleanText(input.zone),
    active: parseBoolean(input.active, true),
    booth_stock: normalizeBoothStock(input.booth_stock),
    notes: cleanText(input.notes),
    created_at: cleanText(input.created_at) || now,
    updated_at: cleanText(input.updated_at) || now
  };
}

const VALID_UNAVAILABILITY_REASONS = new Set<DriverUnavailabilityReason>([
  "absence",
  "conges",
  "maladie",
  "indisponible",
  "autre"
]);

function normalizeDriverUnavailability(input: Partial<DriverUnavailability>): DriverUnavailability {
  const now = nowIso();
  const reason = cleanText(input.reason) as DriverUnavailabilityReason;
  return {
    id: cleanText(input.id) || randomUUID(),
    driver_id: cleanText(input.driver_id),
    driver_name: cleanText(input.driver_name),
    start_date: cleanText(input.start_date),
    end_date: cleanText(input.end_date) || cleanText(input.start_date),
    start_time: cleanText(input.start_time),
    end_time: cleanText(input.end_time),
    all_day: parseBoolean(input.all_day, true),
    reason: VALID_UNAVAILABILITY_REASONS.has(reason) ? reason : "indisponible",
    notes: cleanText(input.notes),
    created_at: cleanText(input.created_at) || now,
    updated_at: cleanText(input.updated_at) || now
  };
}

function toDateWithTime(date: string, time: string, fallbackTime: string) {
  const safeDate = cleanText(date);
  if (!safeDate) {
    return null;
  }
  const safeTime = cleanText(time) || fallbackTime;
  const value = new Date(`${safeDate}T${safeTime}:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

function buildEventRange(input: {
  event_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  delivery_time?: string;
  return_date?: string;
  return_time?: string;
}) {
  const start = toDateWithTime(
    cleanText(input.event_date),
    cleanText(input.delivery_time) || cleanText(input.event_start_time),
    "09:00"
  );
  const end = toDateWithTime(
    cleanText(input.return_date) || cleanText(input.event_date),
    cleanText(input.return_time) || cleanText(input.event_end_time),
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

function buildUnavailabilityRange(item: DriverUnavailability) {
  const start = toDateWithTime(item.start_date, item.all_day ? "00:00" : item.start_time, "00:00");
  const end = toDateWithTime(item.end_date || item.start_date, item.all_day ? "23:59" : item.end_time, "23:59");
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

function buildAssignmentRange(item: Partial<DeliveryAssignment>) {
  return buildEventRange({
    event_date: cleanText(item.event_date),
    delivery_time: cleanText(item.delivery_time),
    return_date: cleanText(item.return_date) || cleanText(item.event_date),
    return_time: cleanText(item.return_time)
  });
}

type DistanceApiResult = {
  ok: boolean;
  distance_km: number;
  travel_time_minutes: number;
  error: string;
};

async function fetchDriverDistance(
  originAddress: string,
  destinationAddress: string,
  apiKey: string
): Promise<DistanceApiResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", originAddress);
  url.searchParams.set("destinations", destinationAddress);
  url.searchParams.set("units", "metric");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    return {
      ok: false,
      distance_km: 0,
      travel_time_minutes: 0,
      error: `Google Distance Matrix HTTP ${response.status}`
    };
  }

  const payload = (await response.json()) as {
    status?: string;
    rows?: Array<{
      elements?: Array<{
        status?: string;
        distance?: { value?: number };
        duration?: { value?: number };
      }>;
    }>;
  };

  if (payload.status !== "OK") {
    return {
      ok: false,
      distance_km: 0,
      travel_time_minutes: 0,
      error: `Google Distance Matrix status=${payload.status ?? "UNKNOWN"}`
    };
  }

  const element = payload.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return {
      ok: false,
      distance_km: 0,
      travel_time_minutes: 0,
      error: `Distance element status=${element?.status ?? "UNKNOWN"}`
    };
  }

  const distanceMeters = parseNumber(element.distance?.value);
  const durationSeconds = parseNumber(element.duration?.value);
  return {
    ok: true,
    distance_km: Number.parseFloat((distanceMeters / 1000).toFixed(1)),
    travel_time_minutes: Math.max(1, Math.round(durationSeconds / 60)),
    error: ""
  };
}

export async function listDeliveryDrivers() {
  const parsed = await readAdminJsonArray<Partial<DeliveryDriver>>(DRIVERS_STORE);
  const normalized = parsed
    .map((entry) => normalizeDriver(entry))
    .filter((entry) => entry.id && entry.name);
  if (normalized.length === 0) {
    return DEFAULT_DRIVERS.map((entry) => normalizeDriver(entry));
  }
  return normalized;
}

export async function upsertDeliveryDrivers(drivers: DeliveryDriver[]) {
  const now = nowIso();
  const normalized = drivers
    .map((entry) => normalizeDriver(entry))
    .filter((entry) => entry.id && entry.name)
    .map((entry) => ({
      ...entry,
      updated_at: now,
      created_at: cleanText(entry.created_at) || now
    }));
  await writeAdminJsonArray(DRIVERS_STORE, normalized);
  return normalized;
}

export async function listDriverUnavailabilities() {
  const parsed = await readAdminJsonArray<Partial<DriverUnavailability>>(DRIVER_UNAVAILABILITIES_STORE);
  return parsed
    .map((entry) => normalizeDriverUnavailability(entry))
    .filter((entry) => entry.driver_id && entry.start_date);
}

export async function createDriverUnavailability(input: Partial<DriverUnavailability>) {
  const next = normalizeDriverUnavailability(input);
  const all = await listDriverUnavailabilities();
  all.unshift(next);
  await writeAdminJsonArray(DRIVER_UNAVAILABILITIES_STORE, all);
  return next;
}

export async function updateDriverUnavailability(id: string, updates: Partial<DriverUnavailability>) {
  const all = await listDriverUnavailabilities();
  const index = all.findIndex((entry) => entry.id === cleanText(id));
  if (index === -1) {
    throw new Error("Indisponibilite introuvable.");
  }
  all[index] = normalizeDriverUnavailability({
    ...all[index],
    ...updates,
    id: all[index].id,
    updated_at: nowIso()
  });
  await writeAdminJsonArray(DRIVER_UNAVAILABILITIES_STORE, all);
  return all[index];
}

export async function deleteDriverUnavailability(id: string) {
  const all = await listDriverUnavailabilities();
  const next = all.filter((entry) => entry.id !== cleanText(id));
  await writeAdminJsonArray(DRIVER_UNAVAILABILITIES_STORE, next);
  return true;
}

export type DriverDependencySummary = {
  assignment_count: number;
  unavailability_count: number;
  event_count: number;
  has_dependencies: boolean;
};

export type DeleteOrDeactivateDriverResult = {
  action: "deleted" | "deactivated";
  driver: DeliveryDriver;
  dependencies: DriverDependencySummary;
  drivers: DeliveryDriver[];
};

function buildDependencySummary(input: {
  assignmentCount: number;
  unavailabilityCount: number;
  eventCount?: number;
}): DriverDependencySummary {
  const assignmentCount = Math.max(0, Math.floor(input.assignmentCount));
  const unavailabilityCount = Math.max(0, Math.floor(input.unavailabilityCount));
  const eventCount = Math.max(0, Math.floor(input.eventCount ?? 0));
  return {
    assignment_count: assignmentCount,
    unavailability_count: unavailabilityCount,
    event_count: eventCount,
    has_dependencies: assignmentCount + unavailabilityCount + eventCount > 0
  };
}

export async function getDriverDependencySummary(
  driverIdInput: string,
  options: { event_count?: number } = {}
): Promise<DriverDependencySummary> {
  const driverId = cleanText(driverIdInput);
  if (!driverId) {
    return buildDependencySummary({
      assignmentCount: 0,
      unavailabilityCount: 0,
      eventCount: options.event_count
    });
  }

  const [assignments, unavailabilities] = await Promise.all([
    readAdminJsonArray<Partial<DeliveryAssignment>>(DELIVERY_ASSIGNMENTS_STORE),
    listDriverUnavailabilities()
  ]);

  return buildDependencySummary({
    assignmentCount: assignments.filter((assignment) => cleanText(assignment.assigned_driver_id) === driverId).length,
    unavailabilityCount: unavailabilities.filter((entry) => entry.driver_id === driverId).length,
    eventCount: options.event_count
  });
}

export async function deleteOrDeactivateDeliveryDriver(
  driverIdInput: string,
  options: { event_count?: number } = {}
): Promise<DeleteOrDeactivateDriverResult> {
  const driverId = cleanText(driverIdInput);
  if (!driverId) {
    throw new Error("driver_id manquant.");
  }

  const drivers = await listDeliveryDrivers();
  const index = drivers.findIndex((driver) => driver.id === driverId);
  if (index === -1) {
    throw new Error("Livreur introuvable.");
  }

  const driver = drivers[index];
  const dependencies = await getDriverDependencySummary(driverId, options);

  if (!dependencies.has_dependencies) {
    const nextDrivers = drivers.filter((entry) => entry.id !== driverId);
    await writeAdminJsonArray(DRIVERS_STORE, nextDrivers);
    return {
      action: "deleted",
      driver,
      dependencies,
      drivers: nextDrivers
    };
  }

  const deactivatedDriver = {
    ...driver,
    active: false,
    updated_at: nowIso()
  };
  const nextDrivers = drivers.map((entry) => (entry.id === driverId ? deactivatedDriver : entry));
  await writeAdminJsonArray(DRIVERS_STORE, nextDrivers);
  return {
    action: "deactivated",
    driver: deactivatedDriver,
    dependencies,
    drivers: nextDrivers
  };
}

export type DriverEventInput = {
  event_date: string;
  event_start_time?: string;
  event_end_time?: string;
  delivery_time?: string;
  return_date?: string;
  return_time?: string;
  event_address?: string;
  booth_quantity?: number;
  exclude_assignment_id?: string;
};

export type AvailableDriverItem = {
  driver_id: string;
  driver_name: string;
  driver_address: string;
  booth_stock: number;
  booked_booths: number;
  remaining_stock: number;
};

export type DriverAvailabilityResult = {
  available_drivers: AvailableDriverItem[];
  unavailable_drivers: DriverAvailabilitySnapshotItem[];
};

export async function getAvailableDriversForEvent(input: DriverEventInput): Promise<DriverAvailabilityResult> {
  const boothQuantity = Math.max(1, Math.floor(parseNumber(input.booth_quantity) || 1));
  const eventRange = buildEventRange(input);
  if (!eventRange) {
    return {
      available_drivers: [],
      unavailable_drivers: []
    };
  }

  const [drivers, unavailabilities, assignments] = await Promise.all([
    listDeliveryDrivers(),
    listDriverUnavailabilities(),
    readAdminJsonArray<Partial<DeliveryAssignment>>(DELIVERY_ASSIGNMENTS_STORE)
  ]);
  const excludeAssignmentId = cleanText(input.exclude_assignment_id);

  const availableDrivers: AvailableDriverItem[] = [];
  const unavailableDrivers: DriverAvailabilitySnapshotItem[] = [];

  for (const driver of drivers) {
    const boothStock = normalizeBoothStock(driver.booth_stock);
    const driverAssignments = assignments.filter(
      (assignment) =>
        cleanText(assignment.id) !== excludeAssignmentId &&
        cleanText(assignment.assigned_driver_id) === driver.id &&
        ACTIVE_ASSIGNMENT_STATUSES.has(cleanText(assignment.status))
    );

    const bookedBooths = driverAssignments.reduce((sum, assignment) => {
      const assignmentRange = buildAssignmentRange(assignment);
      if (!assignmentRange || !rangesOverlap(eventRange, assignmentRange)) {
        return sum;
      }
      const qty = Math.max(1, Math.floor(parseNumber(assignment.booth_quantity) || 1));
      return sum + qty;
    }, 0);

    const remainingStock = Math.max(0, boothStock - bookedBooths);
    const snapshotBase = {
      driver_id: driver.id,
      driver_name: driver.name,
      booth_stock: boothStock,
      booked_booths: bookedBooths,
      remaining_stock: remainingStock
    };

    if (!driver.active) {
      unavailableDrivers.push({ ...snapshotBase, reason: "inactive" });
      continue;
    }

    const hasAbsence = unavailabilities.some((entry) => {
      if (entry.driver_id !== driver.id) {
        return false;
      }
      const unavailableRange = buildUnavailabilityRange(entry);
      if (!unavailableRange) {
        return false;
      }
      return rangesOverlap(eventRange, unavailableRange);
    });

    if (hasAbsence) {
      unavailableDrivers.push({ ...snapshotBase, reason: "absence" });
      continue;
    }

    if (remainingStock < boothQuantity) {
      unavailableDrivers.push({ ...snapshotBase, reason: "stock_full" });
      continue;
    }

    availableDrivers.push({
      driver_id: driver.id,
      driver_name: driver.name,
      driver_address: driver.address,
      booth_stock: boothStock,
      booked_booths: bookedBooths,
      remaining_stock: remainingStock
    });
  }

  return {
    available_drivers: availableDrivers,
    unavailable_drivers: unavailableDrivers
  };
}

export type AvailableDriverRecommendation = {
  status: DeliveryDistanceStatus;
  available: boolean;
  distance_message: string;
  recommended_driver_id: string;
  recommended_driver_name: string;
  driver_start_address: string;
  distance_km: number;
  travel_time_minutes: number;
  delivery_fee: number;
  fee_label: string;
  available_drivers_count: number;
  unavailable_reasons: DriverAvailabilitySnapshotItem[];
};

function emptyRecommendation(
  status: DeliveryDistanceStatus,
  message: string,
  unavailable: DriverAvailabilitySnapshotItem[] = []
): AvailableDriverRecommendation {
  return {
    status,
    available: false,
    distance_message: message,
    recommended_driver_id: "",
    recommended_driver_name: "",
    driver_start_address: "",
    distance_km: 0,
    travel_time_minutes: 0,
    delivery_fee: 0,
    fee_label: "A confirmer",
    available_drivers_count: 0,
    unavailable_reasons: unavailable
  };
}

export async function recommendAvailableDriver(input: DriverEventInput): Promise<AvailableDriverRecommendation> {
  const eventAddress = cleanText(input.event_address);
  const availability = await getAvailableDriversForEvent(input);
  if (availability.available_drivers.length === 0) {
    return emptyRecommendation(
      "no_driver_available",
      "Aucun livreur disponible avec stock suffisant.",
      availability.unavailable_drivers
    );
  }

  const apiKey = cleanText(process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey || !eventAddress) {
    return {
      ...emptyRecommendation(
        "manual_required",
        !eventAddress
          ? "Adresse evenement manquante. Frais a confirmer manuellement."
          : "GOOGLE_MAPS_API_KEY absente. Frais a confirmer manuellement.",
        availability.unavailable_drivers
      ),
      available_drivers_count: availability.available_drivers.length
    };
  }

  const distanceResults: Array<{
    driver: AvailableDriverItem;
    distance_km: number;
    travel_time_minutes: number;
  }> = [];

  for (const driver of availability.available_drivers) {
    if (!cleanText(driver.driver_address)) {
      continue;
    }
    const distance = await fetchDriverDistance(driver.driver_address, eventAddress, apiKey);
    if (!distance.ok) {
      continue;
    }
    distanceResults.push({
      driver,
      distance_km: distance.distance_km,
      travel_time_minutes: distance.travel_time_minutes
    });
  }

  if (distanceResults.length === 0) {
    return {
      ...emptyRecommendation(
        "manual_required",
        "Distance impossible a calculer automatiquement pour les livreurs disponibles.",
        availability.unavailable_drivers
      ),
      available_drivers_count: availability.available_drivers.length
    };
  }

  distanceResults.sort((a, b) => a.distance_km - b.distance_km);
  const best = distanceResults[0];
  const fee = calculateDeliveryFee(best.distance_km);

  return {
    status: "calculated",
    available: true,
    distance_message: "Livreur disponible le plus proche calcule automatiquement.",
    recommended_driver_id: best.driver.driver_id,
    recommended_driver_name: best.driver.driver_name,
    driver_start_address: best.driver.driver_address,
    distance_km: fee.distance_km,
    travel_time_minutes: best.travel_time_minutes,
    delivery_fee: fee.delivery_fee,
    fee_label: fee.fee_label,
    available_drivers_count: availability.available_drivers.length,
    unavailable_reasons: availability.unavailable_drivers
  };
}

export type DriverDistanceOnlyEstimate = {
  status: DeliveryDistanceStatus;
  distance_message: string;
  recommended_driver_id: string;
  recommended_driver_name: string;
  driver_start_address: string;
  distance_km: number;
  travel_time_minutes: number;
  delivery_fee: number;
  fee_label: string;
};

export async function estimateDriverDistanceOnly(
  eventAddressInput: string,
  driverIdInput: string
): Promise<DriverDistanceOnlyEstimate> {
  const eventAddress = cleanText(eventAddressInput);
  const driverId = cleanText(driverIdInput);
  const drivers = await listDeliveryDrivers();
  const selected = drivers.find((driver) => driver.id === driverId);

  if (!selected) {
    return {
      status: "error",
      distance_message: "Livreur introuvable.",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  const selectedAddress = cleanText(selected.address);
  const apiKey = cleanText(process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey || !eventAddress || !selectedAddress) {
    return {
      status: "manual_required",
      distance_message: "Distance a confirmer manuellement pour le livreur selectionne.",
      recommended_driver_id: selected.id,
      recommended_driver_name: selected.name,
      driver_start_address: selectedAddress,
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  const distance = await fetchDriverDistance(selectedAddress, eventAddress, apiKey);
  if (!distance.ok) {
    return {
      status: "error",
      distance_message: distance.error || "Distance non calculee pour le livreur selectionne.",
      recommended_driver_id: selected.id,
      recommended_driver_name: selected.name,
      driver_start_address: selectedAddress,
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  const fee = calculateDeliveryFee(distance.distance_km);
  return {
    status: "calculated",
    distance_message: "Distance calculee pour le livreur selectionne.",
    recommended_driver_id: selected.id,
    recommended_driver_name: selected.name,
    driver_start_address: selectedAddress,
    distance_km: fee.distance_km,
    travel_time_minutes: distance.travel_time_minutes,
    delivery_fee: fee.delivery_fee,
    fee_label: fee.fee_label
  };
}

export async function estimateNearestDriverDistanceOnly(
  eventAddressInput: string
): Promise<DriverDistanceOnlyEstimate> {
  const eventAddress = cleanText(eventAddressInput);
  const apiKey = cleanText(process.env.GOOGLE_MAPS_API_KEY);

  if (!eventAddress) {
    return {
      status: "manual_required",
      distance_message: "Adresse evenement manquante. Frais a confirmer manuellement.",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  if (!apiKey) {
    return {
      status: "manual_required",
      distance_message: "GOOGLE_MAPS_API_KEY absente. Frais a confirmer manuellement.",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  const drivers = (await listDeliveryDrivers()).filter(
    (driver) => driver.active && cleanText(driver.address)
  );

  if (drivers.length === 0) {
    return {
      status: "no_driver_available",
      distance_message: "Aucune base Event Pic active avec adresse de depart.",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  const distances: Array<{
    driver: DeliveryDriver;
    distance_km: number;
    travel_time_minutes: number;
  }> = [];

  for (const driver of drivers) {
    const distance = await fetchDriverDistance(driver.address, eventAddress, apiKey);
    if (!distance.ok) {
      continue;
    }
    distances.push({
      driver,
      distance_km: distance.distance_km,
      travel_time_minutes: distance.travel_time_minutes
    });
  }

  if (distances.length === 0) {
    return {
      status: "manual_required",
      distance_message: "Distance impossible a calculer automatiquement depuis les bases Event Pic.",
      recommended_driver_id: "",
      recommended_driver_name: "",
      driver_start_address: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0,
      fee_label: "A confirmer"
    };
  }

  distances.sort((a, b) => a.distance_km - b.distance_km);
  const best = distances[0];
  const fee = calculateDeliveryFee(best.distance_km);

  return {
    status: "calculated",
    distance_message: "Base Event Pic la plus proche calculee automatiquement.",
    recommended_driver_id: best.driver.id,
    recommended_driver_name: best.driver.name,
    driver_start_address: best.driver.address,
    distance_km: fee.distance_km,
    travel_time_minutes: best.travel_time_minutes,
    delivery_fee: fee.delivery_fee,
    fee_label: fee.fee_label
  };
}

export async function recommendSpecificAvailableDriver(
  input: DriverEventInput,
  driverIdInput: string
) {
  const driverId = cleanText(driverIdInput);
  if (!driverId) {
    return emptyRecommendation("manual_required", "Livreur manquant.");
  }
  const availability = await getAvailableDriversForEvent(input);
  const selected = availability.available_drivers.find((driver) => driver.driver_id === driverId);
  if (!selected) {
    return emptyRecommendation(
      "no_driver_available",
      "Livreur indisponible sur cette periode (absence ou stock complet).",
      availability.unavailable_drivers
    );
  }

  const eventAddress = cleanText(input.event_address);
  const apiKey = cleanText(process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey || !eventAddress) {
    return {
      ...emptyRecommendation(
        "manual_required",
        "Distance a confirmer manuellement pour le livreur selectionne.",
        availability.unavailable_drivers
      ),
      available_drivers_count: availability.available_drivers.length
    };
  }

  const distance = await fetchDriverDistance(selected.driver_address, eventAddress, apiKey);
  if (!distance.ok) {
    return {
      ...emptyRecommendation(
        "error",
        distance.error || "Distance non calculee pour le livreur selectionne.",
        availability.unavailable_drivers
      ),
      available_drivers_count: availability.available_drivers.length
    };
  }

  const fee = calculateDeliveryFee(distance.distance_km);
  return {
    status: "calculated" as const,
    available: true,
    distance_message: "Livreur selectionne disponible et distance calculee.",
    recommended_driver_id: selected.driver_id,
    recommended_driver_name: selected.driver_name,
    driver_start_address: selected.driver_address,
    distance_km: fee.distance_km,
    travel_time_minutes: distance.travel_time_minutes,
    delivery_fee: fee.delivery_fee,
    fee_label: fee.fee_label,
    available_drivers_count: availability.available_drivers.length,
    unavailable_reasons: availability.unavailable_drivers
  };
}
