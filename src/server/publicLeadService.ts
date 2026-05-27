import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EVENT_PIC_OPTIONS,
  EVENT_PIC_PHOTOBOOTH_PACKAGES,
  EVENT_PIC_QUOTE_STATUSES,
  DeliveryDistanceStatus,
  DriverAvailabilitySnapshotItem,
  EventPicContactRequest,
  EventPicQuoteRequest,
  EventPicQuoteStatus
} from "@/src/shared/eventPicPublic";
import {
  estimateDriverDistanceOnly,
  estimateFeeFromManualDistance,
  estimateNearestDriverForEvent,
  estimateSpecificDriverForEvent
} from "@/src/server/deliveryDistanceService";

const quoteRequestsPath = path.join(process.cwd(), "data", "quote-requests.json");
const contactRequestsPath = path.join(process.cwd(), "data", "contact-requests.json");

type QuoteRequestInput = Omit<EventPicQuoteRequest, "id" | "created_at" | "status" | "deposit"> & {
  deposit?: number;
  package_id?: string;
  option_ids?: string[];
  custom_quote?: boolean;
};

type ContactRequestInput = Omit<EventPicContactRequest, "id" | "created_at" | "status">;

const VALID_QUOTE_STATUSES = new Set<EventPicQuoteStatus>(
  EVENT_PIC_QUOTE_STATUSES.map((status) => status.id)
);

const PACKAGE_BY_ID = new Map<string, (typeof EVENT_PIC_PHOTOBOOTH_PACKAGES)[number]>(
  EVENT_PIC_PHOTOBOOTH_PACKAGES.map((item) => [item.id, item])
);
const PACKAGE_BY_LABEL = new Map<string, (typeof EVENT_PIC_PHOTOBOOTH_PACKAGES)[number]>(
  EVENT_PIC_PHOTOBOOTH_PACKAGES.map((item) => [item.label.toLowerCase(), item])
);
const OPTION_BY_ID = new Map<string, (typeof EVENT_PIC_OPTIONS)[number]>(
  EVENT_PIC_OPTIONS.map((item) => [item.id, item])
);
const OPTION_ID_BY_LABEL = new Map<string, string>(
  EVENT_PIC_OPTIONS.map((item) => [item.label.toLowerCase(), item.id])
);

function isValidQuoteStatus(value: unknown): value is EventPicQuoteStatus {
  return typeof value === "string" && VALID_QUOTE_STATUSES.has(value as EventPicQuoteStatus);
}

async function ensureDataFile(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

async function readArrayFile<T>(filePath: string): Promise<T[]> {
  await ensureDataFile(filePath);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as T[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed;
}

async function writeArrayFile<T>(filePath: string, entries: T[]) {
  await ensureDataFile(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value: unknown, field: string) {
  const text = cleanText(value);
  if (!text) {
    throw new Error(`Champ obligatoire manquant : ${field}.`);
  }
  return text;
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => cleanText(entry))
    .filter((entry) => entry.length > 0)
    .slice(0, 8);
}

function normalizeMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  return 0;
}

function normalizeDecimal(value: unknown, digits = 1) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Number.parseFloat(value.toFixed(digits));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Number.parseFloat(parsed.toFixed(digits));
    }
  }
  return 0;
}

function normalizeDistanceStatus(value: unknown): DeliveryDistanceStatus {
  if (
    value === "calculated" ||
    value === "manual_required" ||
    value === "no_driver_available" ||
    value === "error"
  ) {
    return value;
  }
  return "manual_required";
}

function normalizeBoothQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.floor(parsed));
    }
  }
  return 1;
}

function normalizeOptionalPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return undefined;
}

function normalizeOptionalImpressionLimit(value: unknown) {
  if (value === null) {
    return null;
  }
  return normalizeOptionalPositiveInteger(value);
}

