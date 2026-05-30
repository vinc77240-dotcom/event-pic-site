import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  EventPicAiPreparation,
  EventPicSelectedTemplate,
  EventPicTemplateProductionBrief,
  EventPicSelectedTemplateInput,
  EventPicTemplateRequest,
  EventPicTemplateRequestAutomation,
  EventPicTemplateRequestInput,
  EventPicTemplateRequestStatus,
  TEMPLATE_REQUEST_STATUSES,
  isEventPicTemplateRequestStatus
} from "@/src/shared/eventPicTemplates";
import { getCachedTemplateById } from "@/src/server/eventPicTemplateService";
import { autoResolveWelcomeForSelection } from "@/src/server/templateboothWelcomeService";
import { getTemplateSourceLink } from "@/src/server/templateSourceLinks";

const requestPath = path.join(process.cwd(), "data", "template-requests.json");
const TEMPLATE_REQUESTS_BLOB_PATH = "admin/template-requests.json";
const TEMPLATE_REQUESTS_BLOB_BACKUP_PREFIX = "admin/backups/template-requests";
const JSON_BLOB_ACCESS = "private" as const;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

async function ensureRequestFile() {
  await fs.mkdir(path.dirname(requestPath), { recursive: true });

  try {
    await fs.access(requestPath);
  } catch {
    await fs.writeFile(requestPath, "[]", "utf8");
  }
}

