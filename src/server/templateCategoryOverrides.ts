import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { EVENT_PIC_CATEGORIES, EventPicCategoryId, getEventPicCategory } from "@/src/shared/eventPicTemplates";

const overridesPath = path.join(process.cwd(), "data", "template-category-overrides.json");
const OVERRIDES_BLOB_PATH = "admin/template-category-overrides.json";
const OVERRIDES_BLOB_BACKUP_PREFIX = "admin/backups/template-category-overrides";
const OVERRIDES_BLOB_ACCESS = "private" as const;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const OVERRIDE_STATUSES = new Set(["to_review", "validated", "ignored"] as const);
const OVERRIDE_CATEGORIES = new Set(
  EVENT_PIC_CATEGORIES.map((category) => category.id).filter((categoryId) => categoryId !== "all")
);

export type TemplateCategoryOverrideStatus = "to_review" | "validated" | "ignored";
export type TemplateCategoryId = Exclude<EventPicCategoryId, "all">;

export type TemplateCategoryOverrideFormatEntry = {
  template_id: string;
  template_name: string;
  layout: string;
  format_label: string;
  no_of_images: string;
  preview_url: string;
};

export type TemplateCategoryOverrideEntry = {
  family_key: string;
  family_name: string;
  post_url: string;
  preview_url: string;
  detected_categories: TemplateCategoryId[];
  suggested_categories: TemplateCategoryId[];
  validated_categories: TemplateCategoryId[];
  status: TemplateCategoryOverrideStatus;
  reason: string;
  formats_in_family: TemplateCategoryOverrideFormatEntry[];
  created_at: string;
  updated_at: string;
  validated_at: string | null;
};

export type TemplateCategoryOverrideLookup = {
  family_key?: string;
  post_url?: string;
  family_name?: string;
};

export type DetectedTemplateCategoryInput = {
  family_key?: string;
  family_name?: string;
  post_url?: string;
  preview_url?: string;
  detected_categories?: string[];
  suggested_categories?: string[];
  reason?: string;
  formats_in_family?: Array<{
    template_id?: string;
    template_name?: string;
    layout?: string;
    format_label?: string;
    no_of_images?: string | number | null;
    preview_url?: string;
  }>;
};

type OverrideSyncCache = {
  mtimeMs: number;
  entries: TemplateCategoryOverrideEntry[];
  byFamilyKey: Map<string, TemplateCategoryOverrideEntry>;
  byPostUrl: Map<string, TemplateCategoryOverrideEntry>;
};

let syncCache: OverrideSyncCache | null = null;

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  return (
    value
      .split("?")[0]
      ?.replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.[a-z0-9]+$/i, "") ?? ""
  );
}

function normalizePostUrl(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  return normalized.split("?")[0]?.replace(/\/$/, "") ?? normalized;
}