function normalizeAvailabilitySnapshot(value: unknown) {
  const fallback = {
    available_drivers_count: 0,
    unavailable_drivers: [] as DriverAvailabilitySnapshotItem[]
  };
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const record = value as Partial<{
    available_drivers_count: unknown;
    unavailable_drivers: unknown;
  }>;
  const availableDriversCount = Math.max(0, Math.floor(normalizeDecimal(record.available_drivers_count, 0)));
  const unavailableDrivers = Array.isArray(record.unavailable_drivers)
    ? record.unavailable_drivers
        .map((item) => {
          const entry = item as Partial<DriverAvailabilitySnapshotItem>;
          const reason = cleanText(entry.reason) as DriverAvailabilitySnapshotItem["reason"];
          if (reason !== "absence" && reason !== "stock_full" && reason !== "inactive") {
            return null;
          }
          return {
            driver_id: cleanText(entry.driver_id),
            driver_name: cleanText(entry.driver_name),
            reason,
            booth_stock: Math.max(0, Math.floor(normalizeDecimal(entry.booth_stock, 0))),
            booked_booths: Math.max(0, Math.floor(normalizeDecimal(entry.booked_booths, 0))),
            remaining_stock: Math.max(0, Math.floor(normalizeDecimal(entry.remaining_stock, 0)))
          } as DriverAvailabilitySnapshotItem;
        })
        .filter((item): item is DriverAvailabilitySnapshotItem => item !== null)
    : [];
  return {
    available_drivers_count: availableDriversCount,
    unavailable_drivers: unavailableDrivers
  };
}

function normalizeManualDistance(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Number.parseFloat(value.toFixed(1));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Number.parseFloat(parsed.toFixed(1));
    }
  }
  return null;
}

function normalizeOptionIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .map((item) => cleanText(item))
    .filter((item) => OPTION_BY_ID.has(item))
    .slice(0, 8);
}

function resolvePackage(input: Partial<QuoteRequestInput>) {
  const packageId = cleanText(input.package_id);
  if (packageId && PACKAGE_BY_ID.has(packageId)) {
    return { packageId, packageDef: PACKAGE_BY_ID.get(packageId)! };
  }

  const packageLabel = cleanText(input.package).toLowerCase();
  if (packageLabel && PACKAGE_BY_LABEL.has(packageLabel)) {
    const packageDef = PACKAGE_BY_LABEL.get(packageLabel)!;
    return { packageId: packageDef.id, packageDef };
  }

  const fallback = EVENT_PIC_PHOTOBOOTH_PACKAGES[0];
  return { packageId: fallback.id, packageDef: fallback };
}

