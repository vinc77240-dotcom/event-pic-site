import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { EmailPayload, sendEmail, sendTestEmail } from "@/src/server/emailService";

const EMAIL_CONTACT_LISTS_PATH = path.join(process.cwd(), "data", "email-contact-lists.json");
const EMAIL_CAMPAIGN_HISTORY_PATH = path.join(process.cwd(), "data", "email-campaign-history.json");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EMAIL_BATCH_SIZE = parsePositiveInteger(process.env.EMAIL_BATCH_SIZE, 25);
const DEFAULT_EMAIL_DELAY_SECONDS = parsePositiveInteger(process.env.EMAIL_DELAY_SECONDS, 0);
const DEFAULT_EMAIL_DAILY_LIMIT = parsePositiveInteger(process.env.EMAIL_DAILY_LIMIT, 100);

export type EmailContact = {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  city: string;
  target_type: string;
  role: string;
  phone: string;
  event_date: string;
  event_type: string;
  gallery_url: string;
  coupon_code: string;
  coupon_amount: string;
  notes: string;
  unsubscribed: boolean;
  source: "csv";
};

export type EmailContactList = {
  id: string;
  name: string;
  created_at: string;
  contacts: EmailContact[];
};

export type CampaignItemStatus = "pending" | "sent" | "failed" | "skipped" | "unsubscribed" | "duplicate";

export type EmailCampaignHistoryItem = {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  city: string;
  target_type: string;
  role: string;
  status: CampaignItemStatus;
  message_id: string;
  error_message: string;
  sent_at: string;
};

export type EmailCampaignHistoryEntry = {
  id: string;
  created_at: string;
  updated_at: string;
  list_id: string;
  preset_id: string;
  subject: string;
  list_name: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  daily_limit: number;
  batch_size: number;
  status: "draft" | "sending" | "partial" | "completed" | "failed";
  items: EmailCampaignHistoryItem[];
};

export type CsvPreviewError = {
  row: number;
  message: string;
};

