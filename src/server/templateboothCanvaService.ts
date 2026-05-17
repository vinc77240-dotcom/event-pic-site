import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_TEMPLATEBOOTH_BASE_URL = "https://templatesbooth.com/wp-json/tb/v1";
const DEFAULT_PER_PAGE = 200;
const MAX_DIAGNOSTIC_PAGES = 8;
const MAX_DEPTH = 14;
const MAX_DIAGNOSTIC_REQUESTS = 20;
const REQUEST_TIMEOUT_MS = 8000;
const DIAGNOSTIC_DELAY_MS = 1700;
const DIAGNOSTIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const diagnosticCachePath = path.join(process.cwd(), "data", "templatebooth-canva-diagnostic-cache.json");

type TemplateBoothTemplatePayload = Record<string, unknown>;

type TemplateBoothTemplatesResponse = {
  data?: TemplateBoothTemplatePayload[];
  total?: number | string;
  total_pages?: number | string;
};

type DiagnosticQueryStrategy = {
  label: string;
  params: Record<string, string>;
  maxPages?: number;
};

type DiagnosticQueryRun = {
  label: string;
  url: string;
  count: number;
  total: number;
  total_pages: number;
  pages_searched: number;
  requests_used: number;
  error?: string;
  candidates: Array<{
    id: string | null;
    name: string | null;
    post_url: string | null;
    type: string | null;
    type_name: string | null;
    layout: string | null;
    src: string | null;
    poster: string | null;
  }>;
};

type CanvaDiagnosticStatus = "found" | "not_found" | "rate_limited";

type CanvaDiagnosticCacheEntry = {
  template_id: string;
  template_name: string;
  checked_at: string;
  status: CanvaDiagnosticStatus;
  canva_url: string;
  key_path: string;
  fields_inspected: number;
  conclusion: string;
  post_url?: string;
};

type TraversedField = {
  path: string;
  key: string;
  value: unknown;
  textValue: string | null;
};

const SUSPICIOUS_TOKENS = [
  "canva",
  "edit",
  "editor",
  "design",
  "template",
  "template_file",
  "download",
  "downloads",
  "file",
  "files",
  "source",
  "photoshop",
  "psd",
  "zip",
  "package",
  "overlay",
  "png",
  "url",
  "link",
  "links",
  "href"
];

const CANVA_VALUE_HINTS = ["canva.com", "/design/", "edit in canva", "use template", "template link"];

export type CanvaExtractionResult = {
  found: boolean;
  canva_url: string | null;
  key_path: string | null;
  source: "templatebooth_api" | "not_provided_by_api";
  confidence: "high" | "medium" | "low";
  reason: string;
  // Compatibilite avec les appels existants
  url: string | null;
  match_path?: string;
  candidates: string[];
};

export type SourceFilesExtractionResult = {
  psd_url: string | null;
  zip_url: string | null;
  source_file_url: string | null;
  png_url: string | null;
  found: boolean;
  key_paths: string[];
  source: "templatebooth_api" | "not_provided_by_api";
};

export type RawTemplateDiagnosticMatch = {
  path: string;
  key: string;
  value: string;
};

export type RawTemplateDiagnosticResult = {
  selectedTemplate: {
    templateId?: string;
    name?: string;
    postUrl?: string;
    search?: string;
  };
  checked_at: string;
  diagnostic_status: CanvaDiagnosticStatus;
  cache: {
    hit: boolean;
    forced_refresh: boolean;
    checked_at: string | null;
    status: CanvaDiagnosticStatus | null;
    age_minutes: number | null;
  };
  queryInfo: {
    url: string;
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    searchedPages: number;
  };
  apiQueries: DiagnosticQueryRun[];
  rawTemplate: TemplateBoothTemplatePayload | null;
  availableKeys: string[];
  allKeyPaths: string[];
  inspectedFieldsCount: number;
  matchingFields: RawTemplateDiagnosticMatch[];
  valueHints: string[];
  canvaDetection: CanvaExtractionResult;
  sourceFilesDetection: SourceFilesExtractionResult;
  source_files_conclusion: string;
  conclusion: string;
};

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getTemplateBoothConfig() {
  const apiKey = process.env.TEMPLATEBOOTH_API_KEY;
  const baseUrl = (process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("Cle API TemplateBooth absente cote serveur.");
  }

  return { apiKey, baseUrl };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureDiagnosticCacheFile() {
  await fs.mkdir(path.dirname(diagnosticCachePath), { recursive: true });

  try {
    await fs.access(diagnosticCachePath);
  } catch {
    await fs.writeFile(diagnosticCachePath, "[]\n", "utf8");
  }
}

async function readDiagnosticCache(): Promise<CanvaDiagnosticCacheEntry[]> {
  await ensureDiagnosticCacheFile();
  const raw = await fs.readFile(diagnosticCachePath, "utf8");
  const parsed = JSON.parse(raw) as CanvaDiagnosticCacheEntry[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => ({
      template_id: typeof entry.template_id === "string" ? entry.template_id.trim() : "",
      template_name: typeof entry.template_name === "string" ? entry.template_name.trim() : "",
      checked_at: typeof entry.checked_at === "string" ? entry.checked_at : "",
      status: entry.status === "found" || entry.status === "not_found" || entry.status === "rate_limited" ? entry.status : "not_found",
      canva_url: typeof entry.canva_url === "string" ? entry.canva_url.trim() : "",
      key_path: typeof entry.key_path === "string" ? entry.key_path.trim() : "",
      fields_inspected: typeof entry.fields_inspected === "number" && Number.isFinite(entry.fields_inspected) ? entry.fields_inspected : 0,
      conclusion: typeof entry.conclusion === "string" ? entry.conclusion : "",
      post_url: typeof entry.post_url === "string" ? normalizePostUrl(entry.post_url) : undefined
    }))
    .filter((entry) => entry.template_id || entry.template_name || entry.post_url);
}

async function writeDiagnosticCache(entries: CanvaDiagnosticCacheEntry[]) {
  await ensureDiagnosticCacheFile();
  await fs.writeFile(diagnosticCachePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function sanitizeUrl(value: string) {
  return value.replace(/[)\]}>,.;]+$/g, "");
}