function normalizeLegacyQuote(entry: EventPicQuoteRequest): EventPicQuoteRequest {
  const { packageId, packageDef } = resolvePackage(entry as Partial<QuoteRequestInput>);
  const optionLabelsInput = normalizeOptions((entry as Partial<EventPicQuoteRequest>).options);
  const optionIdsStored = normalizeOptionIds((entry as Partial<EventPicQuoteRequest>).option_ids);
  const optionIds =
    optionIdsStored.length > 0
      ? optionIdsStored
      : optionLabelsInput
          .map((label) => OPTION_ID_BY_LABEL.get(label.toLowerCase()) ?? "")
          .filter((optionId) => optionId.length > 0);
  const optionLabelsFromIds = optionIds
    .map((optionId) => OPTION_BY_ID.get(optionId)?.label ?? "")
    .filter((label) => label.length > 0);
  const customLabels = optionLabelsInput.filter(
    (label) => !OPTION_ID_BY_LABEL.has(label.toLowerCase())
  );
  const optionLabels = [...optionLabelsFromIds, ...customLabels];
  const estimatedTotalWithoutDelivery = normalizeMoney(
    (entry as Partial<EventPicQuoteRequest>).estimated_total_without_delivery
  );
  const estimatedTotalWithDelivery = normalizeMoney(
    (entry as Partial<EventPicQuoteRequest>).estimated_total_with_delivery ||
      (entry as Partial<EventPicQuoteRequest>).estimated_total
  );
  const recommendedDriverId = cleanText((entry as Partial<EventPicQuoteRequest>).recommended_driver_id);
  const recommendedDriverName = cleanText(
    (entry as Partial<EventPicQuoteRequest>).recommended_driver_name
  );
  const driverStartAddress = cleanText(
    (entry as Partial<EventPicQuoteRequest>).driver_start_address
  );
  const distanceKm = normalizeDecimal((entry as Partial<EventPicQuoteRequest>).distance_km, 1);
  const travelTime = normalizeDecimal(
    (entry as Partial<EventPicQuoteRequest>).travel_time_minutes,
    0
  );
  const deliveryFee = normalizeMoney((entry as Partial<EventPicQuoteRequest>).delivery_fee);
  const estimatedBalance = normalizeMoney(
    (entry as Partial<EventPicQuoteRequest>).estimated_balance
  );
  const boothQuantity = normalizeBoothQuantity(
    (entry as Partial<EventPicQuoteRequest>).booth_quantity
  );
  const availabilityStatus = normalizeDistanceStatus(
    (entry as Partial<EventPicQuoteRequest>).availability_status ??
      (entry as Partial<EventPicQuoteRequest>).distance_status
  );
  const availabilitySnapshot = normalizeAvailabilitySnapshot(
    (entry as Partial<EventPicQuoteRequest>).driver_availability_snapshot
  );

  return {
    ...entry,
    event_address: cleanText((entry as Partial<EventPicQuoteRequest>).event_address),
    delivery_time: cleanText((entry as Partial<EventPicQuoteRequest>).delivery_time),
    return_date: cleanText((entry as Partial<EventPicQuoteRequest>).return_date),
    return_time: cleanText((entry as Partial<EventPicQuoteRequest>).return_time),
    booth_quantity: boothQuantity,
    package_id: packageId,
    package: cleanText((entry as Partial<EventPicQuoteRequest>).package) || packageDef.label,
    option_ids: optionIds,
    options: optionLabels,
    custom_quote: (entry as Partial<EventPicQuoteRequest>).custom_quote === true,
    recommended_driver_id: recommendedDriverId,
    recommended_driver_name: recommendedDriverName,
    driver_start_address: driverStartAddress,
    distance_km: distanceKm,
    travel_time_minutes: travelTime,
    delivery_fee: deliveryFee,
    estimated_total_without_delivery:
      estimatedTotalWithoutDelivery ||
      Math.max(estimatedTotalWithDelivery - deliveryFee, 0),
    estimated_total_with_delivery: estimatedTotalWithDelivery,
    distance_status: normalizeDistanceStatus(
      (entry as Partial<EventPicQuoteRequest>).distance_status
    ),
    availability_status: availabilityStatus,
    driver_availability_snapshot: availabilitySnapshot,
    estimated_total: estimatedTotalWithDelivery || normalizeMoney(entry.estimated_total),
    estimated_balance:
      estimatedBalance || Math.max(estimatedTotalWithDelivery - normalizeMoney(entry.deposit), 0)
  };
}

