"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  EVENT_PIC_CATEGORIES,
  EVENT_PIC_FORMATS,
  EVENT_TYPES,
  EventPicCategoryId,
  EventPicFormatId,
  EventPicTemplate,
  getEventPicCategory
} from "@/src/shared/eventPicTemplates";

type TemplateResponse = {
  templates?: EventPicTemplate[];
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  source?: "api" | "local";
  error?: string;
};

type TemplateFamilyResponse = {
  family?: string;
  selected?: EventPicTemplate;
  templates?: EventPicTemplate[];
  preferredRequiredPortraitId?: string | null;
  error?: string;
};

type TemplateWelcomeResponse = {
  found?: boolean;
  template?: EventPicTemplate;
  score?: number;
  reason?: string;
  error?: string;
};

type TemplateRequestResponse = {
  request?: { id: string };
  error?: string;
};

type TemplateSearchResult = {
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
  template: EventPicTemplate;
};

type TemplateSearchResponse = {
  query: string;
  total: number;
  results: TemplateSearchResult[];
  error?: string;
};

type SelectedTemplateChoice = EventPicTemplate & {
  required: boolean;
  placeholder: boolean;
  requires_resize: boolean;
  target_width: number;
  target_height: number;
};

type FamilyResolvedState = {
  familyTemplates: EventPicTemplate[];
  requiredIds: string[];
  initialOptionalIds: string[];
  familyMessage: string;
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  event_date: string;
  event_type: string;
  primary_text: string;
  secondary_text: string;
  instructions: string;
};

const TARGET_WELCOME_WIDTH = 1920;
const TARGET_WELCOME_HEIGHT = 1080;
const WELCOME_PLACEHOLDER_PREVIEW = "/welcome-placeholder-event-pic.svg";
const FAMILY_PREFETCH_LIMIT = 10;

const INITIAL_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  event_date: "",
  event_type: "",
  primary_text: "",
  secondary_text: "",
  instructions: ""
};

function formatPhotoCount(value: number | null) {
  if (!value) {
    return "Photos selon design";
  }

  return value > 1 ? `${value} photos` : "1 photo";
}

function formatPublishedDate(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(parsed);
}

function normalizeForScore(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getTemplateLayoutClass(layout: string, type?: string) {
  if (layout === "26strip") {
    return "is-strip";
  }

  if (layout === "46postcard-l" || type === "static_welcome_screen" || type === "animated_welcome_screen") {
    return "is-landscape";
  }

  return "is-portrait";
}

function formatSortRank(template: Pick<EventPicTemplate, "layout" | "no_of_images" | "type">) {
  if (template.type === "static_welcome_screen" || template.type === "animated_welcome_screen") {
    return 390;
  }

  if (template.type === "event_pic_placeholder_welcome") {
    return 399;
  }

  const layoutRanks: Record<string, number> = {
    "26strip": 0,
    "46postcard-p": 1,
    "46postcard-l": 2
  };
  const layoutRank = layoutRanks[template.layout] ?? 99;
  const photoRank = typeof template.no_of_images === "number" ? template.no_of_images : 99;

  return layoutRank * 100 + photoRank;
}

function buildTemplateApiUrl(format: EventPicFormatId, category: EventPicCategoryId, page: number) {
  return `/api/templates?${new URLSearchParams({
    format,
    category,
    page: String(page),
    per_page: "48"
  }).toString()}`;
}

function isWelcomeTemplate(
  template: Pick<EventPicTemplate, "type" | "type_name" | "name" | "layout" | "preview_url">
) {
  const type = template.type?.toLowerCase() ?? "";
  const typeName = template.type_name?.toLowerCase() ?? "";
  const name = template.name?.toLowerCase() ?? "";
  const layout = template.layout?.toLowerCase() ?? "";
  const preview = template.preview_url?.toLowerCase() ?? "";

  if (type === "static_welcome_screen" || type === "animated_welcome_screen") {
    return true;
  }

  return (
    typeName.includes("welcome") ||
    name.includes("welcome") ||
    layout.includes("welcome") ||
    preview.includes("welcome-screen")
  );
}

function isOptionalTemplate(template: EventPicTemplate) {
  if (isWelcomeTemplate(template) || template.type === "event_pic_placeholder_welcome") {
    return false;
  }

  if (template.layout === "26strip") {
    return true;
  }

  if (template.layout === "46postcard-p" || template.layout === "46postcard-l") {
    return template.no_of_images !== 1;
  }

  return false;
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

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined;
  }

  return { width, height };
}

function getWelcomeResolution(template: EventPicTemplate) {
  const width = typeof template.source_width === "number" ? template.source_width : null;
  const height = typeof template.source_height === "number" ? template.source_height : null;

  if (width && height) {
    return { width, height };
  }

  return (
    parseResolutionFromText(template.name) ??
    parseResolutionFromText(template.type_name) ??
    parseResolutionFromText(template.preview_url)
  );
}

function isResolution(template: EventPicTemplate, width: number, height: number) {
  const resolution = getWelcomeResolution(template);
  return Boolean(resolution && resolution.width === width && resolution.height === height);
}

function withWelcomeMetadata(
  template: EventPicTemplate,
  options: {
    sourceWidth: number | null;
    sourceHeight: number | null;
    requiresResize: boolean;
    placeholder: boolean;
    name?: string;
  }
): EventPicTemplate {
  return {
    ...template,
    name: options.name ?? template.name,
    format_label: "Fond d'ecran 1920x1080",
    placeholder: options.placeholder,
    requires_resize: options.requiresResize,
    source_width: options.sourceWidth,
    source_height: options.sourceHeight,
    target_width: TARGET_WELCOME_WIDTH,
    target_height: TARGET_WELCOME_HEIGHT
  };
}

function createWelcomePlaceholder(): EventPicTemplate {
  return {
    id: `event-pic-welcome-placeholder-${Date.now()}`,
    name: "Fond d'ecran Event Pic a preparer",
    preview_url: WELCOME_PLACEHOLDER_PREVIEW,
    layout: "welcome",
    format_label: "Fond d'ecran 1920x1080",
    no_of_images: null,
    type: "static_welcome_screen",
    type_name: "Welcome screen placeholder",
    published_at: null,
    placeholder: true,
    requires_resize: true,
    source_width: null,
    source_height: null,
    target_width: TARGET_WELCOME_WIDTH,
    target_height: TARGET_WELCOME_HEIGHT
  };
}

