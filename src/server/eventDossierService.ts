import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listDeliveryAssignments } from "@/src/server/deliveryService";
import { listEventPicTemplateRequests } from "@/src/server/eventPicTemplateRequests";
import { listContactRequests, listQuoteRequests } from "@/src/server/publicLeadService";
import type { DeliveryAssignment, EventPicContactRequest, EventPicQuoteRequest } from "@/src/shared/eventPicPublic";
import type { EventPicTemplateRequest } from "@/src/shared/eventPicTemplates";
import {
  DOSSIER_STATUS,
  DossierDeliveryStatus,
  DossierDepositStatus,
  DossierGlobalStatus,
  DossierQuoteStatus,
  DossierSignatureStatus,
  DossierTemplateStatus,
  DossierTimelineEventType,
  EventDossier,
  EventDossierPublicView,
  EventDossierReminderItem,
  EventDossierSignatureAuditTrailItem,
  EventDossierTimelineItem
} from "@/src/shared/eventPicDossiers";

const DOSSIERS_PATH = path.join(process.cwd(), "data", "event-dossiers.json");
const LEGAL_DIR = path.join(process.cwd(), "data", "legal");
const CGV_PATH = path.join(LEGAL_DIR, "cgv-event-pic.md");
const CONDITIONS_PATH = path.join(LEGAL_DIR, "conditions-location.md");

const DEFAULT_CGV = `# Conditions Generales de Vente Event Pic

Version: 2026-05

1. Objet
Les presentes conditions encadrent la prestation de location photobooth Event Pic.

2. Reservation
Un acompte de 100 EUR est demande pour bloquer la date.

3. Solde
Le solde est regle selon les modalites convenues avant la prestation.

4. Materiel et responsabilites
Le client s'engage a garantir un acces adapte et a respecter les consignes d'utilisation.

5. Annulation
Toute annulation est traitee selon les conditions definies au devis.
`;

const DEFAULT_CONDITIONS = `# Conditions de location Event Pic

Version: 2026-05

- Installation et recuperation incluses selon le devis.
- Le client confirme les informations evenementielles transmises.
- Toute modification majeure est a signaler au plus vite.
`;

const CLIENT_TOKEN_TTL_HOURS = 48;

type ListDossiersOptions = {
  sync?: boolean;
};