function normalizeLegacyContact(entry: EventPicContactRequest): EventPicContactRequest {
  return {
    ...entry,
    event_address: cleanText((entry as Partial<EventPicContactRequest>).event_address),
    guest_count: normalizeOptionalPositiveInteger(
      (entry as Partial<EventPicContactRequest>).guest_count
    ),
    estimated_prints_need: normalizeOptionalPositiveInteger(
      (entry as Partial<EventPicContactRequest>).estimated_prints_need
    ),
    selected_formula: cleanText((entry as Partial<EventPicContactRequest>).selected_formula),
    recommended_formula: cleanText(
      (entry as Partial<EventPicContactRequest>).recommended_formula
    ),
    recommended_formula_prints: normalizeOptionalImpressionLimit(
      (entry as Partial<EventPicContactRequest>).recommended_formula_prints
    ),
    formula_insufficient:
      typeof (entry as Partial<EventPicContactRequest>).formula_insufficient === "boolean"
        ? (entry as Partial<EventPicContactRequest>).formula_insufficient
        : false
  };
}

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function listQuoteRequests() {
  const entries = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  return entries
    .map(normalizeLegacyQuote)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listContactRequests() {
  const entries = await readArrayFile<EventPicContactRequest>(contactRequestsPath);
  return entries
    .map(normalizeLegacyContact)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createQuoteRequest(input: Partial<QuoteRequestInput>) {
  const name = requireText(input.name, "name");
  const email = requireText(input.email, "email");
  const phone = requireText(input.phone, "phone");
  const eventType = requireText(input.event_type, "event_type");
  const eventDate = cleanText(input.event_date);
  const eventAddress = cleanText(input.event_address);
  const deliveryTime = cleanText(input.delivery_time);
  const returnDate = cleanText(input.return_date);
  const returnTime = cleanText(input.return_time);
  const boothQuantity = normalizeBoothQuantity(input.booth_quantity);
  const message = cleanText(input.message);

  if (!validateEmail(email)) {
    throw new Error("Adresse email invalide.");
  }

  const { packageId, packageDef } = resolvePackage(input);
  const packageLabel = packageDef.label;
  const optionIds = normalizeOptionIds(input.option_ids);
  const optionLabelsFromIds = optionIds.map((optionId) => OPTION_BY_ID.get(optionId)!.label as string);
  const optionLabels = [
    ...optionLabelsFromIds,
    ...normalizeOptions(input.options).filter((label) => !optionLabelsFromIds.includes(label))
  ];

  const estimatedTotalWithoutDeliveryInput = normalizeMoney(
    input.estimated_total_without_delivery ?? input.estimated_total
  );
  const customQuote = Boolean(input.custom_quote);
  const computedBaseTotal =
    customQuote || packageDef.price === null
      ? estimatedTotalWithoutDeliveryInput
      : packageDef.price +
        optionIds.reduce((sum, optionId) => sum + OPTION_BY_ID.get(optionId)!.price, 0);
  const estimatedTotalWithoutDelivery =
    computedBaseTotal || estimatedTotalWithoutDeliveryInput;

  const deliveryEstimate = await estimateNearestDriverForEvent(eventAddress, {
    event_date: eventDate,
    event_start_time: deliveryTime,
    delivery_time: deliveryTime,
    return_date: returnDate || eventDate,
    return_time: returnTime,
    booth_quantity: boothQuantity
  });
  const manualDeliveryFee = normalizeMoney(input.delivery_fee);
  const hasManualDeliveryFee = manualDeliveryFee > 0;
  const deliveryFee = hasManualDeliveryFee
    ? manualDeliveryFee
    : deliveryEstimate.distance_status === "calculated"
      ? deliveryEstimate.delivery_fee
      : 0;
  const depositAmount = normalizeMoney(input.deposit) || 100;
  const estimatedTotalWithDelivery = Math.max(
    estimatedTotalWithoutDelivery + deliveryFee,
    0
  );
  const estimatedBalance = Math.max(estimatedTotalWithDelivery - depositAmount, 0);
  const now = new Date().toISOString();

  const nextEntry: EventPicQuoteRequest = {
    id: randomUUID(),
    created_at: now,
    name,
    email,
    phone,
    event_type: eventType,
    event_date: eventDate,
    event_address: eventAddress,
    delivery_time: deliveryTime,
    return_date: returnDate,
    return_time: returnTime,
    booth_quantity: boothQuantity,
    package_id: packageId,
    package: packageLabel,
    option_ids: optionIds,
    options: optionLabels,
    custom_quote: customQuote,
    recommended_driver_id: deliveryEstimate.recommended_driver_id,
    recommended_driver_name: deliveryEstimate.recommended_driver_name,
    driver_start_address: deliveryEstimate.driver_start_address,
    distance_km: deliveryEstimate.distance_km,
    travel_time_minutes: deliveryEstimate.travel_time_minutes,
    delivery_fee: deliveryFee,
    estimated_total_without_delivery: estimatedTotalWithoutDelivery,
    estimated_total_with_delivery: estimatedTotalWithDelivery,
    distance_status: hasManualDeliveryFee ? "calculated" : deliveryEstimate.distance_status,
    availability_status:
      hasManualDeliveryFee
        ? "calculated"
        : deliveryEstimate.availability_status ?? deliveryEstimate.distance_status,
    driver_availability_snapshot: {
      available_drivers_count: deliveryEstimate.available_drivers_count ?? 0,
      unavailable_drivers: deliveryEstimate.unavailable_reasons ?? []
    },
    estimated_total: estimatedTotalWithDelivery,
    deposit: depositAmount,
    estimated_balance: estimatedBalance,
    message,
    status: "new"
  };

  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  existing.unshift(nextEntry);
  await writeArrayFile(quoteRequestsPath, existing);

  return nextEntry;
}

export async function createContactRequest(input: Partial<ContactRequestInput>) {
  const name = requireText(input.name, "name");
  const email = requireText(input.email, "email");
  const phone = requireText(input.phone, "phone");
  const eventType = cleanText(input.event_type);
  const eventDate = cleanText(input.event_date);
  const eventAddress = cleanText(input.event_address);
  const message = requireText(input.message, "message");
  const guestCount = normalizeOptionalPositiveInteger(input.guest_count);
  const estimatedPrintsNeed = normalizeOptionalPositiveInteger(input.estimated_prints_need);
  const selectedFormula = cleanText(input.selected_formula);
  const recommendedFormula = cleanText(input.recommended_formula);
  const recommendedFormulaPrints = normalizeOptionalImpressionLimit(input.recommended_formula_prints);
  const formulaInsufficient = input.formula_insufficient === true;

  if (!validateEmail(email)) {
    throw new Error("Adresse email invalide.");
  }

  const now = new Date().toISOString();
  const nextEntry: EventPicContactRequest = {
    id: randomUUID(),
    created_at: now,
    name,
    email,
    phone,
    event_type: eventType,
    event_date: eventDate,
    event_address: eventAddress,
    message,
    guest_count: guestCount,
    estimated_prints_need: estimatedPrintsNeed,
    selected_formula: selectedFormula,
    recommended_formula: recommendedFormula,
    recommended_formula_prints: recommendedFormulaPrints,
    formula_insufficient: formulaInsufficient,
    status: "new"
  };

  const existing = await readArrayFile<EventPicContactRequest>(contactRequestsPath);
  existing.unshift(nextEntry);
  await writeArrayFile(contactRequestsPath, existing);

  return nextEntry;
}

export async function updateQuoteRequestStatus(id: string, status: EventPicQuoteStatus) {
  if (!isValidQuoteStatus(status)) {
    throw new Error("Statut devis invalide.");
  }

  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);

  if (index === -1) {
    throw new Error("Demande devis introuvable.");
  }

  existing[index] = {
    ...existing[index],
    status
  };

  await writeArrayFile(quoteRequestsPath, existing);
  return existing[index];
}

export async function updateQuoteRequestDeliveryData(
  id: string,
  updates: Partial<
    Pick<
      EventPicQuoteRequest,
      | "recommended_driver_id"
      | "recommended_driver_name"
      | "driver_start_address"
      | "distance_km"
      | "travel_time_minutes"
      | "delivery_fee"
      | "distance_status"
      | "availability_status"
      | "driver_availability_snapshot"
      | "booth_quantity"
      | "estimated_total_without_delivery"
      | "estimated_total_with_delivery"
      | "estimated_total"
      | "estimated_balance"
    >
  >
) {
  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);

  if (index === -1) {
    throw new Error("Demande devis introuvable.");
  }

  const current = normalizeLegacyQuote(existing[index]);
  const nextWithout = normalizeMoney(
    updates.estimated_total_without_delivery ?? current.estimated_total_without_delivery
  );
  const nextFee = normalizeMoney(updates.delivery_fee ?? current.delivery_fee);
  const nextWith = normalizeMoney(
    updates.estimated_total_with_delivery ?? nextWithout + nextFee
  );

  existing[index] = {
    ...current,
    recommended_driver_id:
      updates.recommended_driver_id !== undefined
        ? cleanText(updates.recommended_driver_id)
        : current.recommended_driver_id,
    recommended_driver_name:
      updates.recommended_driver_name !== undefined
        ? cleanText(updates.recommended_driver_name)
        : current.recommended_driver_name,
    driver_start_address:
      updates.driver_start_address !== undefined
        ? cleanText(updates.driver_start_address)
        : current.driver_start_address,
    distance_km:
      updates.distance_km !== undefined
        ? normalizeDecimal(updates.distance_km, 1)
        : current.distance_km,
    travel_time_minutes:
      updates.travel_time_minutes !== undefined
        ? normalizeDecimal(updates.travel_time_minutes, 0)
        : current.travel_time_minutes,
    delivery_fee: nextFee,
    booth_quantity:
      updates.booth_quantity !== undefined
        ? normalizeBoothQuantity(updates.booth_quantity)
        : current.booth_quantity,
    estimated_total_without_delivery: nextWithout,
    estimated_total_with_delivery: nextWith,
    estimated_total: nextWith,
    estimated_balance: Math.max(nextWith - 100, 0),
    distance_status:
      updates.distance_status !== undefined
        ? normalizeDistanceStatus(updates.distance_status)
        : current.distance_status,
    availability_status:
      updates.availability_status !== undefined
        ? normalizeDistanceStatus(updates.availability_status)
        : current.availability_status,
    driver_availability_snapshot:
      updates.driver_availability_snapshot !== undefined
        ? normalizeAvailabilitySnapshot(updates.driver_availability_snapshot)
        : current.driver_availability_snapshot
  };

  await writeArrayFile(quoteRequestsPath, existing);
  return normalizeLegacyQuote(existing[index]);
}