function extractUrlsFromText(value: string) {
  const urls = value.match(/https?:\/\/[^\s"'<>`]+/gi) ?? [];
  return urls.map(sanitizeUrl).filter(Boolean);
}

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.split("?")[0]?.replace(/\/$/, "");
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

function slugifyText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || undefined;
}

function statusConclusion(status: CanvaDiagnosticStatus) {
  if (status === "found") {
    return "Lien Canva detecte par API.";
  }

  if (status === "rate_limited") {
    return "Diagnostic interrompu : limite API TemplateBooth atteinte. Reessayez dans quelques minutes.";
  }

  return "Diagnostic termine : aucun lien Canva trouve dans la reponse API.";
}

function findDiagnosticCacheEntry(
  entries: CanvaDiagnosticCacheEntry[],
  input: { templateId?: string; name?: string; postUrl?: string }
) {
  const templateId = input.templateId?.trim();
  const postUrl = normalizePostUrl(input.postUrl?.trim());
  const name = normalizeText(input.name?.trim() ?? "");

  if (!templateId && !postUrl && !name) {
    return null;
  }

  return (
    entries.find((entry) => {
      if (templateId && entry.template_id && entry.template_id === templateId) {
        return true;
      }

      if (postUrl && entry.post_url && normalizePostUrl(entry.post_url) === postUrl) {
        return true;
      }

      if (name && entry.template_name && normalizeText(entry.template_name) === name) {
        return true;
      }

      if (name && entry.template_name) {
        const entryName = normalizeText(entry.template_name);
        if (entryName.includes(name) || name.includes(entryName)) {
          return true;
        }
      }

      return false;
    }) ?? null
  );
}

function cacheEntryAgeMinutes(entry: CanvaDiagnosticCacheEntry) {
  if (!entry.checked_at) {
    return null;
  }

  const checkedAt = new Date(entry.checked_at);
  if (Number.isNaN(checkedAt.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - checkedAt.getTime()) / 60000));
}

function isCacheFresh(entry: CanvaDiagnosticCacheEntry) {
  const checkedAt = new Date(entry.checked_at);
  if (Number.isNaN(checkedAt.getTime())) {
    return false;
  }

  return Date.now() - checkedAt.getTime() < DIAGNOSTIC_CACHE_TTL_MS;
}

function formatPath(path: string) {
  if (path === "$") {
    return "$";
  }

  return path.replace(/^\$\./, "");
}

function toTextValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function collectTraversedFields(
  input: unknown,
  path = "$",
  key = "root",
  depth = 0,
  out: TraversedField[] = []
) {
  if (depth > MAX_DEPTH) {
    return out;
  }

  out.push({
    path,
    key,
    value: input,
    textValue: toTextValue(input)
  });

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      collectTraversedFields(item, `${path}[${index}]`, String(index), depth + 1, out);
    });
    return out;
  }

  if (input && typeof input === "object") {
    for (const [childKey, childValue] of Object.entries(input as Record<string, unknown>)) {
      collectTraversedFields(childValue, `${path}.${childKey}`, childKey, depth + 1, out);
    }
  }

  return out;
}

