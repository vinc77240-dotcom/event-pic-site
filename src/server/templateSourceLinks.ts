import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";

const sourceLinksPath = path.join(process.cwd(), "data", "template-source-links.json");
const SOURCE_LINKS_BLOB_PATH = "admin/template-source-links.json";
const SOURCE_LINKS_BLOB_BACKUP_PREFIX = "admin/backups/template-source-links";
const SOURCE_LINKS_BLOB_ACCESS = "private" as const;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export type TemplateSourceLink = {
  template_id?: string;
  template_name?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string;
  updated_at?: string;
  canva_source?:
    | "templatebooth_api"
    | "templatebooth_harvester"
    | "manual"
    | "admin_manual"
    | "not_provided_by_api";
  canva_detected_at?: string;
  canva_folder_url?: string;
  canva_folder_source?:
    | "templatebooth_api"
    | "templatebooth_harvester"
    | "manual"
    | "admin_manual";
  canva_folder_detected_at?: string;
  post_url?: string;
  family_key?: string;
  preferred_required_portrait_id?: string;
  preferred_welcome_id?: string;
  preferred_welcome_preview_url?: string;
  preferred_welcome_source_note?: string;
  welcome_screen_url?: string;
  welcome_preview_url?: string;
  welcome_source_note?: string;
  welcome_source_size?: "1366x1024" | "1920x1080" | string;
  welcome_target_size?: "1920x1080" | string;
  welcome_touch_to_start?: boolean;
  welcome_source?: "manual_admin" | "templatebooth_api" | "templatebooth_harvester" | "unknown";
  psd_source_url?: string;
  zip_url?: string;
  canva_template_url?: string;
  notes?: string;
};

