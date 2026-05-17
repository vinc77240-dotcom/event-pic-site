import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CustomizationRequestInput,
  PhotoboothTemplate,
  TEMPLATE_FORMATS,
  TemplateCatalogResult,
  TemplateDetailResult,
  TemplateFilterOption,
  TemplateFormat,
  TemplateFormatQuery,
  isTemplateFormat
} from "@/src/shared/templatebooth";
import { TemplateBoothError, getFallbackWarning } from "./errors";
import { getLocalTemplateById, getLocalTemplates } from "./localCatalog";
import { createLocalCustomizationRequest, updateCustomizationRequest } from "./requestStore";

const DEFAULT_TEMPLATEBOOTH_BASE_URL = "https://templatesbooth.com/wp-json/tb/v1";
const DEFAULT_PAGE = "1";
const DEFAULT_PER_PAGE = "48";
const canvaLinksPath = path.join(process.cwd(), "data", "canva-template-links.json");
const TEMPLATEBOOTH_QUERY_KEYS = [
  "page",
  "per_page",
  "layout",
  "image_type",
  "no_of_images",
  "tag",
  "tags",
  "search",
  "type",
  "text_display"
] as const;

type RemoteTemplatePayload = Record<string, unknown>;
type RemoteTemplatesResponse = {
  page?: number | string;
  per_page?: number | string;
  total?: number | string;
  total_pages?: number | string;
  data?: RemoteTemplatePayload[];
};
type RemoteFiltersResponse = Record<string, unknown>;
type CanvaTemplateLink = {
  template_id: string;
  name?: string;
  format?: string;
  layout?: string;
  preview_url?: string;
  post_url?: string;
  canva_template_url?: string;
  event_type?: string;
  tags?: string[];
  full_width?: boolean;
};
type TemplateBoothFetchResult<T> = {
  payload: T;
  status: number;
  url: string;
};

export type TemplateBoothApiDiagnostic = {
  ok: boolean;
  status: number | null;
  total: number;
  count: number;
  sample: unknown;
  fallbackLocalUsed: boolean;
  url: string;
  error?: string;
};

function requireTemplateBoothConfig() {
  const apiKey = process.env.TEMPLATEBOOTH_API_KEY;
  const baseUrl = process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL;

  if (!apiKey) {
    throw new TemplateBoothError(
      "Cle API TemplateBooth absente. Ajoutez TEMPLATEBOOTH_API_KEY dans .env.local.",
      "missing_api_key",
      500
    );
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, "")
  };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value && typeof value === "object" && "rendered" in value && typeof value.rendered === "string") {
    return value.rendered.trim();
  }

  return undefined;
}