export async function recalculateQuoteRequestDelivery(
  id: string,
  driverId?: string,
  options?: {
    force_when_unavailable?: boolean;
  }
) {
  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);
  if (index === -1) {
    throw new Error("Demande devis introuvable.");
  }

  const current = normalizeLegacyQuote(existing[index]);
  const eventAddress = cleanText(current.event_address);
  if (!eventAddress) {
    throw new Error("Adresse evenement manquante.");
  }

  const selectedDriverId = cleanText(driverId);
  const forceWhenUnavailable = options?.force_when_unavailable === true;
  const estimate = selectedDriverId
    ? await estimateSpecificDriverForEvent(eventAddress, selectedDriverId, {
        event_date: current.event_date,
        event_start_time: current.delivery_time,
        delivery_time: current.delivery_time,
        return_date: current.return_date || current.event_date,
        return_time: current.return_time,
        booth_quantity: current.booth_quantity
      })
    : await estimateNearestDriverForEvent(eventAddress, {
        event_date: current.event_date,
        event_start_time: current.delivery_time,
        delivery_time: current.delivery_time,
        return_date: current.return_date || current.event_date,
        return_time: current.return_time,
        booth_quantity: current.booth_quantity
      });

  if (selectedDriverId && estimate.distance_status === "no_driver_available") {
    if (!forceWhenUnavailable) {
      throw new Error(
        "Livreur indisponible sur cette periode (absence ou stock complet). Utilisez 'Forcer malgre indisponibilite' si necessaire."
      );
    }

    const forcedDistance = await estimateDriverDistanceOnly(eventAddress, selectedDriverId);
    const deliveryFee = forcedDistance.status === "calculated" ? forcedDistance.delivery_fee : 0;
    const totalWithDelivery = current.estimated_total_without_delivery + deliveryFee;

    return await updateQuoteRequestDeliveryData(id, {
      recommended_driver_id: forcedDistance.recommended_driver_id,
      recommended_driver_name: forcedDistance.recommended_driver_name,
      driver_start_address: forcedDistance.driver_start_address,
      distance_km: forcedDistance.distance_km,
      travel_time_minutes: forcedDistance.travel_time_minutes,
      delivery_fee: deliveryFee,
      distance_status: forcedDistance.status,
      availability_status: "no_driver_available",
      driver_availability_snapshot: {
        available_drivers_count: estimate.available_drivers_count ?? 0,
        unavailable_drivers: estimate.unavailable_reasons ?? []
      },
      estimated_total_without_delivery: current.estimated_total_without_delivery,
      estimated_total_with_delivery: totalWithDelivery
    });
  }

  const deliveryFee = estimate.distance_status === "calculated" ? estimate.delivery_fee : 0;
  const totalWithDelivery = current.estimated_total_without_delivery + deliveryFee;

  return await updateQuoteRequestDeliveryData(id, {
    recommended_driver_id: estimate.recommended_driver_id,
    recommended_driver_name: estimate.recommended_driver_name,
    driver_start_address: estimate.driver_start_address,
    distance_km: estimate.distance_km,
    travel_time_minutes: estimate.travel_time_minutes,
    delivery_fee: deliveryFee,
    distance_status: estimate.distance_status,
    availability_status: estimate.availability_status ?? estimate.distance_status,
    driver_availability_snapshot: {
      available_drivers_count: estimate.available_drivers_count ?? 0,
      unavailable_drivers: estimate.unavailable_reasons ?? []
    },
    estimated_total_without_delivery: current.estimated_total_without_delivery,
    estimated_total_with_delivery: totalWithDelivery
  });
}