type UpsertTemplateSourceLinksOptions = {
  preserveAdminManualCanva?: boolean;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasBlobReadWriteToken() {
  return cleanText(process.env.BLOB_READ_WRITE_TOKEN).length > 0;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function shouldUseSourceLinksBlobStorage() {
  return hasBlobReadWriteToken();
}

function shouldUseLocalSourceLinksStorage() {
  return !shouldUseSourceLinksBlobStorage() && !isVercelRuntime();
}

function missingSourceLinksBlobTokenMessage() {
  return "BLOB_READ_WRITE_TOKEN manquant: les liens sources TemplateBooth doivent utiliser Vercel Blob en production.";
}

function sourceLinksBackupTimestamp() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.split("?")[0]?.replace(/\/$/, "");
}

function normalizeFamilyKey(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNoOfImages(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.floor(value)}images`;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const onlyDigits = trimmed.match(/^(\d+)$/);

  if (onlyDigits) {
    return `${onlyDigits[1]}images`;
  }

  const imagesPattern = trimmed.match(/^(\d+)\s*images?$/i);

  if (imagesPattern) {
    return `${imagesPattern[1]}images`;
  }

  return trimmed;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "oui"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "non"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function normalizeEntry(entry: TemplateSourceLink): TemplateSourceLink {
  const updatedAt = normalizeText(entry.updated_at);
  const canvaSource = normalizeText(entry.canva_source) as TemplateSourceLink["canva_source"];
  const canvaDetectedAt = normalizeText(entry.canva_detected_at);

  return {
    template_id: normalizeText(entry.template_id),
    template_name: normalizeText(entry.template_name),
    format_label: normalizeText(entry.format_label),
    layout: normalizeText(entry.layout),
    no_of_images: normalizeNoOfImages(entry.no_of_images),
    updated_at: updatedAt,
    canva_source:
      canvaSource === "templatebooth_api" ||
      canvaSource === "manual" ||
      canvaSource === "admin_manual" ||
      canvaSource === "templatebooth_harvester" ||
      canvaSource === "not_provided_by_api"
        ? canvaSource === "admin_manual"
          ? "manual"
          : canvaSource
        : undefined,
    canva_detected_at: canvaDetectedAt,
    canva_folder_url: normalizeText(entry.canva_folder_url),
    canva_folder_source: ((): TemplateSourceLink["canva_folder_source"] => {
      const source = normalizeText(entry.canva_folder_source);
      if (
        source === "templatebooth_api" ||
        source === "templatebooth_harvester" ||
        source === "manual" ||
        source === "admin_manual"
      ) {
        return source === "admin_manual" ? "manual" : source;
      }

      return undefined;
    })(),
    canva_folder_detected_at: normalizeText(entry.canva_folder_detected_at),
    post_url: normalizePostUrl(normalizeText(entry.post_url)),
    family_key: normalizeFamilyKey(normalizeText(entry.family_key)),
    preferred_required_portrait_id: normalizeText(entry.preferred_required_portrait_id),
    preferred_welcome_id: normalizeText(entry.preferred_welcome_id),
    preferred_welcome_preview_url: normalizeText(entry.preferred_welcome_preview_url),
    preferred_welcome_source_note: normalizeText(entry.preferred_welcome_source_note),
    welcome_screen_url: normalizeText(entry.welcome_screen_url),
    welcome_preview_url: normalizeText(entry.welcome_preview_url),
    welcome_source_note: normalizeText(entry.welcome_source_note),
    welcome_source_size: normalizeText(entry.welcome_source_size),
    welcome_target_size: normalizeText(entry.welcome_target_size),
    welcome_touch_to_start: normalizeBoolean(entry.welcome_touch_to_start),
    welcome_source: ((): TemplateSourceLink["welcome_source"] => {
      const source = normalizeText(entry.welcome_source);

      if (
        source === "manual_admin" ||
        source === "templatebooth_api" ||
        source === "templatebooth_harvester" ||
        source === "unknown"
      ) {
        return source;
      }

      return undefined;
    })(),
    psd_source_url: normalizeText(entry.psd_source_url),
    zip_url: normalizeText(entry.zip_url),
    canva_template_url: normalizeText(entry.canva_template_url),
    notes: normalizeText(entry.notes)
  };
}

async function ensureSourceLinksFile() {
  await fs.mkdir(path.dirname(sourceLinksPath), { recursive: true });

  try {
    await fs.access(sourceLinksPath);
  } catch {
    await fs.writeFile(sourceLinksPath, "[]\n", "utf8");
  }
}

async function readLocalSourceLinksRaw({ createIfMissing }: { createIfMissing: boolean }) {
  try {
    if (createIfMissing) {
      await ensureSourceLinksFile();
    }

    return await fs.readFile(sourceLinksPath, "utf8");
  } catch {
    return "[]\n";
  }
}

async function readBlobSourceLinksRaw() {
  try {
    const result = await get(SOURCE_LINKS_BLOB_PATH, {
      access: SOURCE_LINKS_BLOB_ACCESS,
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

    throw new Error(`Lecture Vercel Blob impossible pour ${SOURCE_LINKS_BLOB_PATH}: ${message || "erreur inconnue"}`);
  }
}

async function writeBlobText(pathname: string, contents: string, allowOverwrite = true) {
  await put(pathname, contents, {
    access: SOURCE_LINKS_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: JSON_CONTENT_TYPE,
    cacheControlMaxAge: 60
  });
}

async function readSourceLinksRaw() {
  if (shouldUseSourceLinksBlobStorage()) {
    const blobRaw = await readBlobSourceLinksRaw();

    if (blobRaw !== null) {
      return blobRaw;
    }

    const seedRaw = await readLocalSourceLinksRaw({ createIfMissing: false });
    await writeBlobText(SOURCE_LINKS_BLOB_PATH, seedRaw);
    return seedRaw;
  }

  if (!shouldUseLocalSourceLinksStorage()) {
    throw new Error(missingSourceLinksBlobTokenMessage());
  }

  return readLocalSourceLinksRaw({ createIfMissing: true });
}

export async function listTemplateSourceLinks() {
  const raw = await readSourceLinksRaw();
  const parsed = JSON.parse(raw) as TemplateSourceLink[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(normalizeEntry);
}

async function writeTemplateSourceLinks(links: TemplateSourceLink[]) {
  const serialized = `${JSON.stringify(links, null, 2)}\n`;

  if (shouldUseSourceLinksBlobStorage()) {
    const currentRaw = await readBlobSourceLinksRaw();

    if (currentRaw !== null && currentRaw.trim().length > 0) {
      await writeBlobText(`${SOURCE_LINKS_BLOB_BACKUP_PREFIX}-${sourceLinksBackupTimestamp()}.json`, currentRaw, false);
    }

    await writeBlobText(SOURCE_LINKS_BLOB_PATH, serialized);
    return;
  }

  if (shouldUseLocalSourceLinksStorage()) {
    await ensureSourceLinksFile();
    await fs.writeFile(sourceLinksPath, serialized, "utf8");
    return;
  }

  throw new Error(missingSourceLinksBlobTokenMessage());
}

function matchesFormatScope(
  entry: TemplateSourceLink,
  scope: { formatLabel?: string; layout?: string; noOfImages?: string }
) {
  if (scope.formatLabel && entry.format_label && scope.formatLabel !== entry.format_label) {
    return false;
  }

  if (scope.layout && entry.layout && scope.layout !== entry.layout) {
    return false;
  }

  if (scope.noOfImages && entry.no_of_images && scope.noOfImages !== entry.no_of_images) {
    return false;
  }

  return true;
}

export async function findTemplateSourceLink(input: {
  templateId?: string;
  postUrl?: string;
  familyKey?: string;
  formatLabel?: string;
  layout?: string;
  noOfImages?: string | number;
}) {
  const templateId = normalizeText(input.templateId);
  const postUrl = normalizePostUrl(normalizeText(input.postUrl));
  const familyKey = normalizeFamilyKey(normalizeText(input.familyKey));
  const formatLabel = normalizeText(input.formatLabel);
  const layout = normalizeText(input.layout);
  const noOfImages = normalizeNoOfImages(input.noOfImages);
  const scope = { formatLabel, layout, noOfImages };
  const hasScopedLookup = Boolean(formatLabel || layout || noOfImages);
  const links = await listTemplateSourceLinks();
  const hasWelcomeOverride = (entry: TemplateSourceLink) =>
    Boolean(
      entry.preferred_welcome_id ||
        entry.preferred_welcome_preview_url ||
        entry.welcome_screen_url ||
        entry.welcome_preview_url
    );
  const isNonScopedEntry = (entry: TemplateSourceLink) =>
    !entry.format_label && !entry.layout && !entry.no_of_images;

  if (templateId && hasScopedLookup) {
    const matchByScopedTemplate = links.find(
      (entry) => entry.template_id && entry.template_id === templateId && matchesFormatScope(entry, scope)
    );

    if (matchByScopedTemplate) {
      return matchByScopedTemplate;
    }
  }

  if (postUrl && hasScopedLookup) {
    const matchByScopedPostUrl = links.find(
      (entry) => entry.post_url && entry.post_url === postUrl && matchesFormatScope(entry, scope)
    );

    if (matchByScopedPostUrl) {
      return matchByScopedPostUrl;
    }
  }

  if (familyKey) {
    const matchByFamily = links.find(
      (entry) => entry.family_key && familyKey === entry.family_key && matchesFormatScope(entry, scope)
    );

    if (matchByFamily) {
      return matchByFamily;
    }
  }

  if (!hasScopedLookup) {
    if (familyKey) {
      const familyWelcomeOverride = links.find(
        (entry) => entry.family_key && familyKey === entry.family_key && hasWelcomeOverride(entry)
      );

      if (familyWelcomeOverride) {
        return familyWelcomeOverride;
      }

      const familyRootEntry = links.find(
        (entry) => entry.family_key && familyKey === entry.family_key && isNonScopedEntry(entry)
      );

      if (familyRootEntry) {
        return familyRootEntry;
      }
    }

    if (postUrl) {
      const postUrlWelcomeOverride = links.find(
        (entry) => entry.post_url && entry.post_url === postUrl && hasWelcomeOverride(entry)
      );

      if (postUrlWelcomeOverride) {
        return postUrlWelcomeOverride;
      }

      const postUrlRootEntry = links.find(
        (entry) => entry.post_url && entry.post_url === postUrl && isNonScopedEntry(entry)
      );

      if (postUrlRootEntry) {
        return postUrlRootEntry;
      }
    }

    if (templateId) {
      const templateWelcomeOverride = links.find(
        (entry) => entry.template_id && entry.template_id === templateId && hasWelcomeOverride(entry)
      );

      if (templateWelcomeOverride) {
        return templateWelcomeOverride;
      }
    }
  }

  return (
    links.find((entry) => {
      const entryTemplateId = normalizeText(entry.template_id);
      const entryPostUrl = normalizePostUrl(normalizeText(entry.post_url));

      if (templateId && entryTemplateId && templateId === entryTemplateId) {
        return true;
      }

      if (postUrl && entryPostUrl && postUrl === entryPostUrl) {
        return true;
      }

      return false;
    }) ?? null
  );
}

export async function getTemplateSourceLink(template: {
  template_id?: string;
  id?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string | number | null;
  post_url?: string;
}) {
  return findTemplateSourceLink({
    templateId: normalizeText(template.template_id) ?? normalizeText(template.id),
    formatLabel: normalizeText(template.format_label),
    layout: normalizeText(template.layout),
    noOfImages: template.no_of_images ?? undefined,
    postUrl: normalizeText(template.post_url)
  });
}

export async function upsertTemplateSourceLink(entry: TemplateSourceLink) {
  if (!normalizeText(entry.template_id) && !normalizeText(entry.post_url) && !normalizeText(entry.family_key)) {
    throw new Error("template_id, post_url ou family_key requis pour enregistrer la source.");
  }

  const saved = await upsertTemplateSourceLinksBatch([entry]);

  if (!saved[0]) {
    throw new Error("Enregistrement de la source impossible.");
  }

  return saved[0];
}

function isSameNoOfImages(a?: string, b?: string) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a === b;
}

function findEntryIndex(links: TemplateSourceLink[], normalized: TemplateSourceLink) {
  const hasScopedEntry = Boolean(normalized.format_label || normalized.layout || normalized.no_of_images);

  return links.findIndex((current) => {
    const currentIsScoped = Boolean(current.format_label || current.layout || current.no_of_images);

    if (
      normalized.template_id &&
      current.template_id &&
      normalized.template_id === current.template_id &&
      hasScopedEntry &&
      normalized.format_label &&
      current.format_label &&
      normalized.format_label === current.format_label &&
      isSameNoOfImages(normalized.no_of_images, current.no_of_images)
    ) {
      return true;
    }

    if (
      normalized.post_url &&
      current.post_url &&
      normalized.post_url === current.post_url &&
      hasScopedEntry &&
      normalized.format_label &&
      current.format_label &&
      normalized.format_label === current.format_label &&
      isSameNoOfImages(normalized.no_of_images, current.no_of_images)
    ) {
      return true;
    }

    if (normalized.template_id && current.template_id && normalized.template_id === current.template_id) {
      if (hasScopedEntry) {
        return currentIsScoped;
      }

      return !currentIsScoped;
    }

    if (!hasScopedEntry && normalized.post_url && current.post_url && normalized.post_url === current.post_url && !currentIsScoped) {
      return true;
    }

    if (!hasScopedEntry && normalized.family_key && current.family_key && normalized.family_key === current.family_key && !currentIsScoped) {
      return true;
    }

    return false;
  });
}

export async function upsertTemplateSourceLinksBatch(
  entries: TemplateSourceLink[],
  options: UpsertTemplateSourceLinksOptions = {}
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [] as TemplateSourceLink[];
  }

  const nowIso = new Date().toISOString();
  const links = await listTemplateSourceLinks();
  const savedEntries: TemplateSourceLink[] = [];
  let hasChanges = false;

  for (const entry of entries) {
    const normalized = normalizeEntry({
      ...entry,
      updated_at: nowIso
    });

    if (!normalized.template_id && !normalized.post_url && !normalized.family_key) {
      continue;
    }

    const index = findEntryIndex(links, normalized);

    if (index === -1) {
      links.push(normalized);
      savedEntries.push(normalized);
      hasChanges = true;
      continue;
    }

    const current = links[index];
    const shouldPreserveManualCanva =
      options.preserveAdminManualCanva === true &&
      current.canva_source === "manual" &&
      Boolean(current.canva_template_url?.trim()) &&
      Boolean(normalized.canva_template_url?.trim());

    if (shouldPreserveManualCanva) {
      const preserved: TemplateSourceLink = {
        ...current,
        ...normalized,
        canva_template_url: current.canva_template_url,
        canva_source: "manual",
        canva_detected_at: current.canva_detected_at ?? normalized.canva_detected_at
      };
      links[index] = preserved;
      savedEntries.push(preserved);
      hasChanges = true;
      continue;
    }

    const merged: TemplateSourceLink = {
      ...current,
      ...normalized
    };

    links[index] = merged;
    savedEntries.push(merged);
    hasChanges = true;
  }

  if (hasChanges) {
    await writeTemplateSourceLinks(links);
  }

  return savedEntries;
}