function hasBlobReadWriteToken() {
  return optionalText(process.env.BLOB_READ_WRITE_TOKEN).length > 0;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function shouldUseBlobStorage() {
  return hasBlobReadWriteToken();
}

function shouldUseLocalStorage() {
  return !shouldUseBlobStorage() && !isVercelRuntime();
}

function missingTemplateRequestsBlobTokenMessage() {
  return "BLOB_READ_WRITE_TOKEN manquant: les demandes de design doivent utiliser Vercel Blob en production.";
}

function backupTimestamp() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readLocalRequestsRaw({ createIfMissing }: { createIfMissing: boolean }) {
  try {
    if (createIfMissing) {
      await ensureRequestFile();
    }

    return await fs.readFile(requestPath, "utf8");
  } catch {
    return "[]\n";
  }
}

async function readBlobRequestsRaw() {
  try {
    const result = await get(TEMPLATE_REQUESTS_BLOB_PATH, {
      access: JSON_BLOB_ACCESS,
      useCache: false
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    return await new Response(result.stream).text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.toLowerCase().includes("not found")) {
      return null;
    }

    throw new Error(
      `Lecture Vercel Blob impossible pour ${TEMPLATE_REQUESTS_BLOB_PATH}: ${message || "erreur inconnue"}`
    );
  }
}

async function writeBlobText(pathname: string, contents: string, allowOverwrite = true) {
  await put(pathname, contents, {
    access: JSON_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: JSON_CONTENT_TYPE,
    cacheControlMaxAge: 60
  });
}

function serializeRequests(requests: EventPicTemplateRequest[]) {
  return `${JSON.stringify(requests.map(normalizeStoredRequest), null, 2)}\n`;
}

function parseRequests(raw: string): EventPicTemplateRequest[] {
  const parsed = JSON.parse(raw) as EventPicTemplateRequest[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(normalizeStoredRequest);
}

async function readBlobOrSeedRequestsRaw() {
  const blobRaw = await readBlobRequestsRaw();

  if (blobRaw !== null) {
    return blobRaw;
  }

  const seedRaw = await readLocalRequestsRaw({ createIfMissing: false });
  const normalizedSeed = serializeRequests(parseRequests(seedRaw));
  await writeBlobText(TEMPLATE_REQUESTS_BLOB_PATH, normalizedSeed);
  return normalizedSeed;
}

async function readRequests(): Promise<EventPicTemplateRequest[]> {
  if (shouldUseBlobStorage()) {
    return parseRequests(await readBlobOrSeedRequestsRaw());
  }

  if (!shouldUseLocalStorage()) {
    throw new Error(missingTemplateRequestsBlobTokenMessage());
  }

  return parseRequests(await readLocalRequestsRaw({ createIfMissing: true }));
}

async function writeLocalRequests(requests: EventPicTemplateRequest[]) {
  await ensureRequestFile();
  await fs.writeFile(requestPath, serializeRequests(requests), "utf8");
}

async function writeBlobRequests(requests: EventPicTemplateRequest[]) {
  const currentRaw = await readBlobRequestsRaw();

  if (currentRaw !== null && currentRaw.trim().length > 0) {
    const backupPath = `${TEMPLATE_REQUESTS_BLOB_BACKUP_PREFIX}-${backupTimestamp()}.json`;
    await writeBlobText(backupPath, currentRaw, false);
  }

  await writeBlobText(TEMPLATE_REQUESTS_BLOB_PATH, serializeRequests(requests));
}

async function writeRequests(requests: EventPicTemplateRequest[]) {
  if (shouldUseBlobStorage()) {
    await writeBlobRequests(requests);
    return;
  }

  if (shouldUseLocalStorage()) {
    await writeLocalRequests(requests);
    return;
  }

  throw new Error(missingTemplateRequestsBlobTokenMessage());
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Champ obligatoire manquant : ${field}.`);
  }

  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizeSelectedTemplates(value: unknown): EventPicSelectedTemplateInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Sélection de templates invalide.");
  }

  if (value.length < 3 || value.length > 5) {
    throw new Error("Sélectionnez entre 3 et 5 formats.");
  }

  const templates = value.map((item, index) => {
    const template = item as Partial<EventPicSelectedTemplateInput>;
    const isPlaceholder = Boolean(template.placeholder);
    const sourceKind =
      template.source_kind === "templatebooth" || template.source_kind === "event_pic_task"
        ? template.source_kind
        : isPlaceholder
          ? "event_pic_task"
          : "templatebooth";

    return {
      id: requireText(template.id, `selected_templates[${index}].id`),
      name: requireText(template.name, `selected_templates[${index}].name`),
      preview_url: requireText(template.preview_url, `selected_templates[${index}].preview_url`),
      layout: requireText(template.layout, `selected_templates[${index}].layout`),
      format_label: requireText(template.format_label, `selected_templates[${index}].format_label`),
      no_of_images: optionalPositiveInteger(template.no_of_images),
      type: typeof template.type === "string" ? template.type : undefined,
      type_name: typeof template.type_name === "string" && template.type_name.trim() ? template.type_name.trim() : "Template",
      required: typeof template.required === "boolean" ? template.required : false,
      placeholder: isPlaceholder,
      production_needed: typeof template.production_needed === "boolean" ? template.production_needed : isPlaceholder,
      source_kind: sourceKind,
      post_url: typeof template.post_url === "string" && template.post_url.trim() ? template.post_url.trim() : undefined,
      requires_resize: Boolean(template.requires_resize),
      source_width: optionalPositiveInteger(template.source_width),
      source_height: optionalPositiveInteger(template.source_height),
      target_width: optionalPositiveInteger(template.target_width),
      target_height: optionalPositiveInteger(template.target_height),
      published_at: null
    };
  });

  const duplicateIds = templates
    .map((template) => template.id)
    .filter((id, index, all) => all.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    throw new Error("Un même format ne peut pas être sélectionné plusieurs fois.");
  }

  const requiredTemplates = templates.filter((template) => template.required);
  const optionalTemplates = templates.filter((template) => !template.required);
  const hasRequiredPortrait = requiredTemplates.some(
    (template) => template.layout === "46postcard-p" && template.no_of_images === 1
  );
  const hasRequiredLandscape = requiredTemplates.some(
    (template) => template.layout === "46postcard-l" && template.no_of_images === 1
  );
  const requiredWelcome = requiredTemplates.find(
    (template) =>
      template.type === "static_welcome_screen" ||
      template.type === "animated_welcome_screen" ||
      (typeof template.type_name === "string" && template.type_name.toLowerCase().includes("welcome")) ||
      template.format_label.includes("Fond d'ecran") ||
      template.placeholder === true
  );
  const hasRequiredWelcome = Boolean(requiredWelcome);
  const hasValidWelcomeTarget =
    (requiredWelcome?.target_width ?? 1920) === 1920 && (requiredWelcome?.target_height ?? 1080) === 1080;

  if (!hasRequiredPortrait || !hasRequiredLandscape || !hasRequiredWelcome || requiredTemplates.length !== 3) {
    throw new Error(
      "Les formats obligatoires Portrait 10x15 / 4x6 (1 photo), Paysage 10x15 / 4x6 (1 photo) et Welcome screen 1920x1080 sont requis."
    );
  }

  if (!hasValidWelcomeTarget) {
    throw new Error("Le fond d'écran obligatoire doit cibler le format 1920x1080.");
  }

  if (optionalTemplates.length > 2) {
    throw new Error("Vous pouvez ajouter au maximum 2 formats optionnels.");
  }

  return templates;
}

function normalizeInput(input: Partial<EventPicTemplateRequestInput>): EventPicTemplateRequestInput {
  return {
    client: {
      first_name: requireText(input.client?.first_name, "client.first_name"),
      last_name: requireText(input.client?.last_name, "client.last_name"),
      email: requireText(input.client?.email, "client.email"),
      phone: requireText(input.client?.phone, "client.phone")
    },
    event: {
      date: requireText(input.event?.date, "event.date"),
      type: requireText(input.event?.type, "event.type")
    },
    selected_templates: normalizeSelectedTemplates(input.selected_templates),
    customization: {
      main_text: requireText(input.customization?.main_text, "customization.main_text"),
      secondary_text: optionalText(input.customization?.secondary_text),
      notes: optionalText(input.customization?.notes)
    },
    linked_contact_request_id: optionalText(input.linked_contact_request_id) || undefined
  };
}

async function enrichSelectedTemplates(templates: EventPicSelectedTemplateInput[]): Promise<EventPicSelectedTemplate[]> {
  const enrichedTemplates = await Promise.all(
    templates.map(async (template) => {
      const mappedSource = await getTemplateSourceLink({
        template_id: template.id,
        post_url: template.post_url,
        format_label: template.format_label,
        layout: template.layout,
        no_of_images: template.no_of_images ?? undefined
      });

      if (template.placeholder) {
        return {
          ...template,
          production_needed: template.production_needed ?? true,
          source_kind: template.source_kind ?? "event_pic_task",
          post_url: undefined,
          photoshop_download_url: mappedSource?.psd_source_url ?? null,
          psd_url: mappedSource?.psd_source_url ?? null,
          zip_url: null,
          source_file_url: mappedSource?.psd_source_url ?? null,
          download_url: null
        };
      }

      const cachedTemplate = await getCachedTemplateById(template.id);

      return {
        ...template,
        production_needed: template.production_needed ?? false,
        source_kind: template.source_kind ?? "templatebooth",
        post_url: template.post_url ?? cachedTemplate?.post_url,
        photoshop_download_url: cachedTemplate?.photoshop_download_url ?? mappedSource?.psd_source_url ?? null,
        psd_url: cachedTemplate?.psd_url ?? mappedSource?.psd_source_url ?? null,
        zip_url: cachedTemplate?.zip_url ?? null,
        source_file_url: cachedTemplate?.source_file_url ?? mappedSource?.psd_source_url ?? null,
        download_url: cachedTemplate?.download_url ?? null
      };
    })
  );

  return enrichedTemplates;
}

function defaultAutomation(): EventPicTemplateRequestAutomation {
  return {
    canva_folder_status: "pending",
    canva_folder_id: null,
    canva_folder_url: null
  };
}

function defaultAiPreparation(): EventPicAiPreparation {
  return {
    status: "not_started",
    started_at: null,
    completed_at: null,
    error_message: null,
    progress_label: null,
    brief: null,
    checklist: [],
    generated_files: []
  };
}

function normalizeStoredRequest(request: EventPicTemplateRequest): EventPicTemplateRequest {
  const ai = (request as Partial<EventPicTemplateRequest>).ai_preparation;
  const fallbackBrief = (request as Partial<EventPicTemplateRequest>).ai_preparation_brief;
  const baseAi = defaultAiPreparation();

  const normalizedAi: EventPicAiPreparation = {
    ...baseAi,
    ...(ai ?? {}),
    brief: ai?.brief ?? fallbackBrief ?? null,
    checklist: Array.isArray(ai?.checklist) ? ai.checklist : [],
    generated_files: Array.isArray(ai?.generated_files) ? ai.generated_files : []
  };

  return {
    ...request,
    linked_contact_request_id: optionalText(request.linked_contact_request_id) || undefined,
    automation: {
      ...defaultAutomation(),
      ...request.automation
    },
    ai_preparation: normalizedAi
  };
}

export async function listEventPicTemplateRequests() {
  const requests = await readRequests();
  return requests.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getEventPicTemplateRequest(id: string) {
  const requests = await readRequests();
  return requests.find((request) => request.id === id);
}

export async function createEventPicTemplateRequest(input: Partial<EventPicTemplateRequestInput>) {
  const normalizedInput = normalizeInput(input);
  const selectedTemplatesWithWelcome = await autoResolveWelcomeForSelection({
    selected_templates: normalizedInput.selected_templates,
    category: normalizedInput.event.type
  });
  const selectedTemplates = await enrichSelectedTemplates(selectedTemplatesWithWelcome);
  const now = new Date().toISOString();
  const request: EventPicTemplateRequest = {
    ...normalizedInput,
    selected_templates: selectedTemplates,
    automation: defaultAutomation(),
    ai_preparation: defaultAiPreparation(),
    id: randomUUID(),
    status: "a_preparer",
    created_at: now,
    updated_at: now
  };
  const requests = await readRequests();

  requests.unshift(request);
  await writeRequests(requests);

  return request;
}

export async function updateEventPicTemplateRequestStatus(id: string, status: EventPicTemplateRequestStatus) {
  if (!isEventPicTemplateRequestStatus(status)) {
    throw new Error("Statut de demande non reconnu.");
  }

  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new Error("Demande client introuvable.");
  }

  requests[index] = {
    ...requests[index],
    status,
    updated_at: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export async function updateEventPicTemplateRequestAutomation(
  id: string,
  automation: Partial<EventPicTemplateRequestAutomation>
) {
  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new Error("Demande client introuvable.");
  }

  requests[index] = {
    ...requests[index],
    automation: {
      ...defaultAutomation(),
      ...requests[index].automation,
      ...automation
    },
    updated_at: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export async function updateEventPicTemplateRequestAiBrief(
  id: string,
  brief: EventPicTemplateProductionBrief
) {
  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new Error("Demande client introuvable.");
  }

  requests[index] = {
    ...requests[index],
    ai_preparation: {
      ...defaultAiPreparation(),
      ...requests[index].ai_preparation,
      status: "completed",
      started_at: requests[index].ai_preparation?.started_at ?? new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: null,
      progress_label: "Fiche de preparation terminee",
      brief,
      checklist: [
        ...brief.photoshop_checklist,
        ...(brief.canva_checklist ?? []),
        ...brief.lumabooth_checklist
      ],
      generated_files: brief.file_naming_recommendations
    },
    ai_preparation_brief: brief,
    updated_at: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export async function updateEventPicTemplateRequestAiPreparation(
  id: string,
  updates: Partial<EventPicAiPreparation>
) {
  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new Error("Demande client introuvable.");
  }

  requests[index] = {
    ...requests[index],
    ai_preparation: {
      ...defaultAiPreparation(),
      ...requests[index].ai_preparation,
      ...updates,
      checklist: Array.isArray(updates.checklist)
        ? updates.checklist
        : requests[index].ai_preparation.checklist,
      generated_files: Array.isArray(updates.generated_files)
        ? updates.generated_files
        : requests[index].ai_preparation.generated_files
    },
    updated_at: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export async function deleteEventPicTemplateRequest(id: string) {
  const requests = await readRequests();
  const nextRequests = requests.filter((request) => request.id !== id);

  if (nextRequests.length === requests.length) {
    throw new Error("Demande client introuvable.");
  }

  await writeRequests(nextRequests);
  return true;
}

function isWelcomeTemplateSelection(template: EventPicSelectedTemplate) {
  return (
    template.required &&
    (template.type === "static_welcome_screen" ||
      template.type === "animated_welcome_screen" ||
      template.format_label.includes("Fond d'ecran") ||
      template.placeholder === true)
  );
}

export async function replaceEventPicTemplateRequestWelcomeTemplate(
  id: string,
  template: EventPicSelectedTemplate
) {
  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new Error("Demande client introuvable.");
  }

  const welcomeIndex = requests[index].selected_templates.findIndex((selectedTemplate) =>
    isWelcomeTemplateSelection(selectedTemplate)
  );

  if (welcomeIndex === -1) {
    throw new Error("Format fond d'ecran obligatoire introuvable.");
  }

  const normalizedTemplate: EventPicSelectedTemplate = {
    ...template,
    required: true,
    format_label: "Fond d'ecran 1920x1080",
    target_width: 1920,
    target_height: 1080
  };

  requests[index] = {
    ...requests[index],
    selected_templates: requests[index].selected_templates.map((selectedTemplate, selectedIndex) =>
      selectedIndex === welcomeIndex ? normalizedTemplate : selectedTemplate
    ),
    updated_at: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export function getDefaultEventPicTemplateRequestStatus() {
  return TEMPLATE_REQUEST_STATUSES[0].value;
}
