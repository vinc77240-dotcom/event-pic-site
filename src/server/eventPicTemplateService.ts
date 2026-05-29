import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  EVENT_PIC_CATEGORIES,
  EVENT_PIC_FORMATS,
  EventPicCategoryId,
  EventPicFormatId,
  EventPicTemplate,
  getEventPicCategory,
  getEventPicFormat
} from "@/src/shared/eventPicTemplates";
import { getLocalTemplates } from "@/src/server/templatebooth/localCatalog";
import { extractCanvaLinkFromTemplate, extractSourceFilesFromTemplate } from "@/src/server/templateboothCanvaService";
import { findTemplateSourceLink, upsertTemplateSourceLinksBatch } from "@/src/server/templateSourceLinks";
import {
  findTemplateCategoryOverrideSync,
  listTemplateCategoryOverrides,
  TemplateCategoryOverrideEntry,
  TemplateCategoryId,
  upsertDetectedTemplateCategoryOverrides
} from "@/src/server/templateCategoryOverrides";

const DEFAULT_TEMPLATEBOOTH_BASE_URL = "https://templatesbooth.com/wp-json/tb/v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_MEMORY_CACHE_TTL_MS = 60 * 1000;
const CATEGORY_SUPPLEMENT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_PER_PAGE = 48;
const SYNC_PER_PAGE = 48;
const CACHE_SCHEMA_VERSION = 6;
const SYNC_BASE_PAGES = numberFromEnv("TEMPLATEBOOTH_SYNC_BASE_PAGES", 2);
const SYNC_CATEGORY_PAGES = numberFromEnv("TEMPLATEBOOTH_SYNC_CATEGORY_PAGES", 1);
const SYNC_CONCURRENCY = numberFromEnv("TEMPLATEBOOTH_SYNC_CONCURRENCY", 6);
const legacyTemplateCachePath = path.join(process.cwd(), "data", "template-cache.json");
const catalogCachePath = path.join(process.cwd(), "data", "templatebooth-cache.json");
const CATALOG_CACHE_BLOB_PATH = "admin/templatebooth-cache.json";
const CATALOG_CACHE_BLOB_BACKUP_PREFIX = "admin/backups/templatebooth-cache";
const LEGACY_TEMPLATE_CACHE_BLOB_PATH = "admin/template-cache.json";
const LEGACY_TEMPLATE_CACHE_BLOB_BACKUP_PREFIX = "admin/backups/template-cache";
const TEMPLATE_CACHE_BLOB_ACCESS = "private" as const;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type TemplateBoothTemplatePayload = Record<string, unknown>;

type TemplateBoothTemplatesResponse = {
  page?: number | string;
  per_page?: number | string;
  total?: number | string;
  total_pages?: number | string;
  data?: TemplateBoothTemplatePayload[];
};

type TemplateBoothFiltersResponse = {
  tags?: unknown;
  layouts?: unknown;
  layout_size?: unknown;
  image_type?: unknown;
  no_of_images?: unknown;
  types?: unknown;
  type?: unknown;
};

type TemplateBoothCatalogCache = {
  version?: number;
  lastSync: string;
  cacheComplete?: boolean;
  lastFullSync?: string | null;
  totalKnownTemplates?: number;
  totalByLayout?: Record<string, number>;
  totalByCategory?: Record<string, number>;
  templates: CachedTemplate[];
};

type SyncQuery = {
  layout?: string;
  formatId?: EventPicFormatId;
  type?: string;
  imageType?: string;
  noOfImages?: string;
  page: number;
  perPage: number;
  category?: string;
  tags?: string;
  search?: string;
  forceTagsOnly?: boolean;
};

type CategorySupplementQuery = {
  key: string;
  tags?: string;
  search?: string;
};

export type CachedTemplate = EventPicTemplate & {
  post_url?: string;
  layout_size?: string;
  image_type?: string;
  raw_no_of_images?: string | null;
  canva_template_url?: string | null;
  canva_source?: "templatebooth_api" | "not_provided_by_api";
  canva_detected_at?: string | null;
  source: "templatebooth" | "local";
};

export type EventPicTemplateListResult = {
  templates: EventPicTemplate[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  source: "templatebooth" | "local";
  debug?: {
    totalBeforeFormat: number;
    totalAfterFormat: number;
    totalAfterCategory: number;
    returnedCount: number;
    sample?: Array<{
      name: string;
      tags: string[];
      post_url: string | null;
    }>;
  };
  cache: {
    lastSync: string | null;
    stale: boolean;
  };
};

export type EventPicTemplateSearchResult = {
  id: string;
  name: string;
  preview_url: string;
  format_label: string;
  layout: string;
  no_of_images: number | null;
  matched_categories: string[];
  primary_category: string | null;
  tags: string[];
  reason: string;
  classification_reason: string;
  available_formats: string[];
  post_url?: string;
  template: EventPicTemplate;
};

export type EventPicTemplateSearchResponse = {
  query: string;
  total: number;
  results: EventPicTemplateSearchResult[];
};

export type TemplateFilterDiagnosticResult = {
  format: string;
  category: string;
  layoutUsed: string;
  cache: {
    exists: boolean;
    totalTemplates: number;
    sampleFields: string[];
    sampleTemplates: Array<{
      id: string;
      name: string;
      layout: string;
      type?: string;
      type_name: string;
      tags: string[];
      post_url?: string;
    }>;
  };
  apiFilters: {
    tagsFromTemplateBooth: string[];
    layoutsFromTemplateBooth: string[];
    typesFromTemplateBooth: string[];
    imageTypeFromTemplateBooth: string[];
    noOfImagesFromTemplateBooth: string[];
  };
  serverFiltering: {
    totalBeforeFormat: number;
    totalAfterFormat: number;
    totalAfterCategory: number;
    returnedSample: Array<{
      id: string;
      name: string;
      tags: string[];
      post_url?: string;
      type?: string;
      type_name: string;
      layout: string;
    }>;
  };
  liveApiComparison?: {
    pagesTraversed: number;
    totalLive: number;
    cacheCount: number;
    differenceLiveVsCache: number;
    firstTemplates: Array<{
      id: string;
      name: string;
      post_url?: string;
    }>;
  };
  cacheStatus?: {
    cacheComplete: boolean;
    lastFullSync: string | null;
    totalKnownTemplates: number;
    totalByLayout: Record<string, number>;
  };
  templateBoothExactComparison?: {
    query: {
      layout: string;
      tags: string;
      image_type: string;
      no_of_images: string;
      per_page: number;
      page: number;
    };
    templateBooth: {
      total: number;
      count: number;
      first20: string[];
    };
    eventPic: {
      total: number;
      count: number;
      first20: string[];
    };
    missingFromEventPic: string[];
    presentInEventPicButOutOfScope: string[];
    possibleReasons: string[];
    timingsMs?: {
      templateBoothExact: number;
      eventPic: number;
      total: number;
    };
    pagesTraversed?: {
      templateBoothExact: number;
    };
    cacheUsed?: boolean;
    cacheComplete?: boolean;
  };
  matchingRulesUsed: string[];
  conclusion: string;
};

let syncPromise: Promise<TemplateBoothCatalogCache> | null = null;
let catalogMemoryCache: { expiresAt: number; cache: TemplateBoothCatalogCache } | null = null;
const categorySupplementCache = new Map<string, { expiresAt: number; templates: CachedTemplate[] }>();
const categorySupplementInFlight = new Map<string, Promise<CachedTemplate[]>>();
const categorySupplementFullCache = new Map<
  string,
  {
    expiresAt: number;
    result: {
      templates: CachedTemplate[];
      pagesTraversed: number;
      queryStats: Array<{
        key: string;
        pagesTraversed: number;
        total: number;
        firstUrl: string;
      }>;
    };
  }
>();
const categorySupplementFullInFlight = new Map<
  string,
  Promise<{
    templates: CachedTemplate[];
    pagesTraversed: number;
    queryStats: Array<{
      key: string;
      pagesTraversed: number;
      total: number;
      firstUrl: string;
    }>;
  }>
>();
const exactSupplementCache = new Map<
  string,
  {
    expiresAt: number;
    result: {
      templates: CachedTemplate[];
      total: number;
      totalPages: number;
      pagesTraversed: number;
      firstUrl: string;
    };
  }
>();
const exactSupplementInFlight = new Map<
  string,
  Promise<{
    templates: CachedTemplate[];
    total: number;
    totalPages: number;
    pagesTraversed: number;
    firstUrl: string;
  }>
>();

function numberFromEnv(key: string, fallback: number) {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasBlobReadWriteToken() {
  return typeof process.env.BLOB_READ_WRITE_TOKEN === "string" && process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function shouldUseTemplateCacheBlobStorage() {
  return hasBlobReadWriteToken();
}

function shouldUseLocalTemplateCacheStorage() {
  return !shouldUseTemplateCacheBlobStorage() && !isVercelRuntime();
}

function missingTemplateCacheBlobTokenMessage() {
  return "BLOB_READ_WRITE_TOKEN manquant: le cache TemplateBooth doit utiliser Vercel Blob en production.";
}

function templateCacheBackupTimestamp() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
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

function numberValue(value: unknown, fallback: number): number {
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

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function maybePositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function parseResolutionFromText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const patterns = [
    /(\d{3,4})\s*[xX]\s*(\d{3,4})/,
    /(\d{3,4})\s*[×]\s*(\d{3,4})/,
    /(\d{3,4})\D+(\d{3,4})/
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (!match) {
      continue;
    }

    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);

    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  return undefined;
}

function extractTemplateResolution(payload: TemplateBoothTemplatePayload, candidates: Array<string | undefined>) {
  const directPairs: Array<[unknown, unknown]> = [
    [payload.source_width, payload.source_height],
    [payload.width, payload.height],
    [payload.image_width, payload.image_height],
    [payload.screen_width, payload.screen_height],
    [payload.layout_width, payload.layout_height],
    [payload.poster_width, payload.poster_height]
  ];

  for (const [rawWidth, rawHeight] of directPairs) {
    const width = maybePositiveInteger(rawWidth);
    const height = maybePositiveInteger(rawHeight);

    if (width && height) {
      return { width, height };
    }
  }

  for (const candidate of candidates) {
    const parsed = parseResolutionFromText(candidate);

    if (parsed) {
      return parsed;
    }
  }

  return undefined;
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
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function idFromUrl(value: unknown) {
  const url = stringValue(value);

  if (!url) {
    return undefined;
  }

  return url
    .split("?")[0]
    ?.replace(/\/$/, "")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "");
}

function getTemplateBoothConfig() {
  const apiKey = process.env.TEMPLATEBOOTH_API_KEY;
  const baseUrl = (process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("Cle API TemplateBooth absente cote serveur.");
  }

  return { apiKey, baseUrl };
}

function normalizeFilterValue(value: unknown) {
  const normalized = stringValue(value);
  return normalized ? normalized.trim() : undefined;
}

function normalizeFilterCollection(value: unknown) {
  const values = new Set<string>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const normalized = normalizeFilterValue(item);
        if (normalized) {
          values.add(normalized);
        }
        continue;
      }

      if (item && typeof item === "object") {
        const object = item as Record<string, unknown>;
        const candidate =
          normalizeFilterValue(object.value) ??
          normalizeFilterValue(object.name) ??
          normalizeFilterValue(object.slug) ??
          normalizeFilterValue(object.label);

        if (candidate) {
          values.add(candidate);
        }
      }
    }
  } else {
    const single = normalizeFilterValue(value);

    if (single) {
      values.add(single);
    }
  }

  return [...values];
}

async function fetchTemplateBoothFilters() {
  const { apiKey, baseUrl } = getTemplateBoothConfig();
  const url = `${baseUrl}/filters`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-API-Key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`API TemplateBooth /filters indisponible (${response.status}).`);
  }

  const json = (await response.json()) as TemplateBoothFiltersResponse;

  return {
    tagsFromTemplateBooth: normalizeFilterCollection(json.tags),
    layoutsFromTemplateBooth: normalizeFilterCollection(json.layouts ?? json.layout_size),
    typesFromTemplateBooth: normalizeFilterCollection(json.types ?? json.type),
    imageTypeFromTemplateBooth: normalizeFilterCollection(json.image_type),
    noOfImagesFromTemplateBooth: normalizeFilterCollection(json.no_of_images)
  };
}

function normalizeTextForMatch(value: string | undefined) {
  if (!value) {
    return "";
  }

  return normalizeSearchText(value);
}

function detectWelcomeTypeFromFields(input: {
  type?: string;
  typeName?: string;
  layout?: string;
  name?: string;
  previewUrl?: string;
  videoUrl?: string;
}) {
  const type = normalizeTextForMatch(input.type);
  const typeName = normalizeTextForMatch(input.typeName);
  const layout = normalizeTextForMatch(input.layout);
  const name = normalizeTextForMatch(input.name);
  const previewUrl = normalizeTextForMatch(input.previewUrl);
  const videoUrl = normalizeTextForMatch(input.videoUrl);
  const joined = [type, typeName, layout, name, previewUrl, videoUrl].join(" ");
  const looksWelcome = joined.includes("welcome");

  if (type === "static_welcome_screen" || typeName.includes("static_welcome_screen")) {
    return "static_welcome_screen" as const;
  }

  if (type === "animated_welcome_screen" || typeName.includes("animated_welcome_screen")) {
    return "animated_welcome_screen" as const;
  }

  if (type === "animated" && looksWelcome) {
    return "animated_welcome_screen" as const;
  }

  if (type === "static" && looksWelcome) {
    return "static_welcome_screen" as const;
  }

  if (layout === "animated" && looksWelcome) {
    return "animated_welcome_screen" as const;
  }

  if (layout === "static" && looksWelcome) {
    return "static_welcome_screen" as const;
  }

  if (previewUrl.includes("animated-welcome-screen") || videoUrl.includes("animated-welcome-screen")) {
    return "animated_welcome_screen" as const;
  }

  if (previewUrl.includes("welcome-screen") || videoUrl.includes("welcome-screen")) {
    return "static_welcome_screen" as const;
  }

  return undefined;
}

function normalizeTemplateType(input: {
  type?: string;
  typeName?: string;
  layout?: string;
  name?: string;
  previewUrl?: string;
  videoUrl?: string;
}) {
  return detectWelcomeTypeFromFields(input) ?? input.type;
}

function isWelcomeScreenType(type: string | undefined) {
  return type === "static_welcome_screen" || type === "animated_welcome_screen";
}

function isWelcomeTemplateLike(input: {
  type?: string;
  typeName?: string;
  layout?: string;
  name?: string;
  previewUrl?: string;
  videoUrl?: string;
}) {
  const normalizedType = normalizeTemplateType(input);
  return Boolean(normalizedType && isWelcomeScreenType(normalizedType));
}