function createFormatPlaceholder(options: {
  id: string;
  name: string;
  formatLabel: string;
  layout: string;
  fallbackPreviewUrl: string;
}): EventPicTemplate {
  return {
    id: options.id,
    name: options.name,
    preview_url: options.fallbackPreviewUrl || "/template-previews/fallback.svg",
    layout: options.layout,
    format_label: options.formatLabel,
    no_of_images: 1,
    type: "event_pic_placeholder_format",
    type_name: "Placeholder format",
    published_at: null,
    placeholder: true,
    requires_resize: false,
    source_width: null,
    source_height: null,
    target_width: null,
    target_height: null
  };
}

function createLoadingRequiredCard(options: {
  id: string;
  formatLabel: string;
  layout: string;
  fallbackPreviewUrl: string;
}): EventPicTemplate {
  return {
    id: options.id,
    name: "Chargement du format...",
    preview_url: options.fallbackPreviewUrl || "/template-previews/fallback.svg",
    layout: options.layout,
    format_label: options.formatLabel,
    no_of_images: null,
    type: "event_pic_loading_placeholder",
    type_name: "Chargement",
    published_at: null,
    placeholder: true,
    requires_resize: false,
    source_width: null,
    source_height: null,
    target_width: null,
    target_height: null
  };
}

function isLoadingRequiredCard(template: EventPicTemplate) {
  return template.type === "event_pic_loading_placeholder";
}

function isWelcomeRequiredTemplate(template: EventPicTemplate) {
  return (
    template.type === "static_welcome_screen" ||
    template.type === "animated_welcome_screen" ||
    template.format_label === "Fond d'ecran 1920x1080" ||
    (template.placeholder === true && template.layout === "welcome")
  );
}

function familyCacheKey(template: Pick<EventPicTemplate, "id">, category: EventPicCategoryId) {
  return `${template.id}::${category}`;
}

function dedupeTemplates(templates: EventPicTemplate[]) {
  const map = new Map<string, EventPicTemplate>();

  for (const template of templates) {
    if (!map.has(template.id)) {
      map.set(template.id, template);
    }
  }

  return [...map.values()];
}