function buildAllKeyPaths(input: unknown) {
  const traversed = collectTraversedFields(input);
  const keyPaths = new Set<string>();

  for (const field of traversed) {
    const formatted = formatPath(field.path);
    if (formatted !== "$") {
      keyPaths.add(formatted);
    }
  }

  return [...keyPaths].sort((a, b) => a.localeCompare(b));
}

function keyHasSuspiciousToken(key: string) {
  const normalized = normalizeText(key);
  return SUSPICIOUS_TOKENS.some((token) => normalized.includes(token));
}

function valueHasSuspiciousToken(value: string) {
  const normalized = normalizeText(value);
  return SUSPICIOUS_TOKENS.some((token) => normalized.includes(token));
}

function valueHasCanvaHint(value: string) {
  const normalized = normalizeText(value);
  return CANVA_VALUE_HINTS.some((hint) => normalized.includes(hint));
}

function collectMatchingFields(template: unknown) {
  const traversed = collectTraversedFields(template);
  const matches: RawTemplateDiagnosticMatch[] = [];

  for (const field of traversed) {
    if (!field.textValue) {
      continue;
    }

    if (keyHasSuspiciousToken(field.key) || valueHasSuspiciousToken(field.textValue)) {
      matches.push({
        path: formatPath(field.path),
        key: field.key,
        value: field.textValue.length > 400 ? `${field.textValue.slice(0, 400)}...` : field.textValue
      });
    }
  }

  return matches;
}

function collectValueHints(template: unknown) {
  const traversed = collectTraversedFields(template);
  const hints = new Set<string>();

  for (const field of traversed) {
    if (!field.textValue) {
      continue;
    }

    if (valueHasCanvaHint(field.textValue)) {
      hints.add(`${formatPath(field.path)} => ${field.textValue}`);
    }

    const urls = extractUrlsFromText(field.textValue);
    for (const url of urls) {
      if (valueHasCanvaHint(url)) {
        hints.add(`${formatPath(field.path)} => ${url}`);
      }
    }
  }

  return [...hints];
}

function extractAvailableKeys(template: unknown) {
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    return [];
  }

  return Object.keys(template as Record<string, unknown>).sort((a, b) => a.localeCompare(b));
}

function selectTemplateMatch(
  templates: TemplateBoothTemplatePayload[],
  params: { templateId?: string; name?: string; postUrl?: string; search?: string }
) {
  const templateId = params.templateId?.trim();
  const name = params.name ? normalizeText(params.name) : "";
  const postUrl = normalizePostUrl(params.postUrl?.trim());
  const search = params.search ? normalizeText(params.search) : "";

  if (templateId) {
    const match = templates.find((template) => {
      const idCandidate = stringValue(template.template_id ?? template.id ?? template.post_id);
      const postSlug = slugFromUrl(stringValue(template.post_url));
      const postUrlCandidate = normalizePostUrl(stringValue(template.post_url));

      return (
        idCandidate === templateId ||
        postSlug === templateId ||
        (postUrl && postUrlCandidate && postUrlCandidate === postUrl)
      );
    });

    if (match) {
      return match;
    }
  }

  if (postUrl) {
    const match = templates.find((template) => normalizePostUrl(stringValue(template.post_url)) === postUrl);
    if (match) {
      return match;
    }
  }

  if (name) {
    const exact = templates.find((template) => normalizeText(stringValue(template.name ?? template.title) ?? "") === name);
    if (exact) {
      return exact;
    }

    const includes = templates.find((template) =>
      normalizeText(stringValue(template.name ?? template.title) ?? "").includes(name)
    );
    if (includes) {
      return includes;
    }
  }

  if (search) {
    const match = templates.find((template) => {
      const blob = normalizeText(
        [
          stringValue(template.name ?? template.title),
          stringValue(template.post_url),
          stringValue(template.type_name),
          stringValue(template.type)
        ]
          .filter(Boolean)
          .join(" ")
      );
      return blob.includes(search);
    });

    if (match) {
      return match;
    }
  }

  return templates[0] ?? null;
}

function templateIdentity(template: TemplateBoothTemplatePayload) {
  return (
    stringValue(template.template_id ?? template.id ?? template.post_id) ??
    normalizePostUrl(stringValue(template.post_url)) ??
    stringValue(template.src) ??
    stringValue(template.poster) ??
    stringValue(template.name) ??
    JSON.stringify(template).slice(0, 120)
  );
}

