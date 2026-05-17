import { EventPicSelectedTemplateInput } from "@/src/shared/eventPicTemplates";
import { getCachedTemplateById, listCachedTemplates } from "@/src/server/eventPicTemplateService";
import { findTemplateSourceLink } from "@/src/server/templateSourceLinks";

const DEFAULT_TEMPLATEBOOTH_BASE_URL = "https://templatesbooth.com/wp-json/tb/v1";
const WELCOME_RELIABLE_SCORE_THRESHOLD = 70;
const WELCOME_TARGET_WIDTH = 1920;
const WELCOME_TARGET_HEIGHT = 1080;
const WELCOME_PLACEHOLDER_PREVIEW = "/welcome-placeholder-event-pic.svg";
const DEFAULT_PER_PAGE = 200;
const MAX_PAGINATION_PAGES = Number.parseInt(process.env.TEMPLATEBOOTH_WELCOME_MAX_PAGES ?? "30", 10) || 30;

type TemplateBoothTemplatePayload = Record<string, unknown>;

type TemplateBoothTemplatesResponse = {
  total?: number | string;
  total_pages?: number | string;
  page?: number | string;
  per_page?: number | string;
  data?: TemplateBoothTemplatePayload[];
};

type WelcomeDiagnosticInput = {
  templateId?: string;
  name?: string;
  postUrl?: string;
  category?: string;
  deepSearch?: boolean;
};

type ResolvedSelectedTemplate = {
  id: string;
  name: string;
  post_url?: string;
  published_at?: string | null;
  normalized_family_name: string;
  category?: string;
};

type QueryExecution = {
  label: string;
  params: Record<string, string>;
  paginate?: boolean;
};

export type WelcomeDiagnosticCandidate = {
  id: string;
  name: string;
  post_url?: string;
  src?: string;
  poster?: string;
  type?: string;
  type_name?: string;
  layout?: string;
  image_type?: string;
  no_of_images: number | null;
  published_at: string | null;
  score: number;
  match_reason: string;
  source_width: number | null;
  source_height: number | null;
  tags?: string[];
  touch_to_start: boolean;
  is_landscape: boolean;
};

export type WelcomeDiagnosticApiQuery = {
  url: string;
  count: number;
  candidates: WelcomeDiagnosticCandidate[];
};

export type WelcomeDiagnosticResult = {
  selectedTemplate: {
    id: string;
    name: string;
    post_url?: string;
    normalized_family_name: string;
  };
  apiQueries: WelcomeDiagnosticApiQuery[];
  welcomeCandidates: WelcomeDiagnosticCandidate[];
  bestCandidate: WelcomeDiagnosticCandidate | null;
  bestCandidateSource: "api" | "same_pack_cache" | "manual_override" | null;
  conclusion: string;
};

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

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.split("?")[0]?.replace(/\/$/, "");
}

function familyKeyFromSelectedTemplate(template: ResolvedSelectedTemplate) {
  const normalizedPostUrl = normalizePostUrl(template.post_url);

  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  if (template.id.trim()) {
    return `id:${template.id.trim()}`;
  }

  return undefined;
}

function parseResolutionFromText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d{3,4})\s*[xX]\s*(\d{3,4})/);

  if (!match) {
    return undefined;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return { width, height };
}