export type CsvPreviewResult = {
  columns: string[];
  contacts: EmailContact[];
  errors: CsvPreviewError[];
  summary: {
    total_rows: number;
    valid: number;
    invalid: number;
    duplicates: number;
    stop: number;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeHeader(value: string) {
  return cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}

function parseBooleanMarker(value: string) {
  const marker = cleanText(value).toLowerCase();
  return ["1", "true", "oui", "yes", "stop", "desinscrit", "désinscrit", "unsubscribe", "unsubscribed"].includes(marker);
}

function getCampaignSettings() {
  return {
    batchSize: Math.max(1, Math.min(50, DEFAULT_EMAIL_BATCH_SIZE)),
    delaySeconds: Math.max(0, Math.min(60, DEFAULT_EMAIL_DELAY_SECONDS)),
    dailyLimit: Math.max(1, Math.min(500, DEFAULT_EMAIL_DAILY_LIMIT)),
    manualBatchMode: DEFAULT_EMAIL_DELAY_SECONDS === 0
  };
}

async function ensureJsonFile(filePath: string, defaultContents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContents, "utf8");
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return (parsed as T) ?? fallback;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function detectDelimiter(firstLine: string) {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function mapRowValues(headers: string[], rawValues: string[]) {
  const mapped = new Map<string, string>();

  for (let index = 0; index < headers.length; index += 1) {
    mapped.set(headers[index] ?? "", cleanText(rawValues[index]));
  }

  return mapped;
}

function getMappedValue(map: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(map.get(key));
    if (value) {
      return value;
    }
  }

  return "";
}

export function previewContactsFromCsv(csvContent: string): CsvPreviewResult {
  const text = cleanText(csvContent.replace(/^\uFEFF/, ""));

  if (!text) {
    return {
      columns: [],
      contacts: [],
      errors: [{ row: 0, message: "CSV vide." }],
      summary: { total_rows: 0, valid: 0, invalid: 1, duplicates: 0, stop: 0 }
    };
  }

  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      columns: [],
      contacts: [],
      errors: [{ row: 0, message: "Le CSV doit contenir un en-tete et au moins une ligne." }],
      summary: { total_rows: 0, valid: 0, invalid: 1, duplicates: 0, stop: 0 }
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const contacts: EmailContact[] = [];
  const errors: CsvPreviewError[] = [];
  const seenEmails = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  let stopCount = 0;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const rawValues = parseDelimitedLine(lines[lineIndex] ?? "", delimiter);
    const mapped = mapRowValues(headers, rawValues);
    const email = getMappedValue(mapped, ["email", "mail", "destinataire"]);

    if (!email) {
      errors.push({ row: rowNumber, message: "Email manquant." });
      invalidCount += 1;
      continue;
    }

    if (!isValidEmail(email)) {
      errors.push({ row: rowNumber, message: `Email invalide: ${email}` });
      invalidCount += 1;
      continue;
    }

    const normalizedEmail = email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      errors.push({ row: rowNumber, message: `Doublon detecte: ${email}` });
      duplicateCount += 1;
      continue;
    }
    seenEmails.add(normalizedEmail);

    const unsubscribed = parseBooleanMarker(
      getMappedValue(mapped, ["stop", "desinscrit", "desinscription", "unsubscribe", "unsubscribed", "opt_out"])
    );
    if (unsubscribed) {
      stopCount += 1;
    }

    contacts.push({
      email,
      first_name: getMappedValue(mapped, ["first_name", "prenom", "firstname"]),
      last_name: getMappedValue(mapped, ["last_name", "nom", "lastname"]),
      organization_name: getMappedValue(mapped, [
        "organization_name",
        "etablissement",
        "nom_ecole",
        "ecole",
        "entreprise",
        "societe"
      ]),
      city: getMappedValue(mapped, ["city", "ville", "commune"]),
      target_type: getMappedValue(mapped, ["target_type", "type_cible", "cible"]),
      role: getMappedValue(mapped, ["role", "fonction", "contact_role"]),
      event_date: getMappedValue(mapped, ["event_date", "date_evenement", "eventdate"]),
      event_type: getMappedValue(mapped, ["event_type", "type_evenement", "eventtype"]),
      gallery_url: getMappedValue(mapped, ["gallery_url", "galerie_url", "gallery"]),
      phone: getMappedValue(mapped, ["phone", "telephone", "tel"]),
      coupon_code: getMappedValue(mapped, ["coupon_code", "code_promo", "coupon"]) || "EVENT30",
      coupon_amount: getMappedValue(mapped, ["coupon_amount", "montant_coupon", "couponamount"]) || "30 €",
      notes: getMappedValue(mapped, ["notes", "note", "commentaire"]),
      unsubscribed,
      source: "csv"
    });
  }

  return {
    columns: headers,
    contacts,
    errors,
    summary: {
      total_rows: Math.max(0, lines.length - 1),
      valid: contacts.length,
      invalid: invalidCount,
      duplicates: duplicateCount,
      stop: stopCount
    }
  };
}

function normalizeContact(input: Partial<EmailContact>): EmailContact | null {
  const email = cleanText(input.email);
  if (!email || !isValidEmail(email)) {
    return null;
  }

  return {
    email,
    first_name: cleanText(input.first_name),
    last_name: cleanText(input.last_name),
    organization_name: cleanText(input.organization_name),
    city: cleanText(input.city),
    target_type: cleanText(input.target_type),
    role: cleanText(input.role),
    phone: cleanText(input.phone),
    event_date: cleanText(input.event_date),
    event_type: cleanText(input.event_type),
    gallery_url: cleanText(input.gallery_url),
    coupon_code: cleanText(input.coupon_code) || "EVENT30",
    coupon_amount: cleanText(input.coupon_amount) || "30 €",
    notes: cleanText(input.notes),
    unsubscribed: input.unsubscribed === true,
    source: "csv"
  };
}

function normalizeContactList(input: Partial<EmailContactList>): EmailContactList | null {
  const id = cleanText(input.id);
  const name = cleanText(input.name);

  if (!id || !name) {
    return null;
  }

  const contacts = Array.isArray(input.contacts)
    ? input.contacts
        .map((contact) => normalizeContact(contact))
        .filter((contact): contact is EmailContact => Boolean(contact))
    : [];

  return {
    id,
    name,
    created_at: cleanText(input.created_at) || new Date().toISOString(),
    contacts
  };
}