function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function buildPath(path: string, query?: TemplateFormatQuery) {
  if (!query || Object.keys(query).length === 0) {
    return path;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return `${path}?${params.toString()}`;
}

function normalizeTemplateQuery(query?: TemplateFormatQuery): TemplateFormatQuery {
  return {
    ...(query ?? {}),
    page: query?.page ?? DEFAULT_PAGE,
    per_page: query?.per_page ?? DEFAULT_PER_PAGE
  };
}

function queryFromSearchParams(searchParams: URLSearchParams): TemplateFormatQuery {
  const query: TemplateFormatQuery = {};

  for (const key of TEMPLATEBOOTH_QUERY_KEYS) {
    const value = searchParams.get(key);

    if (value) {
      query[key] = value;
    }
  }

  return query;
}

export function queryForTemplateFormat(format: TemplateFormat): TemplateFormatQuery {
  const meta = TEMPLATE_FORMATS.find((item) => item.value === format);
  return meta?.query ?? {};
}

async function templateBoothFetchWithMeta<T>(path: string, init?: RequestInit): Promise<TemplateBoothFetchResult<T>> {
  const config = requireTemplateBoothConfig();
  const headers = new Headers(init?.headers);
  const method = init?.method ?? "GET";
  const url = `${config.baseUrl}${path}`;

  headers.set("Content-Type", "application/json");
  headers.set("X-API-Key", config.apiKey);

  console.info(`[TemplateBooth] URL appelee: ${method} ${url}`);
  console.info(`[TemplateBooth] Header X-API-Key: ${headers.has("X-API-Key") ? "present" : "absent"}`);

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers
    });
  } catch (error) {
    console.error(`[TemplateBooth] Erreur reseau: ${getErrorMessage(error)}`);
    throw new TemplateBoothError(
      "API TemplateBooth indisponible. Le catalogue local peut prendre le relais.",
      "api_unavailable",
      503,
      error
    );
  }

  console.info(`[TemplateBooth] Status HTTP: ${response.status}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`[TemplateBooth] Erreur API: ${errorBody || response.statusText || response.status}`);
    throw new TemplateBoothError(`API TemplateBooth indisponible ou refusee (${response.status}).`, "api_unavailable", response.status);
  }

  try {
    const payload = (await response.json()) as T;
    const count = Array.isArray((payload as RemoteTemplatesResponse).data)
      ? ((payload as RemoteTemplatesResponse).data ?? []).length
      : 0;
    console.info(`[TemplateBooth] Templates recus dans response.data: ${count}`);

    return {
      payload,
      status: response.status,
      url
    };
  } catch (error) {
    console.error(`[TemplateBooth] Erreur parsing JSON: ${getErrorMessage(error)}`);
    throw new TemplateBoothError("Reponse API TemplateBooth illisible.", "incomplete_response", 502, error);
  }
}

async function templateBoothFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await templateBoothFetchWithMeta<T>(path, init);
  return result.payload;
}

function getErrorMessage(error: unknown) {
  if (error instanceof TemplateBoothError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur TemplateBooth inconnue.";
}

function sanitizeApiSample(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => sanitizeApiSample(item, depth + 1));
  }

  const object = objectValue(value);

  if (!object) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(object)
      .filter(([key]) => !/(api.?key|key|token|secret|authorization|password|post_url)/i.test(key))
      .map(([key, item]) => [key, sanitizeApiSample(item, depth + 1)])
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function titleFromUrl(value: unknown) {
  const url = stringValue(value);

  if (!url) {
    return undefined;
  }

  const slug = url.split("?")[0]?.replace(/\/$/, "").split("/").filter(Boolean).pop();

  if (!slug) {
    return undefined;
  }

  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function templateIdFromPostUrl(value: unknown) {
  const url = stringValue(value);

  if (!url) {
    return undefined;
  }

  return url.split("?")[0]?.replace(/\/$/, "").split("/").filter(Boolean).pop();
}

function templateIdFromAssetUrl(value: unknown) {
  const segment = templateIdFromPostUrl(value);

  if (!segment) {
    return undefined;
  }

  return segment.replace(/\.[a-z0-9]+$/i, "");
}

function templateBoothUrlFromTemplateId(templateId: string) {
  return `https://templatesbooth.com/premium/${templateId}/`;
}

async function getCanvaTemplateLinks(): Promise<CanvaTemplateLink[]> {
  try {
    const raw = await fs.readFile(canvaLinksPath, "utf8");
    const links = JSON.parse(raw) as CanvaTemplateLink[];
    return Array.isArray(links) ? links : [];
  } catch {
    return [];
  }
}

function findCanvaMapping(template: Pick<PhotoboothTemplate, "templateId" | "templateBoothUrl">, links: CanvaTemplateLink[]) {
  return links.find(
    (link) =>
      link.template_id === template.templateId ||
      (link.post_url && template.templateBoothUrl && link.post_url.replace(/\/$/, "") === template.templateBoothUrl.replace(/\/$/, ""))
  );
}

function formatFromRemoteTemplate(payload: RemoteTemplatePayload, fallbackFormat?: TemplateFormat): TemplateFormat | undefined {
  if (fallbackFormat) {
    return fallbackFormat;
  }

  const layout = stringValue(payload.layout_size ?? payload.layout)?.toLowerCase();
  const type = stringValue(payload.type)?.toLowerCase();

  if (layout === "26strip") return "vertical-2x6";
  if (layout === "46postcard-p") return "portrait-4x6";
  if (layout === "46postcard-l") return "landscape-4x6-multi";
  if (type === "static_welcome_screen") return "welcome-1920x1080";
  if (type === "animated_welcome_screen") return "welcome-1920x1080";

  return undefined;
}