function extractResolution(payload: TemplateBoothTemplatePayload) {
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

  return (
    parseResolutionFromText(stringValue(payload.name ?? payload.title ?? payload.post_title)) ??
    parseResolutionFromText(stringValue(payload.type_name)) ??
    parseResolutionFromText(stringValue(payload.src)) ??
    parseResolutionFromText(stringValue(payload.poster)) ??
    parseResolutionFromText(stringValue(payload.video_url))
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizedContains(value: string | undefined, token: string) {
  if (!value) {
    return false;
  }

  return normalizeSearchText(value).includes(token);
}

const TOUCH_TO_START_TOKENS = [
  "touch to start",
  "touch-to-start",
  "touch_start",
  "start screen",
  "touch screen",
  "touch",
  "touchstart",
  "welcome start",
  "tap to start"
];

function isLandscapeFromResolution(width: number | null, height: number | null) {
  if (!width || !height) {
    return null;
  }

  return width >= height;
}

function isTouchToStartText(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = normalizeSearchText(value);
  if (TOUCH_TO_START_TOKENS.some((token) => normalized.includes(normalizeSearchText(token)))) {
    return true;
  }

  // Fallback pour les variantes qui gardent seulement "start" dans un contexte welcome/touch.
  return (
    normalized.includes("welcome") &&
    normalized.includes("start") &&
    (normalized.includes("touch") || normalized.includes("screen"))
  );
}

export function isTouchToStartCandidate(
  candidate: Pick<
    WelcomeDiagnosticCandidate,
    "name" | "post_url" | "type_name" | "src" | "poster" | "layout" | "image_type"
  >
) {
  return (
    isTouchToStartText(candidate.name) ||
    isTouchToStartText(candidate.post_url) ||
    isTouchToStartText(candidate.type_name) ||
    isTouchToStartText(candidate.src) ||
    isTouchToStartText(candidate.poster) ||
    isTouchToStartText(candidate.layout) ||
    isTouchToStartText(candidate.image_type)
  );
}

const GENERIC_TOKENS = new Set([
  "photo",
  "booth",
  "template",
  "modele",
  "model",
  "cabine",
  "screen",
  "welcome",
  "static",
  "animated"
]);

function tokenize(value: string | undefined) {
  if (!value) {
    return [];
  }

  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function meaningfulTokens(value: string | undefined) {
  return tokenize(value).filter((token) => !GENERIC_TOKENS.has(token));
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

function idFromPayload(payload: TemplateBoothTemplatePayload) {
  const templateId = stringValue(payload.template_id ?? payload.id ?? payload.post_id);

  if (templateId) {
    return templateId;
  }

  const fromPost = slugFromUrl(stringValue(payload.post_url));

  if (fromPost) {
    return fromPost;
  }

  const fromAsset = slugFromUrl(stringValue(payload.src ?? payload.poster ?? payload.video_url));

  if (!fromAsset) {
    return undefined;
  }

  return fromAsset.replace(/\.[a-z0-9]+$/i, "");
}

function normalizeFamilyName(name: string) {
  const tokens = meaningfulTokens(name);
  return tokens.join(" ").trim();
}

function getTemplateBoothConfig() {
  const apiKey = process.env.TEMPLATEBOOTH_API_KEY;
  const baseUrl = (process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("Cle API TemplateBooth absente cote serveur.");
  }

  return { apiKey, baseUrl };
}

function detectWelcomeType(input: {
  type?: string;
  typeName?: string;
  layout?: string;
  name?: string;
  src?: string;
  poster?: string;
  videoUrl?: string;
}) {
  const type = normalizeSearchText(input.type ?? "");
  const typeName = normalizeSearchText(input.typeName ?? "");
  const layout = normalizeSearchText(input.layout ?? "");
  const name = normalizeSearchText(input.name ?? "");
  const src = normalizeSearchText(input.src ?? "");
  const poster = normalizeSearchText(input.poster ?? "");
  const video = normalizeSearchText(input.videoUrl ?? "");
  const bundle = [type, typeName, layout, name, src, poster, video].join(" ");
  const looksWelcome = bundle.includes("welcome");

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

  if (src.includes("animated-welcome-screen") || video.includes("animated-welcome-screen")) {
    return "animated_welcome_screen" as const;
  }

  if (src.includes("welcome-screen") || poster.includes("welcome-screen") || video.includes("welcome-screen")) {
    return "static_welcome_screen" as const;
  }

  return undefined;
}

function hasWelcomeResolution(width: number | null | undefined, height: number | null | undefined) {
  return (
    (width === 1920 && height === 1080) ||
    (width === 1366 && height === 1024)
  );
}

function isPhotoLayout(layout: string | undefined) {
  const normalized = normalizeSearchText(layout ?? "");
  return (
    normalized.includes("26strip") ||
    normalized.includes("46postcard-p") ||
    normalized.includes("46postcard-l") ||
    normalized.includes("strip") ||
    normalized.includes("postcard")
  );
}

function isWelcomeCandidate(
  candidate: Pick<
    WelcomeDiagnosticCandidate,
    "type" | "type_name" | "layout" | "name" | "src" | "poster" | "source_width" | "source_height" | "no_of_images"
  >
) {
  if (
    detectWelcomeType({
      type: candidate.type,
      typeName: candidate.type_name,
      layout: candidate.layout,
      name: candidate.name,
      src: candidate.src,
      poster: candidate.poster
    })
  ) {
    return true;
  }

  // Certaines variations welcome sont exposes sans type explicite dans l'API.
  if (
    hasWelcomeResolution(candidate.source_width, candidate.source_height) &&
    !isPhotoLayout(candidate.layout)
  ) {
    return true;
  }

  return false;
}

function normalizeTags(value: unknown) {
  const tags = new Set<string>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        tags.add(item.trim());
      } else if (item && typeof item === "object") {
        const object = item as Record<string, unknown>;
        const tagName = stringValue(object.name ?? object.slug);

        if (tagName) {
          tags.add(tagName);
        }
      }
    }
  } else {
    const singleTag = stringValue(value);

    if (singleTag) {
      tags.add(singleTag);
    }
  }

  return [...tags];
}

function mapPayloadToCandidate(payload: TemplateBoothTemplatePayload): WelcomeDiagnosticCandidate | undefined {
  const id = idFromPayload(payload);
  const src = stringValue(payload.src);
  const poster = stringValue(payload.poster) ?? src;
  const type = stringValue(payload.type);
  const typeName = stringValue(payload.type_name ?? payload.layout_type ?? type);
  const layout = stringValue(payload.layout_size ?? payload.layout);
  const rawName = stringValue(payload.name ?? payload.title ?? payload.post_title);
  const resolution = extractResolution(payload);
  const detectedTypeFromMetadata = detectWelcomeType({
    type,
    typeName,
    layout,
    name: rawName,
    src,
    poster,
    videoUrl: stringValue(payload.video_url)
  });
  const looksWelcomeFromResolution =
    hasWelcomeResolution(resolution?.width ?? null, resolution?.height ?? null) && !isPhotoLayout(layout);
  const detectedType = detectedTypeFromMetadata ?? (looksWelcomeFromResolution ? "static_welcome_screen" : undefined);
  const postUrl = stringValue(payload.post_url);
  const name =
    rawName ??
    slugFromUrl(postUrl)?.replace(/[-_]+/g, " ") ??
    "Welcome screen";

  if (!id) {
    return undefined;
  }

  return {
    id,
    name: name.replace(/<[^>]*>/g, "").trim(),
    post_url: postUrl,
    src,
    poster,
    type: detectedType ?? type,
    type_name: typeName ?? detectedType,
    layout,
    image_type: stringValue(payload.image_type),
    no_of_images: nullableNumber(payload.no_of_images),
    published_at: stringValue(payload.published_at) ?? null,
    score: 0,
    match_reason: "",
    source_width: resolution?.width ?? null,
    source_height: resolution?.height ?? null,
    tags: normalizeTags(payload.tags ?? payload.tag ?? payload.categories),
    touch_to_start: isTouchToStartCandidate({
      name,
      post_url: postUrl,
      type_name: typeName,
      src,
      poster
    }),
    is_landscape: (resolution?.width ?? 0) > 0 && (resolution?.height ?? 0) > 0 ? resolution!.width >= resolution!.height : false
  };
}

function candidateFromCachedTemplate(template: {
  id: string;
  name: string;
  post_url?: string;
  preview_url: string;
  type?: string;
  type_name?: string;
  layout: string;
  no_of_images: number | null;
  published_at: string | null;
  source_width?: number | null;
  source_height?: number | null;
  tags?: string[];
}) {
  const detectedTypeFromMetadata = detectWelcomeType({
    type: template.type,
    typeName: template.type_name,
    layout: template.layout,
    name: template.name,
    src: template.preview_url
  });
  const detectedType =
    detectedTypeFromMetadata ??
    (hasWelcomeResolution(template.source_width ?? null, template.source_height ?? null) &&
    !isPhotoLayout(template.layout)
      ? "static_welcome_screen"
      : undefined);

  return {
    id: template.id,
    name: template.name,
    post_url: template.post_url,
    src: template.preview_url,
    poster: template.preview_url,
    type: detectedType ?? template.type,
    type_name: template.type_name ?? detectedType,
    layout: template.layout,
    image_type: undefined,
    no_of_images: template.no_of_images,
    published_at: template.published_at,
    score: 0,
    match_reason: "",
    source_width: template.source_width ?? null,
    source_height: template.source_height ?? null,
    tags: template.tags,
    touch_to_start: isTouchToStartCandidate({
      name: template.name,
      post_url: template.post_url,
      type_name: template.type_name,
      src: template.preview_url,
      poster: template.preview_url
    }),
    is_landscape:
      typeof template.source_width === "number" && typeof template.source_height === "number"
        ? template.source_width >= template.source_height
        : template.layout === "46postcard-l"
  } satisfies WelcomeDiagnosticCandidate;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function dateDistanceDays(a: string | null | undefined, b: string | null | undefined) {
  const first = parseDate(a);
  const second = parseDate(b);

  if (!first || !second) {
    return null;
  }

  const ms = Math.abs(first.getTime() - second.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function categoryHintFromInput(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeSearchText(value);
  const mappings: Array<{ match: string[]; tag: string; search: string }> = [
    { match: ["mariage", "wedding"], tag: "Wedding", search: "Wedding" },
    { match: ["anniversaire", "birthday"], tag: "Birthday", search: "Birthday" },
    { match: ["bapteme", "baptism", "communion", "religious"], tag: "Religious", search: "Religious" },
    { match: ["baby shower"], tag: "Baby Shower", search: "Baby Shower" },
    { match: ["gender reveal"], tag: "Gender Reveal", search: "Gender Reveal" },
    { match: ["soiree privee", "party", "nightlife"], tag: "Nightlife", search: "Nightlife" },
    { match: ["entreprise", "corporate", "business"], tag: "Corporate", search: "Corporate" },
    { match: ["noel", "christmas"], tag: "Christmas", search: "Christmas" },
    { match: ["nouvel an", "new year"], tag: "New Year's Eve", search: "New Year's Eve" },
    { match: ["fiancailles", "engagement"], tag: "Wedding", search: "Engagement" }
  ];

  return mappings.find((item) => item.match.some((candidate) => normalized.includes(candidate)));
}

function overlapCount(first: string[], second: string[]) {
  const secondSet = new Set(second);
  return first.filter((token) => secondSet.has(token)).length;
}

export function scoreWelcomeCandidate(
  selectedTemplate: ResolvedSelectedTemplate,
  candidate: WelcomeDiagnosticCandidate,
  categoryHint?: ReturnType<typeof categoryHintFromInput>
) {
  let score = 0;
  const reasons: string[] = [];
  const selectedNameTokens = meaningfulTokens(selectedTemplate.name);
  const candidateNameTokens = meaningfulTokens(candidate.name);
  const selectedSlugTokens = meaningfulTokens(slugFromUrl(selectedTemplate.post_url));
  const candidateSlugTokens = meaningfulTokens(slugFromUrl(candidate.post_url));
  const selectedPostUrl = normalizePostUrl(selectedTemplate.post_url);
  const candidatePostUrl = normalizePostUrl(candidate.post_url);
  const categoryTokens = (candidate.tags ?? []).map((tag) => normalizeSearchText(tag));
  const mainToken = selectedNameTokens[0];

  const isSamePack = Boolean(selectedPostUrl && candidatePostUrl && selectedPostUrl === candidatePostUrl);
  const hasTouchToStart = candidate.touch_to_start || isTouchToStartCandidate(candidate);
  const resolutionLandscape = isLandscapeFromResolution(candidate.source_width, candidate.source_height);
  const isExact1920x1080 = candidate.source_width === WELCOME_TARGET_WIDTH && candidate.source_height === WELCOME_TARGET_HEIGHT;
  const is1366x1024 = candidate.source_width === 1366 && candidate.source_height === 1024;

  if (isSamePack) {
    score += 120;
    reasons.push("same_post_url_welcome");
  }

  if (isWelcomeCandidate(candidate)) {
    score += 25;
    reasons.push("type welcome screen");
  }

  if (isExact1920x1080) {
    score += 80;
    reasons.push("resolution_1920x1080");
  } else if (is1366x1024) {
    score += 58;
    reasons.push("resolution_1366x1024");
  } else if (candidate.source_width && candidate.source_height) {
    score += 18;
    reasons.push(`resolution_${candidate.source_width}x${candidate.source_height}`);
  }

  if (candidate.image_type && normalizeSearchText(candidate.image_type).includes("landscape")) {
    score += 16;
    reasons.push("image_type_landscape");
  } else if (resolutionLandscape === true || candidate.is_landscape) {
    score += 10;
    reasons.push("landscape_detected");
  } else if (resolutionLandscape === false) {
    score -= 14;
    reasons.push("not_landscape");
  }

  if (hasTouchToStart) {
    if (isExact1920x1080) {
      score += 120;
      reasons.push("touch_to_start_1920x1080_prioritaire");
    } else if (is1366x1024) {
      score += 70;
      reasons.push("touch_to_start_1366x1024_prioritaire");
    } else {
      score -= 340;
      reasons.push("touch_to_start_hors_format_penalty");
    }
  } else {
    if (isExact1920x1080) {
      score += 55;
      reasons.push("1920x1080_sans_touch_bonus");
    } else if (is1366x1024) {
      score += 34;
      reasons.push("1366x1024_sans_touch_bonus");
    } else {
      score += 14;
      reasons.push("no_touch_to_start_bonus");
    }
  }

  if (mainToken && candidateNameTokens.includes(mainToken)) {
    score += 30;
    reasons.push(`mot principal commun: ${mainToken}`);
  }

  if (selectedSlugTokens.length > 0 && candidateSlugTokens.length > 0) {
    const sharedSlugTokens = overlapCount(selectedSlugTokens, candidateSlugTokens);
    const selectedNumericToken = selectedSlugTokens.find((token) => /^\d+$/.test(token));

    if (sharedSlugTokens >= 2 && (!selectedNumericToken || candidateSlugTokens.includes(selectedNumericToken))) {
      score += 30;
      reasons.push("slug principal compatible");
    }
  }

  if (categoryHint) {
    const categoryToken = normalizeSearchText(categoryHint.tag);
    const categoryFields = [
      candidate.name,
      candidate.post_url,
      candidate.type_name,
      candidate.layout,
      ...(candidate.tags ?? [])
    ]
      .map((value) => normalizeSearchText(value ?? ""))
      .join(" ");

    if (categoryFields.includes(categoryToken) || categoryTokens.includes(categoryToken)) {
      score += 20;
      reasons.push(`categorie compatible: ${categoryHint.tag}`);
    }
  }

  if (selectedNameTokens.length > 0 && candidateNameTokens.length > 0) {
    const sharedNameTokens = overlapCount(selectedNameTokens, candidateNameTokens);
    const minTokenCount = Math.max(1, Math.min(selectedNameTokens.length, candidateNameTokens.length));
    const similarity = sharedNameTokens / minTokenCount;

    if (similarity >= 0.45) {
      score += 10;
      reasons.push("nom proche");
    }
  }

  const publicationDistance = dateDistanceDays(selectedTemplate.published_at, candidate.published_at);

  if (publicationDistance !== null && publicationDistance <= 120) {
    score += 5;
    reasons.push("date de publication proche");
  }

  return {
    score,
    match_reason: reasons.join(" | ")
  };
}

export function isReliableWelcomeCandidate(candidate: WelcomeDiagnosticCandidate | null | undefined) {
  return Boolean(candidate && candidate.score >= WELCOME_RELIABLE_SCORE_THRESHOLD);
}

function isPreferredSamePackNonTouchFallback(
  selectedTemplate: ResolvedSelectedTemplate,
  candidate: WelcomeDiagnosticCandidate | null | undefined
) {
  if (!candidate) {
    return false;
  }

  const selectedPostUrl = normalizePostUrl(selectedTemplate.post_url);
  const candidatePostUrl = normalizePostUrl(candidate.post_url);
  if (!selectedPostUrl || !candidatePostUrl || selectedPostUrl !== candidatePostUrl) {
    return false;
  }

  if (isTouchToStartCandidate(candidate)) {
    return false;
  }

  return hasWelcomeResolution(candidate.source_width, candidate.source_height);
}

async function fetchTemplateBoothTemplatesPage(params: Record<string, string>, page: number) {
  const { apiKey, baseUrl } = getTemplateBoothConfig();
  const url = new URL(`${baseUrl}/templates`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(params.per_page ?? DEFAULT_PER_PAGE));
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
  const rawTemplates = Array.isArray(json.data) ? json.data : [];
  const total = nullableNumber(json.total) ?? rawTemplates.length;
  const totalPages = nullableNumber(json.total_pages) ?? 1;
  const candidates = rawTemplates
    .map((payload) => mapPayloadToCandidate(payload))
    .filter((candidate): candidate is WelcomeDiagnosticCandidate => Boolean(candidate));

  return {
    url: url.toString(),
    page,
    total,
    totalPages,
    rawTemplates,
    candidates
  };
}

async function fetchTemplateBoothTemplates(params: Record<string, string>, paginate = false) {
  const firstPage = await fetchTemplateBoothTemplatesPage(params, 1);
  const allCandidates = [...firstPage.candidates];
  const allRaw = [...firstPage.rawTemplates];
  let currentPage = 1;
  const maxPages = Math.max(1, Math.min(MAX_PAGINATION_PAGES, firstPage.totalPages));

  while (paginate && currentPage < maxPages) {
    currentPage += 1;

    const nextPage = await fetchTemplateBoothTemplatesPage(params, currentPage);
    allCandidates.push(...nextPage.candidates);
    allRaw.push(...nextPage.rawTemplates);
  }

  return {
    url: firstPage.url,
    total: firstPage.total,
    totalPages: firstPage.totalPages,
    rawTemplates: allRaw,
    candidates: allCandidates
  };
}

async function resolveSelectedTemplate(input: WelcomeDiagnosticInput): Promise<ResolvedSelectedTemplate> {
  const cached = input.templateId ? await getCachedTemplateById(input.templateId) : undefined;
  const name = input.name?.trim() || cached?.name || "Template Event Pic";
  const postUrl = normalizePostUrl(input.postUrl?.trim() || cached?.post_url);
  const id = input.templateId?.trim() || cached?.id || "manual-selection";

  return {
    id,
    name,
    post_url: postUrl,
    published_at: cached?.published_at ?? null,
    normalized_family_name: normalizeFamilyName(name),
    category: input.category?.trim()
  };
}

function buildSearchTerms(selectedTemplate: ResolvedSelectedTemplate) {
  const nameTokens = meaningfulTokens(selectedTemplate.name);
  const slugTokens = meaningfulTokens(slugFromUrl(selectedTemplate.post_url));
  const terms = new Set<string>();

  if (nameTokens.length >= 2) {
    terms.add(`${nameTokens[0]} ${nameTokens[1]}`);
  }

  if (nameTokens[0]) {
    terms.add(nameTokens[0]);
  }

  if (nameTokens[1]) {
    terms.add(nameTokens[1]);
  }

  if (slugTokens.length >= 2) {
    terms.add(`${slugTokens[0]} ${slugTokens[1]}`);
  }

  if (slugTokens[0]) {
    terms.add(slugTokens[0]);
  }

  return [...terms].filter((term) => term.trim().length > 0);
}

function dedupeCandidates(candidates: WelcomeDiagnosticCandidate[]) {
  const map = new Map<string, WelcomeDiagnosticCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.id}::${normalizePostUrl(candidate.post_url) ?? ""}::${candidate.src ?? candidate.poster ?? ""}`;

    if (!map.has(key)) {
      map.set(key, candidate);
    }
  }

  return [...map.values()];
}

function welcomePriorityBucket(candidate: WelcomeDiagnosticCandidate) {
  const isExact1920 = candidate.source_width === WELCOME_TARGET_WIDTH && candidate.source_height === WELCOME_TARGET_HEIGHT;
  const is1366 = candidate.source_width === 1366 && candidate.source_height === 1024;
  const hasTouch = candidate.touch_to_start || isTouchToStartCandidate(candidate);

  if (hasTouch && isExact1920) {
    return 0;
  }

  if (!hasTouch && isExact1920) {
    return 1;
  }

  if (hasTouch && is1366) {
    return 2;
  }

  if (!hasTouch && is1366) {
    return 3;
  }

  if (hasTouch) {
    return 4;
  }

  return 5;
}

async function getSamePackWelcomeCandidates(selectedTemplate: ResolvedSelectedTemplate) {
  const selectedPostUrl = normalizePostUrl(selectedTemplate.post_url);

  if (!selectedPostUrl) {
    return [];
  }

  const catalogTemplates = await listCachedTemplates();
  const samePackTemplates = catalogTemplates.filter(
    (template) => normalizePostUrl(template.post_url) === selectedPostUrl
  );

  return samePackTemplates
    .map((template) => candidateFromCachedTemplate(template))
    .filter((candidate) => isWelcomeCandidate(candidate));
}

async function getManualWelcomeCandidate(
  selectedTemplate: ResolvedSelectedTemplate,
  manual: Awaited<ReturnType<typeof findTemplateSourceLink>> | null
) {
  if (!manual) {
    return null;
  }

  const preview = manual.preferred_welcome_preview_url ?? manual.welcome_preview_url ?? manual.welcome_screen_url;
  const sourceResolution =
    parseResolutionFromText(manual.welcome_source_size) ??
    parseResolutionFromText(manual.welcome_screen_url ?? preview);
  const detectedType = detectWelcomeType({
    type: "static_welcome_screen",
    typeName: "manual_welcome_screen",
    src: preview
  });

  if (!manual.welcome_screen_url && !preview) {
    return null;
  }

  return {
    id: manual.preferred_welcome_id ?? `${selectedTemplate.id}__manual_welcome`,
    name: `${selectedTemplate.name} (welcome manuel)`,
    post_url: normalizePostUrl(manual.post_url ?? selectedTemplate.post_url),
    src: preview,
    poster: preview,
    type: detectedType ?? "static_welcome_screen",
    type_name: "manual_welcome_screen",
    layout: "welcome",
    image_type: undefined,
    no_of_images: null,
    published_at: null,
    score: 0,
    match_reason: "",
    source_width: sourceResolution?.width ?? null,
    source_height: sourceResolution?.height ?? null,
    tags: [],
    touch_to_start:
      manual.welcome_touch_to_start === true ||
      isTouchToStartText(manual.welcome_screen_url) ||
      isTouchToStartText(preview),
    is_landscape:
      typeof sourceResolution?.width === "number" && typeof sourceResolution?.height === "number"
        ? sourceResolution.width >= sourceResolution.height
        : true
  } satisfies WelcomeDiagnosticCandidate;
}

export async function getTemplateBoothWelcomeDiagnostic(input: WelcomeDiagnosticInput): Promise<WelcomeDiagnosticResult> {
  const selectedTemplate = await resolveSelectedTemplate(input);
  const selectedFamilyKey = familyKeyFromSelectedTemplate(selectedTemplate);
  const categoryHint = categoryHintFromInput(input.category ?? selectedTemplate.category);
  const searchTerms = buildSearchTerms(selectedTemplate);
  const runDeepSearch = input.deepSearch !== false;
  const queryPlan: QueryExecution[] = runDeepSearch
    ? [
        {
          label: "static welcome",
          params: {
            type: "static_welcome_screen",
            per_page: String(DEFAULT_PER_PAGE)
          },
          paginate: true
        },
        {
          label: "animated welcome",
          params: {
            type: "animated_welcome_screen",
            per_page: String(DEFAULT_PER_PAGE)
          },
          paginate: true
        },
        {
          label: "static all",
          params: {
            type: "static_all",
            per_page: String(DEFAULT_PER_PAGE)
          }
        },
        {
          label: "animated all",
          params: {
            type: "animated_all",
            per_page: String(DEFAULT_PER_PAGE)
          }
        },
        ...searchTerms.map((term) => ({
          label: `search ${term}`,
          params: {
            search: term,
            per_page: String(DEFAULT_PER_PAGE)
          }
        })),
        ...(categoryHint
          ? [
              {
                label: `tags ${categoryHint.tag}`,
                params: {
                  tags: categoryHint.tag,
                  per_page: String(DEFAULT_PER_PAGE)
                }
              }
            ]
          : [])
      ]
    : [];

  const apiQueries: WelcomeDiagnosticApiQuery[] = [];
  const allCandidates: WelcomeDiagnosticCandidate[] = [];
  const samePackCandidates = await getSamePackWelcomeCandidates(selectedTemplate);
  const sourceLinkMapping = await findTemplateSourceLink({
    templateId: selectedTemplate.id,
    postUrl: selectedTemplate.post_url,
    familyKey: selectedFamilyKey
  });
  const preferredWelcomeId = sourceLinkMapping?.preferred_welcome_id?.trim() || null;

  apiQueries.push({
    url: `cache://same-post-url/${encodeURIComponent(selectedTemplate.post_url ?? "none")}`,
    count: samePackCandidates.length,
    candidates: samePackCandidates.slice(0, 8).map((candidate) => ({
      ...candidate,
      score: 0,
      match_reason: "same_post_url_welcome"
    }))
  });
  allCandidates.push(...samePackCandidates);

  const manualCandidate = await getManualWelcomeCandidate(selectedTemplate, sourceLinkMapping);

  if (manualCandidate) {
    apiQueries.push({
      url: "manual://template-source-links",
      count: 1,
      candidates: [
        {
          ...manualCandidate,
          score: 0,
          match_reason: "manual_welcome_mapping"
        }
      ]
    });
    allCandidates.push(manualCandidate);
  }

  for (const query of queryPlan) {
    try {
      const response = await fetchTemplateBoothTemplates(query.params, Boolean(query.paginate));
      const queryCandidates = response.candidates.filter((candidate) => isWelcomeCandidate(candidate));

      apiQueries.push({
        url: response.url,
        count: queryCandidates.length,
        candidates: queryCandidates.slice(0, 8).map((candidate) => ({
          ...candidate,
          score: 0,
          match_reason: `resultat ${query.label}`
        }))
      });
      allCandidates.push(...queryCandidates);
    } catch (error) {
      apiQueries.push({
        url: `${(process.env.TEMPLATEBOOTH_BASE_URL || DEFAULT_TEMPLATEBOOTH_BASE_URL).replace(/\/$/, "")}/templates?${new URLSearchParams(query.params).toString()}`,
        count: 0,
        candidates: []
      });
      console.error("[TemplateBooth] Welcome diagnostic query error", {
        label: query.label,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  const selectedPostUrl = normalizePostUrl(selectedTemplate.post_url);
  const scoredCandidates = dedupeCandidates(allCandidates)
    .map((candidate) => {
      const scoring = scoreWelcomeCandidate(selectedTemplate, candidate, categoryHint);
      let score = scoring.score;
      let matchReason = scoring.match_reason || "Aucun critere fort detecte";

      if (preferredWelcomeId && candidate.id === preferredWelcomeId) {
        score += 240;
        matchReason = `${matchReason} | preferred_welcome_id_mapping`;
      }

      return {
        ...candidate,
        score,
        match_reason: matchReason
      };
    })
    .filter((candidate) => isWelcomeCandidate(candidate))
    .sort((first, second) => {
      const scoreDelta = second.score - first.score;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const firstDate = parseDate(first.published_at)?.getTime() ?? 0;
      const secondDate = parseDate(second.published_at)?.getTime() ?? 0;
      return secondDate - firstDate;
    });

  const samePackCandidatesScored = selectedPostUrl
    ? scoredCandidates.filter((candidate) => normalizePostUrl(candidate.post_url) === selectedPostUrl)
    : [];
  let candidatePool: WelcomeDiagnosticCandidate[] = [];
  if (selectedPostUrl) {
    if (samePackCandidatesScored.length > 0) {
      candidatePool = samePackCandidatesScored;
    } else {
      candidatePool = [];
    }
  } else {
    candidatePool = scoredCandidates;
  }
  const rankedCandidates = [...candidatePool].sort((first, second) => {
    const bucketDelta = welcomePriorityBucket(first) - welcomePriorityBucket(second);

    if (bucketDelta !== 0) {
      return bucketDelta;
    }

    const scoreDelta = second.score - first.score;

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const firstDate = parseDate(first.published_at)?.getTime() ?? 0;
    const secondDate = parseDate(second.published_at)?.getTime() ?? 0;
    return secondDate - firstDate;
  });
  const bestCandidate = rankedCandidates[0] ?? null;
  const reliable = isReliableWelcomeCandidate(bestCandidate);
  const touchFallbackUsed = Boolean(bestCandidate && isTouchToStartCandidate(bestCandidate));
  const bestIs1920 = Boolean(
    bestCandidate &&
      bestCandidate.source_width === WELCOME_TARGET_WIDTH &&
      bestCandidate.source_height === WELCOME_TARGET_HEIGHT
  );
  const bestIs1366 = Boolean(
    bestCandidate && bestCandidate.source_width === 1366 && bestCandidate.source_height === 1024
  );
  const bestCandidateSource: WelcomeDiagnosticResult["bestCandidateSource"] = bestCandidate
    ? bestCandidate.match_reason.includes("manual_welcome_mapping")
      ? "manual_override"
      : bestCandidate.match_reason.includes("same_post_url_welcome")
        ? "same_pack_cache"
        : "api"
    : null;

  console.log("[TemplateBooth] Welcome diagnostic", {
    selected_template_id: selectedTemplate.id,
    selected_name: selectedTemplate.name,
    selected_post_url: selectedTemplate.post_url ?? null,
    normalized_family_name: selectedTemplate.normalized_family_name,
    candidates_found: scoredCandidates.length,
    same_pack_candidates_found: samePackCandidatesScored.length,
    best_candidate_id: bestCandidate?.id ?? null,
    best_candidate_score: bestCandidate?.score ?? null,
    best_candidate_reason: bestCandidate?.match_reason ?? null,
    best_candidate_touch_to_start: touchFallbackUsed,
    reliable
  });

  return {
    selectedTemplate: {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      post_url: selectedTemplate.post_url,
      normalized_family_name: selectedTemplate.normalized_family_name
    },
    apiQueries,
    welcomeCandidates: scoredCandidates,
    bestCandidate,
    bestCandidateSource,
    conclusion: reliable
      ? touchFallbackUsed && bestIs1920
        ? `Welcome screen 1920x1080 - Touch to Start selectionne (score ${bestCandidate?.score ?? 0}).`
        : !touchFallbackUsed && bestIs1920
          ? `Welcome screen 1920x1080 selectionne (score ${bestCandidate?.score ?? 0}).`
          : touchFallbackUsed && bestIs1366
            ? `Source 1366x1024 - Touch to Start selectionnee. Event Pic l'adaptera en 1920x1080 (score ${bestCandidate?.score ?? 0}).`
            : `Source 1366x1024 selectionnee. Event Pic l'adaptera en 1920x1080 (score ${bestCandidate?.score ?? 0}).`
      : "Aucun welcome screen fiable detecte. Conserver le placeholder Event Pic."
  };
}

export function templateFromWelcomeCandidate(
  candidate: WelcomeDiagnosticCandidate,
  currentTemplate: EventPicSelectedTemplateInput
): EventPicSelectedTemplateInput {
  const preview = candidate.src ?? candidate.poster ?? currentTemplate.preview_url ?? WELCOME_PLACEHOLDER_PREVIEW;
  const sourceWidth = candidate.source_width;
  const sourceHeight = candidate.source_height;
  const exactTarget = sourceWidth === WELCOME_TARGET_WIDTH && sourceHeight === WELCOME_TARGET_HEIGHT;
  const requiresResize = !exactTarget;
  const detectedType = detectWelcomeType({
    type: candidate.type,
    typeName: candidate.type_name,
    layout: candidate.layout,
    name: candidate.name,
    src: candidate.src,
    poster: candidate.poster
  });

  return {
    ...currentTemplate,
    id: candidate.id,
    name: candidate.name || currentTemplate.name,
    preview_url: preview,
    layout: candidate.layout || currentTemplate.layout || "welcome",
    format_label: "Fond d'ecran 1920x1080",
    no_of_images: candidate.no_of_images,
    type: detectedType ?? candidate.type ?? "static_welcome_screen",
    type_name: candidate.type_name || currentTemplate.type_name || "Welcome screen",
    required: true,
    placeholder: false,
    production_needed: false,
    source_kind: "templatebooth",
    post_url: normalizePostUrl(candidate.post_url),
    requires_resize: requiresResize,
    source_width: sourceWidth,
    source_height: sourceHeight,
    target_width: WELCOME_TARGET_WIDTH,
    target_height: WELCOME_TARGET_HEIGHT
  };
}

function isWelcomeSelection(template: EventPicSelectedTemplateInput) {
  return (
    template.required &&
    (template.type === "static_welcome_screen" ||
      template.type === "animated_welcome_screen" ||
      normalizedContains(template.type_name, "welcome") ||
      template.format_label.includes("Fond d'ecran") ||
      template.placeholder === true)
  );
}

function pickReferenceTemplate(templates: EventPicSelectedTemplateInput[]) {
  const strictPreferred = templates.find(
    (template) =>
      !template.placeholder &&
      (template.layout === "46postcard-p" || template.layout === "46postcard-l") &&
      typeof template.id === "string" &&
      template.id.trim()
  );

  if (strictPreferred) {
    return strictPreferred;
  }

  return templates.find((template) => !template.placeholder && typeof template.id === "string" && template.id.trim());
}

function toWelcomePlaceholder(template: EventPicSelectedTemplateInput) {
  return {
    ...template,
    required: true,
    format_label: "Fond d'ecran 1920x1080",
    placeholder: true,
    production_needed: true,
    source_kind: "event_pic_task" as const,
    requires_resize: true,
    target_width: WELCOME_TARGET_WIDTH,
    target_height: WELCOME_TARGET_HEIGHT,
    preview_url: template.preview_url || WELCOME_PLACEHOLDER_PREVIEW
  };
}

export async function autoResolveWelcomeForSelection(params: {
  selected_templates: EventPicSelectedTemplateInput[];
  category?: string;
}): Promise<EventPicSelectedTemplateInput[]> {
  const templates = [...params.selected_templates];
  const welcomeIndex = templates.findIndex((template) => isWelcomeSelection(template));

  if (welcomeIndex === -1) {
    return templates;
  }

  const reference = pickReferenceTemplate(templates);

  if (!reference) {
    return templates.map<EventPicSelectedTemplateInput>((template, index) =>
      index === welcomeIndex ? toWelcomePlaceholder(template) : template
    );
  }

  try {
    const fastDiagnostic = await getTemplateBoothWelcomeDiagnostic({
      templateId: reference.id,
      name: reference.name,
      postUrl: reference.post_url,
      category: params.category,
      deepSearch: false
    });
    let best = fastDiagnostic.bestCandidate;
    const shouldDeepSearch = !best || !isReliableWelcomeCandidate(best);

    if (shouldDeepSearch) {
      const deepDiagnostic = await getTemplateBoothWelcomeDiagnostic({
        templateId: reference.id,
        name: reference.name,
        postUrl: reference.post_url,
        category: params.category,
        deepSearch: true
      });
      best = deepDiagnostic.bestCandidate ?? best;
    }

    const allowSamePackFallback = isPreferredSamePackNonTouchFallback(
      {
        id: reference.id,
        name: reference.name,
        post_url: reference.post_url,
        published_at: null,
        normalized_family_name: normalizeFamilyName(reference.name),
        category: params.category
      },
      best
    );

    if (best && (isReliableWelcomeCandidate(best) || allowSamePackFallback)) {
      return templates.map<EventPicSelectedTemplateInput>((template, index) =>
        index === welcomeIndex && best ? templateFromWelcomeCandidate(best, template) : template
      );
    }
  } catch (error) {
    console.error("[TemplateBooth] Auto welcome diagnostic failed", error);
  }

  return templates.map<EventPicSelectedTemplateInput>((template, index) =>
    index === welcomeIndex ? toWelcomePlaceholder(template) : template
  );
}
