import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CustomizationRequest,
  CustomizationRequestInput,
  CustomizationStatus,
  CanvaReviewStatus,
  PhotoboothTemplate,
  REQUEST_STATUS_OPTIONS
} from "@/src/shared/templatebooth";
import { TemplateBoothError } from "./errors";

const requestPath = path.join(process.cwd(), "data", "customization-requests.json");

async function ensureRequestFile() {
  await fs.mkdir(path.dirname(requestPath), { recursive: true });

  try {
    await fs.access(requestPath);
  } catch {
    await fs.writeFile(requestPath, "[]", "utf8");
  }
}

async function readRequests(): Promise<CustomizationRequest[]> {
  await ensureRequestFile();
  const raw = await fs.readFile(requestPath, "utf8");
  return JSON.parse(raw) as CustomizationRequest[];
}

async function writeRequests(requests: CustomizationRequest[]) {
  await ensureRequestFile();
  await fs.writeFile(requestPath, `${JSON.stringify(requests, null, 2)}\n`, "utf8");
}

export async function listCustomizationRequests() {
  const requests = await readRequests();
  return requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCustomizationRequest(id: string) {
  const requests = await readRequests();
  return requests.find((request) => request.id === id);
}

export async function createLocalCustomizationRequest(
  input: CustomizationRequestInput,
  template: PhotoboothTemplate
) {
  const now = new Date().toISOString();
  const requests = await readRequests();
  const request: CustomizationRequest = {
    ...input,
    id: randomUUID(),
    templateName: template.name,
    templateFormat: template.format,
    templatePreviewImage: template.previewImage ?? input.templatePreviewImage,
    templateBoothUrl: template.templateBoothUrl,
    canvaTemplateUrl: template.canvaTemplateUrl ?? input.canvaTemplateUrl,
    canvaUrl: template.canvaTemplateUrl ?? template.canvaUrl ?? input.canvaUrl,
    finalCanvaUrl: input.finalCanvaUrl,
    canvaReviewStatus: input.finalCanvaUrl ? "a_verifier" : "a_corriger",
    status: input.finalCanvaUrl ? "a_verifier" : "a_personnaliser",
    createdAt: now,
    updatedAt: now
  };

  requests.unshift(request);
  await writeRequests(requests);
  return request;
}

export async function updateCustomizationRequest(
  id: string,
  changes: Partial<Pick<CustomizationRequest, "status" | "canvaReviewStatus" | "adminNote" | "remoteReference">>
) {
  const requests = await readRequests();
  const index = requests.findIndex((request) => request.id === id);

  if (index === -1) {
    throw new TemplateBoothError("Demande client introuvable.", "template_not_found", 404);
  }

  if (changes.status && !REQUEST_STATUS_OPTIONS.some((status) => status.value === changes.status)) {
    throw new TemplateBoothError("Statut de demande non reconnu.", "invalid_request", 400);
  }

  if (changes.canvaReviewStatus && !["a_verifier", "a_corriger", "valide"].includes(changes.canvaReviewStatus)) {
    throw new TemplateBoothError("Statut Canva non reconnu.", "invalid_request", 400);
  }

  const definedChanges = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined)
  ) as typeof changes;

  requests[index] = {
    ...requests[index],
    ...definedChanges,
    updatedAt: new Date().toISOString()
  };

  await writeRequests(requests);
  return requests[index];
}

export function isCustomizationStatus(value: unknown): value is CustomizationStatus {
  return REQUEST_STATUS_OPTIONS.some((status) => status.value === value);
}

export function isCanvaReviewStatus(value: unknown): value is CanvaReviewStatus {
  return value === "a_verifier" || value === "a_corriger" || value === "valide";
}