function normalizeCampaignItem(input: Partial<EmailCampaignHistoryItem>): EmailCampaignHistoryItem | null {
  const email = cleanText(input.email);
  if (!email) {
    return null;
  }

  const status: CampaignItemStatus =
    input.status === "pending" ||
    input.status === "sent" ||
    input.status === "failed" ||
    input.status === "skipped" ||
    input.status === "unsubscribed" ||
    input.status === "duplicate"
      ? input.status
      : "pending";

  return {
    email,
    first_name: cleanText(input.first_name),
    last_name: cleanText(input.last_name),
    organization_name: cleanText(input.organization_name),
    city: cleanText(input.city),
    target_type: cleanText(input.target_type),
    role: cleanText(input.role),
    status,
    message_id: cleanText(input.message_id),
    error_message: cleanText(input.error_message),
    sent_at: cleanText(input.sent_at)
  };
}

function normalizeCampaignHistoryEntry(
  input: Partial<EmailCampaignHistoryEntry>
): EmailCampaignHistoryEntry | null {
  const id = cleanText(input.id);
  if (!id) {
    return null;
  }

  const items = Array.isArray(input.items)
    ? input.items
        .map((item) => normalizeCampaignItem(item))
        .filter((item): item is EmailCampaignHistoryItem => Boolean(item))
    : [];

  const status =
    input.status === "draft" ||
    input.status === "sending" ||
    input.status === "partial" ||
    input.status === "completed" ||
    input.status === "failed"
      ? input.status
      : "draft";
  const settings = getCampaignSettings();
  const sent = typeof input.sent === "number" ? input.sent : items.filter((item) => item.status === "sent").length;
  const failed =
    typeof input.failed === "number"
      ? input.failed
      : items.filter((item) => item.status === "failed").length;
  const skipped =
    typeof input.skipped === "number"
      ? input.skipped
      : items.filter((item) => item.status === "skipped" || item.status === "unsubscribed").length;

  return {
    id,
    created_at: cleanText(input.created_at) || new Date().toISOString(),
    updated_at: cleanText(input.updated_at) || cleanText(input.created_at) || new Date().toISOString(),
    list_id: cleanText(input.list_id),
    preset_id: cleanText(input.preset_id),
    subject: cleanText(input.subject),
    list_name: cleanText(input.list_name),
    total: typeof input.total === "number" ? input.total : items.length,
    pending: typeof input.pending === "number" ? input.pending : items.filter((item) => item.status === "pending").length,
    sent,
    failed,
    skipped,
    daily_limit: typeof input.daily_limit === "number" ? input.daily_limit : settings.dailyLimit,
    batch_size: typeof input.batch_size === "number" ? input.batch_size : settings.batchSize,
    status,
    items
  };
}

export async function listEmailContactLists() {
  await ensureJsonFile(EMAIL_CONTACT_LISTS_PATH, "[]\n");
  const parsed = await readJsonFile<unknown>(EMAIL_CONTACT_LISTS_PATH, []);

  if (!Array.isArray(parsed)) {
    return [] as EmailContactList[];
  }

  return parsed
    .map((entry) => normalizeContactList(entry as Partial<EmailContactList>))
    .filter((entry): entry is EmailContactList => Boolean(entry))
    .sort((first, second) => second.created_at.localeCompare(first.created_at));
}

async function writeEmailContactLists(lists: EmailContactList[]) {
  await writeJsonFile(EMAIL_CONTACT_LISTS_PATH, lists);
}

export function getEmailCampaignSettings() {
  return getCampaignSettings();
}

export async function createEmailContactListFromCsv(input: {
  name?: string;
  csv_content: string;
}) {
  const preview = previewContactsFromCsv(input.csv_content);

  if (preview.contacts.length === 0) {
    throw new Error("Aucun contact valide detecte dans le CSV.");
  }

  const listName =
    cleanText(input.name) ||
    `Liste CSV ${new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date())}`;

  const lists = await listEmailContactLists();
  const created = {
    id: randomUUID(),
    name: listName,
    created_at: new Date().toISOString(),
    contacts: preview.contacts
  } satisfies EmailContactList;

  const next = [created, ...lists].slice(0, 100);
  await writeEmailContactLists(next);

  return {
    list: created,
    preview
  };
}