function normalizeNoOfImages(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.floor(value)}images`;
  }

  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  const onlyDigits = normalized.match(/^(\d+)$/);

  if (onlyDigits) {
    return `${onlyDigits[1]}images`;
  }

  const imagesPattern = normalized.match(/^(\d+)\s*images?$/i);

  if (imagesPattern) {
    return `${imagesPattern[1]}images`;
  }

  return normalized;
}

function normalizeCategoryId(value: unknown): TemplateCategoryId | undefined {
  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  const mapped = getEventPicCategory(normalized).id;

  if (mapped === "all") {
    return undefined;
  }

  if (!OVERRIDE_CATEGORIES.has(mapped)) {
    return undefined;
  }

  return mapped as TemplateCategoryId;
}

function normalizeCategoryList(value: unknown): TemplateCategoryId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const categories = new Set<TemplateCategoryId>();

  for (const candidate of value) {
    const normalized = normalizeCategoryId(candidate);

    if (normalized) {
      categories.add(normalized);
    }
  }

  return [...categories];
}

function normalizeStatus(
  value: unknown,
  fallback: TemplateCategoryOverrideStatus,
  validatedCategories: TemplateCategoryId[]
): TemplateCategoryOverrideStatus {
  const normalized = normalizeText(value) as TemplateCategoryOverrideStatus;

  if (normalized && OVERRIDE_STATUSES.has(normalized)) {
    return normalized;
  }

  if (validatedCategories.length > 0) {
    return "validated";
  }

  return fallback;
}

function normalizeFamilyKey(value: unknown) {
  const normalized = normalizeText(value);

  if (normalized) {
    return normalized;
  }

  return "";
}

function derivedFamilyKey(params: { family_key?: unknown; post_url?: unknown; family_name?: unknown }) {
  const explicitKey = normalizeFamilyKey(params.family_key);

  if (explicitKey) {
    return explicitKey;
  }

  const normalizedPostUrl = normalizePostUrl(params.post_url);

  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  const normalizedFamilyName = normalizeSearchText(normalizeText(params.family_name));

  if (normalizedFamilyName) {
    return `name:${normalizedFamilyName.replace(/\s+/g, "-")}`;
  }

  return "";
}

function normalizeFormatEntry(input: Partial<TemplateCategoryOverrideFormatEntry>) {
  const templateId = normalizeText(input.template_id);

  if (!templateId) {
    return null;
  }

  return {
    template_id: templateId,
    template_name: normalizeText(input.template_name),
    layout: normalizeText(input.layout),
    format_label: normalizeText(input.format_label),
    no_of_images: normalizeNoOfImages(input.no_of_images),
    preview_url: normalizeText(input.preview_url)
  } satisfies TemplateCategoryOverrideFormatEntry;
}

function mergeFormatEntries(
  currentEntries: TemplateCategoryOverrideFormatEntry[],
  nextEntries: TemplateCategoryOverrideFormatEntry[]
) {
  const map = new Map<string, TemplateCategoryOverrideFormatEntry>();

  for (const entry of currentEntries) {
    map.set(entry.template_id, entry);
  }

  for (const entry of nextEntries) {
    const current = map.get(entry.template_id);

    if (!current) {
      map.set(entry.template_id, entry);
      continue;
    }

    map.set(entry.template_id, {
      template_id: entry.template_id,
      template_name: entry.template_name || current.template_name,
      layout: entry.layout || current.layout,
      format_label: entry.format_label || current.format_label,
      no_of_images: entry.no_of_images || current.no_of_images,
      preview_url: entry.preview_url || current.preview_url
    });
  }

  return [...map.values()].sort((first, second) => first.template_name.localeCompare(second.template_name));
}

function normalizeFormatEntries(value: unknown): TemplateCategoryOverrideFormatEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value
    .map((entry) => normalizeFormatEntry(entry as Partial<TemplateCategoryOverrideFormatEntry>))
    .filter((entry): entry is TemplateCategoryOverrideFormatEntry => Boolean(entry));

  return mergeFormatEntries([], entries);
}

function normalizeEntry(entry: Partial<TemplateCategoryOverrideEntry>): TemplateCategoryOverrideEntry | null {
  const familyKey = derivedFamilyKey(entry);

  if (!familyKey) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const validatedCategories = normalizeCategoryList(entry.validated_categories);
  const detectedCategories = normalizeCategoryList(entry.detected_categories);
  const suggestedCategories = normalizeCategoryList(entry.suggested_categories);
  const status = normalizeStatus(entry.status, "to_review", validatedCategories);
  const createdAt = normalizeText(entry.created_at) || nowIso;
  const updatedAt = normalizeText(entry.updated_at) || createdAt;
  const validatedAt = normalizeText(entry.validated_at);

  return {
    family_key: familyKey,
    family_name: normalizeText(entry.family_name),
    post_url: normalizePostUrl(entry.post_url),
    preview_url: normalizeText(entry.preview_url),
    detected_categories: detectedCategories,
    suggested_categories: suggestedCategories.length > 0 ? suggestedCategories : detectedCategories,
    validated_categories: validatedCategories,
    status,
    reason: normalizeText(entry.reason),
    formats_in_family: normalizeFormatEntries(entry.formats_in_family),
    created_at: createdAt,
    updated_at: updatedAt,
    validated_at: status === "validated" ? validatedAt || updatedAt : null
  };
}

function hasBlobReadWriteToken() {
  return normalizeText(process.env.BLOB_READ_WRITE_TOKEN).length > 0;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function shouldUseBlobStorage() {
  return hasBlobReadWriteToken();
}

function shouldUseLocalFileStorage() {
  return !shouldUseBlobStorage() && !isVercelRuntime();
}

function missingBlobTokenMessage() {
  return "BLOB_READ_WRITE_TOKEN manquant: le classement templates doit utiliser Vercel Blob en production.";
}

function serializeEntries(entries: TemplateCategoryOverrideEntry[]) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

function backupTimestamp() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function setSyncCache(entries: TemplateCategoryOverrideEntry[], mtimeMs = Date.now()) {
  syncCache = {
    ...makeSyncIndex(entries),
    mtimeMs
  };
}

function ensureLocalOverridesFileSync() {
  fsSync.mkdirSync(path.dirname(overridesPath), { recursive: true });

  if (!fsSync.existsSync(overridesPath)) {
    fsSync.writeFileSync(overridesPath, "[]\n", "utf8");
  }
}

async function ensureLocalOverridesFile() {
  await fs.mkdir(path.dirname(overridesPath), { recursive: true });

  try {
    await fs.access(overridesPath);
  } catch {
    await fs.writeFile(overridesPath, "[]\n", "utf8");
  }
}

function readLocalOverridesRawSync({ createIfMissing }: { createIfMissing: boolean }) {
  try {
    if (createIfMissing) {
      ensureLocalOverridesFileSync();
    }

    return fsSync.readFileSync(overridesPath, "utf8");
  } catch {
    return "[]\n";
  }
}

async function readLocalOverridesRaw({ createIfMissing }: { createIfMissing: boolean }) {
  try {
    if (createIfMissing) {
      await ensureLocalOverridesFile();
    }

    return await fs.readFile(overridesPath, "utf8");
  } catch {
    return "[]\n";
  }
}

async function readBlobOverridesRaw() {
  try {
    const result = await get(OVERRIDES_BLOB_PATH, {
      access: OVERRIDES_BLOB_ACCESS,
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

    throw new Error(`Lecture Vercel Blob impossible pour ${OVERRIDES_BLOB_PATH}: ${message || "erreur inconnue"}`);
  }
}

async function writeBlobText(pathname: string, contents: string, allowOverwrite = true) {
  await put(pathname, contents, {
    access: OVERRIDES_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: JSON_CONTENT_TYPE,
    cacheControlMaxAge: 60
  });
}

async function readBlobOrSeedOverridesRaw() {
  const blobRaw = await readBlobOverridesRaw();

  if (blobRaw !== null) {
    return blobRaw;
  }

  const seedRaw = await readLocalOverridesRaw({ createIfMissing: false });
  const seedEntries = sortEntries(parseOverrides(seedRaw));
  const normalizedSeed = serializeEntries(seedEntries);
  await writeBlobText(OVERRIDES_BLOB_PATH, normalizedSeed);
  return normalizedSeed;
}

async function readOverridesRaw() {
  if (shouldUseBlobStorage()) {
    return readBlobOrSeedOverridesRaw();
  }

  if (!shouldUseLocalFileStorage()) {
    throw new Error(missingBlobTokenMessage());
  }

  return readLocalOverridesRaw({ createIfMissing: true });
}

async function writeLocalEntries(entries: TemplateCategoryOverrideEntry[]) {
  await ensureLocalOverridesFile();
  await fs.writeFile(overridesPath, serializeEntries(entries), "utf8");
}

async function writeBlobEntries(entries: TemplateCategoryOverrideEntry[]) {
  const currentRaw = await readBlobOverridesRaw();

  if (currentRaw !== null && currentRaw.trim().length > 0) {
    const backupPath = `${OVERRIDES_BLOB_BACKUP_PREFIX}-${backupTimestamp()}.json`;
    await writeBlobText(backupPath, currentRaw, false);
  }

  await writeBlobText(OVERRIDES_BLOB_PATH, serializeEntries(entries));
}

function parseOverrides(raw: string) {
  const parsed = JSON.parse(raw) as Partial<TemplateCategoryOverrideEntry>[];

  if (!Array.isArray(parsed)) {
    return [] as TemplateCategoryOverrideEntry[];
  }

  return parsed
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is TemplateCategoryOverrideEntry => Boolean(entry));
}

function sortEntries(entries: TemplateCategoryOverrideEntry[]) {
  return [...entries].sort((first, second) => {
    if (first.status !== second.status) {
      const weight = (status: TemplateCategoryOverrideStatus) => {
        if (status === "to_review") {
          return 0;
        }
        if (status === "validated") {
          return 1;
        }
        return 2;
      };

      return weight(first.status) - weight(second.status);
    }

    const firstUpdatedAt = new Date(first.updated_at).getTime();
    const secondUpdatedAt = new Date(second.updated_at).getTime();

    if (Number.isFinite(firstUpdatedAt) && Number.isFinite(secondUpdatedAt) && firstUpdatedAt !== secondUpdatedAt) {
      return secondUpdatedAt - firstUpdatedAt;
    }

    return first.family_name.localeCompare(second.family_name);
  });
}

async function saveEntries(entries: TemplateCategoryOverrideEntry[]) {
  const normalized = sortEntries(
    entries.map((entry) => normalizeEntry(entry)).filter((entry): entry is TemplateCategoryOverrideEntry => Boolean(entry))
  );

  if (shouldUseBlobStorage()) {
    await writeBlobEntries(normalized);
  } else if (shouldUseLocalFileStorage()) {
    await writeLocalEntries(normalized);
  } else {
    throw new Error(missingBlobTokenMessage());
  }

  setSyncCache(normalized);
}

function makeSyncIndex(entries: TemplateCategoryOverrideEntry[]): OverrideSyncCache {
  const byFamilyKey = new Map<string, TemplateCategoryOverrideEntry>();
  const byPostUrl = new Map<string, TemplateCategoryOverrideEntry>();

  for (const entry of entries) {
    byFamilyKey.set(entry.family_key, entry);

    if (entry.post_url) {
      byPostUrl.set(entry.post_url, entry);
    }
  }

  return {
    mtimeMs: Date.now(),
    entries,
    byFamilyKey,
    byPostUrl
  };
}

function loadOverridesSync(): OverrideSyncCache {
  if (shouldUseBlobStorage()) {
    if (syncCache) {
      return syncCache;
    }

    const entries = parseOverrides(readLocalOverridesRawSync({ createIfMissing: false }));
    setSyncCache(entries);
    return syncCache!;
  }

  if (!shouldUseLocalFileStorage()) {
    if (syncCache) {
      return syncCache;
    }

    const entries = parseOverrides(readLocalOverridesRawSync({ createIfMissing: false }));
    setSyncCache(entries);
    return syncCache!;
  }

  ensureLocalOverridesFileSync();
  const stat = fsSync.statSync(overridesPath);

  if (syncCache && syncCache.mtimeMs === stat.mtimeMs) {
    return syncCache;
  }

  const raw = fsSync.readFileSync(overridesPath, "utf8");
  const entries = parseOverrides(raw);
  setSyncCache(entries, stat.mtimeMs);
  return syncCache!;
}

function findEntryIndex(entries: TemplateCategoryOverrideEntry[], lookup: TemplateCategoryOverrideLookup) {
  const familyKey = derivedFamilyKey(lookup);

  if (familyKey) {
    const byFamilyKeyIndex = entries.findIndex((entry) => entry.family_key === familyKey);

    if (byFamilyKeyIndex >= 0) {
      return byFamilyKeyIndex;
    }
  }

  const postUrl = normalizePostUrl(lookup.post_url);

  if (postUrl) {
    const byPostUrlIndex = entries.findIndex((entry) => entry.post_url === postUrl);

    if (byPostUrlIndex >= 0) {
      return byPostUrlIndex;
    }
  }

  const familyName = normalizeSearchText(normalizeText(lookup.family_name));

  if (familyName) {
    return entries.findIndex((entry) => normalizeSearchText(entry.family_name) === familyName);
  }

  return -1;
}

function applyStatus(entry: TemplateCategoryOverrideEntry, nowIso: string) {
  const categories = [...new Set(entry.validated_categories)] as TemplateCategoryId[];
  entry.validated_categories = categories;

  if (entry.status === "ignored") {
    entry.validated_at = null;
    return;
  }

  if (entry.validated_categories.length > 0) {
    entry.status = "validated";
    entry.validated_at = entry.validated_at || nowIso;
    return;
  }

  entry.status = "to_review";
  entry.validated_at = null;
}

export async function listTemplateCategoryOverrides() {
  const raw = await readOverridesRaw();
  const entries = sortEntries(parseOverrides(raw));
  setSyncCache(entries);
  return entries;
}

export function listTemplateCategoryOverridesSync() {
  return loadOverridesSync().entries;
}

export function findTemplateCategoryOverrideSync(lookup: TemplateCategoryOverrideLookup) {
  const cache = loadOverridesSync();
  const familyKey = derivedFamilyKey(lookup);

  if (familyKey) {
    const byFamilyKey = cache.byFamilyKey.get(familyKey);

    if (byFamilyKey) {
      return byFamilyKey;
    }
  }

  const postUrl = normalizePostUrl(lookup.post_url);

  if (postUrl) {
    const byPostUrl = cache.byPostUrl.get(postUrl);

    if (byPostUrl) {
      return byPostUrl;
    }
  }

  return null;
}

export async function writeTemplateCategoryOverrides(entries: TemplateCategoryOverrideEntry[]) {
  await saveEntries(entries);
}

export async function upsertTemplateCategoryOverride(entry: Partial<TemplateCategoryOverrideEntry>) {
  const current = await listTemplateCategoryOverrides();
  const familyKey = derivedFamilyKey(entry);

  if (!familyKey) {
    throw new Error("family_key, post_url ou family_name requis.");
  }

  const index = findEntryIndex(current, entry);
  const nowIso = new Date().toISOString();
  const normalizedDetected = normalizeCategoryList(entry.detected_categories);
  const normalizedSuggested = normalizeCategoryList(entry.suggested_categories);
  const normalizedValidated = normalizeCategoryList(entry.validated_categories);
  const explicitStatus = normalizeText(entry.status) as TemplateCategoryOverrideStatus;
  const hasExplicitStatus = explicitStatus && OVERRIDE_STATUSES.has(explicitStatus);

  const base: TemplateCategoryOverrideEntry =
    index >= 0
      ? { ...current[index] }
      : {
          family_key: familyKey,
          family_name: normalizeText(entry.family_name),
          post_url: normalizePostUrl(entry.post_url),
          preview_url: normalizeText(entry.preview_url),
          detected_categories: [],
          suggested_categories: [],
          validated_categories: [],
          status: "to_review",
          reason: "",
          formats_in_family: [],
          created_at: nowIso,
          updated_at: nowIso,
          validated_at: null
        };

  const nextFormats = normalizeFormatEntries(entry.formats_in_family);
  const next: TemplateCategoryOverrideEntry = {
    ...base,
    family_key: familyKey || base.family_key,
    family_name: normalizeText(entry.family_name) || base.family_name,
    post_url: normalizePostUrl(entry.post_url) || base.post_url,
    preview_url: normalizeText(entry.preview_url) || base.preview_url,
    detected_categories: "detected_categories" in entry ? normalizedDetected : base.detected_categories,
    suggested_categories:
      "suggested_categories" in entry
        ? normalizedSuggested
        : base.suggested_categories,
    validated_categories:
      "validated_categories" in entry
        ? normalizedValidated
        : base.validated_categories,
    reason: normalizeText(entry.reason) || base.reason,
    formats_in_family:
      nextFormats.length > 0
        ? mergeFormatEntries(base.formats_in_family, nextFormats)
        : base.formats_in_family,
    updated_at: nowIso
  };

  if (hasExplicitStatus) {
    next.status = explicitStatus;
  } else if (next.validated_categories.length > 0) {
    next.status = "validated";
  } else if (next.status === "validated") {
    next.status = "to_review";
  }

  if (next.status === "validated") {
    next.validated_at = normalizeText(entry.validated_at) || base.validated_at || nowIso;
  } else {
    next.validated_at = null;
  }

  applyStatus(next, nowIso);

  if (index >= 0) {
    current[index] = next;
  } else {
    current.push(next);
  }

  await saveEntries(current);
  return next;
}

function createDetectedReason(entry: DetectedTemplateCategoryInput) {
  const reason = normalizeText(entry.reason);
  return reason || "Aucune categorie metier detectee";
}

function toDetectedOverrideEntry(entry: DetectedTemplateCategoryInput): TemplateCategoryOverrideEntry | null {
  const familyKey = derivedFamilyKey(entry);

  if (!familyKey) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const detectedCategories = normalizeCategoryList(entry.detected_categories);
  const suggestedCategories = normalizeCategoryList(entry.suggested_categories);
  const formatEntries = normalizeFormatEntries(entry.formats_in_family);

  return {
    family_key: familyKey,
    family_name: normalizeText(entry.family_name),
    post_url: normalizePostUrl(entry.post_url),
    preview_url: normalizeText(entry.preview_url),
    detected_categories: detectedCategories,
    suggested_categories:
      suggestedCategories.length > 0 ? suggestedCategories : detectedCategories.length > 0 ? detectedCategories : ["autres"],
    validated_categories: [],
    status: "to_review",
    reason: createDetectedReason(entry),
    formats_in_family: formatEntries,
    created_at: nowIso,
    updated_at: nowIso,
    validated_at: null
  };
}

export async function upsertDetectedTemplateCategoryOverrides(entries: DetectedTemplateCategoryInput[]) {
  if (!Array.isArray(entries) || entries.length === 0) {
    const current = await listTemplateCategoryOverrides();
    return {
      addedCount: 0,
      updatedCount: 0,
      totalCount: current.length,
      toReviewCount: current.filter((entry) => entry.status === "to_review").length,
      validatedCount: current.filter((entry) => entry.status === "validated").length,
      ignoredCount: current.filter((entry) => entry.status === "ignored").length
    };
  }

  const current = await listTemplateCategoryOverrides();
  let addedCount = 0;
  let updatedCount = 0;
  let hasChanges = false;

  for (const rawEntry of entries) {
    const detectedEntry = toDetectedOverrideEntry(rawEntry);

    if (!detectedEntry) {
      continue;
    }

    const index = findEntryIndex(current, detectedEntry);

    if (index === -1) {
      current.push(detectedEntry);
      addedCount += 1;
      hasChanges = true;
      continue;
    }

    const existing = current[index];
    const keepManual = existing.status === "validated" || existing.status === "ignored";
    const next: TemplateCategoryOverrideEntry = {
      ...existing,
      family_name: detectedEntry.family_name || existing.family_name,
      post_url: detectedEntry.post_url || existing.post_url,
      preview_url: detectedEntry.preview_url || existing.preview_url,
      detected_categories: detectedEntry.detected_categories,
      suggested_categories: detectedEntry.suggested_categories,
      reason: detectedEntry.reason || existing.reason,
      formats_in_family: mergeFormatEntries(existing.formats_in_family, detectedEntry.formats_in_family),
      updated_at: new Date().toISOString(),
      status: keepManual ? existing.status : "to_review",
      validated_categories: keepManual ? existing.validated_categories : [],
      validated_at: keepManual ? existing.validated_at : null
    };

    current[index] = next;
    updatedCount += 1;
    hasChanges = true;
  }

  if (hasChanges) {
    await saveEntries(current);
  }

  const totalCount = current.length;
  const toReviewCount = current.filter((entry) => entry.status === "to_review").length;
  const validatedCount = current.filter((entry) => entry.status === "validated").length;
  const ignoredCount = current.filter((entry) => entry.status === "ignored").length;

  return {
    addedCount,
    updatedCount,
    totalCount,
    toReviewCount,
    validatedCount,
    ignoredCount
  };
}