function buildDiagnosticStrategies(params: {
  templateId?: string;
  name?: string;
  postUrl?: string;
  search?: string;
}) {
  const strategies: DiagnosticQueryStrategy[] = [];
  const seen = new Set<string>();
  const cleanName = params.name?.trim();
  const cleanPostUrl = params.postUrl?.trim();
  const slugFromName = slugifyText(cleanName ?? params.search?.trim());
  const slugFromPostUrl = slugFromUrl(cleanPostUrl);

  function push(label: string, paramsObject: Record<string, string>, maxPages = 1) {
    const key = `${label}:${JSON.stringify(paramsObject)}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    strategies.push({
      label,
      params: paramsObject,
      maxPages
    });
  }

  if (cleanName) {
    push("search_full_name", { search: cleanName });
  }
  if (slugFromName) {
    push("search_slug_from_name", { search: slugFromName });
  }
  if (cleanPostUrl) {
    push("post_url_param", { post_url: cleanPostUrl });
  } else if (slugFromPostUrl) {
    push("search_post_url_slug", { search: slugFromPostUrl });
  }

  return strategies;
}

function buildFallbackDiagnosticStrategies(params: { name?: string; search?: string }) {
  const fallback: DiagnosticQueryStrategy[] = [];
  const seen = new Set<string>();
  const fallbackTerm = params.name?.trim() || params.search?.trim();

  function push(label: string, paramsObject: Record<string, string>, maxPages = 1) {
    const key = `${label}:${JSON.stringify(paramsObject)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    fallback.push({
      label,
      params: paramsObject,
      maxPages
    });
  }

  for (const layout of ["26strip", "46postcard-p", "46postcard-l"]) {
    if (fallbackTerm) {
      push(`fallback_layout_${layout}`, { layout, search: fallbackTerm });
    } else {
      push(`fallback_layout_${layout}`, { layout });
    }
  }

  for (const type of ["static", "static_all"]) {
    if (fallbackTerm) {
      push(`fallback_type_${type}`, { type, search: fallbackTerm });
    } else {
      push(`fallback_type_${type}`, { type });
    }
  }

  return fallback;
}

async function runStrategy(params: {
  apiKey: string;
  baseUrl: string;
  strategy: DiagnosticQueryStrategy;
}) {
  const { apiKey, baseUrl, strategy } = params;
  const perPage = DEFAULT_PER_PAGE;
  const aggregated: TemplateBoothTemplatePayload[] = [];
  let total = 0;
  let totalPages = 1;
  let page = 1;
  let firstUrl = "";
  let error: string | undefined;
  let requestsUsed = 0;

  while (page <= totalPages && page <= (strategy.maxPages ?? MAX_DIAGNOSTIC_PAGES)) {
    if (requestsUsed > 0) {
      await sleep(DIAGNOSTIC_DELAY_MS);
    }

    const url = new URL(`${baseUrl}/templates`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    for (const [key, value] of Object.entries(strategy.params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    if (!firstUrl) {
      firstUrl = url.toString();
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "X-API-Key": apiKey
        }
      });
      clearTimeout(timeout);
      requestsUsed += 1;

      if (!response.ok) {
        if (response.status === 429) {
          error = "rate_limit_exceeded (429)";
        } else {
          error = `api_error (${response.status})`;
        }
        break;
      }

      const payload = (await response.json()) as TemplateBoothTemplatesResponse;
      const data = Array.isArray(payload.data) ? payload.data : [];
      aggregated.push(...data);
      total = Math.max(total, numberValue(payload.total, aggregated.length));
      totalPages = Math.max(1, numberValue(payload.total_pages, 1));
      page += 1;
    } catch {
      requestsUsed += 1;
      error = "network_or_timeout_error";
      break;
    }
  }

  const dedupedMap = new Map<string, TemplateBoothTemplatePayload>();
  for (const template of aggregated) {
    dedupedMap.set(templateIdentity(template), template);
  }

  const deduped = [...dedupedMap.values()];
  const candidates = deduped.slice(0, 20).map((template) => ({
    id: stringValue(template.template_id ?? template.id ?? template.post_id) ?? null,
    name: stringValue(template.name ?? template.title) ?? null,
    post_url: stringValue(template.post_url) ?? null,
    type: stringValue(template.type) ?? null,
    type_name: stringValue(template.type_name) ?? null,
    layout: stringValue(template.layout_size ?? template.layout) ?? null,
    src: stringValue(template.src) ?? null,
    poster: stringValue(template.poster) ?? null
  }));

  return {
    label: strategy.label,
    url: firstUrl,
    count: deduped.length,
    total,
    total_pages: totalPages,
    pages_searched: Math.max(0, page - 1),
    requests_used: requestsUsed,
    error,
    templates: deduped,
    candidates
  };
}

function scoreTemplateCandidate(
  template: TemplateBoothTemplatePayload,
  params: { templateId?: string; name?: string; postUrl?: string; search?: string }
) {
  const id = stringValue(template.template_id ?? template.id ?? template.post_id);
  const name = normalizeText(stringValue(template.name ?? template.title) ?? "");
  const postUrl = normalizePostUrl(stringValue(template.post_url));
  const blob = normalizeText(
    [name, postUrl, stringValue(template.type), stringValue(template.type_name)].filter(Boolean).join(" ")
  );
  const targetTemplateId = params.templateId?.trim();
  const targetName = normalizeText(params.name?.trim() ?? "");
  const targetSearch = normalizeText(params.search?.trim() ?? "");
  const targetPostUrl = normalizePostUrl(params.postUrl?.trim());
  const targetPostSlug = slugFromUrl(targetPostUrl);

  let score = 0;

  if (targetTemplateId && id === targetTemplateId) {
    score += 200;
  }

  if (targetPostUrl && postUrl === targetPostUrl) {
    score += 190;
  }

  if (targetPostSlug && slugFromUrl(postUrl) === targetPostSlug) {
    score += 150;
  }

  if (targetName && name === targetName) {
    score += 140;
  }

  if (targetName && name.includes(targetName)) {
    score += 90;
  }

  if (targetSearch && blob.includes(targetSearch)) {
    score += 70;
  }

  if (score === 0 && blob.length > 0) {
    score = 10;
  }

  return score;
}

function pickBestTemplate(
  templates: TemplateBoothTemplatePayload[],
  params: { templateId?: string; name?: string; postUrl?: string; search?: string }
) {
  if (templates.length === 0) {
    return null;
  }

  let best: TemplateBoothTemplatePayload | null = null;
  let bestScore = -1;

  for (const template of templates) {
    const score = scoreTemplateCandidate(template, params);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }

  return best ?? templates[0] ?? null;
}

export function extractSourceFilesFromTemplate(template: unknown): SourceFilesExtractionResult {
  const traversed = collectTraversedFields(template);
  const picks: Record<"psd" | "zip" | "source" | "png", { url: string; path: string; score: number } | null> = {
    psd: null,
    zip: null,
    source: null,
    png: null
  };

  function pick(kind: "psd" | "zip" | "source" | "png", url: string, path: string, score: number) {
    const current = picks[kind];
    if (!current || score > current.score) {
      picks[kind] = { url, path, score };
    }
  }

  for (const field of traversed) {
    if (!field.textValue) {
      continue;
    }

    const keyNormalized = normalizeText(field.key);
    const pathNormalized = normalizeText(field.path);
    const valueNormalized = normalizeText(field.textValue);
    const urls = extractUrlsFromText(field.textValue);

    for (const url of urls) {
      const normalizedUrl = normalizeText(url);
      const fullPath = formatPath(field.path);

      let psdScore = 0;
      if (normalizedUrl.includes(".psd")) {
        psdScore += 90;
      }
      if (keyNormalized.includes("psd") || keyNormalized.includes("photoshop") || pathNormalized.includes("psd")) {
        psdScore += 30;
      }
      if (valueNormalized.includes("psd") || valueNormalized.includes("photoshop")) {
        psdScore += 15;
      }
      if (psdScore > 0) {
        pick("psd", url, fullPath, psdScore);
      }

      let zipScore = 0;
      if (normalizedUrl.includes(".zip")) {
        zipScore += 90;
      }
      if (keyNormalized.includes("zip") || keyNormalized.includes("package") || pathNormalized.includes("zip")) {
        zipScore += 30;
      }
      if (valueNormalized.includes("zip") || valueNormalized.includes("package")) {
        zipScore += 15;
      }
      if (zipScore > 0) {
        pick("zip", url, fullPath, zipScore);
      }

      let pngScore = 0;
      if (normalizedUrl.includes(".png")) {
        pngScore += 70;
      }
      if (keyNormalized.includes("png") || keyNormalized.includes("overlay") || pathNormalized.includes("overlay")) {
        pngScore += 20;
      }
      if (valueNormalized.includes("overlay")) {
        pngScore += 10;
      }
      if (pngScore > 0) {
        pick("png", url, fullPath, pngScore);
      }

      let sourceScore = 0;
      if (normalizedUrl.includes("download") || normalizedUrl.includes("source") || normalizedUrl.includes("file")) {
        sourceScore += 40;
      }
      if (
        keyNormalized.includes("source") ||
        keyNormalized.includes("file") ||
        keyNormalized.includes("download") ||
        keyNormalized.includes("template_file") ||
        pathNormalized.includes("download")
      ) {
        sourceScore += 25;
      }
      if (
        valueNormalized.includes("source") ||
        valueNormalized.includes("file") ||
        valueNormalized.includes("download")
      ) {
        sourceScore += 10;
      }
      if (sourceScore > 0) {
        pick("source", url, fullPath, sourceScore);
      }
    }
  }

  const psdUrl = picks.psd?.url ?? null;
  const zipUrl = picks.zip?.url ?? null;
  const sourceFileUrl = picks.source?.url ?? psdUrl ?? zipUrl ?? null;
  const pngUrl = picks.png?.url ?? null;
  const found = Boolean(psdUrl || zipUrl || sourceFileUrl || pngUrl);
  const keyPaths = [
    picks.psd ? `psd:${picks.psd.path}` : null,
    picks.zip ? `zip:${picks.zip.path}` : null,
    picks.source ? `source:${picks.source.path}` : null,
    picks.png ? `png:${picks.png.path}` : null
  ].filter((value): value is string => Boolean(value));

  return {
    psd_url: psdUrl,
    zip_url: zipUrl,
    source_file_url: sourceFileUrl,
    png_url: pngUrl,
    found,
    key_paths: keyPaths,
    source: found ? "templatebooth_api" : "not_provided_by_api"
  };
}

export function extractCanvaLinkFromTemplate(template: unknown): CanvaExtractionResult {
  const traversed = collectTraversedFields(template);
  const candidates: Array<{ url: string; path: string; score: number; reasons: string[] }> = [];

  for (const field of traversed) {
    if (!field.textValue) {
      continue;
    }

    const keyNormalized = normalizeText(field.key);
    const pathNormalized = normalizeText(field.path);
    const valueNormalized = normalizeText(field.textValue);
    const urls = extractUrlsFromText(field.textValue);

    for (const url of urls) {
      const urlNormalized = normalizeText(url);
      let score = 0;
      const reasons: string[] = [];

      if (urlNormalized.includes("canva.com")) {
        score += 80;
        reasons.push("url_contains_canva.com");
      }

      if (urlNormalized.includes("/design/")) {
        score += 20;
        reasons.push("url_contains_/design/");
      }

      if (keyNormalized.includes("canva") || pathNormalized.includes("canva")) {
        score += 15;
        reasons.push("key_or_path_contains_canva");
      }

      if (valueNormalized.includes("edit in canva")) {
        score += 10;
        reasons.push("value_contains_edit_in_canva");
      }

      if (valueNormalized.includes("use template") || valueNormalized.includes("template link")) {
        score += 8;
        reasons.push("value_contains_template_link_hint");
      }

      if (score > 0) {
        candidates.push({
          url,
          path: formatPath(field.path),
          score,
          reasons
        });
      }
    }
  }

  const deduped = new Map<string, { url: string; path: string; score: number; reasons: string[] }>();
  for (const candidate of candidates) {
    const current = deduped.get(candidate.url);
    if (!current || candidate.score > current.score) {
      deduped.set(candidate.url, candidate);
    }
  }

  const sorted = [...deduped.values()].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  if (!best) {
    return {
      found: false,
      canva_url: null,
      key_path: null,
      source: "not_provided_by_api",
      confidence: "low",
      reason: "Aucun champ Canva detecte dans la reponse API brute.",
      url: null,
      candidates: []
    };
  }

  const confidence = best.score >= 100 ? "high" : best.score >= 80 ? "medium" : "low";

  return {
    found: true,
    canva_url: best.url,
    key_path: best.path,
    source: "templatebooth_api",
    confidence,
    reason: best.reasons.join(", "),
    url: best.url,
    match_path: best.path,
    candidates: sorted.map((candidate) => candidate.url)
  };
}

export async function getRawTemplateDiagnostic(params: {
  templateId?: string;
  name?: string;
  postUrl?: string;
  search?: string;
  forceRefresh?: boolean;
}) {
  const { apiKey, baseUrl } = getTemplateBoothConfig();
  const templateId = params.templateId?.trim();
  const name = params.name?.trim();
  const postUrl = params.postUrl?.trim();
  const search = params.search?.trim();
  const forceRefresh = params.forceRefresh === true;
  const nowIso = new Date().toISOString();
  const cacheEntries = await readDiagnosticCache();
  const cachedEntry =
    findDiagnosticCacheEntry(cacheEntries, { templateId, name, postUrl }) ??
    cacheEntries.find((entry) => {
      const targetName = normalizeText(name ?? search ?? "");
      const targetSlug = slugifyText(name ?? search);
      const entryName = normalizeText(entry.template_name ?? "");
      const entrySlug = slugifyText(entry.template_name) ?? entry.template_id?.trim();

      if (targetName && entryName && (entryName === targetName || entryName.includes(targetName) || targetName.includes(entryName))) {
        return true;
      }

      if (targetSlug && entrySlug && (entrySlug === targetSlug || entrySlug.includes(targetSlug) || targetSlug.includes(entrySlug))) {
        return true;
      }

      return false;
    }) ??
    null;

  if (cachedEntry && isCacheFresh(cachedEntry) && !forceRefresh) {
    const cachedStatus = cachedEntry.status;
    const cachedFound = cachedStatus === "found";
    const cachedRateLimited = cachedStatus === "rate_limited";

    return {
      selectedTemplate: {
        templateId,
        name,
        postUrl,
        search
      },
      checked_at: cachedEntry.checked_at,
      diagnostic_status: cachedStatus,
      cache: {
        hit: true,
        forced_refresh: false,
        checked_at: cachedEntry.checked_at,
        status: cachedEntry.status,
        age_minutes: cacheEntryAgeMinutes(cachedEntry)
      },
      queryInfo: {
        url: "",
        page: 1,
        per_page: DEFAULT_PER_PAGE,
        total: 0,
        total_pages: 0,
        searchedPages: 0
      },
      apiQueries: [],
      rawTemplate: null,
      availableKeys: [],
      allKeyPaths: [],
      inspectedFieldsCount: cachedEntry.fields_inspected,
      matchingFields: [],
      valueHints: [],
      canvaDetection: {
        found: cachedFound,
        canva_url: cachedFound ? cachedEntry.canva_url || null : null,
        key_path: cachedFound ? cachedEntry.key_path || null : null,
        source: cachedFound ? "templatebooth_api" : "not_provided_by_api",
        confidence: cachedFound ? "high" : "low",
        reason: cachedRateLimited
          ? "Diagnostic interrompu par rate limit TemplateBooth."
          : cachedFound
            ? "Lien Canva detecte en cache."
            : "Aucun champ Canva detecte dans la reponse API brute.",
        url: cachedFound ? cachedEntry.canva_url || null : null,
        match_path: cachedFound ? cachedEntry.key_path || undefined : undefined,
        candidates: cachedFound && cachedEntry.canva_url ? [cachedEntry.canva_url] : []
      },
      sourceFilesDetection: {
        psd_url: null,
        zip_url: null,
        source_file_url: null,
        png_url: null,
        found: false,
        key_paths: [],
        source: "not_provided_by_api"
      },
      source_files_conclusion:
        cachedStatus === "rate_limited"
          ? "Diagnostic interrompu : limite API TemplateBooth atteinte."
          : "PSD non fourni par API",
      conclusion:
        cachedStatus === "rate_limited"
          ? "TemplateBooth a temporairement limite les requetes API. Reessayez plus tard. Le diagnostic ne permet pas encore de conclure si le lien Canva existe."
          : statusConclusion(cachedStatus)
    } satisfies RawTemplateDiagnosticResult;
  }

  const primaryStrategies = buildDiagnosticStrategies({ templateId, name, postUrl, search });
  const fallbackStrategies = buildFallbackDiagnosticStrategies({ name, search });

  const apiQueries: DiagnosticQueryRun[] = [];
  const mergedTemplates: TemplateBoothTemplatePayload[] = [];
  let usedRequests = 0;
  let hasRateLimit = false;

  async function runStrategies(strategies: DiagnosticQueryStrategy[]) {
    for (const strategy of strategies) {
      if (usedRequests >= MAX_DIAGNOSTIC_REQUESTS) {
        apiQueries.push({
          label: "diagnostic_request_cap",
          url: "",
          count: 0,
          total: 0,
          total_pages: 0,
          pages_searched: 0,
          requests_used: 0,
          error: `request_cap_reached (${MAX_DIAGNOSTIC_REQUESTS})`,
          candidates: []
        });
        break;
      }

      if (usedRequests > 0) {
        await sleep(DIAGNOSTIC_DELAY_MS);
      }

      const run = await runStrategy({
        apiKey,
        baseUrl,
        strategy
      });

      apiQueries.push({
        label: run.label,
        url: run.url,
        count: run.count,
        total: run.total,
        total_pages: run.total_pages,
        pages_searched: run.pages_searched,
        requests_used: run.requests_used,
        error: run.error,
        candidates: run.candidates
      });

      mergedTemplates.push(...run.templates);
      usedRequests += run.requests_used;

      if (run.error?.includes("429")) {
        hasRateLimit = true;
        break;
      }

      if (run.count > 0) {
        break;
      }
    }
  }

  await runStrategies(primaryStrategies);

  if (!hasRateLimit && mergedTemplates.length === 0) {
    await runStrategies(fallbackStrategies);
  }

  const dedupedMap = new Map<string, TemplateBoothTemplatePayload>();
  for (const template of mergedTemplates) {
    dedupedMap.set(templateIdentity(template), template);
  }
  const dedupedTemplates = [...dedupedMap.values()];

  const rawTemplate = pickBestTemplate(dedupedTemplates, {
    templateId,
    name,
    postUrl,
    search
  });
  const allKeyPaths = buildAllKeyPaths(rawTemplate);
  const traversed = collectTraversedFields(rawTemplate);
  const matchingFields = collectMatchingFields(rawTemplate);
  const valueHints = collectValueHints(rawTemplate);
  const canvaDetection = extractCanvaLinkFromTemplate(rawTemplate);
  const sourceFilesDetection = extractSourceFilesFromTemplate(rawTemplate);
  const availableKeys = extractAvailableKeys(rawTemplate);
  const hasApiError = apiQueries.some((query) => Boolean(query.error));
  const diagnosticStatus: CanvaDiagnosticStatus = hasRateLimit
    ? "rate_limited"
    : canvaDetection.found
      ? "found"
      : "not_found";
  const sourceFilesConclusion = hasRateLimit
    ? "Diagnostic interrompu : limite API TemplateBooth atteinte."
    : sourceFilesDetection.psd_url
      ? "PSD fourni par API"
      : sourceFilesDetection.zip_url
        ? "ZIP fourni par API (PSD direct absent)"
        : "PSD non fourni par API";

  const firstQuery = apiQueries[0];
  const resolvedTemplateId =
    templateId ??
    stringValue(rawTemplate?.template_id ?? rawTemplate?.id ?? rawTemplate?.post_id) ??
    slugFromUrl(stringValue(rawTemplate?.post_url)) ??
    slugifyText(name ?? search) ??
    `template-${Date.now()}`;
  const resolvedTemplateName =
    name ??
    stringValue(rawTemplate?.name ?? rawTemplate?.title) ??
    search ??
    resolvedTemplateId;
  const resolvedPostUrl = normalizePostUrl(postUrl ?? stringValue(rawTemplate?.post_url));

  const cacheEntry: CanvaDiagnosticCacheEntry = {
    template_id: resolvedTemplateId,
    template_name: resolvedTemplateName,
    checked_at: nowIso,
    status: diagnosticStatus,
    canva_url: diagnosticStatus === "found" ? canvaDetection.canva_url ?? "" : "",
    key_path: diagnosticStatus === "found" ? canvaDetection.key_path ?? "" : "",
    fields_inspected: traversed.length,
    conclusion: diagnosticStatus,
    post_url: resolvedPostUrl
  };

  const nextCache = [...cacheEntries];
  const existingIndex = nextCache.findIndex((entry) => {
    if (entry.template_id && cacheEntry.template_id && entry.template_id === cacheEntry.template_id) {
      return true;
    }
    if (entry.post_url && cacheEntry.post_url && entry.post_url === cacheEntry.post_url) {
      return true;
    }
    return normalizeText(entry.template_name || "") === normalizeText(cacheEntry.template_name || "");
  });

  if (existingIndex >= 0) {
    nextCache[existingIndex] = cacheEntry;
  } else {
    nextCache.push(cacheEntry);
  }

  await writeDiagnosticCache(nextCache);

  return {
    selectedTemplate: {
      templateId,
      name,
      postUrl,
      search
    },
    checked_at: nowIso,
    diagnostic_status: diagnosticStatus,
    cache: {
      hit: false,
      forced_refresh: forceRefresh,
      checked_at: cacheEntry.checked_at,
      status: cacheEntry.status,
      age_minutes: 0
    },
    queryInfo: {
      url: firstQuery?.url ?? "",
      page: 1,
      per_page: DEFAULT_PER_PAGE,
      total: firstQuery?.total ?? 0,
      total_pages: firstQuery?.total_pages ?? 0,
      searchedPages: firstQuery?.pages_searched ?? 0
    },
    apiQueries,
    rawTemplate,
    availableKeys,
    allKeyPaths,
    inspectedFieldsCount: traversed.length,
    matchingFields,
    valueHints,
    canvaDetection,
    sourceFilesDetection,
    source_files_conclusion: sourceFilesConclusion,
    conclusion:
      diagnosticStatus === "rate_limited"
        ? "Diagnostic interrompu : limite API TemplateBooth atteinte. Reessayez dans quelques minutes."
        : rawTemplate
          ? canvaDetection.found
            ? `Lien Canva detecte via ${canvaDetection.key_path} (${canvaDetection.confidence}).`
            : hasApiError
              ? "Diagnostic termine sans lien Canva exploitable (avec erreurs API partielles)."
              : statusConclusion("not_found")
          : hasRateLimit
            ? "Diagnostic interrompu : limite API TemplateBooth atteinte. Reessayez dans quelques minutes."
            : "Aucune donnee template exploitable recuperee via l'API TemplateBooth."
  } satisfies RawTemplateDiagnosticResult;
}