function publicFormatLabel(layout: string, type?: string) {
  if (isWelcomeScreenType(type)) {
    return "Welcome screen 1920x1080";
  }

  return EVENT_PIC_FORMATS.find((format) => format.layout === layout)?.label ?? "Format Event Pic";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’`´]/g, " ")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTags(value: unknown, extraTags: string[] = []) {
  const tags = new Set<string>();

  for (const tag of extraTags) {
    if (tag.trim()) {
      tags.add(tag.trim());
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        tags.add(item.trim());
      } else if (item && typeof item === "object") {
        const name = stringValue((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).slug);
        if (name) {
          tags.add(name);
        }
      }
    }
  } else {
    const tag = stringValue(value);
    if (tag) {
      tags.add(tag);
    }
  }

  return [...tags];
}

function normalizeTemplate(
  payload: TemplateBoothTemplatePayload,
  query: Pick<
    SyncQuery,
    "formatId" | "layout" | "type" | "tags" | "search" | "category" | "imageType" | "noOfImages"
  >
): CachedTemplate | undefined {
  const postUrl = stringValue(payload.post_url);
  const src = stringValue(payload.src);
  const poster = stringValue(payload.poster);
  const videoUrl = stringValue(payload.video_url);
  const previewUrl = src ?? poster;
  const rawType = stringValue(payload.type ?? query.type);
  const rawTypeName = stringValue(payload.type_name ?? rawType);
  const rawLayoutSize = stringValue(payload.layout_size);
  const rawLayout =
    stringValue(payload.layout_size ?? payload.layout) ??
    query.layout ??
    (query.formatId ? getEventPicFormat(query.formatId).layout : rawType ?? "unknown");
  const imageType = stringValue(payload.image_type ?? payload.layout_type ?? query.imageType);
  const rawNoOfImages = stringValue(payload.no_of_images ?? query.noOfImages);
  const type = normalizeTemplateType({
    type: rawType,
    typeName: rawTypeName,
    layout: rawLayout,
    previewUrl,
    videoUrl
  });
  const layout = rawLayout;
  const baseId =
    stringValue(payload.template_id ?? payload.id ?? payload.post_id) ??
    idFromUrl(postUrl) ??
    idFromUrl(previewUrl) ??
    idFromUrl(videoUrl);
  const assetId = idFromUrl(previewUrl ?? videoUrl);

  if (!baseId || !previewUrl) {
    return undefined;
  }

  const name =
    stringValue(payload.name ?? payload.title ?? payload.post_title)?.replace(/<[^>]*>/g, "").trim() ??
    titleFromUrl(postUrl) ??
    "Template Event Pic";
  const normalizedType = normalizeTemplateType({
    type,
    typeName: rawTypeName,
    layout,
    name,
    previewUrl,
    videoUrl
  });
  const resolution = extractTemplateResolution(payload, [
    name,
    rawTypeName,
    stringValue(payload.size),
    stringValue(payload.resolution),
    stringValue(payload.dimensions),
    postUrl,
    previewUrl,
    videoUrl
  ]);
  const tags = normalizeTags(payload.tags ?? payload.tag ?? payload.categories);
  const category = stringValue(payload.category ?? payload.category_name ?? query.category);
  const id = [baseId, layout, assetId].filter(Boolean).join("__");
  const sourceExtraction = extractSourceFilesFromTemplate(payload);
  const photoshopDownloadUrl =
    stringValue(payload.photoshop_download_url) ??
    stringValue(payload.psd_url) ??
    stringValue(payload.source_file_url) ??
    stringValue(payload.download_url) ??
    sourceExtraction.psd_url ??
    sourceExtraction.source_file_url ??
    sourceExtraction.zip_url;
  const psdUrl = stringValue(payload.psd_url) ?? sourceExtraction.psd_url ?? photoshopDownloadUrl;
  const sourceFileUrl =
    stringValue(payload.source_file_url) ?? sourceExtraction.source_file_url ?? sourceExtraction.psd_url ?? photoshopDownloadUrl;
  const downloadUrl =
    stringValue(payload.download_url) ??
    sourceExtraction.zip_url ??
    sourceExtraction.source_file_url ??
    sourceExtraction.psd_url ??
    photoshopDownloadUrl;
  const zipUrl = sourceExtraction.zip_url ?? (downloadUrl?.toLowerCase().includes(".zip") ? downloadUrl : null);
  const canvaDirectUrl =
    stringValue(payload.canva_template_url) ??
    stringValue(payload.canva_url) ??
    stringValue(payload.canva_link) ??
    stringValue(payload.edit_in_canva_url);
  const canvaExtraction = extractCanvaLinkFromTemplate(payload);
  const detectedCanvaUrl = canvaDirectUrl ?? canvaExtraction.url;
  const detectedCanvaSource = detectedCanvaUrl ? "templatebooth_api" : "not_provided_by_api";

  return {
    id,
    name: stripHtml(name),
    preview_url: previewUrl,
    video_url: videoUrl,
    layout,
    layout_size: rawLayoutSize ?? layout,
    image_type: imageType,
    format_label: publicFormatLabel(layout, normalizedType),
    no_of_images: nullableNumber(payload.no_of_images),
    raw_no_of_images: rawNoOfImages ?? null,
    type: normalizedType,
    type_name: rawTypeName ?? normalizedType ?? "Template",
    published_at: stringValue(payload.published_at) ?? null,
    source_width: resolution?.width ?? null,
    source_height: resolution?.height ?? null,
    photoshop_download_url: photoshopDownloadUrl ?? null,
    psd_url: psdUrl ?? null,
    zip_url: zipUrl ?? null,
    source_file_url: sourceFileUrl ?? null,
    download_url: downloadUrl ?? null,
    canva_template_url: detectedCanvaUrl ?? null,
    canva_source: detectedCanvaSource,
    canva_detected_at: detectedCanvaUrl ? new Date().toISOString() : null,
    post_url: postUrl,
    tags,
    category,
    source: "templatebooth"
  };
}

async function ensureCatalogCacheFile() {
  await fs.mkdir(path.dirname(catalogCachePath), { recursive: true });

  try {
    await fs.access(catalogCachePath);
  } catch {
    await fs.writeFile(
      catalogCachePath,
      `${JSON.stringify({ lastSync: "", cacheComplete: false, lastFullSync: null, templates: [] }, null, 2)}\n`,
      "utf8"
    );
  }
}

async function readLocalCatalogCacheRaw({ createIfMissing }: { createIfMissing: boolean }) {
  try {
    if (createIfMissing) {
      await ensureCatalogCacheFile();
    }

    return await fs.readFile(catalogCachePath, "utf8");
  } catch {
    return `${JSON.stringify({ lastSync: "", cacheComplete: false, lastFullSync: null, templates: [] }, null, 2)}\n`;
  }
}

async function readBlobText(blobPath: string) {
  try {
    const result = await get(blobPath, {
      access: TEMPLATE_CACHE_BLOB_ACCESS,
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

    throw new Error(`Lecture Vercel Blob impossible pour ${blobPath}: ${message || "erreur inconnue"}`);
  }
}

async function writeBlobText(blobPath: string, contents: string, allowOverwrite = true) {
  await put(blobPath, contents, {
    access: TEMPLATE_CACHE_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: JSON_CONTENT_TYPE,
    cacheControlMaxAge: 60
  });
}

async function writeBlobTextWithBackup(blobPath: string, backupPrefix: string, contents: string) {
  const currentRaw = await readBlobText(blobPath);

  if (currentRaw !== null && currentRaw.trim().length > 0) {
    await writeBlobText(`${backupPrefix}-${templateCacheBackupTimestamp()}.json`, currentRaw, false);
  }

  await writeBlobText(blobPath, contents);
}

function parseCatalogCache(raw: string): TemplateBoothCatalogCache {
  const parsed = JSON.parse(raw) as Partial<TemplateBoothCatalogCache>;

  return {
    version: typeof parsed.version === "number" ? parsed.version : undefined,
    lastSync: typeof parsed.lastSync === "string" ? parsed.lastSync : "",
    cacheComplete: parsed.cacheComplete === true,
    lastFullSync: typeof parsed.lastFullSync === "string" ? parsed.lastFullSync : null,
    totalKnownTemplates: typeof parsed.totalKnownTemplates === "number" ? parsed.totalKnownTemplates : undefined,
    totalByLayout:
      parsed.totalByLayout && typeof parsed.totalByLayout === "object"
        ? (parsed.totalByLayout as Record<string, number>)
        : undefined,
    totalByCategory:
      parsed.totalByCategory && typeof parsed.totalByCategory === "object"
        ? (parsed.totalByCategory as Record<string, number>)
        : undefined,
    templates: Array.isArray(parsed.templates) ? parsed.templates : []
  };
}

async function readCatalogCache(): Promise<TemplateBoothCatalogCache> {
  if (catalogMemoryCache && catalogMemoryCache.expiresAt > Date.now()) {
    return catalogMemoryCache.cache;
  }

  const remember = (cache: TemplateBoothCatalogCache) => {
    catalogMemoryCache = {
      cache,
      expiresAt: Date.now() + CATALOG_MEMORY_CACHE_TTL_MS
    };
    return cache;
  };

  if (shouldUseTemplateCacheBlobStorage()) {
    const blobRaw = await readBlobText(CATALOG_CACHE_BLOB_PATH);

    if (blobRaw !== null) {
      return remember(parseCatalogCache(blobRaw));
    }

    const seedRaw = await readLocalCatalogCacheRaw({ createIfMissing: false });
    await writeBlobText(CATALOG_CACHE_BLOB_PATH, seedRaw);
    return remember(parseCatalogCache(seedRaw));
  }

  if (!shouldUseLocalTemplateCacheStorage()) {
    throw new Error(missingTemplateCacheBlobTokenMessage());
  }

  return remember(parseCatalogCache(await readLocalCatalogCacheRaw({ createIfMissing: true })));
}

function serializeCatalogCache(cache: TemplateBoothCatalogCache) {
  return `${JSON.stringify(cache, null, 2)}\n`;
}

async function writeCatalogCache(cache: TemplateBoothCatalogCache) {
  const serialized = serializeCatalogCache(cache);
  catalogMemoryCache = {
    cache,
    expiresAt: Date.now() + CATALOG_MEMORY_CACHE_TTL_MS
  };

  if (shouldUseTemplateCacheBlobStorage()) {
    await writeBlobTextWithBackup(CATALOG_CACHE_BLOB_PATH, CATALOG_CACHE_BLOB_BACKUP_PREFIX, serialized);
    return;
  }

  if (shouldUseLocalTemplateCacheStorage()) {
    await ensureCatalogCacheFile();
    await fs.writeFile(catalogCachePath, serialized, "utf8");
    return;
  }

  throw new Error(missingTemplateCacheBlobTokenMessage());
}

function isCacheFresh(cache: TemplateBoothCatalogCache) {
  if (cache.version !== CACHE_SCHEMA_VERSION) {
    return false;
  }

  if (!cache.lastSync || cache.templates.length === 0) {
    return false;
  }

  const syncedAt = new Date(cache.lastSync).getTime();
  return Number.isFinite(syncedAt) && Date.now() - syncedAt < CACHE_TTL_MS;
}

function cacheIsComplete(cache: TemplateBoothCatalogCache) {
  return cache.cacheComplete === true;
}

function buildCacheLayoutCounts(templates: CachedTemplate[]) {
  const counts: Record<string, number> = {};

  for (const template of templates) {
    counts[template.layout] = (counts[template.layout] ?? 0) + 1;
  }

  return counts;
}

function buildCacheCategoryCounts(templates: CachedTemplate[]) {
  const counts: Record<string, number> = {};

  for (const template of templates) {
    for (const category of EVENT_PIC_CATEGORIES) {
      if (category.id === "all" || category.id === "autres") {
        continue;
      }

      if (matchesCategoryV3(template, category.id)) {
        counts[category.id] = (counts[category.id] ?? 0) + 1;
      }
    }
  }

  return counts;
}

function getCategoryFilter(categoryId: string) {
  const category = getEventPicCategory(categoryId);

  if (!("query" in category) || !category.query) {
    return {
      categoryId: category.id,
      tags: undefined,
      search: undefined,
      keyword: undefined
    };
  }

  const tags = "tags" in category.query ? stringValue(category.query.tags) : undefined;
  const search = "search" in category.query ? stringValue(category.query.search) : tags;

  return {
    categoryId: category.id,
    tags,
    search,
    keyword: search ?? tags
  };
}

const CATEGORY_SUPPLEMENT_QUERY_MAP_V2: Record<string, CategorySupplementQuery[]> = {
  mariage: [
    { key: "tags:wedding", tags: "Wedding" },
    { key: "tags:indian-wedding", tags: "Indian Wedding" },
    { key: "tags:wedding-fr", tags: "Modèle de cabine photo photo de mariage" },
    { key: "search:wedding", search: "wedding" },
    { key: "search:mariage", search: "mariage" },
    { key: "search:magazine", search: "magazine" },
    { key: "search:minimal", search: "minimal" },
    { key: "search:rustic", search: "rustic" },
    { key: "search:film-strip", search: "film strip photo booth template" },
    { key: "search:pink-tropical", search: "pink tropical photo booth template" },
    { key: "search:free-tropical-leaves", search: "free tropical leaves photo booth template" },
  ],
  anniversaire: [
    { key: "tags:birthday", tags: "Birthday" },
    { key: "search:birthday", search: "birthday" },
    { key: "search:anniversaire", search: "anniversaire" },
    { key: "tags:sweet-16th", tags: "Sweet 16th" },
    { key: "search:sweet-16", search: "sweet 16" },
    { key: "search:sweet-16th", search: "sweet 16th" },
    { key: "search:party-birthday", search: "party birthday" },
    { key: "search:instagram-themed", search: "instagram themed" },
    { key: "search:gold-leaf", search: "gold leaf" },
    { key: "search:feathered", search: "feathered" },
    { key: "search:film-strip-2", search: "film strip photo booth template 2" }
  ],
  bapteme: [
    { key: "tags:religious", tags: "Religious" },
    { key: "search:baptism", search: "baptism" },
    { key: "search:christening", search: "christening" },
    { key: "search:bapteme", search: "bapteme" },
    { key: "search:bapteme-accent", search: "baptême" }
  ],
  "fete-bebe": [
    { key: "tags:baby-shower", tags: "Baby Shower" },
    { key: "search:baby-shower", search: "baby shower" },
    { key: "search:gender-reveal", search: "gender reveal" },
    { key: "search:boy-or-girl", search: "boy or girl" },
    { key: "search:he-or-she", search: "he or she" },
    { key: "search:baby-reveal", search: "baby reveal" },
    { key: "search:newborn", search: "newborn" },
    { key: "search:baby", search: "baby" },
    { key: "search:wonderland-v2", search: "wonderland photo booth template v2" },
    { key: "search:family-fun", search: "family fun photo booth template" },
    { key: "search:kids-fun-day", search: "kids fun day photo booth template" },
    { key: "search:kindergarten", search: "kindergarten photo booth template" }
  ],
  "soiree-privee": [
    { key: "tags:nightlife", tags: "Nightlife" },
    { key: "search:nightlife", search: "nightlife" },
    { key: "search:night-club", search: "night club" },
    { key: "search:club-sound", search: "club sound" },
    { key: "search:neon-nights", search: "neon nights" },
    { key: "search:gala-night", search: "gala night" },
    { key: "search:champagne-party", search: "champagne party" },
    { key: "search:music-festival", search: "music festival" },
    { key: "search:cocktail", search: "cocktail" },
    { key: "search:lounge", search: "lounge" },
    { key: "search:party-animal", search: "party animal" },
    { key: "search:glitter-background", search: "glitter background" },
    { key: "search:bokeh", search: "bokeh photo booth template" },
    { key: "search:art-deco", search: "art deco" },
    { key: "search:art-deco-party", search: "art deco party photo booth template" },
    { key: "search:neon-party", search: "neon party photo booth template" }
  ],
  entreprise: [
    { key: "tags:corporate", tags: "Corporate" },
    { key: "search:business", search: "business" },
    { key: "search:corporate", search: "corporate" }
  ],
  noel: [{ key: "tags:christmas", tags: "Christmas" }],
  "nouvel-an": [
    { key: "tags:new-years-eve", tags: "New Year's Eve" },
    { key: "tags:chinese-new-year", tags: "Chinese New Year" },
    { key: "tags:lunar-new-year", tags: "Lunar New Year" },
    { key: "search:chinese-new-year", search: "chinese new year" },
    { key: "search:lunar-new-year", search: "lunar new year" },
    { key: "search:new-year", search: "new year" },
    { key: "search:nouvel-an", search: "nouvel an" },
    { key: "search:retro-new-years-eve", search: "retro new years eve" },
    { key: "search:reveillon", search: "réveillon" }
  ],
  communion: [
    { key: "tags:religious", tags: "Religious" },
    { key: "search:communion", search: "communion" }
  ],
  religieux: [
    { key: "tags:religieux", tags: "Religious" },
    { key: "tags:bar-mitzvah", tags: "Bar Mitzvah" },
    { key: "search:religious", search: "religious" },
    { key: "search:religion", search: "religion" },
    { key: "search:faith", search: "faith" },
    { key: "search:church", search: "church" },
    { key: "search:christian", search: "christian" },
    { key: "search:catholic", search: "catholic" },
    { key: "search:communion", search: "communion" },
    { key: "search:baptism", search: "baptism" },
    { key: "search:christening", search: "christening" },
    { key: "search:bapteme", search: "bapteme" },
    { key: "search:prayer", search: "prayer" },
    { key: "search:gospel", search: "gospel" },
    { key: "search:cross", search: "cross" },
    { key: "search:bar-mitzvah", search: "bar mitzvah" },
    { key: "search:bat-mitzvah", search: "bat mitzvah" },
    { key: "search:synagogue", search: "synagogue" },
    { key: "search:hanukkah", search: "hanukkah" },
    { key: "search:nativity", search: "nativity" },
    { key: "search:shine-your-light", search: "shine your light" },
    { key: "search:harmony-night", search: "harmony night" }
  ],
  halloween: [{ key: "tags:halloween", tags: "Halloween" }],
  "saint-valentin": [
    { key: "tags:valentines-day", tags: "Valentines Day" },
    { key: "search:valentine", search: "valentine" },
    { key: "search:saint-valentin", search: "saint-valentin" }
  ],
  tropical: [
    { key: "tags:tropical", tags: "Tropical" },
    { key: "search:beach", search: "beach" },
    { key: "search:summer", search: "summer" },
    { key: "search:cocktail", search: "cocktail" },
    { key: "search:hawaii", search: "hawaii" },
    { key: "search:latin-night-party", search: "latin night party" },
    { key: "search:pool-party", search: "pool party" },
    { key: "search:full-moon-party", search: "full moon party" },
    { key: "search:luau-party", search: "luau party" }
  ],
  retro: [
    { key: "tags:retro", tags: "Retro" },
    { key: "search:retro", search: "retro" },
    { key: "search:retro-accent", search: "rétro" }
  ],
  western: [
    { key: "tags:country-western", tags: "Country & Western" },
    { key: "search:western", search: "western" },
    { key: "search:wanted", search: "wanted" },
    { key: "search:cowboy", search: "cowboy" },
    { key: "search:cowgirl", search: "cowgirl" },
    { key: "search:rodeo", search: "rodeo" },
    { key: "search:saloon", search: "saloon" },
    { key: "search:wild-west", search: "wild west" },
    { key: "search:country", search: "country" }
  ],
  "ecole-diplome": [
    { key: "tags:graduation", tags: "Graduation" },
    { key: "tags:graduation-fr", tags: "Modèle de Cabine Photo Photo Graduation" },
    { key: "search:graduation", search: "graduation" },
    { key: "search:diplome", search: "diplome" },
    { key: "search:school", search: "school" },
    { key: "search:class-of", search: "class of" },
    { key: "search:student", search: "student" },
    { key: "search:university", search: "university" },
    { key: "search:college", search: "college" },
    { key: "search:kindergarten", search: "kindergarten" },
    { key: "search:family-theme", search: "family theme" },
    { key: "search:diplome-accent", search: "diplôme" }
  ],
  paques: [
    { key: "tags:easter", tags: "Easter" },
    { key: "search:easter", search: "easter" },
    { key: "search:paques", search: "paques" },
    { key: "search:paques-accent", search: "pâques" }
  ],
  casino: [{ key: "tags:casino", tags: "Casino" }],
  sport: [
    { key: "tags:sports", tags: "Sports" },
    { key: "search:sport", search: "sport" },
    { key: "search:racing", search: "racing" },
    { key: "search:baseball", search: "baseball" },
    { key: "search:tennis", search: "tennis" },
    { key: "search:horse", search: "horse" },
    { key: "search:football", search: "football" },
    { key: "search:mma", search: "mma" },
    { key: "search:ice-hockey", search: "ice hockey" },
    { key: "search:golf", search: "golf" },
    { key: "search:basketball", search: "basketball" },
    { key: "search:game", search: "game" },
    { key: "search:marathon", search: "marathon" },
    { key: "search:trading-card", search: "trading card" }
  ]
};

const CATEGORY_KEYWORDS_MAP_V2: Record<string, string[]> = {
  mariage: [
    "wedding",
    "indian wedding",
    "mariage",
    "marriage",
    "minimal",
    "rustic",
    "magazine",
    "modele de cabine photo photo de mariage",
    "modèle de cabine photo photo de mariage"
  ],
  anniversaire: [
    "birthday",
    "anniversaire",
    "sweet 16",
    "sweet 16th",
    "instagram themed",
    "gold leaf",
    "feathered"
  ],
  bapteme: ["religious", "baptism", "christening", "bapteme", "baptême"],
  "fete-bebe": [
    "baby shower",
    "baby-shower",
    "gender reveal",
    "gender-reveal",
    "reveal",
    "boy or girl",
    "boy-or-girl",
    "he or she",
    "he-or-she",
    "baby reveal",
    "girl or boy",
    "pink blue",
    "fille ou garcon",
    "garcon ou fille",
    "baby",
    "newborn",
    "birth",
    "naissance",
    "bebe",
    "wonderland",
    "family fun",
    "kids fun day",
    "kindergarten"
  ],
  "soiree-privee": [
    "nightlife",
    "night life",
    "night club",
    "nightclub",
    "club",
    "club sound",
    "neon night",
    "neon nights",
    "gala night",
    "golden night",
    "champagne party",
    "cocktail",
    "lounge",
    "music festival",
    "festival",
    "dj",
    "dance",
    "disco",
    "party animal",
    "glitter background",
    "bokeh",
    "art deco",
    "art deco party",
    "neon party"
  ],
  entreprise: ["corporate", "business"],
  noel: ["christmas"],
  "nouvel-an": [
    "new year's eve",
    "chinese new year",
    "lunar new year",
    "new year",
    "nouvel an",
    "reveillon",
    "réveillon"
  ],
  communion: ["religious", "communion"],
  halloween: ["halloween"],
  "saint-valentin": ["valentines day", "valentine", "saint-valentin"],
  tropical: [
    "tropical",
    "beach",
    "summer",
    "cocktail",
    "hawaii",
    "latin night party",
    "pool party",
    "full moon party",
    "luau party"
  ],
  retro: ["retro", "rétro"],
  western: [
    "western",
    "country & western",
    "cowboy",
    "cowgirl",
    "rodeo",
    "saloon",
    "wild west",
    "country",
    "wanted"
  ],
  "ecole-diplome": [
    "graduation",
    "modele de cabine photo photo graduation",
    "modèle de cabine photo photo graduation",
    "diplome",
    "school",
    "graduate",
    "diploma",
    "class of",
    "student",
    "university",
    "college",
    "kindergarten",
    "family theme",
    "diplôme"
  ],
  paques: ["easter", "paques", "pâques"],
  casino: ["casino"],
  sport: [
    "sports",
    "sport",
    "racing",
    "baseball",
    "tennis",
    "horse",
    "football",
    "mma",
    "ice hockey",
    "golf",
    "basketball",
    "marathon",
    "trading card"
  ]
};

const KNOWN_MAIN_CATEGORY_KEYWORDS = [
  "wedding",
  "indian wedding",
  "modele de cabine photo photo de mariage",
  "modèle de cabine photo photo de mariage",
  "birthday",
  "religious",
  "baby shower",
  "gender reveal",
  "baby reveal",
  "boy or girl",
  "newborn",
  "nightlife",
  "corporate",
  "christmas",
  "new year's eve",
  "chinese new year",
  "halloween",
  "valentines day",
  "tropical",
  "retro",
  "western",
  "country & western",
  "graduation",
  "school",
  "diploma",
  "modele de cabine photo photo graduation",
  "modèle de cabine photo photo graduation",
  "easter",
  "casino",
  "sports"
];

const CATEGORY_RULES_V3: Record<string, { exactTags: string[]; keywords: string[]; strictTagOnly?: boolean }> = {
  mariage: {
    exactTags: [
      "Wedding",
      "Indian Wedding",
      "Modele de cabine photo photo de mariage",
      "Modèle de cabine photo photo de mariage"
    ],
    keywords: ["wedding", "mariage", "marriage", "minimal", "rustic", "magazine"]
  },
  anniversaire: {
    exactTags: ["Birthday", "Sweet 16th"],
    keywords: [
      "birthday",
      "anniversaire",
      "sweet 16",
      "sweet 16th",
      "party birthday",
      "instagram themed",
      "gold leaf",
      "feathered"
    ]
  },
  bapteme: {
    exactTags: ["Religious"],
    keywords: ["religious", "baptism", "christening", "bapteme"]
  },
  "fete-bebe": {
    exactTags: ["Baby Shower", "Gender Reveal"],
    keywords: [
      "baby shower",
      "baby-shower",
      "gender reveal",
      "gender-reveal",
      "reveal",
      "boy or girl",
      "boy-or-girl",
      "he or she",
      "he-or-she",
      "baby reveal",
      "girl or boy",
      "pink blue",
      "fille ou garcon",
      "garcon ou fille",
      "baby",
      "newborn",
      "birth",
      "naissance",
      "bebe",
      "nursery",
      "wonderland",
      "family fun",
      "kids fun day",
      "kindergarten"
    ]
  },
  "soiree-privee": {
    exactTags: ["Nightlife"],
    keywords: [
      "nightlife",
      "night life",
      "night club",
      "nightclub",
      "club",
      "club sound",
      "neon night",
      "neon nights",
      "gala night",
      "golden night",
      "champagne party",
      "cocktail",
      "lounge",
      "music festival",
      "festival",
      "dj",
      "dance",
      "disco",
      "party animal",
      "glitter background",
      "bokeh",
      "art deco",
      "art deco party",
      "neon party"
    ]
  },
  entreprise: {
    exactTags: ["Corporate"],
    keywords: ["corporate", "business"]
  },
  noel: {
    exactTags: ["Christmas"],
    keywords: ["christmas", "noel"]
  },
  "nouvel-an": {
    exactTags: ["New Year's Eve", "Chinese New Year", "Lunar New Year"],
    keywords: [
      "new year's eve",
      "chinese new year",
      "lunar new year",
      "new year",
      "nouvel an",
      "reveillon",
      "retro new years eve"
    ]
  },
  communion: {
    exactTags: ["Religious"],
    keywords: ["religious", "communion"]
  },
  religieux: {
    exactTags: ["Religious", "Bar Mitzvah"],
    keywords: [
      "religious",
      "religion",
      "faith",
      "church",
      "christian",
      "catholic",
      "communion",
      "baptism",
      "christening",
      "bapteme",
      "prayer",
      "gospel",
      "cross",
      "harmony night",
      "shine your light",
      "nativity",
      "bar mitzvah",
      "bat mitzvah",
      "bar-mitzvah",
      "hanukkah",
      "synagogue"
    ]
  },
  halloween: {
    exactTags: ["Halloween"],
    keywords: ["halloween"]
  },
  "saint-valentin": {
    exactTags: ["Valentines Day"],
    keywords: ["valentines day", "valentine", "saint valentin", "saint-valentin"]
  },
  tropical: {
    exactTags: ["Tropical"],
    keywords: ["tropical", "beach", "summer", "cocktail", "hawaii", "latin night party", "pool party", "full moon party"]
  },
  retro: {
    exactTags: ["Retro"],
    keywords: ["retro"],
    strictTagOnly: true
  },
  western: {
    exactTags: ["Country & Western"],
    keywords: ["western", "country & western", "cowboy", "cowgirl", "rodeo", "saloon", "wild west", "country", "wanted"]
  },
  "ecole-diplome": {
    exactTags: [
      "Graduation",
      "Modele de Cabine Photo Photo Graduation",
      "Modèle de Cabine Photo Photo Graduation"
    ],
    keywords: [
      "graduation",
      "diplome",
      "diploma",
      "school",
      "graduate",
      "class of",
      "student",
      "university",
      "college",
      "kindergarten",
      "family theme"
    ]
  },
  paques: {
    exactTags: ["Easter"],
    keywords: ["easter", "paques"]
  },
  casino: {
    exactTags: ["Casino"],
    keywords: ["casino"]
  },
  sport: {
    exactTags: ["Sports"],
    keywords: [
      "sports",
      "sport",
      "racing",
      "baseball",
      "tennis",
      "horse",
      "football",
      "mma",
      "ice hockey",
      "golf",
      "basketball",
      "marathon",
      "trading card"
    ]
  }
};

const NIGHTLIFE_STRONG_KEYWORDS = [
  "nightlife",
  "night life",
  "night club",
  "nightclub",
  "club",
  "club sound",
  "neon night",
  "neon nights",
  "gala night",
  "golden night",
  "champagne party",
  "cocktail",
  "lounge",
  "music festival",
  "festival",
  "dj",
  "dance",
  "disco"
];

const NIGHTLIFE_BLACKLIST_KEYWORDS = [
  "birthday",
  "anniversaire",
  "wedding",
  "mariage",
  "baby",
  "baby shower",
  "gender reveal",
  "religious",
  "baptism",
  "communion",
  "christmas",
  "noel",
  "new year",
  "nouvel an",
  "graduation",
  "sweet 16",
  "bar mitzvah",
  "hanukkah"
];

const MARIAGE_EXACT_TAGS = [
  "Wedding",
  "Indian Wedding",
  "Modele de cabine photo photo de mariage",
  "Modèle de cabine photo photo de mariage"
];

const MARIAGE_PRIMARY_KEYWORDS = ["wedding", "mariage"];
const MARIAGE_CONTROLLED_KEYWORDS = ["engagement", "fiancailles", "fiançailles"];
const MARIAGE_BLACKLIST_KEYWORDS = [
  "birthday",
  "anniversaire",
  "party",
  "night club",
  "club sound",
  "nightlife",
  "baby",
  "graduation",
  "christmas",
  "new year",
  "hanukkah",
  "bar mitzvah",
  "corporate",
  "conference",
  "festival",
  "quinceanera",
  "horse racing",
  "film strip",
  "christian corporate"
];
const MARIAGE_WHITELIST_SLUGS = ["purple-celebration-photo-booth-template"];

type BusinessCategoryId =
  | "mariage"
  | "anniversaire"
  | "religieux"
  | "fete-bebe"
  | "soiree-privee"
  | "entreprise"
  | "noel"
  | "nouvel-an"
  | "halloween"
  | "saint-valentin"
  | "tropical"
  | "retro"
  | "western"
  | "ecole-diplome"
  | "paques"
  | "casino"
  | "sport";

type BusinessCategoryKey = BusinessCategoryId | "autres";

type BusinessCategoryResult = {
  categories: BusinessCategoryId[];
  reasons: string[];
  reasonByCategory: Partial<Record<BusinessCategoryKey, string[]>>;
  lockedByExactRule: boolean;
  forceAutres: boolean;
};

const BUSINESS_EXACT_NAME_RULES: Array<{ name: string; category: BusinessCategoryKey; reason: string }> = [
  {
    name: "Burgundy Party Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Minimal Beach Ocean Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Green Celebration Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Rustic Raspberry Flowers Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Rust Orange Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Watercolor Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Rustic Luxe Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Gold Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Black Gold Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Blue Boho Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Grey Foil Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Watercolor Deco Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Elegant Grey Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Rose Gold Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Foliage Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Marble Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Classy Art Deco Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Peppermint Deco Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Moody Burgundy Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Black Gold Glitter Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Magazine Cover Photo Booth Template 3",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Purple Floral Wreath Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Green Foliage Wreath Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Tiffany Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Film Strip Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Tropical Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Free Tropical Leaves Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Typographic Photo Booth Template V2",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Warm Boho Floral Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Lavender Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Blue Gold Marble Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Bronze Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Yellow Butterflies Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Light Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Free Colourful Flowers Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Simple Pink Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Artistique Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Slate Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Navy Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Harmony Type Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Abstract Pastel Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Rose Patterned Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Petite Typographic Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Typographic Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Blossom Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Fashionista Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Navy Pink Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Contemporary Winter Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Together Forever Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Golden Rings Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Purple Gold Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Woven Blue Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Forest Green Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Brushed Chic Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Light Green Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Uptown Party Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Anniversary Photo Booth Template",
    category: "mariage",
    reason: "regle metier nom exact"
  },
  {
    name: "Orange Party Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Black Gold Party Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Black Gold Party Photo Booth Template 2",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Gold Party Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Nightclub Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Typographic Magazine Cover Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Instagram Themed Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Retro Sweet 16th Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Gold Leaf Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Feathered Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Film Strip Photo Booth Template 2",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "Elegant Deco Photo Booth Template",
    category: "anniversaire",
    reason: "regle metier nom exact"
  },
  {
    name: "White Gold Party Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Pink Core Party Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Prom Night Photo Booth Template 3",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Sparkly Purple Prom Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Glow Stick Party Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Party Animal Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Glitter Background Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Bokeh Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Art Deco Party Photo Booth Template 2",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Art Deco Party Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Neon Party Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Green Gold Art Deco Photo Booth Template",
    category: "soiree-privee",
    reason: "regle metier nom exact"
  },
  {
    name: "Tropical Beach Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Tropicana Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Hawaii Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Latin Night Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Pool Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Full Moon Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Luau Party Photo Booth Template",
    category: "tropical",
    reason: "regle metier nom exact"
  },
  {
    name: "Champagne Party Photo Booth Template",
    category: "nouvel-an",
    reason: "regle metier nom exact"
  },
  {
    name: "Nye Art Deco Photo Booth Template",
    category: "nouvel-an",
    reason: "regle metier nom exact"
  },
  {
    name: "Green Gold Nye Photo Booth Template",
    category: "nouvel-an",
    reason: "regle metier nom exact"
  },
  {
    name: "Blue Gold Nye Photo Booth Template",
    category: "nouvel-an",
    reason: "regle metier nom exact"
  },
  {
    name: "Retro New Years Eve Photo Booth Template",
    category: "nouvel-an",
    reason: "regle metier nom exact"
  },
  {
    name: "Horror Night Party Photo Booth Template",
    category: "halloween",
    reason: "regle metier nom exact"
  },
  {
    name: "Trick Or Treat Photo Booth Template",
    category: "halloween",
    reason: "regle metier nom exact"
  },
  {
    name: "60s Night Photo Booth Template 2",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "80s Night Photo Booth Template 2",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "90s Night Photo Booth Template 2",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "70s Night Photo Booth Template 2",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "60s Night Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "90s Night Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "80s Night Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "70s Night Party Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "70s Night Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "80s Party Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "Film Strip Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "Film Strip Photo Booth Template 2",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "Retro New Years Eve Photo Booth Template",
    category: "retro",
    reason: "regle metier nom exact"
  },
  {
    name: "Fantasy Trading Card Photo Booth Template",
    category: "sport",
    reason: "regle metier nom exact"
  },
  {
    name: "Wonderland Photo Booth Template V2",
    category: "fete-bebe",
    reason: "regle metier nom exact"
  },
  {
    name: "Family Fun Photo Booth Template",
    category: "fete-bebe",
    reason: "regle metier nom exact"
  },
  {
    name: "Kids Fun Day Photo Booth Template",
    category: "fete-bebe",
    reason: "regle metier nom exact"
  },
  {
    name: "Kindergarten Photo Booth Template",
    category: "fete-bebe",
    reason: "regle metier nom exact"
  },
  {
    name: "Family Theme Photo Booth Template",
    category: "ecole-diplome",
    reason: "regle metier nom exact"
  },
  {
    name: "Poker Night Photo Booth Template",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Casino Night Photo Booth Template 3",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "St Patricks Day Lucky Night Photo Booth",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Diwali Festival Photo Booth Template 3",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Casino Night Photo Booth Template 2",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Western Night Photo Booth Template",
    category: "western",
    reason: "regle metier nom exact"
  },
  {
    name: "Casino Night Photo Booth Template",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Winter Festival Photo Booth Template",
    category: "autres",
    reason: "regle metier nom exact"
  },
  {
    name: "Executive Leadership Conference Photo Booth Template",
    category: "entreprise",
    reason: "regle metier nom exact"
  },
  {
    name: "Conference Event Photo Booth Template 2",
    category: "entreprise",
    reason: "regle metier nom exact"
  }
];

const BUSINESS_MARIAGE_KEYWORDS = ["minimal", "rustic", "magazine"];
const BUSINESS_NOUVEL_AN_KEYWORDS = [
  "nye",
  "new year's eve",
  "chinese new year",
  "lunar new year",
  "retro new years eve",
  "nouvel an",
  "reveillon",
  "réveillon"
];
const BUSINESS_SOIREE_KEYWORDS = ["night"];
const BUSINESS_SOIREE_STRONG_KEYWORDS = [
  "nightlife",
  "night club",
  "nightclub",
  "club",
  "gala",
  "lounge",
  "music festival",
  "dj",
  "prom",
  "cocktail",
  "bokeh",
  "art deco",
  "art deco party",
  "neon party"
];
const BUSINESS_MARDI_GRAS_KEYWORDS = ["mardi gras"];
const BUSINESS_ENTREPRISE_KEYWORDS = ["conference", "leadership", "corporate", "business", "executive"];
const BUSINESS_TROPICAL_KEYWORDS = [
  "summer",
  "beach",
  "cocktail",
  "tropical",
  "hawaii",
  "latin night party",
  "pool party",
  "full moon party",
  "luau party"
];
const BUSINESS_HALLOWEEN_KEYWORDS = ["halloween"];
const BUSINESS_NOEL_KEYWORDS = ["santa", "christmas", "noel", "noël"];
const BUSINESS_ANNIVERSAIRE_KEYWORDS = [
  "birthday",
  "anniversaire",
  "sweet 16",
  "sweet 16th",
  "instagram themed",
  "gold leaf",
  "feathered"
];
const BUSINESS_AUTRES_KEYWORDS = ["diwali"];
const BUSINESS_WESTERN_KEYWORDS = [
  "western",
  "country & western",
  "country and western",
  "cowboy",
  "cowgirl",
  "rodeo",
  "saloon",
  "wild west",
  "country",
  "wanted"
];
const BUSINESS_ECOLE_DIPLOME_KEYWORDS = [
  "school",
  "graduation",
  "graduate",
  "diploma",
  "diplome",
  "diplôme",
  "class of",
  "student",
  "university",
  "college",
  "kindergarten",
  "family theme",
  "modele de cabine photo photo graduation",
  "modèle de cabine photo photo graduation"
];
const BUSINESS_SPORT_STRONG_KEYWORDS = [
  "racing",
  "baseball",
  "tennis",
  "horse",
  "football",
  "mma",
  "ice hockey",
  "golf",
  "basketball",
  "marathon",
  "trading card"
];
const BUSINESS_SPORT_GAME_CONTEXT_KEYWORDS = [
  "sport",
  "sports",
  "player",
  "team",
  "league",
  "match",
  "championship",
  "tournament",
  "racing",
  "football",
  "basketball",
  "baseball",
  "tennis",
  "mma",
  "golf",
  "hockey",
  "marathon",
  "trading card"
];
const FILM_STRIP_KEYWORDS = ["film strip", "filmstrip", "film-strip"];
const FILM_STRIP_SOIREE_CONTEXT_KEYWORDS = [
  "party",
  "night",
  "fete",
  "soiree",
  "club",
  "lounge",
  "cocktail",
  "gala",
  "festival",
  "disco",
  "dj"
];

function isSilverPartyFamily(template: Pick<CachedTemplate, "name" | "post_url">) {
  const normalizedName = normalizeSearchText(template.name ?? "");
  const normalizedPostUrl = normalizeSearchText(template.post_url ?? "");

  return (
    normalizedName.includes("silver party photo booth template") ||
    normalizedPostUrl.includes("silver-party-photo-booth-template")
  );
}

function silverPartyVariantNumber(template: Pick<CachedTemplate, "name">) {
  const normalizedName = normalizeSearchText(template.name ?? "");

  if (!normalizedName.includes("silver party photo booth template")) {
    return null;
  }

  const match = normalizedName.match(/silver party photo booth template\s*(\d+)/);

  if (!match) {
    return 1;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function normalizedBusinessName(value: string | undefined) {
  return normalizeSearchText(value ?? "");
}

function businessSearchCorpus(template: Pick<CachedTemplate, "name" | "post_url" | "type_name" | "tags">) {
  return normalizeSearchText(
    [template.name, template.post_url, template.type_name, ...(template.tags ?? [])].filter(Boolean).join(" ")
  );
}

function hasKeywordInBusinessCorpus(
  template: Pick<CachedTemplate, "name" | "post_url" | "type_name" | "tags">,
  keywords: string[]
) {
  const corpus = businessSearchCorpus(template);
  return keywords.some((keyword) => corpus.includes(normalizeSearchText(keyword)));
}

export function getEventPicBusinessCategories(
  template: Pick<CachedTemplate, "name" | "post_url" | "type_name" | "tags">
): BusinessCategoryResult {
  const categories = new Set<BusinessCategoryId>();
  const reasons: string[] = [];
  const reasonByCategory: Partial<Record<BusinessCategoryKey, string[]>> = {};
  const normalizedName = normalizedBusinessName(template.name);
  let forceAutres = false;

  const pushCategory = (category: BusinessCategoryId, reason: string) => {
    categories.add(category);
    reasons.push(reason);
    reasonByCategory[category] = [...(reasonByCategory[category] ?? []), reason];
  };
  const pushAutres = (reason: string) => {
    forceAutres = true;
    reasons.push(reason);
    reasonByCategory.autres = [...(reasonByCategory.autres ?? []), reason];
  };

  const exactRules = BUSINESS_EXACT_NAME_RULES.filter(
    (rule) => normalizedBusinessName(rule.name) === normalizedName
  );

  if (exactRules.length > 0) {
    const exactAutresRules = exactRules.filter((rule) => rule.category === "autres");

    if (exactAutresRules.length > 0) {
      for (const exactAutresRule of exactAutresRules) {
        pushAutres(`${exactAutresRule.reason}: ${exactAutresRule.name}`);
      }

      return {
        categories: [...categories],
        reasons,
        reasonByCategory,
        lockedByExactRule: true,
        forceAutres
      };
    }

    for (const exactRule of exactRules) {
      pushCategory(exactRule.category as BusinessCategoryId, `${exactRule.reason}: ${exactRule.name}`);
    }

    return {
      categories: [...categories],
      reasons,
      reasonByCategory,
      lockedByExactRule: true,
      forceAutres
    };
  }

  if (isSilverPartyFamily(template)) {
    const variant = silverPartyVariantNumber(template);

    if (variant === 2) {
      pushCategory("mariage", "regle metier Silver Party: Template 2");
      return {
        categories: [...categories],
        reasons,
        reasonByCategory,
        lockedByExactRule: true,
        forceAutres
      };
    }

    if (variant === 1) {
      pushCategory("anniversaire", "regle metier Silver Party: Template 1/base");
      return {
        categories: [...categories],
        reasons,
        reasonByCategory,
        lockedByExactRule: true,
        forceAutres
      };
    }
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_AUTRES_KEYWORDS)) {
    pushAutres("name/tag contains diwali");
    return {
      categories: [...categories],
      reasons,
      reasonByCategory,
      lockedByExactRule: true,
      forceAutres
    };
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_MARIAGE_KEYWORDS)) {
    pushCategory("mariage", "name contains minimal/rustic");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_NOUVEL_AN_KEYWORDS)) {
    pushCategory("nouvel-an", "name/tag contains new-year keywords");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_NOEL_KEYWORDS)) {
    pushCategory("noel", "name/tag contains santa/christmas/noel");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_TROPICAL_KEYWORDS)) {
    pushCategory("tropical", "name/tag contains tropical/summer/beach/cocktail");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_HALLOWEEN_KEYWORDS)) {
    pushCategory("halloween", "name/tag contains halloween");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_ANNIVERSAIRE_KEYWORDS)) {
    pushCategory("anniversaire", "name/tag contains birthday/sweet16");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_WESTERN_KEYWORDS)) {
    pushCategory("western", "name/tag contains western/cowboy/country");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_ECOLE_DIPLOME_KEYWORDS)) {
    pushCategory("ecole-diplome", "name/tag contains school/graduate/diplome");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_SPORT_STRONG_KEYWORDS)) {
    pushCategory("sport", "name/tag contains sport strong keywords");
  }

  const businessCorpus = businessSearchCorpus(template);
  const hasGameKeyword = businessCorpus.includes("game");
  const hasGameSportContext = BUSINESS_SPORT_GAME_CONTEXT_KEYWORDS.some((keyword) =>
    businessCorpus.includes(normalizeSearchText(keyword))
  );

  if (hasGameKeyword && hasGameSportContext) {
    pushCategory("sport", "name contains game with sport context");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_SOIREE_KEYWORDS)) {
    pushCategory("soiree-privee", "name contains night");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_SOIREE_STRONG_KEYWORDS)) {
    pushCategory("soiree-privee", "name/tag contains nightlife/club/gala/lounge/dj");
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_MARDI_GRAS_KEYWORDS)) {
    pushCategory("soiree-privee", "name/tag contains Mardi Gras");
  }

  if (hasKeywordInBusinessCorpus(template, FILM_STRIP_KEYWORDS)) {
    pushCategory("retro", "name contains film strip");

    if (hasKeywordInBusinessCorpus(template, FILM_STRIP_SOIREE_CONTEXT_KEYWORDS)) {
      pushCategory("soiree-privee", "film strip with party/night context");
    }
  }

  if (hasKeywordInBusinessCorpus(template, BUSINESS_ENTREPRISE_KEYWORDS)) {
    pushCategory("entreprise", "name/tag contains conference/leadership/corporate/business/executive");
  }

  return {
    categories: [...categories],
    reasons,
    reasonByCategory,
    lockedByExactRule: false,
    forceAutres
  };
}

function hasMariagePrimarySignal(template: CachedTemplate) {
  const normalizedName = normalizeSearchText(template.name ?? "");
  const normalizedPostUrl = normalizeSearchText(template.post_url ?? "");

  return MARIAGE_PRIMARY_KEYWORDS.some((keyword) => {
    const normalized = normalizeSearchText(keyword);
    return normalizedName.includes(normalized) || normalizedPostUrl.includes(normalized);
  });
}

function hasMariageControlledSignal(template: CachedTemplate) {
  const searchable = searchableFields(template);
  return MARIAGE_CONTROLLED_KEYWORDS.some((keyword) => {
    const normalized = normalizeSearchText(keyword);
    return searchable.some((field) => field.includes(normalized));
  });
}

function hasMariageBlacklistedSignal(template: CachedTemplate) {
  const searchable = searchableFields(template);
  return MARIAGE_BLACKLIST_KEYWORDS.some((keyword) => {
    const normalized = normalizeSearchText(keyword);
    return searchable.some((field) => field.includes(normalized));
  });
}

function matchesMariageStrict(template: CachedTemplate) {
  const business = getEventPicBusinessCategories(template);

  if (business.categories.includes("mariage")) {
    return true;
  }

  if (business.lockedByExactRule) {
    return false;
  }

  if (isSilverPartyFamily(template)) {
    const variant = silverPartyVariantNumber(template);

    // Regle metier explicite: Silver Party Template 2 => Mariage.
    if (variant === 2) {
      return true;
    }

    // Silver Party Template 1 (ou sans numero) => Anniversaire, pas Mariage.
    if (variant === 1) {
      return false;
    }
  }

  const normalizedName = normalizeSearchText(template.name ?? "");
  const normalizedPostUrl = normalizeSearchText(template.post_url ?? "");
  const hasWhitelistedSignal =
    normalizedName.includes("purple celebration photo booth template") ||
    MARIAGE_WHITELIST_SLUGS.some((slug) => normalizedPostUrl.includes(normalizeSearchText(slug)));
  const hasExactWeddingTag = hasExactTag(template, MARIAGE_EXACT_TAGS);
  const hasPrimarySignal = hasMariagePrimarySignal(template);
  const hasControlledSignal = hasMariageControlledSignal(template);
  const hasBlacklistedSignal = hasMariageBlacklistedSignal(template);

  if (hasBlacklistedSignal && !hasPrimarySignal && !hasWhitelistedSignal) {
    return false;
  }

  if (hasPrimarySignal || hasWhitelistedSignal) {
    return true;
  }

  if (hasExactWeddingTag && !hasBlacklistedSignal) {
    return true;
  }

  if (hasControlledSignal && (hasPrimarySignal || hasWhitelistedSignal)) {
    return true;
  }

  return false;
}

function isOutOfScopeMariagePublicTemplate(template: Pick<EventPicTemplate, "name" | "type_name" | "tags">) {
  const normalizedTags = (template.tags ?? []).map((tag) => normalizeSearchText(tag)).join(" ");
  const normalizedPayload = normalizeSearchText([template.name, template.type_name, normalizedTags].join(" "));
  const hasPrimary = MARIAGE_PRIMARY_KEYWORDS.some((keyword) => normalizedPayload.includes(normalizeSearchText(keyword)));
  const hasBlacklisted = MARIAGE_BLACKLIST_KEYWORDS.some((keyword) =>
    normalizedPayload.includes(normalizeSearchText(keyword))
  );

  return hasBlacklisted && !hasPrimary;
}

function categorySupplementQueriesV2(categoryId: string): CategorySupplementQuery[] {
  return CATEGORY_SUPPLEMENT_QUERY_MAP_V2[categoryId] ?? [];
}

function categorySearchKeywordsV2(categoryId: string) {
  const CATEGORY_RULES_V3: Record<string, { exactTags: string[]; keywords: string[]; strictTagOnly?: boolean }> = {
    mariage: {
      exactTags: ["Wedding", "Indian Wedding", "Modèle de cabine photo photo de mariage"],
      keywords: ["wedding", "mariage", "marriage", "minimal", "rustic", "magazine"]
    },
    anniversaire: {
      exactTags: ["Birthday"],
      keywords: ["birthday", "anniversaire", "sweet 16", "sweet 16th"]
    },
    bapteme: {
      exactTags: ["Religious"],
      keywords: ["religious", "baptism", "christening", "bapteme", "baptême"]
    },
    "fete-bebe": {
      exactTags: ["Baby Shower", "Gender Reveal"],
      keywords: [
        "baby shower",
        "baby-shower",
        "gender reveal",
        "gender-reveal",
        "reveal",
        "boy or girl",
        "boy-or-girl",
        "he or she",
        "he-or-she",
        "baby reveal",
        "girl or boy",
        "pink blue",
        "fille ou garcon",
        "garcon ou fille",
        "baby",
        "newborn",
        "birth",
        "naissance",
        "bebe"
      ]
    },
    "soiree-privee": {
      exactTags: ["Nightlife"],
      keywords: [
        "nightlife",
        "night life",
        "night club",
        "nightclub",
        "club",
        "club sound",
        "neon night",
        "neon nights",
        "gala night",
        "golden night",
        "champagne party",
        "cocktail",
        "lounge",
        "music festival",
        "festival",
        "dj",
        "dance",
        "disco",
        "party animal",
        "glitter background",
        "art deco"
      ]
    },
    entreprise: {
      exactTags: ["Corporate"],
      keywords: ["corporate", "business"]
    },
    noel: {
      exactTags: ["Christmas"],
      keywords: ["christmas", "noel", "noël"]
    },
    "nouvel-an": {
      exactTags: ["New Year's Eve", "Chinese New Year", "Lunar New Year"],
      keywords: ["new year's eve", "chinese new year", "lunar new year", "new year", "nouvel an", "reveillon", "réveillon"]
    },
    communion: {
      exactTags: ["Religious"],
      keywords: ["religious", "communion"]
    },
    halloween: {
      exactTags: ["Halloween"],
      keywords: ["halloween"]
    },
    "saint-valentin": {
      exactTags: ["Valentines Day"],
      keywords: ["valentines day", "valentine", "saint valentin", "saint-valentin"]
    },
  tropical: {
    exactTags: ["Tropical"],
    keywords: ["tropical", "beach", "summer", "cocktail", "hawaii", "latin night party", "pool party", "full moon party", "luau party"]
  },
    retro: {
      exactTags: ["Retro"],
      keywords: ["retro"],
      strictTagOnly: true
    },
    "ecole-diplome": {
      exactTags: ["Graduation", "Modèle de Cabine Photo Photo Graduation"],
      keywords: ["graduation", "diplome", "diplôme"]
    },
    paques: {
      exactTags: ["Easter"],
      keywords: ["easter", "paques", "pâques"]
    },
    casino: {
      exactTags: ["Casino"],
      keywords: ["casino"]
    },
    sport: {
      exactTags: ["Sports"],
      keywords: ["sports", "sport"]
    }
  };

  return CATEGORY_KEYWORDS_MAP_V2[categoryId] ?? CATEGORY_RULES_V3[categoryId]?.keywords ?? categorySearchKeywords(categoryId);
}

function categoryExactTagsV3(categoryId: string) {
  const CATEGORY_RULES_V3: Record<string, { exactTags: string[]; strictTagOnly?: boolean }> = {
    mariage: { exactTags: ["Wedding", "Indian Wedding", "Modèle de cabine photo photo de mariage"] },
    anniversaire: { exactTags: ["Birthday"] },
    bapteme: { exactTags: ["Religious"] },
    "fete-bebe": { exactTags: ["Baby Shower", "Gender Reveal"] },
    "soiree-privee": { exactTags: ["Nightlife"] },
    entreprise: { exactTags: ["Corporate"] },
    noel: { exactTags: ["Christmas"] },
    "nouvel-an": { exactTags: ["New Year's Eve", "Chinese New Year", "Lunar New Year"] },
    communion: { exactTags: ["Religious"] },
    halloween: { exactTags: ["Halloween"] },
    "saint-valentin": { exactTags: ["Valentines Day"] },
    tropical: { exactTags: ["Tropical"] },
    retro: { exactTags: ["Retro"], strictTagOnly: true },
    "ecole-diplome": {
      exactTags: [
        "Graduation",
        "Modele de Cabine Photo Photo Graduation",
        "Modèle de Cabine Photo Photo Graduation"
      ]
    },
    "remise-diplome": { exactTags: ["Graduation", "Modèle de Cabine Photo Photo Graduation"] },
    paques: { exactTags: ["Easter"] },
    casino: { exactTags: ["Casino"] },
    sport: { exactTags: ["Sports"] }
  };

  const exact = categoryExactTags(categoryId);
  return exact.length > 0 ? exact : CATEGORY_RULES_V3[categoryId]?.exactTags ?? [];
}

function isStrictTagCategory(categoryId: string) {
  return categoryId === "retro";
}

function categoryExactTags(categoryId: string) {
  return CATEGORY_RULES_V3[categoryId]?.exactTags ?? [];
}

function categorySearchKeywords(categoryId: string) {
  return CATEGORY_RULES_V3[categoryId]?.keywords ?? [];
}

function matchingRulesForCategory(categoryId: string) {
  if (categoryId === "all") {
    return ["all:true"];
  }

  if (categoryId === "autres") {
    return ["autres:complement_des_categories_principales"];
  }

  const rules: string[] = [];
  const exactTags = categoryExactTags(categoryId);
  const keywords = categorySearchKeywords(categoryId);

  if (exactTags.length > 0) {
    rules.push(`exact_tags:${exactTags.join(" | ")}`);
  }

  if (keywords.length > 0) {
    rules.push(`keywords:${keywords.join(" | ")}`);
  }

  rules.push("business_rules:event_pic_overrides");

  if (isStrictTagCategory(categoryId)) {
    rules.push("strict_tag_if_tags_exist:true");
  }

  if (categoryId === "mariage") {
    rules.push("special_case:purple_celebration");
  }

  return rules;
}

function matchesCategoryByKeywords(template: CachedTemplate, keywords: string[]) {
  if (keywords.length === 0) {
    return false;
  }

  const normalizedFields = searchableFields(template);
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    return normalizedFields.some((field) => field.includes(normalizedKeyword));
  });
}

function normalizedTemplateTags(template: CachedTemplate) {
  return (template.tags ?? []).map((tag) => normalizeSearchText(tag)).filter(Boolean);
}

function hasExactTag(template: CachedTemplate, expectedTags: string[]) {
  const normalizedTags = new Set(normalizedTemplateTags(template));
  return expectedTags.some((expectedTag) => normalizedTags.has(normalizeSearchText(expectedTag)));
}

function isKnownMainCategory(template: CachedTemplate, overrideIndex?: TemplateCategoryOverrideIndex | null): boolean {
  const mainCategoryIds = EVENT_PIC_CATEGORIES.map((category) => category.id).filter(
    (categoryId) => categoryId !== "all" && categoryId !== "autres"
  );

  return mainCategoryIds.some((categoryId) => matchesCategoryV3(template, categoryId, overrideIndex));
}

function buildRemoteTemplateUrl(query: SyncQuery) {
  const { baseUrl } = getTemplateBoothConfig();
  const url = new URL(`${baseUrl}/templates`);

  if (query.layout) {
    url.searchParams.set("layout", query.layout);
  }

  if (query.type) {
    url.searchParams.set("type", query.type);
  }

  if (query.tags) {
    url.searchParams.set("tags", query.tags);

    if (!query.forceTagsOnly) {
      // Certains flux TemplateBooth attendent aussi un fallback search.
      url.searchParams.set("search", query.tags);
    }
  }

  if (query.search) {
    url.searchParams.set("search", query.search);
  }

  if (query.imageType) {
    url.searchParams.set("image_type", query.imageType);
  }

  if (query.noOfImages) {
    url.searchParams.set("no_of_images", query.noOfImages);
  }

  url.searchParams.set("per_page", String(query.perPage));
  url.searchParams.set("page", String(query.page));

  return url;
}

function buildSyncQueries() {
  const queries: SyncQuery[] = [];
  const categories = EVENT_PIC_CATEGORIES.map((category) => getCategoryFilter(category.id)).filter(
    (category) => category.categoryId !== "all" && category.categoryId !== "autres" && category.keyword
  );

  for (const format of EVENT_PIC_FORMATS) {
    for (let page = 1; page <= SYNC_BASE_PAGES; page += 1) {
      queries.push({
        layout: format.layout,
        formatId: format.id,
        page,
        perPage: SYNC_PER_PAGE
      });
    }

    for (const category of categories) {
      for (let page = 1; page <= SYNC_CATEGORY_PAGES; page += 1) {
        queries.push({
          layout: format.layout,
          formatId: format.id,
          page,
          perPage: SYNC_PER_PAGE,
          category: category.categoryId,
          tags: category.tags,
          search: category.search
        });
      }
    }
  }

  for (const welcomeType of ["static_welcome_screen", "animated_welcome_screen"]) {
    for (let page = 1; page <= SYNC_BASE_PAGES; page += 1) {
      queries.push({
        type: welcomeType,
        page,
        perPage: SYNC_PER_PAGE
      });
    }
  }

  return queries;
}

async function fetchRemoteTemplates(query: SyncQuery) {
  const result = await fetchRemoteTemplatesPage(query);
  return result.templates;
}

async function fetchRemoteTemplatesPage(query: SyncQuery) {
  const { apiKey } = getTemplateBoothConfig();
  const url = buildRemoteTemplateUrl(query);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-API-Key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`API TemplateBooth indisponible (${response.status}).`);
  }

  const json = (await response.json()) as TemplateBoothTemplatesResponse;
  const data = Array.isArray(json.data) ? json.data : [];
  const totalPages = Math.max(1, numberValue(json.total_pages, 1));
  const total = Math.max(0, numberValue(json.total, data.length));

  const templates = data
    .map((item) => normalizeTemplate(item, query))
    .filter((template): template is CachedTemplate => Boolean(template));

  return {
    templates,
    totalPages,
    total,
    url: url.toString()
  };
}

async function fetchRemoteTemplatesAllPages(query: SyncQuery) {
  const firstPageResult = await fetchRemoteTemplatesPage({ ...query, page: 1 });
  let templates = [...firstPageResult.templates];
  let pagesTraversed = 1;
  const totalPages = firstPageResult.totalPages;

  if (totalPages > 1) {
    for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
      const pageResult = await fetchRemoteTemplatesPage({ ...query, page: nextPage });
      templates = [...templates, ...pageResult.templates];
      pagesTraversed += 1;
    }
  }

  return {
    templates: mergeTemplates(templates),
    total: firstPageResult.total,
    totalPages,
    pagesTraversed,
    firstUrl: firstPageResult.url
  };
}

async function fetchRemoteTemplatesCached(cacheKey: string, query: SyncQuery) {
  const now = Date.now();
  const cached = categorySupplementCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.templates;
  }

  const inFlight = categorySupplementInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    try {
      const templates = await fetchRemoteTemplates(query);
      categorySupplementCache.set(cacheKey, {
        expiresAt: Date.now() + CATEGORY_SUPPLEMENT_TTL_MS,
        templates
      });
      return templates;
    } catch (error) {
      console.error("[TemplateBooth] supplement categorie ignore.", {
        layout: query.layout,
        page: query.page,
        tags: query.tags,
        search: query.search,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      });
      return [];
    }
  })().finally(() => {
    categorySupplementInFlight.delete(cacheKey);
  });

  categorySupplementInFlight.set(cacheKey, request);
  return request;
}

async function fetchCategorySupplementTemplatesDetailed(params: {
  categoryId: string;
  layout: string;
  page: number;
  perPage: number;
  allPages?: boolean;
}) {
  const queries = categorySupplementQueriesV2(params.categoryId);

  if (queries.length === 0) {
    return {
      templates: [] as CachedTemplate[],
      pagesTraversed: 0,
      queryStats: [] as Array<{
        key: string;
        pagesTraversed: number;
        total: number;
        firstUrl: string;
      }>
    };
  }

  if (params.allPages) {
    const cacheKey = `full:${params.categoryId}:${params.layout}:${Math.min(200, Math.max(48, params.perPage))}`;
    const now = Date.now();
    const cached = categorySupplementFullCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const inFlight = categorySupplementFullInFlight.get(cacheKey);

    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      const allPageBatches = await Promise.all(
        queries.map(async (query) => {
          const response = await fetchRemoteTemplatesAllPages({
            layout: params.layout,
            page: 1,
            perPage: Math.min(200, Math.max(48, params.perPage)),
            category: params.categoryId,
            tags: query.tags,
            search: query.search,
            forceTagsOnly: Boolean(query.tags)
          });

          return {
            key: query.key,
            pagesTraversed: response.pagesTraversed,
            total: response.total,
            firstUrl: response.firstUrl,
            templates: response.templates
          };
        })
      );
      const merged = mergeTemplates(allPageBatches.flatMap((batch) => batch.templates)).filter(
        (template) => template.layout === params.layout
      );
      const result = {
        templates: merged,
        pagesTraversed: allPageBatches.reduce((sum, batch) => sum + batch.pagesTraversed, 0),
        queryStats: allPageBatches.map((batch) => ({
          key: batch.key,
          pagesTraversed: batch.pagesTraversed,
          total: batch.total,
          firstUrl: batch.firstUrl
        }))
      };

      categorySupplementFullCache.set(cacheKey, {
        expiresAt: Date.now() + CATEGORY_SUPPLEMENT_TTL_MS,
        result
      });

      return result;
    })().finally(() => {
      categorySupplementFullInFlight.delete(cacheKey);
    });

    categorySupplementFullInFlight.set(cacheKey, request);
    return request;
  }

  const batches = await Promise.all(
    queries.map((query) => {
      const cacheKey = `${params.categoryId}:${params.layout}:${params.page}:${params.perPage}:${query.key}`;

      return fetchRemoteTemplatesCached(cacheKey, {
        layout: params.layout,
        page: params.page,
        perPage: params.perPage,
        category: params.categoryId,
        tags: query.tags,
        search: query.search,
        forceTagsOnly: Boolean(query.tags)
      }).then((templates) => ({
        key: query.key,
        pagesTraversed: 1,
        total: templates.length,
        firstUrl: buildRemoteTemplateUrl({
          layout: params.layout,
          page: params.page,
          perPage: params.perPage,
          category: params.categoryId,
          tags: query.tags,
          search: query.search,
          forceTagsOnly: Boolean(query.tags)
        }).toString(),
        templates
      }));
    })
  );
  const merged = mergeTemplates(batches.flatMap((batch) => batch.templates)).filter((template) => template.layout === params.layout);

  return {
    templates: merged,
    pagesTraversed: batches.reduce((sum, batch) => sum + batch.pagesTraversed, 0),
    queryStats: batches.map((batch) => ({
      key: batch.key,
      pagesTraversed: batch.pagesTraversed,
      total: batch.total,
      firstUrl: batch.firstUrl
    }))
  };
}

async function fetchCategorySupplementTemplates(params: {
  categoryId: string;
  layout: string;
  page: number;
  perPage: number;
  allPages?: boolean;
}) {
  const result = await fetchCategorySupplementTemplatesDetailed(params);
  return result.templates;
}

function templateIdentityKey(template: Pick<CachedTemplate, "id" | "post_url" | "preview_url" | "name">) {
  if (template.id?.trim()) {
    return `id:${template.id.trim()}`;
  }

  if (template.post_url || template.preview_url) {
    return `url:${template.post_url ?? ""}::${template.preview_url ?? ""}`;
  }

  return `name:${normalizeSearchText(template.name ?? "")}`;
}

function isLandscapeTemplate(template: Pick<CachedTemplate, "layout" | "layout_size" | "image_type">) {
  const layout = normalizeSearchText(template.layout ?? "");
  const layoutSize = normalizeSearchText(template.layout_size ?? "");
  const imageType = normalizeSearchText(template.image_type ?? "");

  if (layout === "46postcard l" || layoutSize === "46postcard l") {
    return true;
  }

  return imageType.includes("landscape");
}

function isOneImageTemplate(template: Pick<CachedTemplate, "no_of_images" | "raw_no_of_images">) {
  if (template.no_of_images === 1) {
    return true;
  }

  const rawNoOfImages = normalizeSearchText(template.raw_no_of_images ?? "");
  return rawNoOfImages.includes("1image");
}

async function fetchMariageLandscapeOneImageExactPage(page: number, perPage: number) {
  return fetchRemoteTemplatesPage({
    layout: "46postcard-l",
    category: "mariage",
    tags: "Wedding",
    imageType: "landscape",
    noOfImages: "1images",
    page,
    perPage,
    forceTagsOnly: true
  });
}

async function fetchMariageLandscapeOneImageExactAllPages(perPage = 200) {
  const cacheKey = `exact:mariage:46postcard-l:landscape:1images:${perPage}`;
  const now = Date.now();
  const cached = exactSupplementCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inFlight = exactSupplementInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = fetchRemoteTemplatesAllPages({
    layout: "46postcard-l",
    category: "mariage",
    tags: "Wedding",
    imageType: "landscape",
    noOfImages: "1images",
    page: 1,
    perPage,
    forceTagsOnly: true
  }).finally(() => {
    exactSupplementInFlight.delete(cacheKey);
  });

  exactSupplementInFlight.set(cacheKey, request);
  const result = await request;
  exactSupplementCache.set(cacheKey, {
    expiresAt: Date.now() + CATEGORY_SUPPLEMENT_TTL_MS,
    result
  });
  return result;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function mergeTemplateKey(template: CachedTemplate) {
  if (typeof template.id === "string" && template.id.trim().length > 0) {
    return `id:${template.id.trim()}`;
  }

  const postUrl = template.post_url?.trim();
  const previewUrl = template.preview_url?.trim();
  return `fallback:${postUrl ?? ""}::${previewUrl ?? ""}`;
}

function mergeTemplates(templates: CachedTemplate[]) {
  const merged = new Map<string, CachedTemplate>();

  for (const template of templates) {
    const mergeKey = mergeTemplateKey(template);
    const current = merged.get(mergeKey);

    if (!current) {
      merged.set(mergeKey, template);
      continue;
    }

    const nextCanvaUrl =
      typeof template.canva_template_url === "string" && template.canva_template_url.trim().length > 0
        ? template.canva_template_url.trim()
        : typeof current.canva_template_url === "string" && current.canva_template_url.trim().length > 0
          ? current.canva_template_url.trim()
          : null;
    const nextCanvaSource = nextCanvaUrl ? "templatebooth_api" : "not_provided_by_api";
    const nextCanvaDetectedAt = nextCanvaUrl
      ? template.canva_detected_at ?? current.canva_detected_at ?? new Date().toISOString()
      : null;

    merged.set(mergeKey, {
      ...current,
      ...template,
      canva_template_url: nextCanvaUrl,
      canva_source: nextCanvaSource,
      canva_detected_at: nextCanvaDetectedAt,
      tags: [...new Set([...(current.tags ?? []), ...(template.tags ?? [])])],
      category: current.category ?? template.category
    });
  }

  return [...merged.values()];
}

async function persistDetectedCanvaLinksFromTemplates(templates: CachedTemplate[]) {
  const detectedAt = new Date().toISOString();
  const entries = templates
    .filter((template) => typeof template.canva_template_url === "string" && template.canva_template_url.trim().length > 0)
    .map((template) => ({
      template_id: template.id,
      template_name: template.name,
      format_label: template.format_label,
      layout: template.layout,
      no_of_images: template.no_of_images ? `${Math.floor(template.no_of_images)}images` : undefined,
      post_url: template.post_url,
      canva_template_url: template.canva_template_url?.trim(),
      canva_source: "templatebooth_api" as const,
      canva_detected_at: detectedAt,
      psd_source_url: template.psd_url ?? template.source_file_url ?? template.photoshop_download_url ?? undefined
    }));

  if (entries.length === 0) {
    return {
      detectedCount: 0,
      savedCount: 0
    };
  }

  const saved = await upsertTemplateSourceLinksBatch(entries, {
    preserveAdminManualCanva: true
  });

  return {
    detectedCount: entries.length,
    savedCount: saved.length
  };
}

async function persistDetectedCategoryOverridesFromTemplates(templates: CachedTemplate[]) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return {
      addedCount: 0,
      updatedCount: 0,
      totalCount: 0,
      toReviewCount: 0,
      validatedCount: 0,
      ignoredCount: 0
    };
  }

  await hydrateTemplateCategoryOverridesForSyncLookups();

  const families = new Map<
    string,
    {
      familyKey: string;
      familyName: string;
      postUrl: string;
      previewUrl: string;
      templates: CachedTemplate[];
    }
  >();

  for (const template of templates) {
    const familyKey = getTemplateFamily(template);
    const current = families.get(familyKey);

    if (!current) {
      families.set(familyKey, {
        familyKey,
        familyName: template.name,
        postUrl: template.post_url ?? "",
        previewUrl: template.preview_url,
        templates: [template]
      });
      continue;
    }

    current.templates.push(template);

    if (!current.postUrl && template.post_url) {
      current.postUrl = template.post_url;
    }

    if (!current.previewUrl && template.preview_url) {
      current.previewUrl = template.preview_url;
    }
  }

  const entries = [...families.values()].map((family) => {
    const categorySet = new Set<string>();
    const reasonsSet = new Set<string>();

    for (const template of family.templates) {
      const business = getEventPicBusinessCategories(template);
      const matched = matchedCategoryIds(template);
      const categoriesFromRules = matched.length > 0 ? matched : business.categories;

      for (const category of categoriesFromRules) {
        categorySet.add(category);
      }

      for (const reason of business.reasons) {
        reasonsSet.add(reason);
      }
    }

    const detectedCategories = [...categorySet];
    const suggestedCategories = detectedCategories.length > 0 ? detectedCategories : ["autres"];
    const reason =
      reasonsSet.size > 0 ? [...reasonsSet].join(" | ") : "Aucune categorie metier detectee";

    return {
      family_key: family.familyKey,
      family_name: family.familyName,
      post_url: family.postUrl,
      preview_url: family.previewUrl,
      detected_categories: detectedCategories,
      suggested_categories: suggestedCategories,
      reason,
      formats_in_family: family.templates.map((template) => ({
        template_id: template.id,
        template_name: template.name,
        layout: template.layout,
        format_label: template.format_label,
        no_of_images: template.no_of_images,
        preview_url: template.preview_url
      }))
    };
  });

  return upsertDetectedTemplateCategoryOverrides(entries);
}

export async function syncTemplateBoothCatalog({ force = false, full = false }: { force?: boolean; full?: boolean } = {}) {
  const currentCache = await readCatalogCache();
  const previousTemplateKeys = new Set(currentCache.templates.map((template) => mergeTemplateKey(template)));
  const shouldRunFullSync = full || !cacheIsComplete(currentCache) || !isCacheFresh(currentCache);

  if (!force && isCacheFresh(currentCache) && cacheIsComplete(currentCache)) {
    return currentCache;
  }

  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    let templates: CachedTemplate[] = [];
    let pagesTraversed = 0;

    if (shouldRunFullSync) {
      const fullQueries: SyncQuery[] = [
        ...EVENT_PIC_FORMATS.map((format) => ({
          layout: format.layout,
          page: 1,
          perPage: 200
        })),
        { type: "static_welcome_screen", page: 1, perPage: 200 },
        { type: "animated_welcome_screen", page: 1, perPage: 200 }
      ];

      console.info(`[TemplateBooth] Synchronisation complete: ${fullQueries.length} lots.`);
      const fullBatches = await runWithConcurrency(fullQueries, Math.min(3, SYNC_CONCURRENCY), async (query) => {
        try {
          return await fetchRemoteTemplatesAllPages(query);
        } catch (error) {
          console.error("[TemplateBooth] Lot de synchronisation complete ignore.", {
            layout: query.layout,
            type: query.type,
            error: error instanceof Error ? error.message : "Erreur inconnue"
          });
          return {
            templates: [] as CachedTemplate[],
            total: 0,
            totalPages: 0,
            pagesTraversed: 0,
            firstUrl: ""
          };
        }
      });

      templates = mergeTemplates(fullBatches.flatMap((batch) => batch.templates));
      pagesTraversed = fullBatches.reduce((sum, batch) => sum + batch.pagesTraversed, 0);
    } else {
      const queries = buildSyncQueries();
      console.info(`[TemplateBooth] Synchronisation catalogue: ${queries.length} lots.`);
      const batches = await runWithConcurrency(queries, SYNC_CONCURRENCY, async (query) => {
        try {
          return await fetchRemoteTemplates(query);
        } catch (error) {
          console.error("[TemplateBooth] Lot de synchronisation ignore.", {
            layout: query.layout,
            category: query.category,
            page: query.page,
            error: error instanceof Error ? error.message : "Erreur inconnue"
          });
          return [];
        }
      });
      templates = mergeTemplates(batches.flat());
      pagesTraversed = queries.length;
    }

    const newTemplates = templates.filter((template) => !previousTemplateKeys.has(mergeTemplateKey(template)));
    const nowIso = new Date().toISOString();
    const totalByLayout = buildCacheLayoutCounts(templates);
    const totalByCategory = buildCacheCategoryCounts(templates);
    const nextCache: TemplateBoothCatalogCache = {
      version: CACHE_SCHEMA_VERSION,
      lastSync: nowIso,
      cacheComplete: shouldRunFullSync,
      lastFullSync: shouldRunFullSync ? nowIso : currentCache.lastFullSync ?? null,
      totalKnownTemplates: templates.length,
      totalByLayout,
      totalByCategory,
      templates
    };

    await writeCatalogCache(nextCache);
    await writeLegacyTemplateCache(templates);
    const canvaSync = await persistDetectedCanvaLinksFromTemplates(templates).catch((error) => {
      console.error("[TemplateBooth] Synchronisation des liens Canva detectes echouee.", error);
      return {
        detectedCount: 0,
        savedCount: 0
      };
    });
    const categoryOverrideSync = await persistDetectedCategoryOverridesFromTemplates(newTemplates).catch((error) => {
      console.error("[TemplateBooth] Synchronisation du classement templates echouee.", error);
      return {
        addedCount: 0,
        updatedCount: 0,
        totalCount: 0,
        toReviewCount: 0,
        validatedCount: 0
      };
    });
    console.info(
      `[TemplateBooth] Synchronisation catalogue terminee: ${templates.length} templates caches (${pagesTraversed} pages), ${canvaSync.savedCount}/${canvaSync.detectedCount} liens Canva detectes synchronises, ${categoryOverrideSync.addedCount} nouveaux templates a classer.`
    );
    return nextCache;
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

export async function syncMariagePaysageOneImageCache() {
  const currentCache = await readCatalogCache();
  const previousTemplateKeys = new Set(currentCache.templates.map((template) => mergeTemplateKey(template)));
  const live = await fetchMariageLandscapeOneImageExactAllPages(200);
  const mergedTemplates = mergeTemplates([...currentCache.templates, ...live.templates]);
  const newTemplates = mergedTemplates.filter((template) => !previousTemplateKeys.has(mergeTemplateKey(template)));
  const nowIso = new Date().toISOString();
  const nextCache: TemplateBoothCatalogCache = {
    ...currentCache,
    version: CACHE_SCHEMA_VERSION,
    lastSync: nowIso,
    totalKnownTemplates: mergedTemplates.length,
    totalByLayout: buildCacheLayoutCounts(mergedTemplates),
    totalByCategory: buildCacheCategoryCounts(mergedTemplates),
    templates: mergedTemplates
  };

  await writeCatalogCache(nextCache);
  await writeLegacyTemplateCache(mergedTemplates);
  const canvaSync = await persistDetectedCanvaLinksFromTemplates(mergedTemplates).catch((error) => {
    console.error("[TemplateBooth] Synchronisation des liens Canva detectes (mariage paysage) echouee.", error);
    return {
      detectedCount: 0,
      savedCount: 0
    };
  });
  const categoryOverrideSync = await persistDetectedCategoryOverridesFromTemplates(newTemplates).catch((error) => {
    console.error("[TemplateBooth] Synchronisation du classement templates (mariage paysage) echouee.", error);
    return {
      addedCount: 0,
      updatedCount: 0,
      totalCount: 0,
      toReviewCount: 0,
      validatedCount: 0
    };
  });

  const previousCount = currentCache.templates.length;
  const addedCount = Math.max(0, mergedTemplates.length - previousCount);

  return {
    cache: nextCache,
    addedCount,
    previousCount,
    newCount: mergedTemplates.length,
    pagesTraversed: live.pagesTraversed,
    totalLive: live.total,
    firstUrl: live.firstUrl,
    canvaDetectedCount: canvaSync.detectedCount,
    canvaSavedCount: canvaSync.savedCount,
    categoryOverrideAddedCount: categoryOverrideSync.addedCount
  };
}

async function writeLegacyTemplateCache(templates: CachedTemplate[]) {
  const serialized = `${JSON.stringify(templates, null, 2)}\n`;

  if (shouldUseTemplateCacheBlobStorage()) {
    await writeBlobTextWithBackup(LEGACY_TEMPLATE_CACHE_BLOB_PATH, LEGACY_TEMPLATE_CACHE_BLOB_BACKUP_PREFIX, serialized);
    return;
  }

  if (shouldUseLocalTemplateCacheStorage()) {
    await fs.mkdir(path.dirname(legacyTemplateCachePath), { recursive: true });
    await fs.writeFile(legacyTemplateCachePath, serialized, "utf8");
    return;
  }

  throw new Error(missingTemplateCacheBlobTokenMessage());
}

async function readLegacyTemplateCacheRaw() {
  if (shouldUseTemplateCacheBlobStorage()) {
    const blobRaw = await readBlobText(LEGACY_TEMPLATE_CACHE_BLOB_PATH);

    if (blobRaw !== null) {
      return blobRaw;
    }

    try {
      const seedRaw = await fs.readFile(legacyTemplateCachePath, "utf8");
      await writeBlobText(LEGACY_TEMPLATE_CACHE_BLOB_PATH, seedRaw);
      return seedRaw;
    } catch {
      return "[]\n";
    }
  }

  if (!shouldUseLocalTemplateCacheStorage()) {
    throw new Error(missingTemplateCacheBlobTokenMessage());
  }

  return fs.readFile(legacyTemplateCachePath, "utf8");
}

type TemplateCategoryOverrideIndex = {
  byFamilyKey: Map<string, TemplateCategoryOverrideEntry>;
  byPostUrl: Map<string, TemplateCategoryOverrideEntry>;
  byFamilyName: Map<string, TemplateCategoryOverrideEntry>;
};

function normalizeOverridePostUrl(value: string | undefined) {
  return value?.split("?")[0]?.replace(/\/$/, "") ?? "";
}

function buildTemplateCategoryOverrideIndex(entries: TemplateCategoryOverrideEntry[]): TemplateCategoryOverrideIndex {
  const byFamilyKey = new Map<string, TemplateCategoryOverrideEntry>();
  const byPostUrl = new Map<string, TemplateCategoryOverrideEntry>();
  const byFamilyName = new Map<string, TemplateCategoryOverrideEntry>();

  for (const entry of entries) {
    if (entry.family_key) {
      byFamilyKey.set(entry.family_key, entry);
    }

    const normalizedPostUrl = normalizeOverridePostUrl(entry.post_url);

    if (normalizedPostUrl) {
      byPostUrl.set(normalizedPostUrl, entry);
    }

    const normalizedFamilyName = normalizeSearchText(entry.family_name);

    if (normalizedFamilyName) {
      byFamilyName.set(normalizedFamilyName, entry);
    }
  }

  return {
    byFamilyKey,
    byPostUrl,
    byFamilyName
  };
}

function findTemplateCategoryOverrideInIndex(
  template: Pick<CachedTemplate, "id" | "name" | "post_url">,
  overrideIndex: TemplateCategoryOverrideIndex
) {
  const familyKey = getTemplateFamily(template);
  const byFamilyKey = overrideIndex.byFamilyKey.get(familyKey);

  if (byFamilyKey) {
    return byFamilyKey;
  }

  const normalizedPostUrl = normalizeOverridePostUrl(template.post_url);

  if (normalizedPostUrl) {
    const byPostUrl = overrideIndex.byPostUrl.get(normalizedPostUrl);

    if (byPostUrl) {
      return byPostUrl;
    }
  }

  const normalizedFamilyName = normalizeSearchText(template.name);

  if (normalizedFamilyName) {
    const byFamilyName = overrideIndex.byFamilyName.get(normalizedFamilyName);

    if (byFamilyName) {
      return byFamilyName;
    }
  }

  return null;
}

function getTemplateCategoryOverride(
  template: Pick<CachedTemplate, "id" | "name" | "post_url">,
  overrideIndex?: TemplateCategoryOverrideIndex | null
) {
  if (overrideIndex) {
    return findTemplateCategoryOverrideInIndex(template, overrideIndex);
  }

  const familyKey = getTemplateFamily(template);

  return findTemplateCategoryOverrideSync({
    family_key: familyKey,
    post_url: template.post_url,
    family_name: template.name
  });
}

async function hydrateTemplateCategoryOverridesForSyncLookups() {
  try {
    const entries = await listTemplateCategoryOverrides();
    return buildTemplateCategoryOverrideIndex(entries);
  } catch (error) {
    console.error("[Event Pic] Chargement du classement templates impossible.", error);
    return null;
  }
}

function getValidatedOverrideCategories(
  template: Pick<CachedTemplate, "id" | "name" | "post_url">,
  overrideIndex?: TemplateCategoryOverrideIndex | null
) {
  const override = getTemplateCategoryOverride(template, overrideIndex);

  if (!override || override.validated_categories.length === 0) {
    return [] as EventPicCategoryId[];
  }

  return [...override.validated_categories] as EventPicCategoryId[];
}

function isTemplateIgnoredByOverride(
  template: Pick<CachedTemplate, "id" | "name" | "post_url">,
  overrideIndex?: TemplateCategoryOverrideIndex | null
) {
  const override = getTemplateCategoryOverride(template, overrideIndex);
  return override?.status === "ignored";
}

function searchableFields(template: CachedTemplate) {
  return [
    template.name,
    template.post_url,
    template.type,
    template.type_name,
    template.category,
    template.source,
    ...(template.tags ?? [])
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeSearchText);
}

function matchesCategory(
  template: CachedTemplate,
  categoryId: string,
  overrideIndex?: TemplateCategoryOverrideIndex | null
): boolean {
  if (categoryId === "all") {
    return !isTemplateIgnoredByOverride(template, overrideIndex);
  }

  if (isTemplateIgnoredByOverride(template, overrideIndex)) {
    return false;
  }

  const validatedOverrideCategories = getValidatedOverrideCategories(template, overrideIndex);

  if (validatedOverrideCategories.length > 0) {
    if (categoryId === "autres") {
      return validatedOverrideCategories.includes("autres");
    }

    return validatedOverrideCategories.includes(categoryId as EventPicCategoryId);
  }

  const business = getEventPicBusinessCategories(template);

  if (categoryId === "autres") {
    return business.forceAutres || !isKnownMainCategory(template, overrideIndex);
  }

  if (business.forceAutres) {
    return false;
  }

  if (business.categories.includes(categoryId as BusinessCategoryId)) {
    return true;
  }

  if (business.lockedByExactRule) {
    return false;
  }

  if (categoryId === "retro") {
    // Retro est une categorie de style TemplateBooth, elle peut contenir des evenements varies.
    // Filtrage strict: tag exact uniquement.
    return hasExactTag(template, ["Retro"]);
  }

  if (categoryId === "nouvel-an") {
    if (hasExactTag(template, ["New Year's Eve", "Chinese New Year", "Lunar New Year"])) {
      return true;
    }

    const newYearKeywords = [
      "new year's eve",
      "chinese new year",
      "lunar new year",
      "new year",
      "nouvel an",
      "reveillon",
      "réveillon"
    ];

    if (matchesCategoryByKeywords(template, newYearKeywords)) {
      return true;
    }
  }

  if (categoryId === "mariage") {
    return matchesMariageStrict(template);
  }

  const categoryKeywords = categorySearchKeywordsV2(categoryId);

  if (categoryKeywords.length > 0 && matchesCategoryByKeywords(template, categoryKeywords)) {
    return true;
  }

  const filter = getCategoryFilter(categoryId);

  if (!filter.keyword) {
    return true;
  }

  const keyword = normalizeSearchText(filter.keyword);
  return searchableFields(template).some((field) => field.includes(keyword));
}

function matchesCategoryV3(
  template: CachedTemplate,
  categoryId: string,
  overrideIndex?: TemplateCategoryOverrideIndex | null
): boolean {
  if (categoryId === "all") {
    return !isTemplateIgnoredByOverride(template, overrideIndex);
  }

  if (isTemplateIgnoredByOverride(template, overrideIndex)) {
    return false;
  }

  const validatedOverrideCategories = getValidatedOverrideCategories(template, overrideIndex);

  if (validatedOverrideCategories.length > 0) {
    if (categoryId === "autres") {
      return validatedOverrideCategories.includes("autres");
    }

    return validatedOverrideCategories.includes(categoryId as EventPicCategoryId);
  }

  const business = getEventPicBusinessCategories(template);

  if (categoryId === "autres") {
    return business.forceAutres || !isKnownMainCategory(template, overrideIndex);
  }

  if (business.forceAutres) {
    return false;
  }

  if (business.categories.includes(categoryId as BusinessCategoryId)) {
    return true;
  }

  if (business.lockedByExactRule) {
    return false;
  }

  if (categoryId === "mariage") {
    return matchesMariageStrict(template);
  }

  if (categoryId === "fete-bebe") {
    const blockedBabyKeywords = ["sweet 16", "sweet 16th", "birthday", "graduation", "wedding"];
    const hasBlockedKeyword = matchesCategoryByKeywords(template, blockedBabyKeywords);
    const hasBabyTag = hasExactTag(template, ["Baby Shower", "Gender Reveal"]);

    if (hasBlockedKeyword && !hasBabyTag) {
      return false;
    }
  }

  if (categoryId === "soiree-privee") {
    const hasNightlifeTag = hasExactTag(template, ["Nightlife"]);
    const hasStrongNightlifeSignal = hasNightlifeTag || matchesCategoryByKeywords(template, NIGHTLIFE_STRONG_KEYWORDS);
    const hasBlacklistedSignal = matchesCategoryByKeywords(template, NIGHTLIFE_BLACKLIST_KEYWORDS);

    if (hasBlacklistedSignal && !hasStrongNightlifeSignal) {
      return false;
    }
  }

  const exactTags = categoryExactTags(categoryId);
  const keywords = categorySearchKeywords(categoryId);
  const hasTagData = (template.tags ?? []).length > 0;

  if (exactTags.length > 0 && hasExactTag(template, exactTags)) {
    return true;
  }

  if (isStrictTagCategory(categoryId) && hasTagData) {
    // Retro: si les tags existent, on reste strict sur le tag exact.
    return false;
  }

  if (keywords.length > 0 && matchesCategoryByKeywords(template, keywords)) {
    return true;
  }

  const fallback = getCategoryFilter(categoryId).keyword;

  if (!fallback) {
    return false;
  }

  const normalizedFallback = normalizeSearchText(fallback);
  return searchableFields(template).some((field) => field.includes(normalizedFallback));
}

function toPublicTemplate(template: CachedTemplate): EventPicTemplate {
  const normalizedType = normalizeTemplateType({
    type: template.type,
    typeName: template.type_name,
    layout: template.layout,
    name: template.name,
    previewUrl: template.preview_url,
    videoUrl: template.video_url
  });

  return {
    id: template.id,
    name: template.name,
    preview_url: template.preview_url,
    video_url: template.video_url,
    layout: template.layout,
    format_label: isWelcomeScreenType(normalizedType) ? "Welcome screen 1920x1080" : template.format_label,
    no_of_images: template.no_of_images,
    type: normalizedType,
    type_name: template.type_name,
    published_at: template.published_at,
    source_width: template.source_width ?? null,
    source_height: template.source_height ?? null,
    tags: template.tags,
    category: template.category,
    source: template.source
  };
}

function slugFromUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .split("?")[0]
    ?.replace(/\/$/, "")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "");
}

function normalizeFamilyText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || undefined;
}

function familyKeys(template: Pick<CachedTemplate, "id" | "name" | "post_url">) {
  const normalizedPostUrl = template.post_url?.split("?")[0]?.replace(/\/$/, "");

  if (normalizedPostUrl) {
    return [`post_url:${normalizedPostUrl}`];
  }

  const baseId = template.id.split("__")[0];

  return [
    baseId ? `id:${baseId}` : undefined,
    normalizeFamilyText(slugFromUrl(template.post_url)),
    normalizeFamilyText(template.name)
  ].filter((value): value is string => Boolean(value));
}

export function getTemplateFamily(template: Pick<CachedTemplate, "id" | "name" | "post_url">) {
  const normalizedPostUrl = template.post_url?.split("?")[0]?.replace(/\/$/, "");

  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  return familyKeys(template)[0] ?? template.id;
}

type PortraitCandidateScore = {
  templateId: string;
  score: number;
  reasons: string[];
};

function scoreRequiredPortraitCandidate(template: CachedTemplate): PortraitCandidateScore {
  const reasons: string[] = [];
  let score = 0;

  if (template.layout === "46postcard-p") {
    score += 120;
    reasons.push("layout_46postcard-p");
  } else {
    score -= 300;
    reasons.push("layout_non_portrait");
  }

  if (template.no_of_images === 1) {
    score += 120;
    reasons.push("1_photo");
  } else {
    score -= 250;
    reasons.push("not_1_photo");
  }

  const searchable = normalizeSearchText(
    [template.name, template.type_name, template.preview_url, template.post_url].filter(Boolean).join(" ")
  );
  const positiveSignals: Array<[string, number]> = [
    ["single", 14],
    ["one photo", 12],
    ["1 photo", 12],
    ["1image", 10],
    ["main photo", 10],
    ["grande photo", 14],
    ["large", 8],
    ["full", 8],
    ["hero", 6]
  ];
  const negativeSignals: Array<[string, number]> = [
    ["mini", -10],
    ["small", -10],
    ["thumbnail", -10],
    ["collage", -12],
    ["multi", -10],
    ["grid", -8]
  ];

  for (const [token, weight] of positiveSignals) {
    if (searchable.includes(token)) {
      score += weight;
      reasons.push(`signal_plus:${token}`);
    }
  }

  for (const [token, weight] of negativeSignals) {
    if (searchable.includes(token)) {
      score += weight;
      reasons.push(`signal_moins:${token}`);
    }
  }

  const publishedAt = Date.parse(template.published_at ?? "");

  if (Number.isFinite(publishedAt)) {
    const ageDays = Math.max(0, Math.floor((Date.now() - publishedAt) / 86_400_000));
    const recentBonus = ageDays <= 365 ? 5 : 0;
    score += recentBonus;
    reasons.push(`published_bonus:${recentBonus}`);
  }

  return {
    templateId: template.id,
    score,
    reasons
  };
}

async function resolvePreferredRequiredPortraitId(params: {
  familyKey: string;
  selectedTemplate: CachedTemplate;
  portraitCandidates: CachedTemplate[];
}) {
  const mapping = await findTemplateSourceLink({
    familyKey: params.familyKey,
    postUrl: params.selectedTemplate.post_url
  });
  const preferredFromMapping = mapping?.preferred_required_portrait_id?.trim();

  if (
    preferredFromMapping &&
    params.portraitCandidates.some((candidate) => candidate.id === preferredFromMapping)
  ) {
    return {
      preferredRequiredPortraitId: preferredFromMapping,
      selectionReason: "mapping_manuel"
    } as const;
  }

  const scoredCandidates = params.portraitCandidates
    .map((candidate) => ({
      candidate,
      scoring: scoreRequiredPortraitCandidate(candidate)
    }))
    .sort((first, second) => {
      const scoreDelta = second.scoring.score - first.scoring.score;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const firstDate = Date.parse(first.candidate.published_at ?? "");
      const secondDate = Date.parse(second.candidate.published_at ?? "");
      const dateDelta = (Number.isFinite(secondDate) ? secondDate : 0) - (Number.isFinite(firstDate) ? firstDate : 0);

      if (dateDelta !== 0) {
        return dateDelta;
      }

      return first.candidate.id.localeCompare(second.candidate.id);
    });
  const bestCandidate = scoredCandidates[0]?.candidate;

  if (bestCandidate) {
    return {
      preferredRequiredPortraitId: bestCandidate.id,
      selectionReason: "scoring_auto"
    } as const;
  }

  return {
    preferredRequiredPortraitId: null,
    selectionReason: "fallback_ou_placeholder"
  } as const;
}

function templateBelongsToFamily(template: CachedTemplate, selectedFamilyKeys: string[]) {
  const keys = familyKeys(template);
  return keys.some((key) => selectedFamilyKeys.includes(key));
}

const FAMILY_ALLOWED_LAYOUTS = ["26strip", "46postcard-p", "46postcard-l"] as const;

function layoutRank(layout: string) {
  const index = FAMILY_ALLOWED_LAYOUTS.findIndex((allowedLayout) => allowedLayout === layout);
  return index === -1 ? 999 : index;
}

function photoCountRank(value: number | null) {
  return typeof value === "number" ? value : 99;
}

function isFamilyEligibleVariant(template: CachedTemplate) {
  return (
    FAMILY_ALLOWED_LAYOUTS.includes(template.layout as (typeof FAMILY_ALLOWED_LAYOUTS)[number]) ||
    isWelcomeTemplateLike({
      type: template.type,
      typeName: template.type_name,
      layout: template.layout,
      name: template.name,
      previewUrl: template.preview_url,
      videoUrl: template.video_url
    })
  );
}

function sortFamilyVariants(a: CachedTemplate, b: CachedTemplate) {
  const aIsWelcome = isWelcomeTemplateLike({
    type: a.type,
    typeName: a.type_name,
    layout: a.layout,
    name: a.name,
    previewUrl: a.preview_url,
    videoUrl: a.video_url
  });
  const bIsWelcome = isWelcomeTemplateLike({
    type: b.type,
    typeName: b.type_name,
    layout: b.layout,
    name: b.name,
    previewUrl: b.preview_url,
    videoUrl: b.video_url
  });
  const aRank = aIsWelcome ? 3 : layoutRank(a.layout);
  const bRank = bIsWelcome ? 3 : layoutRank(b.layout);
  const layoutDelta = aRank - bRank;

  if (layoutDelta !== 0) {
    return layoutDelta;
  }

  const photoDelta = photoCountRank(a.no_of_images) - photoCountRank(b.no_of_images);

  if (photoDelta !== 0) {
    return photoDelta;
  }

  return a.name.localeCompare(b.name);
}

function selectFamilyVariants(templates: CachedTemplate[]) {
  const deduped = new Map<string, CachedTemplate>();

  for (const template of templates) {
    if (!isFamilyEligibleVariant(template)) {
      continue;
    }

    if (!deduped.has(template.id)) {
      deduped.set(template.id, template);
    }
  }

  return [...deduped.values()].sort(sortFamilyVariants);
}

export async function getTemplateFamilyVariants(templateId: string) {
  let cache = await readCatalogCache();

  if (cache.templates.length === 0) {
    cache = await syncTemplateBoothCatalog({ force: true });
  } else if (!isCacheFresh(cache)) {
    void syncTemplateBoothCatalog({ force: true }).catch((error) => {
      console.error("[TemplateBooth] Synchronisation famille arriere-plan echouee.", error);
    });
  }

  const selectedTemplate = cache.templates.find((template) => template.id === templateId);

  if (!selectedTemplate) {
    return undefined;
  }

  const selectedFamilyKeys = familyKeys(selectedTemplate);
  const strictFamilyKey = getTemplateFamily(selectedTemplate);
  const familyTemplates = cache.templates.filter((template) => {
    const templateFamilyKey = getTemplateFamily(template);

    if (strictFamilyKey.startsWith("post_url:") || templateFamilyKey.startsWith("post_url:")) {
      return templateFamilyKey === strictFamilyKey;
    }

    return templateBelongsToFamily(template, selectedFamilyKeys) && templateFamilyKey === strictFamilyKey;
  });
  const variants = selectFamilyVariants(familyTemplates);
  const portraitCandidates = variants.filter(
    (template) => template.layout === "46postcard-p" && template.no_of_images === 1
  );
  const preferredPortrait = await resolvePreferredRequiredPortraitId({
    familyKey: strictFamilyKey,
    selectedTemplate,
    portraitCandidates
  });

  return {
    family: getTemplateFamily(selectedTemplate),
    selected: toPublicTemplate(selectedTemplate),
    templates: variants.map(toPublicTemplate),
    preferredRequiredPortraitId: preferredPortrait.preferredRequiredPortraitId
  };
}

async function getFallbackTemplates(formatId: string): Promise<EventPicTemplateListResult> {
  const requestedFormat = getEventPicFormat(formatId);
  const localFormatAliases: Record<string, string[]> = {
    "2x6": ["2x6", "vertical-2x6"],
    portrait: ["portrait", "portrait-4x6"],
    paysage: ["paysage", "landscape-4x6", "landscape-4x6-multi", "landscape-4x6-full"]
  };
  const localTemplates = await getLocalTemplates();
  const templates = localTemplates
    .filter((template) => {
      if (template.layoutSize) {
        return template.layoutSize === requestedFormat.layout;
      }

      if (template.format === "landscape-4x6-multi" || template.format === "landscape-4x6-full") {
        return requestedFormat.id === "paysage";
      }

      return (localFormatAliases[requestedFormat.id] ?? [requestedFormat.id]).includes(template.format);
    })
    .map((template) => ({
      id: template.templateId || template.id,
      name: template.name,
      preview_url: template.previewImage,
      video_url: template.videoUrl,
      layout: template.layoutSize || requestedFormat.layout,
      format_label: requestedFormat.label,
      no_of_images: template.photoCount,
      type: template.templateBoothType,
      type_name: template.templateBoothType || template.theme || "Template local",
      published_at: template.publishedAt ?? null,
      source_width: null,
      source_height: null,
      photoshop_download_url: null,
      psd_url: null,
      source_file_url: null,
      download_url: null,
      tags: template.tags,
      category: template.eventType,
      source: "local"
    }));

  return {
    templates,
    page: 1,
    per_page: templates.length,
    total: templates.length,
    total_pages: 1,
    source: "local",
    debug: {
      totalBeforeFormat: templates.length,
      totalAfterFormat: templates.length,
      totalAfterCategory: templates.length,
      returnedCount: templates.length
    },
    cache: {
      lastSync: null,
      stale: true
    }
  };
}

function paginateTemplates(templates: EventPicTemplate[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  return templates.slice(start, start + perPage);
}

function dedupeCategoryTemplates(templates: CachedTemplate[]) {
  const deduped = new Map<string, CachedTemplate>();

  for (const template of templates) {
    const idKey = typeof template.id === "string" && template.id.trim().length > 0 ? `id:${template.id.trim()}` : "";
    const postUrlPreviewKey =
      template.post_url && template.preview_url ? `post_preview:${template.post_url}::${template.preview_url}` : "";
    const namePreviewKey = template.preview_url
      ? `name_preview:${normalizeSearchText(template.name)}::${template.preview_url}`
      : "";
    const key = idKey || postUrlPreviewKey || namePreviewKey || templateIdentityKey(template);

    if (!deduped.has(key)) {
      deduped.set(key, template);
    }
  }

  return [...deduped.values()];
}

export async function getTemplateFilterDiagnostic({
  format,
  category
}: {
  format: string;
  category: string;
}): Promise<TemplateFilterDiagnosticResult> {
  const selectedFormat = getEventPicFormat(format);
  const selectedCategory = getEventPicCategory(category);
  let cacheExists = true;

  try {
    await fs.access(catalogCachePath);
  } catch {
    cacheExists = false;
  }

  let cache = await readCatalogCache();

  if (cache.templates.length === 0) {
    try {
      cache = await syncTemplateBoothCatalog({ force: true });
    } catch (error) {
      console.error("[TemplateBooth] Diagnostic: synchro impossible", error);
    }
  }

  const overrideIndex = await hydrateTemplateCategoryOverridesForSyncLookups();

  const allTemplates = cache.templates;
  const visibleTemplates = allTemplates.filter((template) => !isTemplateIgnoredByOverride(template, overrideIndex));
  const formatTemplates = visibleTemplates.filter((template) => template.layout === selectedFormat.layout);
  const cacheCategoryTemplates =
    selectedCategory.id === "all"
      ? formatTemplates
      : formatTemplates.filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex));
  let mergedCategoryTemplates = cacheCategoryTemplates.map((template) => ({ ...template }));
  let liveApiComparison: TemplateFilterDiagnosticResult["liveApiComparison"];
  let templateBoothExactComparison: TemplateFilterDiagnosticResult["templateBoothExactComparison"];

  if (selectedCategory.id === "mariage") {
    const liveResult = await fetchCategorySupplementTemplatesDetailed({
      categoryId: selectedCategory.id,
      layout: selectedFormat.layout,
      page: 1,
      perPage: 200,
      allPages: true
    });
    const liveMatches = dedupeCategoryTemplates(
      liveResult.templates.filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex))
    );

    liveApiComparison = {
      pagesTraversed: liveResult.pagesTraversed,
      totalLive: liveMatches.length,
      cacheCount: cacheCategoryTemplates.length,
      differenceLiveVsCache: liveMatches.length - cacheCategoryTemplates.length,
      firstTemplates: liveMatches.slice(0, 10).map((template) => ({
        id: template.id,
        name: template.name,
        post_url: template.post_url
      }))
    };

    if (liveMatches.length > 0) {
      mergedCategoryTemplates = dedupeCategoryTemplates([...mergedCategoryTemplates, ...liveMatches]).map((template) => ({
        ...template
      }));
    }
  }

  if (
    selectedCategory.id !== "mariage" &&
    selectedCategory.id !== "all" &&
    selectedCategory.id !== "autres" &&
    mergedCategoryTemplates.length === 0
  ) {
    const supplementTemplates = await fetchCategorySupplementTemplates({
      categoryId: selectedCategory.id,
      layout: selectedFormat.layout,
      page: 1,
      perPage: 96
    });

    if (supplementTemplates.length > 0) {
      mergedCategoryTemplates = supplementTemplates
        .filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex))
        .map((template) => ({ ...template }));
    }
  }

  const dedupedCategoryTemplates = dedupeCategoryTemplates(mergedCategoryTemplates);

  if (selectedCategory.id === "mariage" && selectedFormat.layout === "46postcard-l") {
    try {
      const diagnosticStartedAt = Date.now();
      const exactStartedAt = Date.now();
      const exactPage = await fetchMariageLandscapeOneImageExactPage(1, 48);
      const exactDurationMs = Date.now() - exactStartedAt;
      const exactFirst20 = exactPage.templates.slice(0, 20);
      const eventPicStartedAt = Date.now();
      const eventPicCurrent = await fetchEventPicTemplates({
        format: selectedFormat.id,
        category: selectedCategory.id,
        page: 1,
        perPage: 48
      });
      const eventPicDurationMs = Date.now() - eventPicStartedAt;
      const eventPicFirst20 = eventPicCurrent.templates.slice(0, 20);
      const exactKeys = new Set(exactPage.templates.map((template) => templateIdentityKey(template)));
      const eventPicKeys = new Set(eventPicCurrent.templates.map((template) => templateIdentityKey(template)));
      const missingFromEventPic = exactFirst20
        .filter((template) => !eventPicKeys.has(templateIdentityKey(template)))
        .map((template) => template.name)
        .slice(0, 20);
      const presentInEventPicButOutOfScope = eventPicCurrent.templates
        .filter((template) => !exactKeys.has(templateIdentityKey(template)))
        .filter((template) => isOutOfScopeMariagePublicTemplate(template))
        .map((template) => template.name)
        .slice(0, 20);
      const possibleReasons: string[] = [];

      if (!cacheIsComplete(cache)) {
        possibleReasons.push("cache incomplet");
      }

      if ((liveApiComparison?.differenceLiveVsCache ?? 0) > 0) {
        possibleReasons.push("cache local en retard par rapport a l'API");
      }

      if (missingFromEventPic.length > 0) {
        possibleReasons.push("filtres locaux ou dedoublonnage retirent des variantes");
        possibleReasons.push("ordre de tri/pagination different de TemplateBooth");
      }

      if (presentInEventPicButOutOfScope.length > 0) {
        possibleReasons.push("resultats Event Pic encore trop larges (hors sujet)");
      }

      templateBoothExactComparison = {
        query: {
          layout: "46postcard-l",
          tags: "Wedding",
          image_type: "landscape",
          no_of_images: "1images",
          per_page: 48,
          page: 1
        },
        templateBooth: {
          total: exactPage.total,
          count: exactPage.templates.length,
          first20: exactFirst20.map((template) => template.name)
        },
        eventPic: {
          total: eventPicCurrent.total,
          count: eventPicCurrent.templates.length,
          first20: eventPicFirst20.map((template) => template.name)
        },
        missingFromEventPic,
        presentInEventPicButOutOfScope,
        possibleReasons: possibleReasons.length > 0 ? possibleReasons : ["cache OK"],
        timingsMs: {
          templateBoothExact: exactDurationMs,
          eventPic: eventPicDurationMs,
          total: Date.now() - diagnosticStartedAt
        },
        pagesTraversed: {
          templateBoothExact: exactPage.totalPages
        },
        cacheUsed: cache.templates.length > 0,
        cacheComplete: cacheIsComplete(cache)
      };
    } catch (error) {
      templateBoothExactComparison = {
        query: {
          layout: "46postcard-l",
          tags: "Wedding",
          image_type: "landscape",
          no_of_images: "1images",
          per_page: 48,
          page: 1
        },
        templateBooth: {
          total: 0,
          count: 0,
          first20: []
        },
        eventPic: {
          total: dedupedCategoryTemplates.length,
          count: Math.min(20, dedupedCategoryTemplates.length),
          first20: dedupedCategoryTemplates.slice(0, 20).map((template) => template.name)
        },
        missingFromEventPic: [],
        presentInEventPicButOutOfScope: [],
        possibleReasons: [
          `diagnostic API exact indisponible: ${error instanceof Error ? error.message : "Erreur inconnue"}`
        ],
        timingsMs: {
          templateBoothExact: 0,
          eventPic: 0,
          total: 0
        },
        pagesTraversed: {
          templateBoothExact: 0
        },
        cacheUsed: cache.templates.length > 0,
        cacheComplete: cacheIsComplete(cache)
      };
    }
  }

  let apiFilters: TemplateFilterDiagnosticResult["apiFilters"] = {
    tagsFromTemplateBooth: [],
    layoutsFromTemplateBooth: [],
    typesFromTemplateBooth: [],
    imageTypeFromTemplateBooth: [],
    noOfImagesFromTemplateBooth: []
  };
  let filtersError: string | null = null;

  try {
    apiFilters = await fetchTemplateBoothFilters();
  } catch (error) {
    filtersError = error instanceof Error ? error.message : "Lecture /filters impossible";
  }

  const sampleTemplates = visibleTemplates.slice(0, 5).map((template) => ({
    id: template.id,
    name: template.name,
    layout: template.layout,
    type: template.type,
    type_name: template.type_name,
    tags: template.tags ?? [],
    post_url: template.post_url
  }));

  const returnedSample = dedupedCategoryTemplates.slice(0, 10).map((template) => {
    const matched = matchedCategoryIds(template, overrideIndex);
    const primary = primaryCategoryForTemplate(template, matched, overrideIndex);

    return {
      id: template.id,
      name: template.name,
      tags: template.tags ?? [],
      post_url: template.post_url,
      type: template.type,
      type_name: template.type_name,
      layout: template.layout,
      matched_categories: matched,
      primary_category: primary,
      classification_reason: classificationReason(template, primary, overrideIndex)
    };
  });

  let conclusion =
    dedupedCategoryTemplates.length > 0
      ? `Filtrage actif: ${dedupedCategoryTemplates.length} templates correspondent au format ${selectedFormat.id} et a la categorie ${selectedCategory.id}.`
      : selectedCategory.id === "fete-bebe"
        ? "Aucun modele Fete bebe trouve dans ce format."
        : filtersError
          ? `Aucun resultat. Verification des regles terminee, mais /filters n'est pas disponible: ${filtersError}`
          : `Aucun resultat pour format=${selectedFormat.id} et category=${selectedCategory.id} avec les regles actuelles.`;

  if (selectedCategory.id === "mariage" && liveApiComparison) {
    if (liveApiComparison.differenceLiveVsCache > 0) {
      conclusion = `cache incomplet: ${liveApiComparison.totalLive} templates mariage disponibles via API live, ${liveApiComparison.cacheCount} dans le cache (${liveApiComparison.differenceLiveVsCache} manquants).`;
    } else if (cacheIsComplete(cache)) {
      conclusion = `cache OK: ${liveApiComparison.cacheCount} templates mariage en cache, coherent avec l'API live.`;
    } else {
      conclusion = `cache incomplet ou non confirme: ${liveApiComparison.cacheCount} templates mariage en cache, ${liveApiComparison.totalLive} via API live.`;
    }
  }

  if (templateBoothExactComparison) {
    if (
      templateBoothExactComparison.missingFromEventPic.length === 0 &&
      templateBoothExactComparison.presentInEventPicButOutOfScope.length === 0
    ) {
      conclusion =
        "alignement OK: les premiers resultats Event Pic correspondent au filtrage TemplateBooth exact (Wedding + paysage + 1 image).";
    } else {
      conclusion = `ecart detecte: ${templateBoothExactComparison.missingFromEventPic.length} templates visibles cote TemplateBooth exact manquent, ${templateBoothExactComparison.presentInEventPicButOutOfScope.length} templates Event Pic semblent hors sujet.`;
    }
  }

  return {
    format: selectedFormat.id,
    category: selectedCategory.id,
    layoutUsed: selectedFormat.layout,
    cache: {
      exists: cacheExists,
      totalTemplates: visibleTemplates.length,
      sampleFields: visibleTemplates[0] ? Object.keys(visibleTemplates[0]) : [],
      sampleTemplates
    },
    apiFilters,
    serverFiltering: {
      totalBeforeFormat: visibleTemplates.length,
      totalAfterFormat: formatTemplates.length,
      totalAfterCategory: dedupedCategoryTemplates.length,
      returnedSample
    },
    liveApiComparison,
    cacheStatus: {
      cacheComplete: cacheIsComplete(cache),
      lastFullSync: cache.lastFullSync ?? null,
      totalKnownTemplates: cache.totalKnownTemplates ?? visibleTemplates.length,
      totalByLayout: cache.totalByLayout ?? buildCacheLayoutCounts(visibleTemplates)
    },
    templateBoothExactComparison,
    matchingRulesUsed: matchingRulesForCategory(selectedCategory.id),
    conclusion
  };
}