export async function deleteEmailContactList(listId: string) {
  const id = cleanText(listId);
  if (!id) {
    throw new Error("list_id manquant.");
  }

  const lists = await listEmailContactLists();
  const next = lists.filter((list) => list.id !== id);
  await writeEmailContactLists(next);

  return {
    ok: true
  };
}

export async function listEmailCampaignHistory() {
  await ensureJsonFile(EMAIL_CAMPAIGN_HISTORY_PATH, "[]\n");
  const parsed = await readJsonFile<unknown>(EMAIL_CAMPAIGN_HISTORY_PATH, []);

  if (!Array.isArray(parsed)) {
    return [] as EmailCampaignHistoryEntry[];
  }

  return parsed
    .map((entry) => normalizeCampaignHistoryEntry(entry as Partial<EmailCampaignHistoryEntry>))
    .filter((entry): entry is EmailCampaignHistoryEntry => Boolean(entry))
    .sort((first, second) => second.created_at.localeCompare(first.created_at));
}

async function writeEmailCampaignHistory(history: EmailCampaignHistoryEntry[]) {
  await writeJsonFile(EMAIL_CAMPAIGN_HISTORY_PATH, history);
}

async function upsertCampaignHistoryEntry(entry: EmailCampaignHistoryEntry) {
  const history = await listEmailCampaignHistory();
  const index = history.findIndex((item) => item.id === entry.id);

  if (index >= 0) {
    history[index] = entry;
  } else {
    history.unshift(entry);
  }

  await writeEmailCampaignHistory(history.slice(0, 300));
}

function buildVariablesForContact(
  contact: EmailContact,
  inputVariables: Record<string, unknown> | undefined
) {
  const firstName = cleanText(contact.first_name);
  const lastName = cleanText(contact.last_name);

  return {
    client_first_name: firstName,
    client_last_name: lastName,
    client_full_name: `${firstName} ${lastName}`.trim(),
    event_date: cleanText(contact.event_date),
    event_type: cleanText(contact.event_type),
    event_location: cleanText(contact.city),
    organization_name: cleanText(contact.organization_name),
    contact_role: cleanText(contact.role),
    gallery_url: cleanText(contact.gallery_url),
    google_review_url: "",
    coupon_code: cleanText(contact.coupon_code) || "EVENT30",
    coupon_amount: cleanText(contact.coupon_amount) || "30 €",
    custom_message: cleanText(contact.notes),
    company_name: "Event Pic",
    instagram_url: "https://www.instagram.com/_event_pic",
    phone_number: cleanText(contact.phone),
    ...(inputVariables && typeof inputVariables === "object"
      ? Object.entries(inputVariables).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = cleanText(value);
          return acc;
        }, {})
      : {})
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function normalizeDelaySeconds(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return getCampaignSettings().delaySeconds;
  }

  return Math.max(0, Math.min(60, Math.floor(value)));
}

function normalizeBatchSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return getCampaignSettings().batchSize;
  }

  return Math.max(1, Math.min(50, Math.floor(value)));
}

function normalizeDailyLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return getCampaignSettings().dailyLimit;
  }

  return Math.max(1, Math.min(500, Math.floor(value)));
}

function createCampaignItem(contact: EmailContact): EmailCampaignHistoryItem {
  return {
    email: contact.email,
    first_name: contact.first_name,
    last_name: contact.last_name,
    organization_name: contact.organization_name,
    city: contact.city,
    target_type: contact.target_type,
    role: contact.role,
    status: contact.unsubscribed ? "unsubscribed" : "pending",
    message_id: "",
    error_message: contact.unsubscribed ? "Contact marqué STOP / désinscrit." : "",
    sent_at: ""
  };
}