function normalizeTemplate(
  payload: RemoteTemplatePayload,
  fallbackFormat?: TemplateFormat,
  canvaLinks: CanvaTemplateLink[] = []
): PhotoboothTemplate | undefined {
  const postUrl = stringValue(payload.post_url);
  const src = stringValue(payload.src);
  const poster = stringValue(payload.poster);
  const videoUrl = stringValue(payload.video_url);
  const templateId =
    stringValue(payload.template_id ?? payload.id ?? payload.post_id) ??
    templateIdFromPostUrl(postUrl) ??
    templateIdFromAssetUrl(src ?? poster ?? videoUrl);
  const id = templateId ?? stringValue(videoUrl ?? src ?? poster);
  const format = formatFromRemoteTemplate(payload, fallbackFormat);

  if (!id || !templateId || !format) {
    return undefined;
  }

  const name =
    stringValue(payload.name ?? payload.title ?? payload.post_title)?.replace(/<[^>]*>/g, "").trim() ??
    titleFromUrl(postUrl) ??
    stringValue(payload.type_name) ??
    "Template TemplateBooth";
  const previewImage = poster ?? src ?? "/template-previews/fallback.svg";

  const baseTemplate: PhotoboothTemplate = {
    id,
    templateId,
    name: stripHtml(name),
    theme: stringValue(payload.type_name ?? payload.theme ?? payload.category) ?? "TemplateBooth",
    format,
    photoCount: numberValue(payload.no_of_images, 0),
    mainColors: [],
    previewImage,
    src,
    poster,
    videoUrl,
    mediaType: videoUrl ? "video" : "image",
    compatibility: {},
    templateBoothUrl: postUrl,
    canvaTemplateUrl: stringValue(payload.canva_template_url ?? payload.canvaUrl ?? payload.canva_url ?? payload.canva_link ?? payload.edit_in_canva_url),
    canvaUrl: stringValue(payload.canva_template_url ?? payload.canvaUrl ?? payload.canva_url ?? payload.canva_link ?? payload.edit_in_canva_url),
    templateBoothType: stringValue(payload.type_name ?? payload.type),
    layoutSize: stringValue(payload.layout_size),
    orientation: stringValue(payload.image_type),
    publishedAt: stringValue(payload.published_at),
    eventType: stringValue(payload.event_type),
    tags: Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === "string") : [],
    fullWidth: Boolean(payload.full_width),
    source: "templatebooth"
  };

  const mapping = findCanvaMapping(baseTemplate, canvaLinks);

  return {
    ...baseTemplate,
    name: mapping?.name ?? baseTemplate.name,
    previewImage: mapping?.preview_url || baseTemplate.previewImage,
    canvaTemplateUrl: mapping?.canva_template_url || baseTemplate.canvaTemplateUrl,
    canvaUrl: mapping?.canva_template_url || baseTemplate.canvaUrl,
    eventType: mapping?.event_type ?? baseTemplate.eventType,
    tags: mapping?.tags ?? baseTemplate.tags,
    fullWidth: mapping?.full_width ?? baseTemplate.fullWidth
  };
}

function normalizeTemplatesResponse(
  payload: RemoteTemplatesResponse,
  fallbackFormat?: TemplateFormat,
  canvaLinks: CanvaTemplateLink[] = []
): Omit<TemplateCatalogResult, "source" | "warning"> {
  if (!Array.isArray(payload.data)) {
    throw new TemplateBoothError("Reponse API TemplateBooth incomplete : champ data absent.", "incomplete_response", 502);
  }

  return {
    templates: payload.data
      .map((item) => normalizeTemplate(item, fallbackFormat, canvaLinks))
      .filter((template): template is PhotoboothTemplate => Boolean(template)),
    page: numberValue(payload.page, 1),
    perPage: numberValue(payload.per_page, DEFAULT_PER_PAGE ? Number(DEFAULT_PER_PAGE) : 48),
    total: numberValue(payload.total, payload.data.length),
    totalPages: numberValue(payload.total_pages, 1)
  };
}

async function getFallbackTemplates(error: unknown, format?: TemplateFormat): Promise<TemplateCatalogResult> {
  const templates = await getLocalTemplates();
  const filteredTemplates = format ? templates.filter((template) => matchesRequestedFormat(template.format, format)) : templates;

  if (templates.length === 0) {
    throw error;
  }

  console.warn("[TemplateBooth] Catalogue local utilise.", error);

  return {
    templates: filteredTemplates,
    source: "local",
    page: 1,
    perPage: filteredTemplates.length,
    total: filteredTemplates.length,
    totalPages: 1,
    warning: getFallbackWarning(error)
  };
}