type SendSignatureResult = {
  mode: "sms" | "manual";
  message: string;
  token: string;
  otp_code: string;
  expires_at: string;
  sms_provider_status: "sent" | "not_configured" | "error";
  sms_error: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
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

function splitName(fullName: string) {
  const cleaned = cleanText(fullName);
  if (!cleaned) {
    return { first_name: "", last_name: "", full_name: "" };
  }
  const parts = cleaned.split(/\s+/g);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "", full_name: cleaned };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
    full_name: cleaned
  };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateInput: string, delta: number) {
  if (!isIsoDate(dateInput)) {
    return "";
  }
  const [year, month, day] = dateInput.split("-").map((item) => Number.parseInt(item, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  if (isIsoDate(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function buildOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function createSecretHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function hashOtp(token: string, otp: string) {
  const secret = cleanText(process.env.SIGNATURE_TOKEN_SECRET) || "event-pic-signature-fallback-secret";
  return createSecretHash(`${secret}:${token}:${otp}`);
}

function createQuoteNumber(quoteId: string, createdAt: string) {
  const year = cleanText(createdAt).slice(0, 4) || `${new Date().getFullYear()}`;
  const suffix = cleanText(quoteId).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || randomUUID().slice(0, 6).toUpperCase();
  return `EP-${year}-${suffix}`;
}

function buildQuoteDocumentUrl(dossierId: string) {
  return `/admin/dossiers/${encodeURIComponent(dossierId)}/documents/devis`;
}

function buildCgvDocumentUrl(dossierId: string) {
  return `/admin/dossiers/${encodeURIComponent(dossierId)}/documents/cgv`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildDefaultDossier(): EventDossier {
  const now = nowIso();
  return {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    client: {
      first_name: "",
      last_name: "",
      full_name: "",
      email: "",
      phone: ""
    },
    event: {
      type: "",
      date: "",
      start_time: "",
      end_time: "",
      address: "",
      guest_count: 0,
      notes: ""
    },
    quote: {
      quote_id: "",
      quote_number: "",
      quote_pdf_url: "",
      package_id: "",
      package_label: "",
      option_ids: [],
      options: [],
      custom_quote: false,
      amount_total: 0,
      deposit_amount: 100,
      balance_amount: 0,
      delivery_fee: 0,
      status: "not_created",
      sent_at: "",
      signed_at: ""
    },
    terms: {
      cgv_version: "2026-05",
      cgv_pdf_url: "",
      cgv_hash: "",
      status: "not_sent",
      signed_at: ""
    },
    signature: {
      signature_method: "sms_otp",
      signature_status: "not_started",
      signature_link_token: "",
      signature_link_expires_at: "",
      otp_sent_at: "",
      otp_verified_at: "",
      signed_ip: "",
      signed_user_agent: "",
      document_hash: "",
      otp_hash: "",
      otp_expires_at: "",
      audit_trail: []
    },
    payment: {
      deposit_status: "not_requested",
      deposit_requested_at: "",
      deposit_received_at: "",
      deposit_method: "manual",
      deposit_reference: "",
      balance_status: "not_due",
      balance_due_at: "",
      balance_paid_at: "",
      notes: ""
    },
    template: {
      template_request_id: "",
      template_name: "",
      status: "not_started",
      client_validated_at: "",
      prepared_at: "",
      sent_to_booth_at: "",
      canva_links_available: 0,
      psd_status: ""
    },
    delivery: {
      delivery_assignment_id: "",
      recommended_driver_id: "",
      assigned_driver_id: "",
      assigned_driver_name: "",
      status: "not_created",
      delivery_time: "",
      pickup_time: "",
      distance_km: 0,
      travel_time_minutes: 0,
      delivery_fee: 0
    },
    post_event: {
      gallery_url: "",
      gallery_sent_at: "",
      review_requested_at: "",
      coupon_sent_at: "",
      status: "not_started"
    },
    global_status: "new",
    internal_notes: "",
    reminders: [],
    history: []
  };
}

function cleanReminders(reminders: unknown): EventDossierReminderItem[] {
  if (!Array.isArray(reminders)) {
    return [];
  }
  return reminders
    .map((entry) => {
      const item = entry as Partial<EventDossierReminderItem>;
      return {
        id: cleanText(item.id),
        label: cleanText(item.label),
        due_date: cleanText(item.due_date),
        checked: item.checked === true
      };
    })
    .filter((item) => item.id && item.label);
}

function cleanTimeline(history: unknown): EventDossierTimelineItem[] {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .map((entry) => {
      const item = entry as Partial<EventDossierTimelineItem>;
      return {
        id: cleanText(item.id) || randomUUID(),
        event: (cleanText(item.event) as DossierTimelineEventType) || "note_added",
        at: cleanText(item.at) || nowIso(),
        label: cleanText(item.label),
        details: cleanText(item.details)
      };
    })
    .filter((item) => item.label);
}

function normalizeDossier(input: Partial<EventDossier>): EventDossier {
  const base = buildDefaultDossier();
  const nameFromInput = splitName(cleanText(input.client?.full_name));
  const cleaned: EventDossier = {
    ...base,
    ...input,
    id: cleanText(input.id) || base.id,
    created_at: cleanText(input.created_at) || base.created_at,
    updated_at: cleanText(input.updated_at) || base.updated_at,
    client: {
      first_name: cleanText(input.client?.first_name) || nameFromInput.first_name,
      last_name: cleanText(input.client?.last_name) || nameFromInput.last_name,
      full_name:
        cleanText(input.client?.full_name) ||
        `${cleanText(input.client?.first_name)} ${cleanText(input.client?.last_name)}`.trim(),
      email: cleanText(input.client?.email),
      phone: cleanText(input.client?.phone)
    },
    event: {
      type: cleanText(input.event?.type),
      date: toIsoDate(cleanText(input.event?.date)),
      start_time: cleanText(input.event?.start_time),
      end_time: cleanText(input.event?.end_time),
      address: cleanText(input.event?.address),
      guest_count: Math.max(0, Math.floor(cleanNumber(input.event?.guest_count))),
      notes: cleanText(input.event?.notes)
    },
    quote: {
      quote_id: cleanText(input.quote?.quote_id),
      quote_number: cleanText(input.quote?.quote_number),
      quote_pdf_url: cleanText(input.quote?.quote_pdf_url),
      package_id: cleanText(input.quote?.package_id),
      package_label: cleanText(input.quote?.package_label),
      option_ids: Array.isArray(input.quote?.option_ids)
        ? input.quote.option_ids.map((item) => cleanText(item)).filter((item) => item.length > 0)
        : [],
      options: Array.isArray(input.quote?.options)
        ? input.quote.options.map((item) => cleanText(item)).filter((item) => item.length > 0)
        : [],
      custom_quote: input.quote?.custom_quote === true,
      amount_total: Math.max(0, Math.round(cleanNumber(input.quote?.amount_total))),
      deposit_amount: Math.max(0, Math.round(cleanNumber(input.quote?.deposit_amount) || 100)),
      balance_amount: Math.max(0, Math.round(cleanNumber(input.quote?.balance_amount))),
      delivery_fee: Math.max(0, Math.round(cleanNumber(input.quote?.delivery_fee))),
      status: (cleanText(input.quote?.status) as DossierQuoteStatus) || "not_created",
      sent_at: cleanText(input.quote?.sent_at),
      signed_at: cleanText(input.quote?.signed_at)
    },
    terms: {
      cgv_version: cleanText(input.terms?.cgv_version) || "2026-05",
      cgv_pdf_url: cleanText(input.terms?.cgv_pdf_url),
      cgv_hash: cleanText(input.terms?.cgv_hash),
      status: (cleanText(input.terms?.status) as EventDossier["terms"]["status"]) || "not_sent",
      signed_at: cleanText(input.terms?.signed_at)
    },
    signature: {
      signature_method:
        (cleanText(input.signature?.signature_method) as EventDossier["signature"]["signature_method"]) ||
        "sms_otp",
      signature_status:
        (cleanText(input.signature?.signature_status) as DossierSignatureStatus) || "not_started",
      signature_link_token: cleanText(input.signature?.signature_link_token),
      signature_link_expires_at: cleanText(input.signature?.signature_link_expires_at),
      otp_sent_at: cleanText(input.signature?.otp_sent_at),
      otp_verified_at: cleanText(input.signature?.otp_verified_at),
      signed_ip: cleanText(input.signature?.signed_ip),
      signed_user_agent: cleanText(input.signature?.signed_user_agent),
      document_hash: cleanText(input.signature?.document_hash),
      otp_hash: cleanText(input.signature?.otp_hash),
      otp_expires_at: cleanText(input.signature?.otp_expires_at),
      audit_trail: Array.isArray(input.signature?.audit_trail)
        ? input.signature?.audit_trail.map((entry) => {
            const item = entry as Partial<EventDossierSignatureAuditTrailItem>;
            return {
              event: (cleanText(item.event) as EventDossierSignatureAuditTrailItem["event"]) || "signature_sent",
              at: cleanText(item.at) || nowIso(),
              ip: cleanText(item.ip),
              user_agent: cleanText(item.user_agent),
              details: cleanText(item.details)
            };
          })
        : []
    },
    payment: {
      deposit_status:
        (cleanText(input.payment?.deposit_status) as DossierDepositStatus) || "not_requested",
      deposit_requested_at: cleanText(input.payment?.deposit_requested_at),
      deposit_received_at: cleanText(input.payment?.deposit_received_at),
      deposit_method:
        (cleanText(input.payment?.deposit_method) as EventDossier["payment"]["deposit_method"]) ||
        "manual",
      deposit_reference: cleanText(input.payment?.deposit_reference),
      balance_status:
        (cleanText(input.payment?.balance_status) as EventDossier["payment"]["balance_status"]) ||
        "not_due",
      balance_due_at: cleanText(input.payment?.balance_due_at),
      balance_paid_at: cleanText(input.payment?.balance_paid_at),
      notes: cleanText(input.payment?.notes)
    },
    template: {
      template_request_id: cleanText(input.template?.template_request_id),
      template_name: cleanText(input.template?.template_name),
      status:
        (cleanText(input.template?.status) as DossierTemplateStatus) || "not_started",
      client_validated_at: cleanText(input.template?.client_validated_at),
      prepared_at: cleanText(input.template?.prepared_at),
      sent_to_booth_at: cleanText(input.template?.sent_to_booth_at),
      canva_links_available: Math.max(0, Math.floor(cleanNumber(input.template?.canva_links_available))),
      psd_status: cleanText(input.template?.psd_status)
    },
    delivery: {
      delivery_assignment_id: cleanText(input.delivery?.delivery_assignment_id),
      recommended_driver_id: cleanText(input.delivery?.recommended_driver_id),
      assigned_driver_id: cleanText(input.delivery?.assigned_driver_id),
      assigned_driver_name: cleanText(input.delivery?.assigned_driver_name),
      status:
        (cleanText(input.delivery?.status) as DossierDeliveryStatus) || "not_created",
      delivery_time: cleanText(input.delivery?.delivery_time),
      pickup_time: cleanText(input.delivery?.pickup_time),
      distance_km: Math.max(0, cleanNumber(input.delivery?.distance_km)),
      travel_time_minutes: Math.max(0, cleanNumber(input.delivery?.travel_time_minutes)),
      delivery_fee: Math.max(0, Math.round(cleanNumber(input.delivery?.delivery_fee)))
    },
    post_event: {
      gallery_url: cleanText(input.post_event?.gallery_url),
      gallery_sent_at: cleanText(input.post_event?.gallery_sent_at),
      review_requested_at: cleanText(input.post_event?.review_requested_at),
      coupon_sent_at: cleanText(input.post_event?.coupon_sent_at),
      status:
        (cleanText(input.post_event?.status) as EventDossier["post_event"]["status"]) ||
        "not_started"
    },
    global_status:
      (cleanText(input.global_status) as DossierGlobalStatus) || "new",
    internal_notes: cleanText(input.internal_notes),
    reminders: cleanReminders(input.reminders),
    history: cleanTimeline(input.history)
  };

  if (!cleaned.client.full_name) {
    cleaned.client.full_name = `${cleaned.client.first_name} ${cleaned.client.last_name}`.trim();
  }
  if (!cleaned.quote.quote_pdf_url) {
    cleaned.quote.quote_pdf_url = buildQuoteDocumentUrl(cleaned.id);
  }
  if (!cleaned.terms.cgv_pdf_url) {
    cleaned.terms.cgv_pdf_url = buildCgvDocumentUrl(cleaned.id);
  }

  return cleaned;
}

async function ensureJsonFile(filePath: string, fallbackContents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, fallbackContents, "utf8");
  }
}

async function ensureLegalFiles() {
  await ensureJsonFile(CGV_PATH, DEFAULT_CGV);
  await ensureJsonFile(CONDITIONS_PATH, DEFAULT_CONDITIONS);
}

async function ensureDossiersFile() {
  await ensureJsonFile(DOSSIERS_PATH, "[]\n");
}

async function readDossiers() {
  await ensureDossiersFile();
  const raw = await fs.readFile(DOSSIERS_PATH, "utf8");
  const parsed = JSON.parse(raw) as Array<Partial<EventDossier>>;
  if (!Array.isArray(parsed)) {
    return [] as EventDossier[];
  }
  return parsed.map((item) => normalizeDossier(item));
}

async function writeDossiers(dossiers: EventDossier[]) {
  await ensureDossiersFile();
  await fs.writeFile(DOSSIERS_PATH, `${JSON.stringify(dossiers, null, 2)}\n`, "utf8");
}

function upsertTimeline(
  dossier: EventDossier,
  event: DossierTimelineEventType,
  label: string,
  details: string
) {
  const exists = dossier.history.some((entry) => entry.event === event && entry.label === label && entry.details === details);
  if (exists) {
    return dossier;
  }
  dossier.history.unshift({
    id: randomUUID(),
    event,
    at: nowIso(),
    label,
    details: cleanText(details)
  });
  dossier.history = dossier.history.slice(0, 200);
  return dossier;
}

function computeGlobalStatus(dossier: EventDossier) {
  if (dossier.quote.status === "refused" || dossier.quote.status === "expired") {
    return "cancelled" as DossierGlobalStatus;
  }
  if (dossier.post_event.status === "completed") {
    return "closed" as DossierGlobalStatus;
  }
  if (dossier.post_event.status !== "not_started") {
    return "post_event" as DossierGlobalStatus;
  }
  if (dossier.quote.status === "not_created" || dossier.quote.status === "draft") {
    return "new" as DossierGlobalStatus;
  }
  if (dossier.quote.status === "sent") {
    return "signature_pending" as DossierGlobalStatus;
  }
  if (dossier.signature.signature_status !== "signed") {
    return "signature_pending" as DossierGlobalStatus;
  }
  if (dossier.payment.deposit_status !== "received") {
    return "deposit_pending" as DossierGlobalStatus;
  }
  if (
    dossier.template.status !== "validated_by_client" &&
    dossier.template.status !== "sent_to_booth"
  ) {
    return "template_pending" as DossierGlobalStatus;
  }
  if (dossier.event.date && dossier.event.date <= nowIso().slice(0, 10)) {
    return "event_day" as DossierGlobalStatus;
  }
  return "ready" as DossierGlobalStatus;
}

function computeReminders(dossier: EventDossier) {
  const existing = new Map<string, boolean>((dossier.reminders ?? []).map((item) => [item.id, item.checked]));
  const eventDate = dossier.event.date;
  if (!isIsoDate(eventDate)) {
    return [] as EventDossierReminderItem[];
  }
  const items: EventDossierReminderItem[] = [
    {
      id: "quote_not_signed_48h",
      label: "Devis non signe apres 48h",
      due_date: addDays(dossier.created_at.slice(0, 10), 2),
      checked: existing.get("quote_not_signed_48h") === true
    },
    {
      id: "deposit_not_received",
      label: "Acompte non recu",
      due_date: addDays(eventDate, -10),
      checked: existing.get("deposit_not_received") === true
    },
    {
      id: "template_not_validated_j7",
      label: "Template non valide a J-7",
      due_date: addDays(eventDate, -7),
      checked: existing.get("template_not_validated_j7") === true
    },
    {
      id: "prepare_equipment_j2",
      label: "Preparer materiel a J-2",
      due_date: addDays(eventDate, -2),
      checked: existing.get("prepare_equipment_j2") === true
    },
    {
      id: "caution_reminder_j1",
      label: "Rappel caution 1000 EUR a J-1",
      due_date: addDays(eventDate, -1),
      checked: existing.get("caution_reminder_j1") === true
    },
    {
      id: "gallery_j1",
      label: "Galerie a envoyer J+1",
      due_date: addDays(eventDate, 1),
      checked: existing.get("gallery_j1") === true
    },
    {
      id: "review_j2",
      label: "Avis Google a demander J+2",
      due_date: addDays(eventDate, 2),
      checked: existing.get("review_j2") === true
    },
    {
      id: "offer_j7",
      label: "Offre 30 EUR a envoyer J+7",
      due_date: addDays(eventDate, 7),
      checked: existing.get("offer_j7") === true
    }
  ];
  return items;
}

function mapQuoteStatusToDossier(status: EventPicQuoteRequest["status"]): DossierQuoteStatus {
  if (status === "devis_envoye") {
    return "sent";
  }
  if (status === "gagne") {
    return "signed";
  }
  if (status === "perdu") {
    return "refused";
  }
  if (status === "contacte") {
    return "draft";
  }
  return "draft";
}

function mapTemplateStatus(status: EventPicTemplateRequest["status"]): DossierTemplateStatus {
  if (status === "a_preparer") {
    return "to_prepare";
  }
  if (status === "en_cours") {
    return "in_progress";
  }
  if (status === "a_verifier") {
    return "ready_for_review";
  }
  if (status === "valide") {
    return "validated_by_client";
  }
  return "sent_to_booth";
}

function mapDeliveryStatus(status: DeliveryAssignment["status"]): DossierDeliveryStatus {
  if (status === "a_affecter") {
    return "to_assign";
  }
  if (status === "affecte") {
    return "assigned";
  }
  if (status === "en_livraison") {
    return "in_delivery";
  }
  if (status === "installe") {
    return "installed";
  }
  if (status === "a_recuperer") {
    return "to_pickup";
  }
  if (status === "recupere") {
    return "picked_up";
  }
  return "completed";
}

function matchTemplateRequest(dossier: EventDossier, template: EventPicTemplateRequest) {
  if (dossier.template.template_request_id && dossier.template.template_request_id === template.id) {
    return true;
  }
  const sameEmail =
    dossier.client.email &&
    cleanText(dossier.client.email).toLowerCase() === cleanText(template.client.email).toLowerCase();
  const sameDate = dossier.event.date && dossier.event.date === toIsoDate(template.event.date);
  return Boolean(sameEmail && sameDate);
}

function matchQuote(dossier: EventDossier, quote: EventPicQuoteRequest) {
  if (dossier.quote.quote_id && dossier.quote.quote_id === quote.id) {
    return true;
  }
  const sameEmail =
    dossier.client.email &&
    cleanText(dossier.client.email).toLowerCase() === cleanText(quote.email).toLowerCase();
  const sameDate = dossier.event.date && dossier.event.date === toIsoDate(quote.event_date);
  return Boolean(sameEmail && sameDate);
}

function matchContact(dossier: EventDossier, contact: EventPicContactRequest) {
  const sameEmail =
    dossier.client.email &&
    cleanText(dossier.client.email).toLowerCase() === cleanText(contact.email).toLowerCase();
  const sameDate = dossier.event.date && dossier.event.date === toIsoDate(contact.event_date);
  return Boolean(sameEmail && sameDate);
}

function matchDelivery(dossier: EventDossier, delivery: DeliveryAssignment) {
  if (
    dossier.delivery.delivery_assignment_id &&
    dossier.delivery.delivery_assignment_id === delivery.id
  ) {
    return true;
  }
  if (dossier.quote.quote_id && delivery.event_source === "quote" && delivery.event_id === dossier.quote.quote_id) {
    return true;
  }
  if (
    dossier.template.template_request_id &&
    delivery.event_source === "template_request" &&
    delivery.event_id === dossier.template.template_request_id
  ) {
    return true;
  }
  const samePhone =
    dossier.client.phone &&
    cleanText(dossier.client.phone).replace(/\s+/g, "") === cleanText(delivery.client_phone).replace(/\s+/g, "");
  const sameDate = dossier.event.date && dossier.event.date === toIsoDate(delivery.event_date);
  return Boolean(samePhone && sameDate);
}

function ensureDossierFromQuote(quote: EventPicQuoteRequest) {
  const name = splitName(quote.name);
  const now = nowIso();
  const dossier = normalizeDossier({
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    client: {
      first_name: name.first_name,
      last_name: name.last_name,
      full_name: name.full_name,
      email: quote.email,
      phone: quote.phone
    },
    event: {
      type: quote.event_type,
      date: toIsoDate(quote.event_date),
      start_time: quote.delivery_time,
      end_time: quote.return_time,
      address: quote.event_address,
      guest_count: 0,
      notes: quote.message
    },
    quote: {
      quote_id: quote.id,
      quote_number: createQuoteNumber(quote.id, quote.created_at),
      quote_pdf_url: "",
      package_id: quote.package_id || "",
      package_label: quote.package || "",
      option_ids: quote.option_ids ?? [],
      options: quote.options ?? [],
      custom_quote: quote.custom_quote === true,
      amount_total: quote.estimated_total_with_delivery || quote.estimated_total,
      deposit_amount: quote.deposit,
      balance_amount: quote.estimated_balance,
      delivery_fee: quote.delivery_fee,
      status: mapQuoteStatusToDossier(quote.status),
      sent_at: quote.status === "devis_envoye" ? now : "",
      signed_at: quote.status === "gagne" ? now : ""
    },
    terms: {
      cgv_version: "2026-05",
      cgv_pdf_url: "",
      cgv_hash: "",
      status: quote.status === "gagne" ? "signed" : "not_sent",
      signed_at: quote.status === "gagne" ? now : ""
    },
    signature: {
      signature_method: "sms_otp",
      signature_status: quote.status === "gagne" ? "signed" : "not_started",
      signature_link_token: "",
      signature_link_expires_at: "",
      otp_sent_at: "",
      otp_verified_at: "",
      signed_ip: "",
      signed_user_agent: "",
      document_hash: "",
      otp_hash: "",
      otp_expires_at: "",
      audit_trail: []
    },
    payment: {
      deposit_status: quote.status === "gagne" ? "requested" : "not_requested",
      deposit_requested_at: quote.status === "gagne" ? now : "",
      deposit_received_at: "",
      deposit_method: "manual",
      deposit_reference: "",
      balance_status: "not_due",
      balance_due_at: "",
      balance_paid_at: "",
      notes: ""
    },
    global_status: "quote_pending"
  });
  return upsertTimeline(dossier, "dossier_created", "Dossier cree", "Creation initiale depuis devis.");
}

function mergeQuoteIntoDossier(dossier: EventDossier, quote: EventPicQuoteRequest) {
  dossier.client.email = cleanText(quote.email) || dossier.client.email;
  dossier.client.phone = cleanText(quote.phone) || dossier.client.phone;
  dossier.client.full_name = cleanText(quote.name) || dossier.client.full_name;
  const split = splitName(dossier.client.full_name);
  dossier.client.first_name = split.first_name;
  dossier.client.last_name = split.last_name;
  dossier.event.type = cleanText(quote.event_type) || dossier.event.type;
  dossier.event.date = toIsoDate(quote.event_date) || dossier.event.date;
  dossier.event.address = cleanText(quote.event_address) || dossier.event.address;
  dossier.event.start_time = cleanText(quote.delivery_time) || dossier.event.start_time;
  dossier.event.end_time = cleanText(quote.return_time) || dossier.event.end_time;
  dossier.quote.quote_id = quote.id;
  dossier.quote.quote_number = dossier.quote.quote_number || createQuoteNumber(quote.id, quote.created_at);
  dossier.quote.package_id = cleanText(quote.package_id) || dossier.quote.package_id;
  dossier.quote.package_label = cleanText(quote.package) || dossier.quote.package_label;
  dossier.quote.option_ids = Array.isArray(quote.option_ids) ? quote.option_ids : dossier.quote.option_ids;
  dossier.quote.options = Array.isArray(quote.options) ? quote.options : dossier.quote.options;
  dossier.quote.custom_quote = quote.custom_quote === true;
  dossier.quote.amount_total = Math.max(0, Math.round(quote.estimated_total_with_delivery || quote.estimated_total));
  dossier.quote.deposit_amount = Math.max(0, Math.round(quote.deposit || 100));
  dossier.quote.delivery_fee = Math.max(0, Math.round(quote.delivery_fee || 0));
  dossier.quote.balance_amount = Math.max(0, Math.round(quote.estimated_balance || 0));
  dossier.quote.status = mapQuoteStatusToDossier(quote.status);
  if (quote.status === "devis_envoye" && !dossier.quote.sent_at) {
    dossier.quote.sent_at = nowIso();
    upsertTimeline(dossier, "quote_sent", "Devis envoye", "Le devis a ete marque comme envoye.");
  }
  if (quote.status === "gagne") {
    if (!dossier.quote.signed_at) {
      dossier.quote.signed_at = nowIso();
      upsertTimeline(dossier, "quote_signed", "Devis signe", "Le devis a ete marque comme signe.");
    }
    dossier.terms.status = "signed";
    dossier.terms.signed_at = dossier.terms.signed_at || nowIso();
    dossier.signature.signature_status = "signed";
    dossier.payment.deposit_status =
      dossier.payment.deposit_status === "received" ? "received" : "requested";
    dossier.payment.deposit_requested_at = dossier.payment.deposit_requested_at || nowIso();
  }
  if (quote.status === "perdu") {
    dossier.global_status = "cancelled";
  }
  return dossier;
}

function mergeContactIntoDossier(dossier: EventDossier, contact: EventPicContactRequest) {
  dossier.client.full_name = cleanText(contact.name) || dossier.client.full_name;
  const split = splitName(dossier.client.full_name);
  dossier.client.first_name = split.first_name;
  dossier.client.last_name = split.last_name;
  dossier.client.email = cleanText(contact.email) || dossier.client.email;
  dossier.client.phone = cleanText(contact.phone) || dossier.client.phone;
  dossier.event.type = cleanText(contact.event_type) || dossier.event.type;
  dossier.event.date = toIsoDate(contact.event_date) || dossier.event.date;
  dossier.event.address = cleanText(contact.event_address) || dossier.event.address;
  dossier.event.notes = cleanText(contact.message) || dossier.event.notes;
  return dossier;
}

function mergeTemplateIntoDossier(dossier: EventDossier, template: EventPicTemplateRequest) {
  dossier.template.template_request_id = template.id;
  dossier.template.template_name =
    cleanText(template.selected_templates?.[0]?.name) || dossier.template.template_name;
  dossier.template.status = mapTemplateStatus(template.status);
  dossier.template.canva_links_available =
    typeof template.ai_preparation_brief?.canva?.format_links_available_count === "number"
      ? template.ai_preparation_brief.canva.format_links_available_count
      : dossier.template.canva_links_available;
  const selectedWithPsd = template.selected_templates.filter(
    (item) => cleanText(item.psd_url) || cleanText(item.source_file_url)
  );
  dossier.template.psd_status = selectedWithPsd.length > 0 ? "PSD disponible" : "PSD a recuperer";
  dossier.client.email = cleanText(template.client.email) || dossier.client.email;
  dossier.client.phone = cleanText(template.client.phone) || dossier.client.phone;
  dossier.event.type = cleanText(template.event.type) || dossier.event.type;
  dossier.event.date = toIsoDate(template.event.date) || dossier.event.date;
  if (dossier.template.status === "ready_for_review" && !dossier.template.prepared_at) {
    dossier.template.prepared_at = nowIso();
    upsertTimeline(dossier, "template_ready", "Template pret a valider", "Demande template prete pour validation.");
  }
  if (dossier.template.status === "validated_by_client" && !dossier.template.client_validated_at) {
    dossier.template.client_validated_at = nowIso();
    upsertTimeline(dossier, "template_validated", "Template valide client", "Validation client enregistree.");
  }
  return dossier;
}

function mergeDeliveryIntoDossier(dossier: EventDossier, delivery: DeliveryAssignment) {
  dossier.delivery.delivery_assignment_id = delivery.id;
  dossier.delivery.recommended_driver_id = cleanText(delivery.assigned_driver_id) || dossier.delivery.recommended_driver_id;
  dossier.delivery.assigned_driver_id = cleanText(delivery.assigned_driver_id);
  dossier.delivery.assigned_driver_name = cleanText(delivery.assigned_driver_name);
  dossier.delivery.status = mapDeliveryStatus(delivery.status);
  dossier.delivery.delivery_time = cleanText(delivery.delivery_time);
  dossier.delivery.pickup_time = cleanText(delivery.return_time);
  dossier.delivery.distance_km = cleanNumber(delivery.distance_km);
  dossier.delivery.travel_time_minutes = cleanNumber(delivery.travel_time_minutes);
  dossier.delivery.delivery_fee = cleanNumber(delivery.delivery_fee);
  dossier.event.address = cleanText(delivery.event_address) || dossier.event.address;
  if (dossier.delivery.status === "assigned") {
    upsertTimeline(
      dossier,
      "delivery_assigned",
      "Livraison affectee",
      `Livreur: ${dossier.delivery.assigned_driver_name || "Non renseigne"}`
    );
  }
  return dossier;
}

async function computeCgvHash() {
  await ensureLegalFiles();
  const [cgv, conditions] = await Promise.all([
    fs.readFile(CGV_PATH, "utf8"),
    fs.readFile(CONDITIONS_PATH, "utf8")
  ]);
  return createSecretHash(`${cgv}\n---\n${conditions}`);
}

function normalizeAndFinalize(dossier: EventDossier, cgvHash: string) {
  dossier.terms.cgv_hash = cgvHash;
  dossier.terms.cgv_pdf_url = dossier.terms.cgv_pdf_url || buildCgvDocumentUrl(dossier.id);
  dossier.quote.quote_pdf_url = dossier.quote.quote_pdf_url || buildQuoteDocumentUrl(dossier.id);
  dossier.quote.balance_amount = Math.max(
    0,
    Math.round((dossier.quote.amount_total || 0) - (dossier.quote.deposit_amount || 0))
  );
  dossier.global_status = computeGlobalStatus(dossier);
  dossier.reminders = computeReminders(dossier);
  dossier.updated_at = nowIso();
  return dossier;
}

async function syncDossiersFromSources(dossiersInput: EventDossier[]) {
  const [quotes, contacts, templates, deliveries, cgvHash] = await Promise.all([
    listQuoteRequests(),
    listContactRequests(),
    listEventPicTemplateRequests(),
    listDeliveryAssignments(),
    computeCgvHash()
  ]);

  const dossiers = dossiersInput.map((item) => normalizeDossier(item));

  for (const quote of quotes) {
    let dossier = dossiers.find((item) => matchQuote(item, quote));
    if (!dossier) {
      dossier = ensureDossierFromQuote(quote);
      dossiers.unshift(dossier);
    } else {
      mergeQuoteIntoDossier(dossier, quote);
    }
  }

  for (const contact of contacts) {
    const existing = dossiers.find((item) => matchContact(item, contact));
    if (!existing) {
      const name = splitName(contact.name);
      const newDossier = normalizeDossier({
        client: {
          first_name: name.first_name,
          last_name: name.last_name,
          full_name: name.full_name,
          email: contact.email,
          phone: contact.phone
        },
        event: {
          type: contact.event_type,
          date: toIsoDate(contact.event_date),
          address: contact.event_address,
          notes: contact.message,
          start_time: "",
          end_time: "",
          guest_count: 0
        },
        quote: {
          quote_id: `contact:${contact.id}`,
          quote_number: createQuoteNumber(contact.id, contact.created_at),
          quote_pdf_url: "",
          package_id: "",
          package_label: "",
          option_ids: [],
          options: [],
          custom_quote: false,
          amount_total: 0,
          deposit_amount: 100,
          balance_amount: 0,
          delivery_fee: 0,
          status: "draft",
          sent_at: "",
          signed_at: ""
        }
      });
      upsertTimeline(newDossier, "dossier_created", "Dossier cree", "Creation depuis demande contact.");
      dossiers.unshift(newDossier);
    } else {
      mergeContactIntoDossier(existing, contact);
    }
  }

  for (const template of templates) {
    let dossier = dossiers.find((item) => matchTemplateRequest(item, template));
    if (!dossier) {
      const fullName = `${template.client.first_name} ${template.client.last_name}`.trim();
      dossier = normalizeDossier({
        client: {
          first_name: template.client.first_name,
          last_name: template.client.last_name,
          full_name: fullName,
          email: template.client.email,
          phone: template.client.phone
        },
        event: {
          type: template.event.type,
          date: toIsoDate(template.event.date),
          address: "",
          notes: template.customization.notes || "",
          start_time: "",
          end_time: "",
          guest_count: 0
        },
        quote: {
          quote_id: "",
          quote_number: "",
          quote_pdf_url: "",
          package_id: "",
          package_label: "",
          option_ids: [],
          options: [],
          custom_quote: false,
          amount_total: 0,
          deposit_amount: 100,
          balance_amount: 0,
          delivery_fee: 0,
          status: "not_created",
          sent_at: "",
          signed_at: ""
        },
        template: {
          template_request_id: template.id,
          template_name: template.selected_templates?.[0]?.name || "",
          status: mapTemplateStatus(template.status),
          client_validated_at: "",
          prepared_at: "",
          sent_to_booth_at: "",
          canva_links_available: 0,
          psd_status: ""
        }
      });
      upsertTimeline(dossier, "template_linked", "Demande template liee", "Dossier cree depuis demande template.");
      dossiers.unshift(dossier);
    }
    mergeTemplateIntoDossier(dossier, template);
  }

  for (const delivery of deliveries) {
    let dossier = dossiers.find((item) => matchDelivery(item, delivery));
    if (!dossier) {
      const fullName = cleanText(delivery.client_name);
      const split = splitName(fullName);
      dossier = normalizeDossier({
        client: {
          first_name: split.first_name,
          last_name: split.last_name,
          full_name: fullName,
          email: delivery.client_email,
          phone: delivery.client_phone
        },
        event: {
          type: delivery.event_type,
          date: toIsoDate(delivery.event_date),
          address: delivery.event_address,
          start_time: delivery.delivery_time,
          end_time: delivery.return_time,
          guest_count: 0,
          notes: ""
        },
        quote: {
          quote_id: "",
          quote_number: "",
          quote_pdf_url: "",
          package_id: "",
          package_label: "",
          option_ids: [],
          options: [],
          custom_quote: false,
          amount_total: 0,
          deposit_amount: 100,
          balance_amount: 0,
          delivery_fee: 0,
          status: "not_created",
          sent_at: "",
          signed_at: ""
        },
        delivery: {
          delivery_assignment_id: delivery.id,
          recommended_driver_id: "",
          assigned_driver_id: delivery.assigned_driver_id,
          assigned_driver_name: delivery.assigned_driver_name,
          status: mapDeliveryStatus(delivery.status),
          delivery_time: delivery.delivery_time,
          pickup_time: delivery.return_time,
          distance_km: cleanNumber(delivery.distance_km),
          travel_time_minutes: cleanNumber(delivery.travel_time_minutes),
          delivery_fee: cleanNumber(delivery.delivery_fee)
        }
      });
      upsertTimeline(dossier, "delivery_linked", "Livraison liee", "Dossier cree depuis livraison.");
      dossiers.unshift(dossier);
    }
    mergeDeliveryIntoDossier(dossier, delivery);
  }

  for (const dossier of dossiers) {
    normalizeAndFinalize(dossier, cgvHash);
  }

  dossiers.sort((a, b) => {
    if (a.event.date && b.event.date && a.event.date !== b.event.date) {
      return a.event.date.localeCompare(b.event.date);
    }
    return b.updated_at.localeCompare(a.updated_at);
  });

  return dossiers;
}

export async function listEventDossiers(options: ListDossiersOptions = {}) {
  const sync = options.sync !== false;
  const current = await readDossiers();
  if (!sync) {
    return current;
  }
  const synced = await syncDossiersFromSources(current);
  await writeDossiers(synced);
  return synced;
}

export async function getEventDossierById(id: string) {
  const dossierId = cleanText(id);
  const dossiers = await listEventDossiers({ sync: true });
  return dossiers.find((item) => item.id === dossierId) ?? null;
}

export async function createManualEventDossier(input: Partial<EventDossier>) {
  const dossiers = await listEventDossiers({ sync: true });
  const dossier = normalizeDossier({
    ...buildDefaultDossier(),
    ...input,
    id: randomUUID(),
    created_at: nowIso(),
    updated_at: nowIso()
  });
  upsertTimeline(dossier, "dossier_created", "Dossier cree", "Creation manuelle.");
  dossiers.unshift(dossier);
  await writeDossiers(dossiers);
  return dossier;
}

export async function createEventDossierFromQuoteId(quoteId: string) {
  const cleanQuoteId = cleanText(quoteId);
  if (!cleanQuoteId) {
    throw new Error("quote_id manquant.");
  }

  const [quotes, dossiers] = await Promise.all([
    listQuoteRequests(),
    listEventDossiers({ sync: true })
  ]);

  const quote = quotes.find((item) => item.id === cleanQuoteId || `contact:${item.id}` === cleanQuoteId);
  if (!quote) {
    throw new Error("Devis introuvable.");
  }

  const existing = dossiers.find((item) => item.quote.quote_id === quote.id || matchQuote(item, quote));
  if (existing) {
    return existing;
  }

  const created = ensureDossierFromQuote(quote);
  dossiers.unshift(created);
  await writeDossiers(dossiers);
  return created;
}

function setNestedValue(target: Record<string, unknown>, pathParts: string[], value: unknown) {
  let current: Record<string, unknown> = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[pathParts[pathParts.length - 1]] = value;
}

export async function updateEventDossier(
  dossierIdInput: string,
  updates: Record<string, unknown>,
  options?: { timelineLabel?: string; timelineEvent?: DossierTimelineEventType }
) {
  const dossierId = cleanText(dossierIdInput);
  if (!dossierId) {
    throw new Error("id dossier manquant.");
  }
  const dossiers = await listEventDossiers({ sync: true });
  const index = dossiers.findIndex((item) => item.id === dossierId);
  if (index === -1) {
    throw new Error("Dossier introuvable.");
  }

  const snapshot = normalizeDossier(dossiers[index]);
  const mutable = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;

  for (const [key, value] of Object.entries(updates ?? {})) {
    if (!key.includes(".")) {
      mutable[key] = value;
      continue;
    }
    setNestedValue(mutable, key.split("."), value);
  }

  const normalized = normalizeDossier(mutable as Partial<EventDossier>);
  normalized.updated_at = nowIso();
  normalized.reminders = computeReminders(normalized);
  normalized.global_status = computeGlobalStatus(normalized);

  if (options?.timelineEvent && options.timelineLabel) {
    upsertTimeline(normalized, options.timelineEvent, options.timelineLabel, cleanText(options.timelineLabel));
  }

  dossiers[index] = normalized;
  await writeDossiers(dossiers);
  return normalized;
}

export async function updateEventDossierGlobalStatus(dossierId: string, status: DossierGlobalStatus) {
  const allowed = new Set(DOSSIER_STATUS.map((item) => item.id));
  if (!allowed.has(status)) {
    throw new Error("Statut dossier invalide.");
  }
  return updateEventDossier(
    dossierId,
    { global_status: status },
    { timelineEvent: "status_changed", timelineLabel: `Statut dossier: ${status}` }
  );
}

function createPublicView(dossier: EventDossier): EventDossierPublicView {
  return {
    dossier_id: dossier.id,
    client_name: dossier.client.full_name,
    event_type: dossier.event.type,
    event_date: dossier.event.date,
    quote_number: dossier.quote.quote_number,
    amount_total: dossier.quote.amount_total,
    deposit_amount: dossier.quote.deposit_amount,
    balance_amount: dossier.quote.balance_amount,
    quote_pdf_url: dossier.quote.quote_pdf_url,
    cgv_pdf_url: dossier.terms.cgv_pdf_url,
    signature_status: dossier.signature.signature_status,
    token_expires_at: dossier.signature.signature_link_expires_at
  };
}

export async function getPublicDossierByToken(tokenInput: string) {
  const token = cleanText(tokenInput);
  if (!token) {
    return null;
  }
  const dossiers = await listEventDossiers({ sync: true });
  const dossier = dossiers.find((item) => item.signature.signature_link_token === token);
  if (!dossier) {
    return null;
  }
  if (
    dossier.signature.signature_link_expires_at &&
    new Date(dossier.signature.signature_link_expires_at).getTime() < Date.now()
  ) {
    return null;
  }
  return createPublicView(dossier);
}

function buildSignatureSmsMessage(input: {
  clientName: string;
  token: string;
  otpCode: string;
  baseUrl: string;
}) {
  const link = `${input.baseUrl}/dossier/${encodeURIComponent(input.token)}`;
  return `Event Pic - Bonjour ${input.clientName || "client"}, validez votre devis et CGV via ${link} . Code OTP: ${input.otpCode} (valable 48h).`;
}

async function sendSignatureSmsViaBrevo(phone: string, message: string) {
  const apiKey = cleanText(process.env.BREVO_SMS_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      status: "not_configured" as const,
      error: "BREVO_SMS_API_KEY non configuree."
    };
  }

  const sender = cleanText(process.env.SMS_FROM_NAME) || "EventPic";
  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender,
      recipient: phone,
      content: message,
      type: "transactional"
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    return {
      ok: false,
      status: "error" as const,
      error: `Brevo SMS error (${response.status}): ${payload}`
    };
  }

  return {
    ok: true,
    status: "sent" as const,
    error: ""
  };
}

function redactPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.length < 4) {
    return phone;
  }
  return `${cleaned.slice(0, 2)}***${cleaned.slice(-2)}`;
}