function refreshCampaignCounts(campaign: EmailCampaignHistoryEntry) {
  const sent = campaign.items.filter((item) => item.status === "sent").length;
  const failed = campaign.items.filter((item) => item.status === "failed").length;
  const skipped = campaign.items.filter((item) => item.status === "skipped" || item.status === "unsubscribed").length;
  const pending = campaign.items.filter((item) => item.status === "pending").length;

  return {
    ...campaign,
    updated_at: new Date().toISOString(),
    total: campaign.items.length,
    sent,
    failed,
    skipped,
    pending,
    status: pending > 0 ? (sent + failed + skipped > 0 ? "partial" : "draft") : sent > 0 ? "completed" : "failed"
  } satisfies EmailCampaignHistoryEntry;
}

function sentTodayCount(history: EmailCampaignHistoryEntry[]) {
  const today = new Date().toISOString().slice(0, 10);
  return history
    .filter((campaign) => campaign.created_at.slice(0, 10) === today)
    .reduce((total, campaign) => total + campaign.items.filter((item) => item.status === "sent").length, 0);
}

type CampaignSendInput = {
  campaign_id?: string;
  list_id: string;
  preset_id: string;
  subject_template: string;
  body_template: string;
  variables?: Record<string, unknown>;
  is_marketing?: boolean;
  marketing_consent?: boolean;
  batch_size?: number;
  delay_seconds?: number;
  daily_limit?: number;
};

export async function sendEmailCampaign(input: CampaignSendInput) {
  const campaignId = cleanText(input.campaign_id);
  const listId = cleanText(input.list_id);
  const subjectTemplate = cleanText(input.subject_template);
  const bodyTemplate = cleanText(input.body_template);
  const batchSize = normalizeBatchSize(input.batch_size);
  const delaySeconds = normalizeDelaySeconds(input.delay_seconds);
  const dailyLimit = normalizeDailyLimit(input.daily_limit);

  if (!listId) {
    throw new Error("Liste de contacts manquante.");
  }
  if (!subjectTemplate) {
    throw new Error("Sujet de campagne manquant.");
  }
  if (!bodyTemplate) {
    throw new Error("Message de campagne manquant.");
  }

  const lists = await listEmailContactLists();
  const selectedList = lists.find((list) => list.id === listId);
  if (!selectedList) {
    throw new Error("Liste de contacts introuvable.");
  }

  if (selectedList.contacts.length === 0) {
    throw new Error("La liste ne contient aucun contact.");
  }

  const isMarketing = input.is_marketing === true;
  const marketingConsent = input.marketing_consent === true;
  if (isMarketing && !marketingConsent) {
    throw new Error("Confirmation obligatoire avant envoi d'une campagne marketing.");
  }

  if (isMarketing && !bodyTemplate.toLowerCase().includes("stop")) {
    throw new Error("La mention STOP est obligatoire pour une campagne de prospection.");
  }

  const history = await listEmailCampaignHistory();
  const alreadySentToday = sentTodayCount(history);
  const remainingDaily = Math.max(0, dailyLimit - alreadySentToday);
  if (remainingDaily <= 0) {
    throw new Error(`Limite quotidienne atteinte (${dailyLimit} emails). Reprenez la campagne demain.`);
  }

  const existingCampaign = campaignId ? history.find((entry) => entry.id === campaignId) : null;
  let campaign: EmailCampaignHistoryEntry = existingCampaign
    ? {
        ...existingCampaign,
        list_id: existingCampaign.list_id || selectedList.id,
        preset_id: cleanText(input.preset_id) || existingCampaign.preset_id,
        subject: subjectTemplate,
        batch_size: batchSize,
        daily_limit: dailyLimit
      }
    : {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        list_id: selectedList.id,
        preset_id: cleanText(input.preset_id),
        subject: subjectTemplate,
        list_name: selectedList.name,
        total: selectedList.contacts.length,
        pending: selectedList.contacts.filter((contact) => !contact.unsubscribed).length,
        sent: 0,
        failed: 0,
        skipped: selectedList.contacts.filter((contact) => contact.unsubscribed).length,
        daily_limit: dailyLimit,
        batch_size: batchSize,
        status: "draft",
        items: selectedList.contacts.map(createCampaignItem)
      };

  campaign = refreshCampaignCounts(campaign);
  await upsertCampaignHistoryEntry({ ...campaign, status: "sending" });

  const pendingItems = campaign.items.filter((item) => item.status === "pending");
  const batchItems = pendingItems.slice(0, Math.min(batchSize, remainingDaily));
  const contactsByEmail = new Map(selectedList.contacts.map((contact) => [contact.email.toLowerCase(), contact]));

  if (batchItems.length === 0) {
    await upsertCampaignHistoryEntry(campaign);
    return campaign;
  }

  for (let index = 0; index < batchItems.length; index += 1) {
    const item = batchItems[index];
    const contact = contactsByEmail.get(item.email.toLowerCase());
    if (!contact || contact.unsubscribed) {
      item.status = contact?.unsubscribed ? "unsubscribed" : "skipped";
      item.error_message = contact?.unsubscribed ? "Contact marqué STOP / désinscrit." : "Contact introuvable dans la liste.";
      continue;
    }

    const variables = buildVariablesForContact(contact, input.variables);
    const payload: EmailPayload = {
      to: cleanText(contact.email),
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      preset_id: campaign.preset_id,
      variables,
      request_id: "",
      client_name: `${contact.first_name} ${contact.last_name}`.trim(),
      is_marketing: isMarketing,
      marketing_consent: marketingConsent
    };

    try {
      const sendResult = await sendEmail(payload);
      if (sendResult.mode === "sent") {
        item.status = "sent";
        item.message_id = cleanText(sendResult.messageId);
        item.error_message = "";
        item.sent_at = new Date().toISOString();
      } else {
        item.status = "failed";
        item.message_id = "";
        item.error_message = cleanText(sendResult.message || "Envoi automatique non configuré.");
        item.sent_at = new Date().toISOString();
      }
    } catch (error) {
      item.status = "failed";
      item.message_id = "";
      item.error_message = error instanceof Error ? error.message : "Envoi impossible.";
      item.sent_at = new Date().toISOString();
    }

    campaign = refreshCampaignCounts(campaign);
    await upsertCampaignHistoryEntry({ ...campaign, status: "sending" });

    if (delaySeconds > 0 && index < batchItems.length - 1) {
      await sleep(delaySeconds * 1000);
    }
  }

  campaign = refreshCampaignCounts(campaign);
  await upsertCampaignHistoryEntry(campaign);

  return campaign;
}