function matchesRequestedFormat(templateFormat: string, requestedFormat: TemplateFormat) {
  if (templateFormat === requestedFormat) {
    return true;
  }

  const aliases: Record<TemplateFormat, string[]> = {
    "vertical-2x6": ["vertical-2x6"],
    "portrait-4x6": ["portrait-4x6"],
    "landscape-4x6-multi": ["landscape-4x6-multi", "landscape-4x6-full"],
    "landscape-4x6-full": ["landscape-4x6-full", "landscape-4x6-multi"],
    "welcome-1920x1080": ["welcome-1920x1080"]
  };

  return aliases[requestedFormat].includes(templateFormat);
}

function dedupeTemplates(templates: PhotoboothTemplate[]) {
  return [
    ...new Map(
      templates.map((template) => [
        `${template.templateId}:${template.previewImage}:${template.videoUrl ?? ""}`,
        template
      ])
    ).values()
  ];
}

export async function getFilters() {
  return templateBoothFetch<RemoteFiltersResponse>("/filters");
}

function flattenFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenFilterValues(item));
  }

  const object = objectValue(value);

  if (object) {
    return Object.values(object).flatMap((item) => flattenFilterValues(item));
  }

  const string = stringValue(value);
  return string ? [string] : [];
}

export async function getTemplateFilterOptions(): Promise<{
  filters: TemplateFilterOption[];
  source: "templatebooth" | "local";
}> {
  try {
    const payload = await getFilters();
    const availableValues = new Set(flattenFilterValues(payload));
    const canDetectAvailability = availableValues.size > 0;

    return {
      filters: TEMPLATE_FORMATS.map((item) => ({
        value: item.value,
        label: item.label,
        badge: item.badge,
        usage: item.usage,
        query: item.query,
        available: canDetectAvailability ? Object.values(item.query).some((value) => availableValues.has(String(value))) : true
      })),
      source: "templatebooth"
    };
  } catch (error) {
    console.warn("[TemplateBooth] /filters indisponible, filtres officiels locaux utilises.", error);

    return {
      filters: TEMPLATE_FORMATS.map((item) => ({
        value: item.value,
        label: item.label,
        badge: item.badge,
        usage: item.usage,
        query: item.query,
        available: true
      })),
      source: "local"
    };
  }
}

export async function getTemplatesByQuery(query: TemplateFormatQuery, fallbackFormat?: TemplateFormat): Promise<TemplateCatalogResult> {
  try {
    const canvaLinks = await getCanvaTemplateLinks();
    const payload = await templateBoothFetch<RemoteTemplatesResponse>(buildPath("/templates", normalizeTemplateQuery(query)));
    return {
      ...normalizeTemplatesResponse(payload, fallbackFormat, canvaLinks),
      source: "templatebooth"
    };
  } catch (error) {
    return getFallbackTemplates(error, fallbackFormat);
  }
}

export async function getTemplates(): Promise<TemplateCatalogResult> {
  return getTemplatesByQuery({});
}

export async function getTemplatesByFormat(format: string, query: TemplateFormatQuery = {}): Promise<TemplateCatalogResult> {
  if (!isTemplateFormat(format)) {
    throw new TemplateBoothError("Format de template non reconnu.", "unknown_format", 400);
  }

  const meta = TEMPLATE_FORMATS.find((item) => item.value === format);
  const alternateQueries = meta && "alternateQueries" in meta ? meta.alternateQueries : [];
  const queries = [meta?.query ?? {}, ...alternateQueries].map((formatQuery) => ({
    ...formatQuery,
    ...query
  }));

  try {
    const results = await Promise.all(queries.map((item) => getTemplatesByQuery(item, format)));
    const templates = dedupeTemplates(results.flatMap((result) => result.templates));
    const fullWidthTemplates = format === "landscape-4x6-full" ? templates.filter((template) => template.fullWidth) : [];
    const filteredTemplates = format === "landscape-4x6-full" && fullWidthTemplates.length > 0 ? fullWidthTemplates : templates;

    return {
      templates: filteredTemplates,
      source: results.every((result) => result.source === "templatebooth") ? "templatebooth" : "local",
      page: results[0]?.page,
      perPage: results[0]?.perPage,
      total: results.reduce((sum, result) => sum + (result.total ?? result.templates.length), 0),
      totalPages: Math.max(...results.map((result) => result.totalPages ?? 1))
    };
  } catch (error) {
    return getFallbackTemplates(error, format);
  }
}

