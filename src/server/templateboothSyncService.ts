import { promises as fs } from "node:fs";
import path from "node:path";
import { listTemplateCategoryOverrides } from "@/src/server/templateCategoryOverrides";
import { syncTemplateBoothCatalog } from "@/src/server/eventPicTemplateService";

const templateBoothCachePath = path.join(process.cwd(), "data", "templatebooth-cache.json");
const syncHistoryPath = path.join(process.cwd(), "data", "templatebooth-sync-history.json");
const MAX_HISTORY_ENTRIES = 20;

export type TemplateBoothSyncTrigger = "cron" | "manual";
export type TemplateBoothSyncStatus = "success" | "error";

export type TemplateBoothSyncHistoryEntry = {
  started_at: string;
  completed_at: string;
  status: TemplateBoothSyncStatus;
  trigger: TemplateBoothSyncTrigger;
  total_templates: number;
  total_families: number;
  new_families: number;
  new_templates: number;
  to_review: number;
  validated: number;
  ignored: number;
  error_message: string;
};

export type TemplateBoothSyncRunResult = {
  ok: boolean;
  started_at: string;
  completed_at: string;
  status: TemplateBoothSyncStatus;
  trigger: TemplateBoothSyncTrigger;
  total_templates: number;
  total_families: number;
  new_families: number;
  new_templates: number;
  to_review: number;
  validated: number;
  ignored: number;
  error_message: string;
};

type CacheSnapshot = {
  templates?: Array<{
    id?: string;
    post_url?: string;
    preview_url?: string;
    layout?: string;
    format_label?: string;
    no_of_images?: string | number | null;
  }>;
};

function templateIdentityKey(template: {
  id?: string;
  post_url?: string;
  preview_url?: string;
  layout?: string;
  format_label?: string;
  no_of_images?: string | number | null;
}) {
  if (template.id && template.id.trim().length > 0) {
    return `id:${template.id.trim()}`;
  }

  return `fallback:${template.post_url ?? ""}::${template.preview_url ?? ""}::${template.layout ?? ""}::${template.format_label ?? ""}::${template.no_of_images ?? ""}`;
}

async function ensureSyncHistoryFile() {
  await fs.mkdir(path.dirname(syncHistoryPath), { recursive: true });

  try {
    await fs.access(syncHistoryPath);
  } catch {
    await fs.writeFile(syncHistoryPath, "[]\n", "utf8");
  }
}

async function readSyncHistoryRaw() {
  await ensureSyncHistoryFile();
  const raw = await fs.readFile(syncHistoryPath, "utf8");
  const parsed = JSON.parse(raw) as TemplateBoothSyncHistoryEntry[];

  if (!Array.isArray(parsed)) {
    return [] as TemplateBoothSyncHistoryEntry[];
  }

  return parsed;
}

async function writeSyncHistory(entries: TemplateBoothSyncHistoryEntry[]) {
  await ensureSyncHistoryFile();
  const trimmed = entries.slice(0, MAX_HISTORY_ENTRIES);
  await fs.writeFile(syncHistoryPath, `${JSON.stringify(trimmed, null, 2)}\n`, "utf8");
}

async function appendSyncHistory(entry: TemplateBoothSyncHistoryEntry) {
  const current = await readSyncHistoryRaw();
  const next = [entry, ...current];
  await writeSyncHistory(next);
}

async function readCacheTemplateKeys() {
  try {
    const raw = await fs.readFile(templateBoothCachePath, "utf8");
    const parsed = JSON.parse(raw) as CacheSnapshot;
    const templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    return new Set(templates.map((template) => templateIdentityKey(template)));
  } catch {
    return new Set<string>();
  }
}

export async function listTemplateBoothSyncHistory(limit = 20) {
  const entries = await readSyncHistoryRaw();
  const safeLimit = Math.min(MAX_HISTORY_ENTRIES, Math.max(1, limit));
  return entries.slice(0, safeLimit);
}

export async function getLatestTemplateBoothSyncHistory() {
  const entries = await listTemplateBoothSyncHistory(1);
  return entries[0] ?? null;
}

export async function runTemplateBoothSync(trigger: TemplateBoothSyncTrigger): Promise<TemplateBoothSyncRunResult> {
  const startedAt = new Date().toISOString();
  let beforeFamilyKeys = new Set<string>();
  let beforeTemplateKeys = new Set<string>();

  try {
    const [beforeOverrides, beforeKeys] = await Promise.all([
      listTemplateCategoryOverrides(),
      readCacheTemplateKeys()
    ]);
    beforeFamilyKeys = new Set(beforeOverrides.map((entry) => entry.family_key));
    beforeTemplateKeys = beforeKeys;
  } catch {
    beforeFamilyKeys = new Set<string>();
    beforeTemplateKeys = new Set<string>();
  }

  try {
    const synced = await syncTemplateBoothCatalog({ force: true, full: true });
    const syncedTemplates = synced.templates ?? [];
    const afterOverrides = await listTemplateCategoryOverrides();
    const completedAt = new Date().toISOString();
    const newTemplates = syncedTemplates.filter((template) => !beforeTemplateKeys.has(templateIdentityKey(template))).length;
    const newFamilies = afterOverrides.filter((entry) => !beforeFamilyKeys.has(entry.family_key)).length;
    const toReview = afterOverrides.filter((entry) => entry.status === "to_review").length;
    const validated = afterOverrides.filter((entry) => entry.status === "validated").length;
    const ignored = afterOverrides.filter((entry) => entry.status === "ignored").length;
    const historyEntry: TemplateBoothSyncHistoryEntry = {
      started_at: startedAt,
      completed_at: completedAt,
      status: "success",
      trigger,
      total_templates: syncedTemplates.length,
      total_families: afterOverrides.length,
      new_families: newFamilies,
      new_templates: newTemplates,
      to_review: toReview,
      validated,
      ignored,
      error_message: ""
    };

    await appendSyncHistory(historyEntry);

    return {
      ok: true,
      ...historyEntry
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Synchronisation TemplateBooth impossible.";

    let fallbackFamilies = 0;
    let fallbackToReview = 0;
    let fallbackValidated = 0;
    let fallbackIgnored = 0;

    try {
      const overrides = await listTemplateCategoryOverrides();
      fallbackFamilies = overrides.length;
      fallbackToReview = overrides.filter((entry) => entry.status === "to_review").length;
      fallbackValidated = overrides.filter((entry) => entry.status === "validated").length;
      fallbackIgnored = overrides.filter((entry) => entry.status === "ignored").length;
    } catch {}

    const historyEntry: TemplateBoothSyncHistoryEntry = {
      started_at: startedAt,
      completed_at: completedAt,
      status: "error",
      trigger,
      total_templates: 0,
      total_families: fallbackFamilies,
      new_families: 0,
      new_templates: 0,
      to_review: fallbackToReview,
      validated: fallbackValidated,
      ignored: fallbackIgnored,
      error_message: errorMessage
    };

    await appendSyncHistory(historyEntry);

    return {
      ok: false,
      ...historyEntry
    };
  }
}