export async function sendDossierSignatureOtp(
  dossierIdInput: string,
  metadata: { origin?: string; ip?: string; userAgent?: string }
): Promise<SendSignatureResult> {
  const dossierId = cleanText(dossierIdInput);
  const dossiers = await listEventDossiers({ sync: true });
  const index = dossiers.findIndex((item) => item.id === dossierId);
  if (index === -1) {
    throw new Error("Dossier introuvable.");
  }

  const dossier = dossiers[index];
  if (!cleanText(dossier.client.phone)) {
    throw new Error("Telephone client manquant pour l'envoi OTP.");
  }

  const token = randomBytes(24).toString("hex");
  const otpCode = buildOtp();
  const otpHash = hashOtp(token, otpCode);
  const expiresAt = new Date(Date.now() + CLIENT_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const baseUrl = cleanText(metadata.origin) || cleanText(process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000";
  const smsMessage = buildSignatureSmsMessage({
    clientName: dossier.client.first_name || dossier.client.full_name,
    token,
    otpCode,
    baseUrl
  });

  const smsResult = await sendSignatureSmsViaBrevo(dossier.client.phone, smsMessage);

  dossier.signature.signature_status = "sent";
  dossier.signature.signature_link_token = token;
  dossier.signature.signature_link_expires_at = expiresAt;
  dossier.signature.otp_sent_at = nowIso();
  dossier.signature.otp_hash = otpHash;
  dossier.signature.otp_expires_at = expiresAt;
  dossier.quote.status = dossier.quote.status === "not_created" ? "sent" : dossier.quote.status;
  dossier.terms.status = dossier.terms.status === "not_sent" ? "sent" : dossier.terms.status;
  dossier.global_status = "signature_pending";
  dossier.updated_at = nowIso();
  dossier.reminders = computeReminders(dossier);

  dossier.signature.audit_trail.unshift({
    event: "signature_sent",
    at: nowIso(),
    ip: cleanText(metadata.ip),
    user_agent: cleanText(metadata.userAgent),
    details: smsResult.ok
      ? `Lien de signature envoye au ${redactPhone(dossier.client.phone)}`
      : `Mode manuel: ${smsResult.error || "SMS non configure"}`
  });
  dossier.signature.audit_trail = dossier.signature.audit_trail.slice(0, 100);
  upsertTimeline(dossier, "signature_sent", "Lien signature envoye", "Demande de signature OTP envoyee.");

  dossiers[index] = dossier;
  await writeDossiers(dossiers);

  return {
    mode: smsResult.ok ? "sms" : "manual",
    message: smsResult.ok
      ? "Lien de signature SMS envoye."
      : "SMS non configure. Utilisez le lien et le code OTP en mode manuel.",
    token,
    otp_code: otpCode,
    expires_at: expiresAt,
    sms_provider_status: smsResult.status,
    sms_error: smsResult.error
  };
}

export async function verifyPublicDossierSignature(input: {
  token: string;
  otp: string;
  accepted: boolean;
  ip?: string;
  userAgent?: string;
}) {
  const token = cleanText(input.token);
  const otp = cleanText(input.otp);
  if (!token) {
    throw new Error("Token dossier manquant.");
  }
  if (!input.accepted) {
    throw new Error("Vous devez accepter le devis et les CGV.");
  }
  if (!otp) {
    throw new Error("Code OTP manquant.");
  }

  const dossiers = await listEventDossiers({ sync: true });
  const index = dossiers.findIndex((item) => item.signature.signature_link_token === token);
  if (index === -1) {
    throw new Error("Lien de signature invalide.");
  }
  const dossier = dossiers[index];
  if (
    dossier.signature.signature_link_expires_at &&
    new Date(dossier.signature.signature_link_expires_at).getTime() < Date.now()
  ) {
    throw new Error("Lien de signature expire.");
  }
  if (
    dossier.signature.otp_expires_at &&
    new Date(dossier.signature.otp_expires_at).getTime() < Date.now()
  ) {
    throw new Error("Code OTP expire.");
  }

  const expectedHash = hashOtp(token, otp);
  if (!dossier.signature.otp_hash || dossier.signature.otp_hash !== expectedHash) {
    dossier.signature.signature_status = "failed";
    dossier.signature.audit_trail.unshift({
      event: "otp_verified",
      at: nowIso(),
      ip: cleanText(input.ip),
      user_agent: cleanText(input.userAgent),
      details: "Code OTP invalide."
    });
    dossiers[index] = dossier;
    await writeDossiers(dossiers);
    throw new Error("Code OTP invalide.");
  }

  const signedAt = nowIso();
  dossier.signature.signature_status = "signed";
  dossier.signature.otp_verified_at = signedAt;
  dossier.signature.signed_ip = cleanText(input.ip);
  dossier.signature.signed_user_agent = cleanText(input.userAgent);
  dossier.signature.otp_hash = "";
  dossier.quote.status = "signed";
  dossier.quote.signed_at = signedAt;
  dossier.terms.status = "signed";
  dossier.terms.signed_at = signedAt;
  if (dossier.payment.deposit_status === "not_requested") {
    dossier.payment.deposit_status = "requested";
    dossier.payment.deposit_requested_at = signedAt;
  }
  dossier.global_status = "deposit_pending";
  dossier.updated_at = signedAt;
  dossier.reminders = computeReminders(dossier);

  dossier.signature.audit_trail.unshift({
    event: "otp_verified",
    at: signedAt,
    ip: cleanText(input.ip),
    user_agent: cleanText(input.userAgent),
    details: "Code OTP verifie."
  });
  dossier.signature.audit_trail.unshift({
    event: "document_signed",
    at: signedAt,
    ip: cleanText(input.ip),
    user_agent: cleanText(input.userAgent),
    details: "Devis et CGV valides par OTP."
  });
  dossier.signature.audit_trail = dossier.signature.audit_trail.slice(0, 100);
  upsertTimeline(dossier, "otp_verified", "OTP verifie", "Code OTP valide cote client.");
  upsertTimeline(dossier, "quote_signed", "Devis signe", "Validation devis et CGV effectuee.");

  dossiers[index] = dossier;
  await writeDossiers(dossiers);
  return createPublicView(dossier);
}

export async function getEventDossierBySignatureToken(token: string) {
  const cleaned = cleanText(token);
  if (!cleaned) {
    return null;
  }
  const dossiers = await listEventDossiers({ sync: true });
  return dossiers.find((item) => item.signature.signature_link_token === cleaned) ?? null;
}

export async function markDossierReminder(
  dossierId: string,
  reminderIdInput: string,
  checked: boolean
) {
  const reminderId = cleanText(reminderIdInput);
  if (!reminderId) {
    throw new Error("Reminder id manquant.");
  }
  const dossier = await getEventDossierById(dossierId);
  if (!dossier) {
    throw new Error("Dossier introuvable.");
  }
  const reminders = computeReminders(dossier).map((item) =>
    item.id === reminderId ? { ...item, checked } : item
  );
  return updateEventDossier(dossier.id, { reminders });
}

export async function buildDossierDashboardStats() {
  const dossiers = await listEventDossiers({ sync: true });
  const open = dossiers.filter((item) => item.global_status !== "closed" && item.global_status !== "cancelled");
  const signaturesPending = dossiers.filter((item) => item.signature.signature_status !== "signed");
  const depositsPending = dossiers.filter((item) => item.payment.deposit_status !== "received");
  const templatesPending = dossiers.filter(
    (item) => item.template.status !== "validated_by_client" && item.template.status !== "sent_to_booth"
  );
  const today = nowIso().slice(0, 10);
  const weekLimit = addDays(today, 7);
  const thisWeek = dossiers.filter((item) => item.event.date && item.event.date >= today && item.event.date <= weekLimit);
  const toClose = dossiers.filter((item) => item.global_status === "post_event");

  return {
    open_count: open.length,
    signatures_pending_count: signaturesPending.length,
    deposits_pending_count: depositsPending.length,
    templates_pending_count: templatesPending.length,
    events_this_week_count: thisWeek.length,
    dossiers_to_close_count: toClose.length
  };
}

export function getPipelineColumnForStatus(status: DossierGlobalStatus) {
  switch (status) {
    case "new":
      return "nouveau";
    case "quote_pending":
      return "devis_a_envoyer";
    case "signature_pending":
      return "signature_en_attente";
    case "deposit_pending":
      return "acompte_en_attente";
    case "template_pending":
      return "template_a_preparer";
    case "ready":
      return "pret_evenement";
    case "event_day":
      return "pret_evenement";
    case "post_event":
      return "post_evenement";
    case "closed":
      return "cloture";
    case "cancelled":
      return "cloture";
    default:
      return "nouveau";
  }
}

export async function readLegalDocuments() {
  await ensureLegalFiles();
  const [cgv, conditions] = await Promise.all([
    fs.readFile(CGV_PATH, "utf8"),
    fs.readFile(CONDITIONS_PATH, "utf8")
  ]);
  return { cgv, conditions };
}

export function buildDossierDocumentView(dossier: EventDossier) {
  const quoteOptions =
    dossier.quote.options.length > 0 ? dossier.quote.options.join(", ") : "Aucune option";
  const lines = [
    `Event Pic`,
    `Devis: ${dossier.quote.quote_number || "-"}`,
    `Client: ${dossier.client.full_name || "-"}`,
    `Email: ${dossier.client.email || "-"}`,
    `Telephone: ${dossier.client.phone || "-"}`,
    `Evenement: ${dossier.event.type || "-"} - ${dossier.event.date || "-"}`,
    `Adresse: ${dossier.event.address || "-"}`,
    `Formule: ${dossier.quote.package_label || "-"}`,
    `Options: ${quoteOptions}`,
    `Formule / total: ${dossier.quote.amount_total} EUR`,
    `Frais deplacement: ${dossier.quote.delivery_fee} EUR`,
    `Acompte: ${dossier.quote.deposit_amount} EUR`,
    `Solde: ${dossier.quote.balance_amount} EUR`,
    `Date edition: ${new Date().toLocaleDateString("fr-FR")}`
  ];
  return {
    quote_number: dossier.quote.quote_number,
    summary: lines.join("\n")
  };
}