export async function updateQuoteRequestManualDistance(
  id: string,
  manualDistanceKm: number
) {
  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);
  if (index === -1) {
    throw new Error("Demande devis introuvable.");
  }

  const current = normalizeLegacyQuote(existing[index]);
  const normalizedDistance = normalizeManualDistance(manualDistanceKm);
  if (normalizedDistance === null) {
    throw new Error("Distance manuelle invalide.");
  }

  const manualFee = estimateFeeFromManualDistance(normalizedDistance);
  const totalWithDelivery = current.estimated_total_without_delivery + manualFee.delivery_fee;

  return await updateQuoteRequestDeliveryData(id, {
    distance_km: manualFee.distance_km,
    travel_time_minutes: 0,
    delivery_fee: manualFee.delivery_fee,
    distance_status: "calculated",
    availability_status: "calculated",
    estimated_total_without_delivery: current.estimated_total_without_delivery,
    estimated_total_with_delivery: totalWithDelivery
  });
}

export async function updateQuoteRequestRecommendedDriver(
  id: string,
  driverId: string,
  options?: {
    force_when_unavailable?: boolean;
  }
) {
  return await recalculateQuoteRequestDelivery(id, driverId, options);
}

export async function updateQuoteRequestBoothQuantity(
  id: string,
  boothQuantityInput: number
) {
  const boothQuantity = normalizeBoothQuantity(boothQuantityInput);
  await updateQuoteRequestDeliveryData(id, {
    booth_quantity: boothQuantity
  });
  return await recalculateQuoteRequestDelivery(id);
}