export function getTemplateQueryFromRequest(request: Request) {
  return queryFromSearchParams(new URL(request.url).searchParams);
}

export async function getTemplateById(id: string): Promise<TemplateDetailResult> {
  const template = await getLocalTemplateById(id);

  if (!template) {
    throw new TemplateBoothError("Template introuvable localement.", "template_not_found", 404);
  }

  return {
    template,
    source: "local"
  };
}

export async function testTemplateBoothConnection(): Promise<TemplateBoothApiDiagnostic> {
  const query = normalizeTemplateQuery({ layout: "26strip" });
  const path = buildPath("/templates", query);
  const baseUrl = (process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL).replace(/\/$/, "");
  const url = `${baseUrl}${path}`;

  try {
    const result = await templateBoothFetchWithMeta<RemoteTemplatesResponse>(path);
    const data = Array.isArray(result.payload.data) ? result.payload.data : undefined;

    if (!data) {
      const templates = await getLocalTemplates();
      const message = "Champ data absent ou invalide dans la reponse TemplateBooth.";
      console.error(`[TemplateBooth] Erreur API: ${message}`);

      return {
        ok: false,
        status: result.status,
        total: numberValue(result.payload.total, 0),
        count: 0,
        sample: null,
        fallbackLocalUsed: templates.length > 0,
        url: result.url,
        error: message
      };
    }

    return {
      ok: true,
      status: result.status,
      total: numberValue(result.payload.total, data.length),
      count: data.length,
      sample: sanitizeApiSample(data[0] ?? null),
      fallbackLocalUsed: false,
      url: result.url
    };
  } catch (error) {
    const templates = await getLocalTemplates();
    const message = getErrorMessage(error);
    console.error(`[TemplateBooth] Diagnostic API en erreur: ${message}`);

    return {
      ok: false,
      status: error instanceof TemplateBoothError ? error.statusCode : null,
      total: 0,
      count: 0,
      sample: null,
      fallbackLocalUsed: templates.length > 0,
      url,
      error: message
    };
  }
}

function validateCustomizationInput(input: CustomizationRequestInput) {
  const requiredFields: Array<keyof CustomizationRequestInput> = [
    "templateId",
    "firstName",
    "lastName",
    "email",
    "phone",
    "eventDate",
    "eventType",
    "templateText",
    "desiredColors"
  ];

  const missingField = requiredFields.find((field) => !input[field]);

  if (missingField) {
    throw new TemplateBoothError(`Champ obligatoire manquant : ${missingField}.`, "invalid_request", 400);
  }

  if (input.canvaTemplateUrl && !input.finalCanvaUrl) {
    throw new TemplateBoothError("Champ obligatoire manquant : finalCanvaUrl.", "invalid_request", 400);
  }
}

async function templateFromCustomizationSnapshot(data: CustomizationRequestInput): Promise<PhotoboothTemplate> {
  const links = await getCanvaTemplateLinks();
  const mapping = links.find((link) => link.template_id === data.templateId);
  const templateBoothUrl = mapping?.post_url ?? templateBoothUrlFromTemplateId(data.templateId);

  return {
    id: data.templateId,
    templateId: data.templateId,
    name: data.templateName || "Template TemplateBooth",
    theme: "TemplateBooth",
    format: isTemplateFormat(data.templateFormat) ? data.templateFormat : "vertical-2x6",
    photoCount: 1,
    mainColors: [],
    previewImage: data.templatePreviewImage || mapping?.preview_url || "/template-previews/fallback.svg",
    compatibility: {},
    templateBoothUrl,
    canvaTemplateUrl: mapping?.canva_template_url || data.canvaTemplateUrl,
    canvaUrl: mapping?.canva_template_url || data.canvaTemplateUrl || data.canvaUrl,
    eventType: mapping?.event_type,
    tags: mapping?.tags,
    fullWidth: mapping?.full_width,
    source: "templatebooth"
  };
}

export async function createCustomizationRequest(data: CustomizationRequestInput) {
  validateCustomizationInput(data);
  const template = await templateFromCustomizationSnapshot(data);
  const request = await createLocalCustomizationRequest(data, template);

  return {
    request
  };
}

export async function syncTemplateStatus(templateId: string) {
  return {
    templateId,
    status: "unknown",
    updatedAt: new Date().toISOString()
  };
}