export async function fetchEventPicTemplates({
  format,
  category,
  page,
  perPage
}: {
  format: string;
  category: string;
  page: number;
  perPage: number;
}): Promise<EventPicTemplateListResult> {
  const selectedFormat = getEventPicFormat(format);
  const selectedCategory = getEventPicCategory(category);
  const safePage = Math.max(1, page || 1);
  const safePerPage = Math.min(Math.max(1, perPage || DEFAULT_PER_PAGE), 48);
  let cache = await readCatalogCache();
  const stale = !isCacheFresh(cache);

  if (cache.templates.length === 0) {
    try {
      cache = await syncTemplateBoothCatalog({ force: true });
    } catch (error) {
      console.error("[TemplateBooth] fallback local utilise pour /api/templates", error);
      return getFallbackTemplates(selectedFormat.id);
    }
  } else if (stale) {
    void syncTemplateBoothCatalog({ force: true }).catch((error) => {
      console.error("[TemplateBooth] Synchronisation arriere-plan echouee.", error);
    });
  }

  if (!cacheIsComplete(cache)) {
    void syncTemplateBoothCatalog({ force: true, full: true }).catch((error) => {
      console.error("[TemplateBooth] Synchronisation complete arriere-plan echouee.", error);
    });
  }

  const overrideIndex = await hydrateTemplateCategoryOverridesForSyncLookups();

  const visibleTemplates = cache.templates.filter((template) => !isTemplateIgnoredByOverride(template, overrideIndex));
  const layoutTemplates = visibleTemplates.filter((template) => template.layout === selectedFormat.layout);
  const totalBefore = layoutTemplates.length;
  const categoryTemplates =
    selectedCategory.id === "all"
      ? layoutTemplates
      : layoutTemplates.filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex));
  let mergedCategoryTemplates = categoryTemplates.map((template) => ({ ...template }));
  const cacheCompleteForLayout = cacheIsComplete(cache) && Number((cache.totalByLayout ?? {})[selectedFormat.layout] ?? 0) > 0;

  if (selectedCategory.id === "autres") {
    mergedCategoryTemplates = layoutTemplates
      .filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex))
      .map((template) => ({ ...template }));
  }

  const shouldLoadMariageSupplement =
    selectedCategory.id === "mariage" && (!cacheCompleteForLayout || mergedCategoryTemplates.length === 0);

  if (shouldLoadMariageSupplement) {
    try {
      const mariageLive = await fetchCategorySupplementTemplatesDetailed({
        categoryId: selectedCategory.id,
        layout: selectedFormat.layout,
        page: 1,
        perPage: 200,
        allPages: true
      });
      const mariageMatches = mariageLive.templates
        .filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex))
        .map((template) => ({ ...template }));

      if (mariageMatches.length > 0) {
        mergedCategoryTemplates = [...mergedCategoryTemplates, ...mariageMatches];
      }

    } catch (error) {
      console.error("[TemplateBooth] supplement mariage live ignore.", {
        layout: selectedFormat.layout,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  const hasMariageLandscapeOneImageFromCache = mergedCategoryTemplates.some(
    (template) =>
      template.layout === "46postcard-l" &&
      isLandscapeTemplate(template) &&
      isOneImageTemplate(template) &&
      matchesMariageStrict(template)
  );
  const shouldLoadMariageLandscapeExact =
    selectedCategory.id === "mariage" &&
    selectedFormat.layout === "46postcard-l" &&
    (!cacheCompleteForLayout || (mergedCategoryTemplates.length === 0 && !hasMariageLandscapeOneImageFromCache));

  if (shouldLoadMariageLandscapeExact) {
    try {
      const exactWeddingLandscapeOneImage = await fetchMariageLandscapeOneImageExactAllPages(200);
      const exactWeddingLandscapeOneImageMatches = exactWeddingLandscapeOneImage.templates
        .filter((template) => template.layout === "46postcard-l")
        .filter((template) => isLandscapeTemplate(template))
        .filter((template) => isOneImageTemplate(template))
        .filter((template) => matchesMariageStrict(template))
        .map((template) => ({ ...template }));

      if (exactWeddingLandscapeOneImageMatches.length > 0) {
        mergedCategoryTemplates = [...exactWeddingLandscapeOneImageMatches, ...mergedCategoryTemplates];
      }

    } catch (error) {
      console.error("[TemplateBooth] supplement mariage exact paysage ignore.", {
        layout: selectedFormat.layout,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  const shouldLoadCategorySupplement =
    selectedCategory.id !== "mariage" &&
    selectedCategory.id !== "all" &&
    selectedCategory.id !== "autres" &&
    (mergedCategoryTemplates.length === 0 ||
      (selectedCategory.id === "religieux" && mergedCategoryTemplates.length < 24));

  if (shouldLoadCategorySupplement) {
    const supplementTemplates = await fetchCategorySupplementTemplates({
      categoryId: selectedCategory.id,
      layout: selectedFormat.layout,
      page: 1,
      perPage: Math.max(safePerPage, 96)
    });

    if (supplementTemplates.length > 0) {
      const supplementMatches = supplementTemplates
        .filter((template) => matchesCategoryV3(template, selectedCategory.id, overrideIndex))
        .map((template) => ({ ...template }));

      if (supplementMatches.length > 0) {
        mergedCategoryTemplates = [...mergedCategoryTemplates, ...supplementMatches];
      }
    }
  }

  const dedupedCategoryTemplates = dedupeCategoryTemplates(mergedCategoryTemplates);
  const orderedCategoryTemplates =
    selectedCategory.id === "mariage" && selectedFormat.layout === "46postcard-l"
      ? [
          ...dedupedCategoryTemplates.filter(
            (template) => isLandscapeTemplate(template) && isOneImageTemplate(template) && matchesMariageStrict(template)
          ),
          ...dedupedCategoryTemplates.filter(
            (template) => !(isLandscapeTemplate(template) && isOneImageTemplate(template) && matchesMariageStrict(template))
          )
        ]
      : dedupedCategoryTemplates;
  const totalAfter = orderedCategoryTemplates.length;

  const filteredTemplates = orderedCategoryTemplates.map(toPublicTemplate);
  const total = filteredTemplates.length;
  const paginatedTemplates = paginateTemplates(filteredTemplates, safePage, safePerPage);

  return {
    templates: paginatedTemplates,
    page: safePage,
    per_page: safePerPage,
    total,
    total_pages: Math.max(1, Math.ceil(total / safePerPage)),
    source: "templatebooth",
    debug: {
      totalBeforeFormat: visibleTemplates.length,
      totalAfterFormat: totalBefore,
      totalAfterCategory: totalAfter,
      returnedCount: paginatedTemplates.length,
      sample: orderedCategoryTemplates.slice(0, 5).map((template) => ({
        name: template.name,
        tags: template.tags ?? [],
        post_url: template.post_url ?? null
      }))
    },
    cache: {
      lastSync: cache.lastSync || null,
      stale
    }
  };
}

export async function getCachedTemplateById(id: string) {
  const catalogCache = await readCatalogCache();
  const cachedTemplate = catalogCache.templates.find((template) => template.id === id);

  if (cachedTemplate) {
    return cachedTemplate;
  }

  try {
    const raw = await readLegacyTemplateCacheRaw();
    const legacyTemplates = JSON.parse(raw) as CachedTemplate[];
    return Array.isArray(legacyTemplates) ? legacyTemplates.find((template) => template.id === id) : undefined;
  } catch {
    return undefined;
  }
}

export async function listCachedTemplates() {
  let catalogCache = await readCatalogCache();

  if (catalogCache.templates.length === 0) {
    catalogCache = await syncTemplateBoothCatalog({ force: true });
  } else {
    if (!isCacheFresh(catalogCache)) {
      void syncTemplateBoothCatalog({ force: true }).catch((error) => {
        console.error("[TemplateBooth] Synchronisation auto (cache expire) echouee.", error);
      });
    }

    if (!cacheIsComplete(catalogCache)) {
      void syncTemplateBoothCatalog({ force: true, full: true }).catch((error) => {
        console.error("[TemplateBooth] Synchronisation auto complete (cache incomplet) echouee.", error);
      });
    }
  }

  return catalogCache.templates;
}

export async function getTemplateBoothCacheStatus() {
  const cache = await readCatalogCache();
  const lastSyncTime = cache.lastSync ? new Date(cache.lastSync).getTime() : Number.NaN;
  const ageMs = Number.isFinite(lastSyncTime) ? Math.max(0, Date.now() - lastSyncTime) : null;
  const ageHours = ageMs === null ? null : ageMs / (1000 * 60 * 60);
  const stale = !isCacheFresh(cache);

  return {
    lastSync: cache.lastSync || null,
    stale,
    cacheComplete: cacheIsComplete(cache),
    totalKnownTemplates: cache.totalKnownTemplates ?? cache.templates.length,
    totalByLayout: cache.totalByLayout ?? buildCacheLayoutCounts(cache.templates),
    ageHours
  };
}

export async function readTemplateBoothCatalogCacheSnapshot() {
  return readCatalogCache();
}

function searchReason(template: CachedTemplate, normalizedQuery: string) {
  const reasons: string[] = [];

  if (normalizeSearchText(template.name).includes(normalizedQuery)) {
    reasons.push("name");
  }

  if (normalizeSearchText(template.post_url ?? "").includes(normalizedQuery)) {
    reasons.push("post_url");
  }

  if (normalizeSearchText(template.type_name).includes(normalizedQuery)) {
    reasons.push("type_name");
  }

  if ((template.tags ?? []).some((tag) => normalizeSearchText(tag).includes(normalizedQuery))) {
    reasons.push("tag");
  }

  return reasons;
}

const MAIN_CATEGORY_IDS = EVENT_PIC_CATEGORIES.map((category) => category.id).filter(
  (id) => id !== "all" && id !== "autres"
);

function matchedCategoryIds(template: CachedTemplate, overrideIndex?: TemplateCategoryOverrideIndex | null) {
  return MAIN_CATEGORY_IDS.filter((categoryId) => matchesCategoryV3(template, categoryId, overrideIndex));
}

export function matchedEventPicCategoryIds(template: CachedTemplate) {
  return matchedCategoryIds(template);
}

function primaryCategoryForTemplate(
  template: CachedTemplate,
  matchedCategories: string[],
  overrideIndex?: TemplateCategoryOverrideIndex | null
) {
  const validatedOverrideCategories = getValidatedOverrideCategories(template, overrideIndex);
  const overridePriority: Array<EventPicCategoryId> = [
    "mariage",
    "anniversaire",
    "religieux",
    "fete-bebe",
    "soiree-privee",
    "entreprise",
    "noel",
    "nouvel-an",
    "halloween",
    "saint-valentin",
    "tropical",
    "retro",
    "western",
    "ecole-diplome",
    "paques",
    "casino",
    "sport",
    "autres"
  ];

  if (validatedOverrideCategories.length > 0) {
    for (const categoryId of overridePriority) {
      if (validatedOverrideCategories.includes(categoryId)) {
        return categoryId;
      }
    }

    return validatedOverrideCategories[0] ?? null;
  }

  if (matchedCategories.length === 0) {
    const business = getEventPicBusinessCategories(template);
    return business.forceAutres ? "autres" : null;
  }

  const business = getEventPicBusinessCategories(template);

  // Priorite business: mariage puis anniversaire puis le reste dans l'ordre UI.
  const priority: BusinessCategoryId[] = [
    "mariage",
    "anniversaire",
    "religieux",
    "fete-bebe",
    "western",
    "soiree-privee",
    "entreprise",
    "noel",
    "nouvel-an",
    "halloween",
    "saint-valentin",
    "tropical",
    "retro",
    "ecole-diplome",
    "paques",
    "casino",
    "sport"
  ];

  if (business.categories.length > 0) {
    for (const categoryId of priority) {
      if (business.categories.includes(categoryId)) {
        return categoryId;
      }
    }
  }

  for (const categoryId of priority) {
    if (matchedCategories.includes(categoryId)) {
      return categoryId;
    }
  }

  return matchedCategories[0] ?? null;
}

function classificationReason(
  template: CachedTemplate,
  primaryCategory: string | null,
  overrideIndex?: TemplateCategoryOverrideIndex | null
) {
  const override = getTemplateCategoryOverride(template, overrideIndex);

  if (override?.status === "ignored") {
    return "Ignore manuellement dans le classement admin";
  }

  if (primaryCategory && override?.validated_categories.includes(primaryCategory as TemplateCategoryId)) {
    const reason = override.reason.trim();
    return reason ? `Classement manuel valide: ${reason}` : "Classement manuel valide dans l'admin";
  }

  if (!primaryCategory) {
    return "Aucune categorie principale detectee";
  }

  const business = getEventPicBusinessCategories(template);
  const businessReasons = business.reasonByCategory[primaryCategory as BusinessCategoryKey];

  if (businessReasons && businessReasons.length > 0) {
    return businessReasons.join(" | ");
  }

  if (primaryCategory === "autres" && business.forceAutres) {
    return "regle metier Event Pic: classement force dans Autres";
  }

  return `Classe selon les regles ${primaryCategory}`;
}

function formatKeyFromTemplate(template: CachedTemplate) {
  if (template.layout === "26strip") {
    return "2x6";
  }

  if (template.layout === "46postcard-p") {
    return "portrait";
  }

  if (template.layout === "46postcard-l") {
    return "paysage";
  }

  if (isWelcomeScreenType(normalizeTemplateType(template))) {
    return "welcome";
  }

  return undefined;
}

function availableFormatsByFamily(templates: CachedTemplate[]) {
  const map = new Map<string, Set<string>>();

  for (const template of templates) {
    const familyKey = getTemplateFamily(template);
    const formatKey = formatKeyFromTemplate(template);

    if (!formatKey) {
      continue;
    }

    if (!map.has(familyKey)) {
      map.set(familyKey, new Set<string>());
    }

    map.get(familyKey)!.add(formatKey);
  }

  return map;
}

export async function searchEventPicTemplates(params: {
  query: string;
  limit?: number;
  includeAdminFields?: boolean;
}): Promise<EventPicTemplateSearchResponse> {
  const query = params.query.trim();
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length < 2) {
    return {
      query,
      total: 0,
      results: []
    };
  }

  let cache = await readCatalogCache();

  if (cache.templates.length === 0) {
    cache = await syncTemplateBoothCatalog({ force: true });
  }

  const overrideIndex = await hydrateTemplateCategoryOverridesForSyncLookups();

  const familyFormatMap = availableFormatsByFamily(cache.templates);
  const seen = new Set<string>();
  const hits: EventPicTemplateSearchResult[] = [];
  const max = Math.min(Math.max(params.limit ?? 80, 1), 200);

  for (const template of cache.templates) {
    if (params.includeAdminFields !== true && isTemplateIgnoredByOverride(template, overrideIndex)) {
      continue;
    }

    const reasons = searchReason(template, normalizedQuery);

    if (reasons.length === 0) {
      continue;
    }

    const dedupeKey =
      template.id ||
      (template.post_url && template.preview_url ? `${template.post_url}::${template.preview_url}` : template.name);

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    const familyKey = getTemplateFamily(template);
    const business = getEventPicBusinessCategories(template);
    const matchedMainCategories = matchedCategoryIds(template, overrideIndex);
    const matchedCategories =
      matchedMainCategories.length > 0
        ? matchedMainCategories
        : business.forceAutres
          ? ["autres"]
          : [];
    const primaryCategory = primaryCategoryForTemplate(template, matchedCategories, overrideIndex);
    const availableFormats = [...(familyFormatMap.get(familyKey) ?? new Set<string>())];
    const publicTemplate = toPublicTemplate(template);

    hits.push({
      id: publicTemplate.id,
      name: publicTemplate.name,
      preview_url: publicTemplate.preview_url,
      format_label: publicTemplate.format_label,
      layout: publicTemplate.layout,
      no_of_images: publicTemplate.no_of_images,
      matched_categories: matchedCategories,
      primary_category: primaryCategory,
      tags: publicTemplate.tags ?? [],
      reason: `matched by ${reasons.join("/")}`,
      classification_reason: classificationReason(template, primaryCategory, overrideIndex),
      available_formats: availableFormats,
      post_url: params.includeAdminFields ? template.post_url : undefined,
      template: publicTemplate
    });

    if (hits.length >= max) {
      break;
    }
  }

  hits.sort((first, second) => first.name.localeCompare(second.name));

  return {
    query,
    total: hits.length,
    results: hits
  };
}