function scoreRequiredPortraitCandidate(template: EventPicTemplate) {
  const reasons: string[] = [];
  let score = 0;

  if (template.layout === "46postcard-p") {
    score += 120;
    reasons.push("layout_46postcard-p");
  }

  if (template.no_of_images === 1) {
    score += 120;
    reasons.push("1_photo");
  }

  const searchable = normalizeForScore(
    [template.name, template.type_name, template.preview_url, template.format_label].filter(Boolean).join(" ")
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

  return {
    score,
    reasons
  };
}

function resolveRequiredTemplates(
  variants: EventPicTemplate[],
  fallbackPreviewUrl: string,
  preferredRequiredPortraitId?: string | null
) {
  const requiredTemplates: EventPicTemplate[] = [];
  const messages: string[] = [];
  const portraitCandidates = variants.filter((template) => template.layout === "46postcard-p" && template.no_of_images === 1);
  const scoredPortraitCandidates = portraitCandidates
    .map((candidate) => ({
      candidate,
      scoring: scoreRequiredPortraitCandidate(candidate)
    }))
    .sort((first, second) => {
      const delta = second.scoring.score - first.scoring.score;

      if (delta !== 0) {
        return delta;
      }

      return first.candidate.name.localeCompare(second.candidate.name);
    });
  const portraitFromMapping = preferredRequiredPortraitId
    ? portraitCandidates.find((template) => template.id === preferredRequiredPortraitId)
    : undefined;
  const portrait = portraitFromMapping ?? scoredPortraitCandidates[0]?.candidate;
  const paysage = variants.find((template) => template.layout === "46postcard-l" && template.no_of_images === 1);

  if (portraitCandidates.length > 0) {
    console.info("[Event Pic] Portrait obligatoire diagnostic", {
      preferred_required_portrait_id: preferredRequiredPortraitId ?? null,
      candidates: scoredPortraitCandidates.map((item) => ({
        id: item.candidate.id,
        name: item.candidate.name,
        score: item.scoring.score,
        reasons: item.scoring.reasons
      })),
      selected_id: portrait?.id ?? null,
      selection_reason: portraitFromMapping
        ? "mapping_manuel"
        : portrait
          ? "grande_photo_detectee_ou_meilleur_score"
          : "fallback_placeholder"
    });
  }

  if (portrait) {
    requiredTemplates.push({ ...portrait, required: true, placeholder: false, requires_resize: false });
  } else {
    requiredTemplates.push(
      createFormatPlaceholder({
        id: `event-pic-placeholder-portrait-${Date.now()}`,
        name: "Portrait 10x15 / 4x6 a preparer",
        formatLabel: "Portrait 10x15 / 4x6",
        layout: "46postcard-p",
        fallbackPreviewUrl
      })
    );
    messages.push("Ce format sera prepare par Event Pic a partir du design selectionne.");
  }

  if (paysage) {
    requiredTemplates.push({ ...paysage, required: true, placeholder: false, requires_resize: false });
  } else {
    requiredTemplates.push(
      createFormatPlaceholder({
        id: `event-pic-placeholder-paysage-${Date.now()}`,
        name: "Paysage 10x15 / 4x6 a preparer",
        formatLabel: "Paysage 10x15 / 4x6",
        layout: "46postcard-l",
        fallbackPreviewUrl
      })
    );
    messages.push("Ce format sera prepare par Event Pic a partir du design selectionne.");
  }

  const welcomeCandidates = variants.filter((template) => isWelcomeTemplate(template));
  const welcome1920Touch = welcomeCandidates.find(
    (template) => isResolution(template, 1920, 1080) && isTouchToStartTemplate(template)
  );
  const welcome1920NoTouch = welcomeCandidates.find(
    (template) => isResolution(template, 1920, 1080) && !isTouchToStartTemplate(template)
  );
  const welcome1366Touch = welcomeCandidates.find(
    (template) => isResolution(template, 1366, 1024) && isTouchToStartTemplate(template)
  );
  const welcome1366NoTouch = welcomeCandidates.find(
    (template) => isResolution(template, 1366, 1024) && !isTouchToStartTemplate(template)
  );

  if (welcome1920Touch) {
    requiredTemplates.push(
      withWelcomeMetadata(welcome1920Touch, {
        sourceWidth: 1920,
        sourceHeight: 1080,
        requiresResize: false,
        placeholder: false
      })
    );
    messages.push("Welcome screen 1920x1080 - Touch to Start.");
  } else if (welcome1920NoTouch) {
    requiredTemplates.push(
      withWelcomeMetadata(welcome1920NoTouch, {
        sourceWidth: 1920,
        sourceHeight: 1080,
        requiresResize: false,
        placeholder: false
      })
    );
    messages.push("Welcome screen 1920x1080.");
  } else if (welcome1366Touch) {
    requiredTemplates.push(
      withWelcomeMetadata(welcome1366Touch, {
        sourceWidth: 1366,
        sourceHeight: 1024,
        requiresResize: true,
        placeholder: false
      })
    );
    messages.push("Source 1366x1024 - Touch to Start. Event Pic l'adaptera en 1920x1080.");
  } else if (welcome1366NoTouch) {
    requiredTemplates.push(
      withWelcomeMetadata(welcome1366NoTouch, {
        sourceWidth: 1366,
        sourceHeight: 1024,
        requiresResize: true,
        placeholder: false
      })
    );
    messages.push("Source 1366x1024 - Event Pic l'adaptera en 1920x1080.");
  } else {
    requiredTemplates.push(createWelcomePlaceholder());
    messages.push("Aucun welcome screen fiable trouve - creation Event Pic necessaire.");
  }

  return {
    requiredTemplates,
    messages
  };
}

function buildInitialFamilyState(template: EventPicTemplate): FamilyResolvedState {
  const initialRequiredTemplates: EventPicTemplate[] = [
    createLoadingRequiredCard({
      id: `event-pic-loading-portrait-${template.id}`,
      formatLabel: "Portrait 10x15 / 4x6",
      layout: "46postcard-p",
      fallbackPreviewUrl: template.preview_url
    }),
    createLoadingRequiredCard({
      id: `event-pic-loading-paysage-${template.id}`,
      formatLabel: "Paysage 10x15 / 4x6",
      layout: "46postcard-l",
      fallbackPreviewUrl: template.preview_url
    }),
    createWelcomePlaceholder()
  ];

  return {
    familyTemplates: initialRequiredTemplates,
    requiredIds: initialRequiredTemplates.map((requiredTemplate) => requiredTemplate.id),
    initialOptionalIds: [],
    familyMessage: "Chargement des formats disponibles..."
  };
}

function buildResolvedFamilyState(
  template: EventPicTemplate,
  variants: EventPicTemplate[],
  preferredRequiredPortraitId?: string | null
): FamilyResolvedState {
  const sortedVariants = (variants.length ? variants : [template]).slice().sort((a, b) => {
    return formatSortRank(a) - formatSortRank(b) || a.name.localeCompare(b.name);
  });
  const resolution = resolveRequiredTemplates(sortedVariants, template.preview_url, preferredRequiredPortraitId);
  const requiredIds = resolution.requiredTemplates.map((requiredTemplate) => requiredTemplate.id);
  const mergedFamilyTemplates = dedupeTemplates([...resolution.requiredTemplates, ...sortedVariants]).sort((a, b) => {
    return formatSortRank(a) - formatSortRank(b) || a.name.localeCompare(b.name);
  });
  const optionalLimit = Math.max(0, 5 - requiredIds.length);
  const initialOptionalIds =
    requiredIds.includes(template.id) || !isOptionalTemplate(template) ? [] : [template.id].slice(0, optionalLimit);

  return {
    familyTemplates: mergedFamilyTemplates,
    requiredIds,
    initialOptionalIds,
    familyMessage: resolution.messages.join(" ")
  };
}

function applyResolvedWelcomeToState(
  state: FamilyResolvedState,
  welcomeTemplate: EventPicTemplate
): FamilyResolvedState {
  const welcomeRequiredId = state.requiredIds.find((requiredId) => {
    const requiredTemplate = state.familyTemplates.find((candidate) => candidate.id === requiredId);
    return Boolean(requiredTemplate && isWelcomeRequiredTemplate(requiredTemplate));
  });

  if (!welcomeRequiredId) {
    return state;
  }

  const nextFamilyTemplates: EventPicTemplate[] = state.familyTemplates.map((candidate): EventPicTemplate =>
    candidate.id === welcomeRequiredId
      ? {
          ...welcomeTemplate,
          format_label: "Fond d'ecran 1920x1080",
          placeholder: false,
          production_needed: false,
          source_kind: "templatebooth" as const
        }
      : candidate
  );
  const nextRequiredIds = state.requiredIds.map((requiredId) =>
    requiredId === welcomeRequiredId ? welcomeTemplate.id : requiredId
  );

  return {
    ...state,
    familyTemplates: dedupeTemplates(nextFamilyTemplates),
    requiredIds: nextRequiredIds
  };
}

function stateNeedsWelcomeLookup(state: FamilyResolvedState) {
  return state.requiredIds.some((requiredId) => {
    const requiredTemplate = state.familyTemplates.find((template) => template.id === requiredId);
    return Boolean(
      requiredTemplate &&
        isWelcomeRequiredTemplate(requiredTemplate) &&
        isProductionTaskTemplate(requiredTemplate)
    );
  });
}

function selectedTemplateSubtitle(template: SelectedTemplateChoice) {
  if (isProductionTaskTemplate(template)) {
    return "Ce fond d'ecran sera prepare par Event Pic avant l'evenement.";
  }

  if (isWelcomeTemplate(template) && template.source_width === 1920 && template.source_height === 1080) {
    return isTouchToStartTemplate(template)
      ? "Welcome screen 1920x1080 - Touch to Start"
      : "Welcome screen 1920x1080";
  }

  if (isWelcomeTemplate(template) && template.source_width === 1366 && template.source_height === 1024) {
    return isTouchToStartTemplate(template)
      ? "Source 1366x1024 - Touch to Start. Event Pic l'adaptera en 1920x1080"
      : "Source 1366x1024 - Event Pic l'adaptera en 1920x1080";
  }

  if (template.requires_resize && template.source_width && template.source_height) {
    return `source ${template.source_width}x${template.source_height} - a adapter`;
  }

  if (template.requires_resize) {
    return "Source welcome screen disponible - a adapter en 1920x1080";
  }

  if (template.required && (template.type === "static_welcome_screen" || template.type === "animated_welcome_screen")) {
    return "1920x1080 disponible";
  }

  return formatPhotoCount(template.no_of_images);
}

function isProductionTaskTemplate(template: EventPicTemplate) {
  const withFlags = template as EventPicTemplate & {
    production_needed?: boolean;
    source_kind?: string;
  };

  return (
    template.placeholder === true ||
    withFlags.production_needed === true ||
    withFlags.source_kind === "event_pic_task"
  );
}

function containsTouchToStart(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = normalizeForScore(value);
  return (
    normalized.includes("touch to start") ||
    normalized.includes("touch-to-start") ||
    normalized.includes("touch_start") ||
    normalized.includes("start screen") ||
    normalized.includes("touchstart") ||
    normalized.includes("touch screen") ||
    normalized.includes("touch")
  );
}

function isTouchToStartTemplate(template: EventPicTemplate) {
  return (
    containsTouchToStart(template.name) ||
    containsTouchToStart(template.type_name) ||
    containsTouchToStart(template.preview_url)
  );
}

function requiredTemplateSubtitle(template: EventPicTemplate) {
  if (isProductionTaskTemplate(template)) {
    return "Ce fond d'ecran sera prepare par Event Pic avant l'evenement.";
  }

  if (isWelcomeTemplate(template) && template.source_width === 1920 && template.source_height === 1080) {
    return isTouchToStartTemplate(template)
      ? "Welcome screen 1920x1080 - Touch to Start"
      : "Welcome screen 1920x1080";
  }

  if (isWelcomeTemplate(template) && template.source_width === 1366 && template.source_height === 1024) {
    return isTouchToStartTemplate(template)
      ? "Source 1366x1024 - Touch to Start. Event Pic l'adaptera en 1920x1080"
      : "Source 1366x1024 - Event Pic l'adaptera en 1920x1080";
  }

  if (template.requires_resize && template.source_width && template.source_height) {
    return `Source ${template.source_width}x${template.source_height} - Event Pic l'adaptera en 1920x1080`;
  }

  if (template.requires_resize) {
    return "Source welcome screen disponible - Event Pic l'adaptera en 1920x1080";
  }

  if (isWelcomeTemplate(template) || template.format_label === "Fond d'ecran 1920x1080") {
    return "Fond d'ecran 1920x1080 inclus";
  }

  return formatPhotoCount(template.no_of_images);
}

function requiredTemplateBadge(template: EventPicTemplate) {
  if (isProductionTaskTemplate(template)) {
    return "OBLIGATOIRE - A CREER";
  }

  return "Inclus automatiquement";
}

export function TemplateGridClient() {
  const [selectedFormatId, setSelectedFormatId] = useState<EventPicFormatId>(EVENT_PIC_FORMATS[0].id);
  const [selectedCategoryId, setSelectedCategoryId] = useState<EventPicCategoryId>(EVENT_PIC_CATEGORIES[0].id);
  const [templates, setTemplates] = useState<EventPicTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<SelectedTemplateChoice[]>([]);
  const [familyRootTemplate, setFamilyRootTemplate] = useState<EventPicTemplate | null>(null);
  const [familyTemplates, setFamilyTemplates] = useState<EventPicTemplate[]>([]);
  const [requiredFamilyIds, setRequiredFamilyIds] = useState<string[]>([]);
  const [optionalFamilyIds, setOptionalFamilyIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<"api" | "local">("api");
  const [previewTemplate, setPreviewTemplate] = useState<EventPicTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFamilyLoading, setIsFamilyLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TemplateSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const hasPrefetchedRef = useRef(false);
  const familyCacheRef = useRef<Map<string, FamilyResolvedState>>(new Map());
  const familyInFlightRef = useRef<Map<string, Promise<FamilyResolvedState>>>(new Map());
  const welcomeCacheRef = useRef<Map<string, EventPicTemplate | null>>(new Map());
  const welcomeInFlightRef = useRef<Map<string, Promise<EventPicTemplate | null>>>(new Map());
  const activeFamilySessionRef = useRef<string | null>(null);
  const latestFamilyTemplatesRef = useRef<EventPicTemplate[]>([]);
  const latestRequiredFamilyIdsRef = useRef<string[]>([]);
  const selectedCategory = getEventPicCategory(selectedCategoryId);
  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const category of EVENT_PIC_CATEGORIES) {
      map.set(category.id, category.label);
    }

    return map;
  }, []);

  const requiredFamilyTemplates = useMemo(
    () => familyTemplates.filter((template) => requiredFamilyIds.includes(template.id)),
    [familyTemplates, requiredFamilyIds]
  );
  const optionalFamilyTemplates = useMemo(
    () => familyTemplates.filter((template) => !requiredFamilyIds.includes(template.id) && isOptionalTemplate(template)),
    [familyTemplates, requiredFamilyIds]
  );
  const selectedFamilyIds = useMemo(() => [...requiredFamilyIds, ...optionalFamilyIds], [requiredFamilyIds, optionalFamilyIds]);
  const totalSelectedFormats = selectedFamilyIds.length;
  const canContinueWithFamily =
    !isFamilyLoading && requiredFamilyIds.length === 3 && totalSelectedFormats >= 3 && totalSelectedFormats <= 5;
  const missingRequiredFormatCount = Math.max(0, 3 - totalSelectedFormats);
  const mobileFamilyActionStatus = isFamilyLoading
    ? "Chargement des formats..."
    : canContinueWithFamily
      ? "Pret a finaliser votre selection"
      : missingRequiredFormatCount > 0
        ? `${missingRequiredFormatCount} format${missingRequiredFormatCount > 1 ? "s" : ""} obligatoire${
            missingRequiredFormatCount > 1 ? "s" : ""
          } en attente`
        : "Les formats obligatoires doivent rester inclus";

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setMessage("");
      const apiUrl = buildTemplateApiUrl(selectedFormatId, selectedCategoryId, page);

      fetch(apiUrl)
        .then(async (response) => {
          const payload = (await response.json()) as TemplateResponse;

          if (!response.ok) {
            throw new Error(payload.error ?? "Chargement impossible.");
          }

          return payload;
        })
        .then((payload) => {
          if (cancelled) {
            return;
          }

          setTemplates((current) => (page === 1 ? payload.templates ?? [] : [...current, ...(payload.templates ?? [])]));
          setTotalPages(payload.total_pages ?? 1);
          setTotal(payload.total ?? payload.templates?.length ?? 0);
          setSource(payload.source ?? "api");

          if (!hasPrefetchedRef.current && page === 1) {
            hasPrefetchedRef.current = true;
            prefetchOtherFormats(selectedFormatId, selectedCategoryId);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          console.error("[Event Pic] Chargement templates", error);
          setMessage("Les templates ne sont pas disponibles pour le moment. Merci de reessayer dans quelques instants.");
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [selectedFormatId, selectedCategoryId, page]);

  useEffect(() => {
    latestFamilyTemplatesRef.current = familyTemplates;
    latestRequiredFamilyIdsRef.current = requiredFamilyIds;
  }, [familyTemplates, requiredFamilyIds]);

  useEffect(() => {
    if (templates.length === 0) {
      return;
    }

    let cancelled = false;
    const visibleTemplates = templates.slice(0, FAMILY_PREFETCH_LIMIT);

    const timeout = window.setTimeout(async () => {
      for (const template of visibleTemplates) {
        if (cancelled) {
          return;
        }

        try {
          await fetchFamilyState(template, selectedCategoryId);
        } catch (error) {
          console.warn("[Event Pic] Prechargement famille ignore", error);
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 90);
        });
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [templates, selectedCategoryId]);

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchMessage("");
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchMessage("");

      fetch(`/api/templates/search?${new URLSearchParams({ q: trimmed, limit: "24" }).toString()}`)
        .then(async (response) => {
          const payload = (await response.json()) as TemplateSearchResponse;

          if (!response.ok) {
            throw new Error(payload.error ?? "Recherche impossible.");
          }

          return payload;
        })
        .then((payload) => {
          if (cancelled) {
            return;
          }

          setSearchResults(payload.results ?? []);
          setSearchMessage((payload.results ?? []).length === 0 ? "Aucun template trouve." : "");
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          console.error("[Event Pic] Recherche templates", error);
          setSearchResults([]);
          setSearchMessage("Recherche indisponible pour le moment.");
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  function prefetchOtherFormats(currentFormatId: EventPicFormatId, currentCategoryId: EventPicCategoryId) {
    for (const format of EVENT_PIC_FORMATS) {
      if (format.id === currentFormatId) {
        continue;
      }

      fetch(buildTemplateApiUrl(format.id, currentCategoryId, 1)).catch((error) => {
        console.warn("[Event Pic] Prechargement template ignore", error);
      });
    }
  }

  function resetTemplateList(nextFormatId = selectedFormatId, nextCategoryId = selectedCategoryId) {
    setSelectedFormatId(nextFormatId);
    setSelectedCategoryId(nextCategoryId);
    setPage(1);
    setIsLoading(true);
    setSelectedTemplates([]);
    setFamilyRootTemplate(null);
    setRequiredFamilyIds([]);
    setOptionalFamilyIds([]);
    activeFamilySessionRef.current = null;
  }

  function applyFamilyResolvedState(state: FamilyResolvedState, options?: { preserveOptionalIds?: string[] }) {
    const optionalLimit = Math.max(0, 5 - state.requiredIds.length);
    const optionalFromState = state.initialOptionalIds.filter((id) => !state.requiredIds.includes(id));
    const optionalFromPreserved = (options?.preserveOptionalIds ?? []).filter(
      (id) => !state.requiredIds.includes(id) && state.familyTemplates.some((template) => template.id === id)
    );
    const nextOptionalIds = [...new Set([...optionalFromPreserved, ...optionalFromState])].slice(0, optionalLimit);

    setFamilyTemplates(state.familyTemplates);
    setRequiredFamilyIds(state.requiredIds);
    setOptionalFamilyIds(nextOptionalIds);
    setFamilyMessage(state.familyMessage);
  }

  async function fetchFamilyState(template: EventPicTemplate, category: EventPicCategoryId) {
    const cacheKey = familyCacheKey(template, category);
    const cached = familyCacheRef.current.get(cacheKey);

    if (cached) {
      return cached;
    }

    const inFlight = familyInFlightRef.current.get(cacheKey);

    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      const response = await fetch(`/api/templates/${encodeURIComponent(template.id)}/family`);
      const payload = (await response.json()) as TemplateFamilyResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Declinaisons indisponibles.");
      }

      const variants = payload.templates?.length ? payload.templates : [template];
      const resolved = buildResolvedFamilyState(template, variants, payload.preferredRequiredPortraitId);

      familyCacheRef.current.set(cacheKey, resolved);
      return resolved;
    })().finally(() => {
      familyInFlightRef.current.delete(cacheKey);
    });

    familyInFlightRef.current.set(cacheKey, request);
    return request;
  }

  async function fetchWelcomeCandidate(template: EventPicTemplate, category: EventPicCategoryId) {
    const cacheKey = familyCacheKey(template, category);

    if (welcomeCacheRef.current.has(cacheKey)) {
      return welcomeCacheRef.current.get(cacheKey) ?? null;
    }

    const inFlight = welcomeInFlightRef.current.get(cacheKey);

    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      const response = await fetch(
        `/api/templates/${encodeURIComponent(template.id)}/welcome?${new URLSearchParams({
          category
        }).toString()}`
      );
      const payload = (await response.json()) as TemplateWelcomeResponse;

      if (!response.ok || !payload.found || !payload.template) {
        welcomeCacheRef.current.set(cacheKey, null);
        return null;
      }

      welcomeCacheRef.current.set(cacheKey, payload.template);
      return payload.template;
    })().finally(() => {
      welcomeInFlightRef.current.delete(cacheKey);
    });

    welcomeInFlightRef.current.set(cacheKey, request);
    return request;
  }

  function replaceWelcomeInCurrentState(template: EventPicTemplate, category: EventPicCategoryId, welcomeTemplate: EventPicTemplate) {
    const cacheKey = familyCacheKey(template, category);
    const currentState: FamilyResolvedState = {
      familyTemplates: latestFamilyTemplatesRef.current,
      requiredIds: latestRequiredFamilyIdsRef.current,
      initialOptionalIds: optionalFamilyIds,
      familyMessage
    };
    const nextState = applyResolvedWelcomeToState(currentState, welcomeTemplate);

    familyCacheRef.current.set(cacheKey, nextState);
    setFamilyTemplates(nextState.familyTemplates);
    setRequiredFamilyIds(nextState.requiredIds);
  }

  async function resolveWelcomeInBackground(
    template: EventPicTemplate,
    category: EventPicCategoryId,
    sessionId: string
  ) {
    const welcomeTemplate = await fetchWelcomeCandidate(template, category).catch((error) => {
      console.warn("[Event Pic] Welcome screen non resolu", error);
      return null;
    });

    if (!welcomeTemplate || activeFamilySessionRef.current !== sessionId) {
      return;
    }

    replaceWelcomeInCurrentState(template, category, welcomeTemplate);
  }

  async function chooseTemplate(template: EventPicTemplate) {
    const sessionId = `${template.id}-${Date.now()}`;
    const category = selectedCategoryId;
    const cacheKey = familyCacheKey(template, category);
    activeFamilySessionRef.current = sessionId;
    setFamilyRootTemplate(template);
    setMessage("");
    setIsFamilyLoading(true);

    const cachedFamily = familyCacheRef.current.get(cacheKey);

    if (cachedFamily) {
      applyFamilyResolvedState(cachedFamily);
      setIsFamilyLoading(false);

      if (stateNeedsWelcomeLookup(cachedFamily)) {
        void resolveWelcomeInBackground(template, category, sessionId);
      }

      return;
    }

    const initialState = buildInitialFamilyState(template);
    applyFamilyResolvedState(initialState);

    try {
      const resolvedFamily = await fetchFamilyState(template, category);

      if (activeFamilySessionRef.current !== sessionId) {
        return;
      }

      applyFamilyResolvedState(resolvedFamily, { preserveOptionalIds: optionalFamilyIds });

      if (stateNeedsWelcomeLookup(resolvedFamily)) {
        void resolveWelcomeInBackground(template, category, sessionId);
      }
    } catch (error) {
      if (activeFamilySessionRef.current !== sessionId) {
        return;
      }

      console.error("[Event Pic] Chargement famille template", error);
      setFamilyMessage("Les declinaisons ne sont pas disponibles pour le moment. Merci de reessayer.");
    } finally {
      if (activeFamilySessionRef.current === sessionId) {
        setIsFamilyLoading(false);
      }
    }
  }

  function toggleOptionalTemplate(template: EventPicTemplate) {
    setOptionalFamilyIds((current) => {
      if (current.includes(template.id)) {
        return current.filter((id) => id !== template.id);
      }

      const nextTotal = requiredFamilyIds.length + current.length + 1;

      if (nextTotal > 5) {
        setFamilyMessage("Vous pouvez selectionner jusqu'a 5 formats maximum.");
        return current;
      }

      setFamilyMessage((previous) =>
        previous === "Vous pouvez selectionner jusqu'a 5 formats maximum." ? "" : previous
      );
      return [...current, template.id];
    });
  }

  function continueWithSelectedFormats() {
    if (!canContinueWithFamily) {
      setFamilyMessage("Les formats obligatoires doivent rester inclus pour continuer.");
      return;
    }

    const selectedSet = new Set(selectedFamilyIds);
    const requiredSet = new Set(requiredFamilyIds);
    const nextSelectedTemplates: SelectedTemplateChoice[] = familyTemplates
      .filter((template) => selectedSet.has(template.id))
      .map((template) => ({
        ...template,
        required: requiredSet.has(template.id),
        placeholder: Boolean(template.placeholder),
        requires_resize: Boolean(template.requires_resize),
        target_width: template.target_width ?? TARGET_WELCOME_WIDTH,
        target_height: template.target_height ?? TARGET_WELCOME_HEIGHT
      }))
      .sort((a, b) => {
        if (a.required !== b.required) {
          return a.required ? -1 : 1;
        }

        return formatSortRank(a) - formatSortRank(b) || a.name.localeCompare(b.name);
      });

    setSelectedTemplates(nextSelectedTemplates);
    setFamilyRootTemplate(null);
    activeFamilySessionRef.current = null;
    setFamilyMessage("");
    setForm((current) => ({
      ...current,
      event_type: selectedCategory.id === "all" ? current.event_type : selectedCategory.label
    }));

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requiredCount = selectedTemplates.filter((template) => template.required).length;

    if (selectedTemplates.length < 3 || selectedTemplates.length > 5 || requiredCount !== 3) {
      setMessage("Les formats obligatoires doivent etre inclus dans la demande.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/template-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone
          },
          event: {
            date: form.event_date,
            type: form.event_type
          },
          selected_templates: selectedTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            preview_url: template.preview_url,
            layout: template.layout,
            format_label: template.format_label,
            no_of_images: template.no_of_images,
            type: template.type,
            type_name: template.type_name,
            required: template.required,
            placeholder: template.placeholder,
            production_needed: isProductionTaskTemplate(template),
            source_kind: isProductionTaskTemplate(template) ? "event_pic_task" : "templatebooth",
            requires_resize: template.requires_resize,
            source_width: template.source_width ?? null,
            source_height: template.source_height ?? null,
            target_width: template.target_width,
            target_height: template.target_height
          })),
          customization: {
            main_text: form.primary_text,
            secondary_text: form.secondary_text,
            notes: form.instructions
          }
        })
      });
      const payload = (await response.json()) as TemplateRequestResponse;

      if (!response.ok || !payload.request) {
        setMessage(payload.error ?? "Impossible d'envoyer la demande.");
        return;
      }

      window.location.href = `/confirmation?request=${encodeURIComponent(payload.request.id)}`;
    } catch (error) {
      console.error("[Event Pic] Envoi demande", error);
      setMessage("Impossible d'envoyer la demande pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="format-reminder premium-section premium-card" aria-labelledby="formats-title">
        <div className="section-heading">
          <p>Formats Event Pic</p>
          <h2 id="formats-title">Choisissez votre format</h2>
        </div>
        <div className="format-reminder-grid" role="group" aria-label="Filtres de formats Event Pic">
          {EVENT_PIC_FORMATS.map((format) => (
            <button
              className={format.id === selectedFormatId ? "format-filter-button is-active" : "format-filter-button"}
              disabled={isLoading}
              key={format.id}
              onClick={() => resetTemplateList(format.id, selectedCategoryId)}
              type="button"
            >
              <span>{format.badge}</span>
              {format.label}
            </button>
          ))}
        </div>
      </section>

      <section className="category-filter-panel premium-section premium-card" aria-labelledby="categories-title">
        <div className="section-heading">
          <p>Affinez la selection</p>
          <h2 id="categories-title">Thème de l’événement</h2>
        </div>
        <div className="category-segment-list" role="group" aria-label="Filtres de themes Event Pic">
          {EVENT_PIC_CATEGORIES.map((category) => (
            <button
              className={category.id === selectedCategoryId ? "category-segment-button is-active" : "category-segment-button"}
              disabled={isLoading}
              key={category.id}
              onClick={() => resetTemplateList(selectedFormatId, category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="template-search-panel premium-section premium-card" aria-labelledby="template-search-title">
        <div className="section-heading">
          <p>Diagnostic rapide</p>
          <h2 id="template-search-title">Recherche template</h2>
        </div>
        <label className="template-search-input-wrap">
          <span>Nom du template</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un template par nom..."
            aria-label="Rechercher un template par nom"
          />
        </label>
        {searchLoading ? <p className="catalog-loader">Recherche en cours...</p> : null}
        {searchMessage ? <p className="notice">{searchMessage}</p> : null}
        {searchResults.length > 0 ? (
          <div className="template-search-results">
            {searchResults.map((result) => (
              <article key={`search-${result.id}`} className="template-search-card">
                <img alt={`Apercu ${result.name}`} src={result.preview_url} loading="lazy" decoding="async" />
                <div>
                  <strong>{result.name}</strong>
                  <small>{`${result.format_label} - ${formatPhotoCount(result.no_of_images)}`}</small>
                  <small>
                    {`Categorie actuelle: ${
                      result.primary_category ? (categoryLabelMap.get(result.primary_category) ?? result.primary_category) : "Non classe"
                    }`}
                  </small>
                  <small>{`Formats disponibles: ${result.available_formats.join(", ") || "-"}`}</small>
                  <small>
                    {`Categories detectees: ${
                      result.matched_categories.length > 0
                        ? result.matched_categories.map((id) => categoryLabelMap.get(id) ?? id).join(", ")
                        : "Aucune"
                    }`}
                  </small>
                  <small>{`Recherche: ${result.reason}`}</small>
                  <small>{`Classement: ${result.classification_reason}`}</small>
                </div>
                <button type="button" className="modal-secondary-button" onClick={() => setPreviewTemplate(result.template)}>
                  Voir ce template
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="widget-frame-section event-pic-grid-section premium-section premium-card" aria-labelledby="template-grid-title" aria-busy={isLoading}>
        <div className="widget-frame-heading">
          <div>
            <p className="eyebrow">Selection du design</p>
            <h2 id="template-grid-title">Votre espace de personnalisation</h2>
          </div>
          <p>
            Selectionnez un design, puis choisissez les declinaisons souhaitees. Event Pic preparera votre template avec
            les textes fournis et verifiera le rendu avant votre evenement.
          </p>
        </div>

        <div className="catalog-toolbar">
          <span>{`${total || templates.length} templates disponibles`}</span>
          {isLoading ? <span className="catalog-loader">Chargement des modeles...</span> : null}
          {source === "local" ? <span className="catalog-source">Catalogue local de secours</span> : null}
        </div>

        {message ? <p className="notice">{message}</p> : null}

        {templates.length > 0 ? (
          <div className={`template-grid event-pic-template-grid grid-${selectedFormatId}`}>
            {templates.map((template) => (
              <article
                className={`template-card event-pic-template-card ${getTemplateLayoutClass(template.layout, template.type)}`}
                key={template.id}
              >
                <div className="template-card-media">
                  <button className="template-preview-button" type="button" onClick={() => setPreviewTemplate(template)}>
                    <img alt={`Apercu ${template.name}`} src={template.preview_url} loading="lazy" decoding="async" />
                  </button>
                </div>
                <div className="template-card-copy">
                  <span className="badge template-format-badge">{template.format_label}</span>
                  <strong>{template.name}</strong>
                  <small>{formatPhotoCount(template.no_of_images)}</small>
                  <small>
                    {[template.type_name, formatPublishedDate(template.published_at)].filter(Boolean).join(" - ")}
                  </small>
                </div>
                <button className="choose-template-button" type="button" onClick={() => chooseTemplate(template)}>
                  Choisir ce template
                </button>
              </article>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="empty-state">
            Aucun template trouve pour cette combinaison. Essayez le format seul ou choisissez une autre categorie.
          </div>
        ) : null}

        {page < totalPages ? (
          <div className="pagination-row">
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={isLoading}>
              {isLoading && page > 1 ? "Chargement..." : "Charger plus"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="form-section template-request-panel premium-section premium-card" ref={formRef} aria-labelledby="request-form-title">
        {selectedTemplates.length > 0 ? (
          <>
            <div className="selected-template-summary selected-template-summary-wide">
              <div className="selected-template-list">
                {selectedTemplates.map((template) => (
                  <article key={template.id} className={`selected-template-chip ${getTemplateLayoutClass(template.layout, template.type)}`}>
                    <img alt={`Apercu ${template.name}`} src={template.preview_url} loading="lazy" decoding="async" />
                    <div>
                      <strong>{template.format_label}</strong>
                      <small>{template.name}</small>
                      <small>{selectedTemplateSubtitle(template)}</small>
                      {template.required ? (
                        <span className="auto-included-pill">
                          {isProductionTaskTemplate(template) ? "OBLIGATOIRE - A CREER" : "Inclus automatiquement"}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <div>
                <p className="eyebrow">Formats selectionnes</p>
                <h2 id="request-form-title">Finaliser votre demande</h2>
                <p>{selectedTemplates.map((template) => template.format_label).join(" | ")}</p>
              </div>
            </div>

            <p className="client-guidance">
              Event Pic preparera votre template avec les textes fournis et verifiera le rendu avant votre evenement.
            </p>

            <form className="customization-form" onSubmit={submitRequest}>
              <label>
                Prenom
                <input
                  required
                  value={form.first_name}
                  onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
                />
              </label>
              <label>
                Nom
                <input
                  required
                  value={form.last_name}
                  onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                Telephone
                <input
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Date evenement
                <input
                  required
                  type="date"
                  value={form.event_date}
                  onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
                />
              </label>
              <label>
                Type evenement
                <select
                  required
                  value={form.event_type}
                  onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}
                >
                  <option value="">Choisir</option>
                  {EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide-field">
                Texte principal
                <input
                  required
                  value={form.primary_text}
                  onChange={(event) => setForm((current) => ({ ...current, primary_text: event.target.value }))}
                />
              </label>
              <label className="wide-field">
                Texte secondaire
                <input
                  value={form.secondary_text}
                  onChange={(event) => setForm((current) => ({ ...current, secondary_text: event.target.value }))}
                />
              </label>
              <label className="wide-field">
                Consignes particulieres
                <textarea
                  rows={4}
                  value={form.instructions}
                  onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
                />
              </label>
              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Envoi..." : "Envoyer ma demande"}
              </button>
            </form>
          </>
        ) : (
          <div className="empty-state">Choisissez un template pour selectionner les formats souhaites.</div>
        )}
      </section>

      {familyRootTemplate ? (
        <div className="template-preview-modal" role="dialog" aria-modal="true" aria-labelledby="template-family-title">
          <div className={`template-preview-dialog template-family-dialog ${getTemplateLayoutClass(familyRootTemplate.layout, familyRootTemplate.type)}`}>
            <div className="template-preview-heading">
              <div>
                <span className="badge template-format-badge">{familyRootTemplate.format_label}</span>
                <h2 id="template-family-title">{familyRootTemplate.name}</h2>
                <p>Selectionnez les formats souhaites pour votre evenement.</p>
              </div>
              <button
                className="modal-close-button"
                type="button"
                onClick={() => {
                  activeFamilySessionRef.current = null;
                  setFamilyRootTemplate(null);
                }}
              >
                Fermer
              </button>
            </div>

            <div className="template-family-layout">
              <div className="template-preview-large-frame">
                <img
                  alt={`Apercu agrandi ${familyRootTemplate.name}`}
                  src={familyRootTemplate.preview_url}
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="template-family-options">
                {isFamilyLoading ? <p className="catalog-loader">Chargement des formats disponibles...</p> : null}
                {familyMessage ? <p className="notice">{familyMessage}</p> : null}

                <div className="template-family-section">
                  <h3>Formats inclus automatiquement</h3>
                  <p className="family-section-note">
                    Portrait 10x15 / 4x6 (1 photo), Paysage 10x15 / 4x6 (1 photo) et Fond d'ecran 1920x1080.
                  </p>
                  {requiredFamilyTemplates.length > 0 ? (
                    <div className="template-family-grid required-grid">
                      {requiredFamilyTemplates.map((template) => {
                        const isManualProduction = isProductionTaskTemplate(template);
                        const isLoadingCard = isLoadingRequiredCard(template);

                        return (
                          <article
                            className={`template-family-card is-required ${isWelcomeRequiredTemplate(template) ? "is-welcome-card" : ""} ${getTemplateLayoutClass(template.layout, template.type)}`}
                            key={template.id}
                          >
                            {!isManualProduction && !isLoadingCard ? (
                              <span className="template-family-check" aria-hidden="true">
                                OK
                              </span>
                            ) : null}
                            {isLoadingCard ? (
                              <div className="required-template-skeleton" aria-hidden="true">
                                <span />
                              </div>
                            ) : (
                              <img alt={`Apercu ${template.name}`} src={template.preview_url} loading="eager" decoding="async" />
                            )}
                            <strong>{isManualProduction ? "Fond d'ecran 1920x1080" : template.format_label}</strong>
                            <span className="auto-included-pill">
                              {isLoadingCard ? "Chargement..." : requiredTemplateBadge(template)}
                            </span>
                            <small>
                              {isLoadingCard
                                ? "Recuperation du format obligatoire..."
                                : isManualProduction
                                  ? "Creation Event Pic a partir du design selectionne."
                                  : template.name}
                            </small>
                            <small>
                              {isLoadingCard ? "Chargement des formats disponibles..." : requiredTemplateSubtitle(template)}
                            </small>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-state">Les formats obligatoires ne sont pas disponibles pour ce modele.</p>
                  )}
                </div>

                <div className="template-family-section">
                  <h3>Formats optionnels</h3>
                  <p className="family-section-note">Vous pouvez ajouter jusqu'a 2 formats optionnels supplementaires.</p>
                  {optionalFamilyTemplates.length > 0 ? (
                    <div className="template-family-grid">
                      {optionalFamilyTemplates.map((template) => {
                        const isSelected = optionalFamilyIds.includes(template.id);
                        const isDisabled = !isSelected && totalSelectedFormats >= 5;

                        return (
                          <button
                            className={`${isSelected ? "template-family-card is-selected" : "template-family-card"} ${getTemplateLayoutClass(template.layout, template.type)}`}
                            disabled={isDisabled}
                            key={template.id}
                            onClick={() => toggleOptionalTemplate(template)}
                            type="button"
                          >
                            <span className="template-family-check" aria-hidden="true">
                              {isSelected ? "OK" : ""}
                            </span>
                            <img alt={`Apercu ${template.name}`} src={template.preview_url} loading="lazy" decoding="async" />
                            <strong>{template.format_label}</strong>
                            <small>{template.name}</small>
                            <small>{formatPhotoCount(template.no_of_images)}</small>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-state">Aucune declinaison optionnelle disponible pour ce modele.</p>
                  )}
                </div>

                <p className="selection-limit">{totalSelectedFormats} / 5 formats selectionnes</p>
                {!isFamilyLoading &&
                requiredFamilyTemplates.some(
                  (template) => template.placeholder || template.requires_resize
                ) ? (
                  <p className="family-section-note">
                    Ce format sera prepare par Event Pic a partir du design selectionne.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="template-preview-actions">
              <button className="submit-button" type="button" disabled={!canContinueWithFamily} onClick={continueWithSelectedFormats}>
                Continuer avec ces formats
              </button>
              <button
                className="modal-secondary-button"
                type="button"
                onClick={() => {
                  activeFamilySessionRef.current = null;
                  setFamilyRootTemplate(null);
                }}
              >
                Fermer
              </button>
            </div>

          </div>
          <div className="template-family-mobile-action" aria-live="polite">
            <div className="template-family-mobile-action-copy">
              <strong>{totalSelectedFormats} / 5 formats selectionnes</strong>
              <span>{mobileFamilyActionStatus}</span>
            </div>
            <button className="submit-button" type="button" disabled={!canContinueWithFamily} onClick={continueWithSelectedFormats}>
              Continuer avec ces formats
            </button>
          </div>
        </div>
      ) : null}

      {previewTemplate ? (
        <div className="template-preview-modal" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
          <div className={`template-preview-dialog ${getTemplateLayoutClass(previewTemplate.layout, previewTemplate.type)}`}>
            <div className="template-preview-heading">
              <div>
                <span className="badge template-format-badge">{previewTemplate.format_label}</span>
                <h2 id="template-preview-title">{previewTemplate.name}</h2>
              </div>
              <button className="modal-close-button" type="button" onClick={() => setPreviewTemplate(null)}>
                Fermer
              </button>
            </div>
            <div className="template-preview-large-frame">
              <img alt={`Apercu agrandi ${previewTemplate.name}`} src={previewTemplate.preview_url} loading="eager" decoding="async" />
            </div>
            <div className="template-preview-actions">
              <button
                className="submit-button"
                type="button"
                onClick={() => {
                  chooseTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
              >
                Choisir ce template
              </button>
              <button className="modal-secondary-button" type="button" onClick={() => setPreviewTemplate(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