export async function updateQuoteRequestOptionSelection(
  id: string,
  optionIdInput: string,
  enabled: boolean
) {
  const optionId = cleanText(optionIdInput);
  if (!OPTION_BY_ID.has(optionId)) {
    throw new Error("Option devis inconnue.");
  }

  const optionDef = OPTION_BY_ID.get(optionId)!;
  const existing = await readArrayFile<EventPicQuoteRequest>(quoteRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);
  if (index === -1) {
    throw new Error("Demande devis introuvable.");
  }

  const current = normalizeLegacyQuote(existing[index]);
  const currentOptionIds = [...current.option_ids];
  const hasOption = currentOptionIds.includes(optionId);
  const nextOptionIds = enabled
    ? hasOption
      ? currentOptionIds
      : [...currentOptionIds, optionId]
    : currentOptionIds.filter((item) => item !== optionId);

  const optionLabelsFromIds = nextOptionIds
    .map((item) => OPTION_BY_ID.get(item)?.label ?? "")
    .filter((item) => item.length > 0);
  const customLabels = normalizeOptions(current.options).filter(
    (label) => !OPTION_ID_BY_LABEL.has(label.toLowerCase())
  );
  const nextOptions = [...optionLabelsFromIds, ...customLabels];

  const currentOptionsTotal = currentOptionIds.reduce(
    (sum, item) => sum + (OPTION_BY_ID.get(item)?.price ?? 0),
    0
  );
  const nextOptionsTotal = nextOptionIds.reduce(
    (sum, item) => sum + (OPTION_BY_ID.get(item)?.price ?? 0),
    0
  );
  const delta = nextOptionsTotal - currentOptionsTotal;
  const nextWithout = Math.max(0, normalizeMoney(current.estimated_total_without_delivery + delta));
  const nextWith = Math.max(0, normalizeMoney(nextWithout + current.delivery_fee));

  existing[index] = {
    ...current,
    option_ids: nextOptionIds,
    options: nextOptions,
    estimated_total_without_delivery: nextWithout,
    estimated_total_with_delivery: nextWith,
    estimated_total: nextWith,
    estimated_balance: Math.max(nextWith - 100, 0)
  };

  await writeArrayFile(quoteRequestsPath, existing);

  const updated = normalizeLegacyQuote(existing[index]);
  return {
    updated,
    option: optionDef
  };
}

export async function updateContactRequestStatus(id: string, status: EventPicQuoteStatus) {
  if (!isValidQuoteStatus(status)) {
    throw new Error("Statut contact invalide.");
  }

  const existing = await readArrayFile<EventPicContactRequest>(contactRequestsPath);
  const index = existing.findIndex((entry) => entry.id === id);

  if (index === -1) {
    throw new Error("Demande contact introuvable.");
  }

  existing[index] = {
    ...existing[index],
    status
  };

  await writeArrayFile(contactRequestsPath, existing);
  return existing[index];
}

export function getQuoteStatusLabel(status: EventPicQuoteStatus) {
  return EVENT_PIC_QUOTE_STATUSES.find((item) => item.id === status)?.label ?? status;
}