export async function sendEmailCampaignTest(input: {
  list_id: string;
  to: string;
  preset_id: string;
  subject_template: string;
  body_template: string;
  variables?: Record<string, unknown>;
  is_marketing?: boolean;
  marketing_consent?: boolean;
}) {
  const listId = cleanText(input.list_id);
  const to = cleanText(input.to);
  if (!listId) {
    throw new Error("Liste de contacts manquante.");
  }
  if (!to || !isValidEmail(to)) {
    throw new Error("Adresse email de test invalide.");
  }

  const lists = await listEmailContactLists();
  const selectedList = lists.find((list) => list.id === listId);
  if (!selectedList || selectedList.contacts.length === 0) {
    throw new Error("Aucun contact disponible dans la liste pour le test.");
  }

  const sampleContact = selectedList.contacts[0];
  const variables = buildVariablesForContact(sampleContact, input.variables);

  return sendTestEmail({
    to,
    subject_template: cleanText(input.subject_template),
    body_template: cleanText(input.body_template),
    preset_id: cleanText(input.preset_id),
    variables,
    request_id: "",
    client_name: `${sampleContact.first_name} ${sampleContact.last_name}`.trim(),
    is_marketing: input.is_marketing === true,
    marketing_consent: input.marketing_consent === true
  });
}

export async function exportEmailCampaignResultsCsv(campaignId: string) {
  const id = cleanText(campaignId);
  if (!id) {
    throw new Error("Campagne introuvable.");
  }

  const history = await listEmailCampaignHistory();
  const campaign = history.find((entry) => entry.id === id);

  if (!campaign) {
    throw new Error("Campagne introuvable.");
  }

  const rows = [
    "email,status,message_id,error_message",
    ...campaign.items.map((item) =>
      [
        item.email,
        item.status,
        item.message_id,
        `"${item.error_message.replace(/"/g, '""')}"`
      ].join(",")
    )
  ];

  return rows.join("\n");
}
