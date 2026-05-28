"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EVENT_PIC_CATEGORIES,
  EventPicAiPreparation,
  EventPicAiPreparationStatus,
  EventPicSelectedTemplate,
  EventPicTemplateRequest,
  EventPicTemplateRequestStatus,
  TEMPLATE_REQUEST_STATUSES,
  getEventPicTemplateRequestStatusLabel
} from "@/src/shared/eventPicTemplates";
import { BrandLogo } from "@/app/components/BrandLogo";

type RequestsResponse = {
  requests?: EventPicTemplateRequest[];
  error?: string;
};

type PatchResponse = {
  request?: EventPicTemplateRequest;
  error?: string;
};

type SyncResponse = {
  ok?: boolean;
  lastSync?: string;
  count?: number;
  cacheComplete?: boolean;
  lastFullSync?: string | null;
  totalKnownTemplates?: number;
  totalByLayout?: Record<string, number>;
  familyCount?: number;
  toReviewCount?: number;
  validatedCount?: number;
  ignoredCount?: number;
  error?: string;
};

type CanvaResponse = {
  ok?: boolean;
  message?: string;
  request?: EventPicTemplateRequest;
  error?: string;
};

type AiResponse = {
  ok?: boolean;
  message?: string;
  request?: EventPicTemplateRequest;
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

type PreferredPortraitResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type WelcomeDiagnosticCandidate = {
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
  touch_to_start?: boolean;
  is_landscape?: boolean;
};

type WelcomeDiagnosticResponse = {
  selectedTemplate: {
    id: string;
    name: string;
    post_url?: string;
    normalized_family_name: string;
  };
  apiQueries: Array<{
    url: string;
    count: number;
    candidates: WelcomeDiagnosticCandidate[];
  }>;
  welcomeCandidates: WelcomeDiagnosticCandidate[];
  bestCandidate: WelcomeDiagnosticCandidate | null;
  bestCandidateSource?: "api" | "same_pack_cache" | "manual_override" | null;
  conclusion: string;
  error?: string;
};

type ManualWelcomeInput = {
  family_key: string;
  template_id: string;
  post_url: string;
  welcome_screen_url: string;
  welcome_preview_url: string;
  welcome_source_size: "1366x1024" | "1920x1080";
  welcome_target_size: "1920x1080";
  welcome_touch_to_start: boolean;
  welcome_source_note: string;
};

type AdminTemplateSearchResult = {
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
};

type AdminTemplateSearchResponse = {
  query: string;
  total: number;
  results: AdminTemplateSearchResult[];
  error?: string;
};

type TemplateSourceLinkEntry = {
  family_key?: string;
  template_id?: string;
  template_name?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string;
  updated_at?: string;
  canva_source?: "templatebooth_api" | "templatebooth_harvester" | "manual" | "admin_manual" | "not_provided_by_api";
  canva_detected_at?: string;
  canva_folder_url?: string;
  canva_folder_source?: "templatebooth_api" | "templatebooth_harvester" | "manual" | "admin_manual";
  canva_folder_detected_at?: string;
  post_url?: string;
  canva_template_url?: string;
  psd_source_url?: string;
  zip_url?: string;
  notes?: string;
};

type TemplateSourceLinksResponse = {
  ok?: boolean;
  links?: TemplateSourceLinkEntry[];
  entry?: TemplateSourceLinkEntry;
  message?: string;
  error?: string;
};

type CanvaImportPendingItem = {
  id: string;
  source: "templatebooth_harvester";
  link_type: "folder_global" | "format_link" | "unknown";
  template_id?: string;
  template_name: string;
  source_page_url?: string;
  page_url: string;
  parent_templatebooth_url?: string;
  parent_canva_folder_url?: string;
  section_title?: string;
  card_index?: number;
  image_src?: string;
  image_alt?: string;
  image_width?: number;
  image_height?: number;
  image_ratio?: string;
  button_text?: string;
  canva_url: string;
  canva_folder_url?: string;
  canva_template_url?: string;
  detected_format: string;
  detected_layout: string;
  detected_no_of_images: string;
  confidence: "high" | "medium" | "low";
  nearby_text: string;
  detected_at: string;
  status: "pending" | "resolved" | "ignored";
  suggested_template_id?: string;
  suggested_template_name?: string;
  suggested_format_label?: string;
  suggested_layout?: string;
  suggested_no_of_images?: string;
  suggested_post_url?: string;
  suggested_family_key?: string;
  match_score?: number;
  match_reason?: string;
  created_at: string;
  updated_at: string;
  resolved_template_id?: string;
  resolved_format_label?: string;
  resolved_layout?: string;
  resolved_no_of_images?: string;
  resolved_family_key?: string;
};

type CanvaImportPendingResponse = {
  ok?: boolean;
  items?: CanvaImportPendingItem[];
  pending?: CanvaImportPendingItem;
  saved?: TemplateSourceLinkEntry;
  proposals?: CanvaAutoAssociationProposal[];
  results?: Array<{
    pending_id: string;
    ok: boolean;
    error?: string;
  }>;
  error?: string;
};

type CanvaAutoAssociationProposal = {
  pending_id: string;
  order_index: number;
  canva_url: string;
  page_url: string;
  section_title?: string;
  card_index?: number;
  template_name: string;
  proposed_template_id: string;
  proposed_template_name: string;
  proposed_format_label: string;
  proposed_layout: string;
  proposed_no_of_images: string;
  proposed_family_key: string;
  proposed_post_url?: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type RawTemplateDiagnosticMatch = {
  path: string;
  key: string;
  value: string;
};

type RawTemplateDiagnosticResponse = {
  selectedTemplate: {
    templateId?: string;
    name?: string;
    postUrl?: string;
    search?: string;
  };
  checked_at?: string;
  diagnostic_status?: "found" | "not_found" | "rate_limited";
  cache?: {
    hit: boolean;
    forced_refresh: boolean;
    checked_at: string | null;
    status: "found" | "not_found" | "rate_limited" | null;
    age_minutes: number | null;
  };
  queryInfo: {
    url: string;
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    searchedPages: number;
    requests_used?: number;
  };
  apiQueries?: Array<{
    label: string;
    url: string;
    count: number;
    total: number;
    total_pages: number;
    pages_searched: number;
    requests_used?: number;
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
  }>;
  rawTemplate: Record<string, unknown> | null;
  availableKeys: string[];
  allKeyPaths?: string[];
  inspectedFieldsCount?: number;
  matchingFields: RawTemplateDiagnosticMatch[];
  valueHints?: string[];
  canvaDetection: {
    found?: boolean;
    canva_url?: string | null;
    key_path?: string | null;
    url: string | null;
    source: "templatebooth_api" | "not_provided_by_api";
    confidence: "high" | "medium" | "low";
    reason?: string;
    match_path?: string;
    candidates: string[];
  };
  sourceFilesDetection?: {
    psd_url: string | null;
    zip_url: string | null;
    source_file_url: string | null;
    png_url: string | null;
    found: boolean;
    key_paths: string[];
    source: "templatebooth_api" | "not_provided_by_api";
  };
  source_files_conclusion?: string;
  conclusion: string;
  error?: string;
};

type HarvestCanvaResponse = {
  ok?: boolean;
  status?: "completed" | "pending_login" | "no_links_found" | "error";
  code?: string;
  found_links?: number;
  imported_links?: number;
  pending_links?: number;
  message?: string;
  details?: string;
  help?: string;
  manual_commands?: string[];
  debug_commands?: string[];
  debug?: {
    loggedInLikely?: boolean | "uncertain";
    pageTitle?: string;
    currentUrl?: string;
    canvaTextFound?: boolean;
    editButtonsFound?: number;
    canvaLinksDetected?: number;
    linksScanned?: number;
    buttonsScanned?: number;
    buttonTexts?: string[];
    screenshotPath?: string;
    htmlPath?: string;
  } | null;
  error?: string;
};

type HarvestCanvaFeedback = {
  tone: "info" | "success" | "error";
  message: string;
  details?: string;
  help?: string;
  manualCommands?: string[];
  debugLines?: string[];
};

type AdminRequestDetailTab = "resume" | "formats" | "canva" | "sources" | "ia" | "historique";

const ADMIN_REQUEST_DETAIL_TABS: Array<{ id: AdminRequestDetailTab; label: string }> = [
  { id: "resume", label: "Resume" },
  { id: "formats", label: "Formats" },
  { id: "canva", label: "Canva" },
  { id: "sources", label: "Sources" },
  { id: "ia", label: "IA" },
  { id: "historique", label: "Historique" }
];

const WELCOME_PLACEHOLDER_PREVIEW = "/welcome-placeholder-event-pic.svg";
const LOCAL_CANVA_HARVESTER_FALLBACK_COMMANDS = [
  'cd /d "C:\\Users\\vinc7\\Documents\\Codex\\2026-05-05\\analyse-mon-projet-et-pr-pare\\tools\\templatebooth-canva-harvester"',
  "npm.cmd install",
  "npm.cmd run harvest"
];
const LOCAL_CANVA_HARVESTER_DEBUG_COMMANDS = [
  'cd /d "C:\\Users\\vinc7\\Documents\\Codex\\2026-05-05\\analyse-mon-projet-et-pr-pare\\tools\\templatebooth-canva-harvester"',
  "npm.cmd run harvest -- --debug --keep-open"
];
const DEFAULT_AI_PREPARATION: EventPicAiPreparation = {
  status: "not_started",
  started_at: null,
  completed_at: null,
  error_message: null,
  progress_label: null,
  brief: null,
  checklist: [],
  generated_files: []
};

function yesNoUnknown(value: boolean | "uncertain" | undefined) {
  if (value === true) {
    return "oui";
  }
  if (value === false) {
    return "non";
  }
  return "incertain";
}

function buildHarvesterDebugLines(debug: HarvestCanvaResponse["debug"]) {
  if (!debug) {
    return [] as string[];
  }

  return [
    `Connecte a TemplateBooth : ${yesNoUnknown(debug.loggedInLikely)}`,
    `Boutons Canva detectes : ${debug.editButtonsFound ?? 0}`,
    `Liens Canva detectes : ${debug.canvaLinksDetected ?? 0}`,
    `Liens scannes : ${debug.linksScanned ?? 0}`,
    `Boutons scannes : ${debug.buttonsScanned ?? 0}`,
    `Texte Canva detecte dans la page : ${debug.canvaTextFound ? "oui" : "non"}`,
    `Titre page : ${debug.pageTitle || "-"}`,
    `URL actuelle : ${debug.currentUrl || "-"}`,
    `Capture debug disponible : ${debug.screenshotPath || "-"}`,
    `HTML debug disponible : ${debug.htmlPath || "-"}`
  ];
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function formatDateTimeWithAt(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} à ${hours}:${minutes}`;
}

function clientName(request: EventPicTemplateRequest) {
  return `${request.client.first_name} ${request.client.last_name}`.trim();
}

function splitTemplates(templates: EventPicSelectedTemplate[]) {
  return {
    required: templates.filter((template) => template.required),
    optional: templates.filter((template) => !template.required)
  };
}

function isWelcomeTemplate(template: EventPicSelectedTemplate) {
  return (
    template.type === "static_welcome_screen" ||
    template.type === "animated_welcome_screen" ||
    template.format_label.includes("Fond d'ecran")
  );
}

function containsTouchToStart(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return (
    normalized.includes("touch to start") ||
    normalized.includes("touch-to-start") ||
    normalized.includes("start screen") ||
    normalized.includes("touchstart")
  );
}

function isTouchToStartTemplate(template: EventPicSelectedTemplate) {
  return (
    containsTouchToStart(template.name) ||
    containsTouchToStart(template.type_name) ||
    containsTouchToStart(template.preview_url) ||
    containsTouchToStart(template.post_url)
  );
}

function isProductionTaskTemplate(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
  const withFlags = template as EventPicSelectedTemplate & {
    production_needed?: boolean;
    source_kind?: string;
  };

  return (
    template.placeholder === true ||
    shouldTreatWelcomeAsPlaceholder(request, template) ||
    withFlags.production_needed === true ||
    withFlags.source_kind === "event_pic_task"
  );
}

function shouldTreatWelcomeAsPlaceholder(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
  if (!template.required || !isWelcomeTemplate(template)) {
    return false;
  }

  if (template.placeholder) {
    return true;
  }

  return request.selected_templates.some((candidate) => {
    if (candidate.id === template.id) {
      return false;
    }

    return !isWelcomeTemplate(candidate) && candidate.preview_url === template.preview_url;
  });
}

function adminPreviewUrl(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
  if (isProductionTaskTemplate(request, template)) {
    return WELCOME_PLACEHOLDER_PREVIEW;
  }

  return template.preview_url || WELCOME_PLACEHOLDER_PREVIEW;
}

function welcomeStatus(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
  if (!isWelcomeTemplate(template) && template.type !== "event_pic_placeholder_welcome") {
    return null;
  }

  if (isProductionTaskTemplate(request, template)) {
    return "Fond d'ecran 1920x1080 - a creer par Event Pic";
  }

  if (template.source_width === 1920 && template.source_height === 1080) {
    return isTouchToStartTemplate(template)
      ? "Welcome screen 1920x1080 - Touch to Start"
      : "Welcome screen 1920x1080";
  }

  if (template.source_width === 1366 && template.source_height === 1024) {
    return isTouchToStartTemplate(template)
      ? "Source 1366x1024 - Touch to Start. Event Pic l'adaptera en 1920x1080"
      : "Source 1366x1024 - Event Pic l'adaptera en 1920x1080";
  }

  if (template.requires_resize && template.source_width && template.source_height) {
    return `Source welcome screen disponible - ${template.source_width}x${template.source_height} a adapter en 1920x1080`;
  }

  if (template.requires_resize) {
    return "Source welcome screen disponible - Event Pic l'adaptera en 1920x1080.";
  }

  return "Fond d'ecran 1920x1080 inclus";
}

function compactFormatLabel(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
  if (isWelcomeTemplate(template) || template.type === "event_pic_placeholder_welcome") {
    return isProductionTaskTemplate(request, template) ? "Welcome - a creer" : "Welcome";
  }

  let base = template.format_label;

  if (template.layout === "26strip") {
    base = "2x6";
  } else if (template.layout === "46postcard-p") {
    base = "Portrait";
  } else if (template.layout === "46postcard-l") {
    base = "Paysage";
  }

  if (typeof template.no_of_images === "number" && template.no_of_images > 0) {
    return `${base} ${template.no_of_images} photo${template.no_of_images > 1 ? "s" : ""}`;
  }

  return base;
}

function canvaStatusLabel(status: EventPicTemplateRequest["automation"]["canva_folder_status"]) {
  const labels = {
    pending: "en attente",
    created: "dossier pret",
    not_configured: "non configure",
    error: "erreur"
  };

  return labels[status] ?? status;
}

function getPsdUrl(template: EventPicSelectedTemplate) {
  const direct = template.psd_url ?? template.photoshop_download_url ?? null;
  if (direct && direct.toLowerCase().includes(".psd")) {
    return direct;
  }
  if (template.psd_url) {
    return template.psd_url;
  }
  if (template.photoshop_download_url && template.photoshop_download_url.toLowerCase().includes(".psd")) {
    return template.photoshop_download_url;
  }
  return null;
}

function getZipUrl(template: EventPicSelectedTemplate) {
  if (template.zip_url && template.zip_url.toLowerCase().includes(".zip")) {
    return template.zip_url;
  }
  if (template.download_url && template.download_url.toLowerCase().includes(".zip")) {
    return template.download_url;
  }
  return null;
}

function getSourceFileUrl(template: EventPicSelectedTemplate) {
  return getPsdUrl(template) ?? getZipUrl(template) ?? template.source_file_url ?? template.download_url ?? null;
}

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? "";
}

function normalizeSearchText(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function familyKeyFromTemplate(template: EventPicSelectedTemplate) {
  const normalizedPostUrl = normalizePostUrl(template.post_url);

  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  const baseId = template.id.split("__")[0];
  return baseId ? `id:${baseId}` : `id:${template.id}`;
}

function formatPhotoCount(value: number | null) {
  if (!value) {
    return "Photos selon design";
  }

  return value > 1 ? `${value} photos` : "1 photo";
}

function noOfImagesToken(value: number | null) {
  if (!value || value <= 0) {
    return "";
  }

  return `${Math.floor(value)}images`;
}

function templateSourceKey(template: EventPicSelectedTemplate) {
  return `${template.id}::${template.format_label}::${noOfImagesToken(template.no_of_images)}`;
}

function selectedTemplateOptionKey(template: EventPicSelectedTemplate) {
  return templateSourceKey(template);
}

function parseSelectedTemplateOptionKey(key: string) {
  const [templateId = "", formatLabel = "", noOfImages = ""] = key.split("::");
  return {
    templateId,
    formatLabel,
    noOfImages
  };
}

function toDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function findTemplateSourceLinkForTemplate(
  links: TemplateSourceLinkEntry[],
  template: EventPicSelectedTemplate
) {
  const formatLabel = template.format_label;
  const noOfImages = noOfImagesToken(template.no_of_images);

  const scopedByTemplateId = links.find(
    (entry) =>
      entry.template_id === template.id &&
      Boolean(entry.format_label || entry.layout || entry.no_of_images || entry.canva_template_url) &&
      (!entry.format_label || entry.format_label === formatLabel) &&
      (!entry.no_of_images || entry.no_of_images === noOfImages)
  );

  if (scopedByTemplateId) {
    return scopedByTemplateId;
  }

  return (
    links.find(
      (entry) =>
        entry.template_id === template.id &&
        Boolean(entry.format_label || entry.layout || entry.no_of_images || entry.canva_template_url)
    ) ?? null
  );
}

function findTemplateFamilySourceLink(
  links: TemplateSourceLinkEntry[],
  template: EventPicSelectedTemplate
) {
  const familyKey = familyKeyFromTemplate(template);
  const postUrl = (template.post_url ?? "").trim().replace(/\?(.+)?$/, "").replace(/\/$/, "");

  if (familyKey) {
    const byFamily = links.find((entry) => entry.family_key === familyKey);
    if (byFamily) {
      return byFamily;
    }
  }

  if (postUrl) {
    const byPostUrl = links.find(
      (entry) =>
        (entry.post_url ?? "").trim().replace(/\?(.+)?$/, "").replace(/\/$/, "") === postUrl &&
        !entry.format_label
    );
    if (byPostUrl) {
      return byPostUrl;
    }
  }

  return null;
}

function canvaPendingTypeLabel(linkType: CanvaImportPendingItem["link_type"]) {
  if (linkType === "folder_global") {
    return "dossier global";
  }
  if (linkType === "format_link") {
    return "lien format";
  }
  return "inconnu";
}

function canvaStatusTextForTemplate(
  sourceLinkEntry: TemplateSourceLinkEntry | null,
  diagnostic: RawTemplateDiagnosticResponse | undefined
) {
  const hasLink = Boolean(sourceLinkEntry?.canva_template_url?.trim());

  if (hasLink) {
    if (sourceLinkEntry?.canva_source === "templatebooth_api") {
      return "Lien Canva detecte par API";
    }

    if (sourceLinkEntry?.canva_source === "templatebooth_harvester") {
      return "Lien Canva detecte par harvester local";
    }

    if (sourceLinkEntry?.canva_source === "manual" || sourceLinkEntry?.canva_source === "admin_manual") {
      return "Lien Canva disponible (manuel)";
    }

    return "Lien Canva disponible";
  }

  if (diagnostic?.canvaDetection?.found || diagnostic?.canvaDetection?.url || diagnostic?.canvaDetection?.canva_url) {
    return "Lien Canva detecte par API";
  }

  if (diagnostic?.diagnostic_status === "rate_limited") {
    return "Diagnostic bloque par rate limit";
  }

  const noApiLink =
    sourceLinkEntry?.canva_source === "not_provided_by_api" ||
    (diagnostic?.diagnostic_status === "not_found" && diagnostic?.canvaDetection?.source === "not_provided_by_api");

  if (noApiLink) {
    return "Lien Canva non fourni par l'API";
  }

  return "Lien Canva manquant";
}

function canvaDiagnosticStatusLabel(diagnostic: RawTemplateDiagnosticResponse | undefined) {
  const status = diagnostic?.diagnostic_status;

  if (status === "found") {
    return "Lien Canva trouve";
  }

  if (status === "not_found") {
    return "Lien Canva non fourni par l'API";
  }

  if (status === "rate_limited") {
    return "Diagnostic bloque par rate limit";
  }

  return "Diagnostic non lance";
}

function canvaDiagnosticStatusMessage(diagnostic: RawTemplateDiagnosticResponse | undefined) {
  const status = diagnostic?.diagnostic_status;

  if (status === "found") {
    return "Lien Canva detecte par API.";
  }

  if (status === "not_found") {
    return "Diagnostic termine : aucun lien Canva trouve dans la reponse API.";
  }

  if (status === "rate_limited") {
    return "TemplateBooth a temporairement limite les requetes API. Reessayez plus tard. Le diagnostic ne permet pas encore de conclure si le lien Canva existe.";
  }

  return "Diagnostic non lance.";
}

function aiStatusLabel(status: EventPicAiPreparationStatus) {
  const labels: Record<EventPicAiPreparationStatus, string> = {
    not_started: "Non lancee",
    pending: "En attente",
    running: "En cours",
    completed: "Terminee",
    error: "Erreur",
    not_configured: "IA non configuree"
  };

  return labels[status];
}

function aiData(request: EventPicTemplateRequest) {
  return request.ai_preparation ?? DEFAULT_AI_PREPARATION;
}

function isReliableWelcomeCandidate(candidate: WelcomeDiagnosticCandidate) {
  return candidate.score >= 70;
}

function findWelcomeTemplateForRequest(request: EventPicTemplateRequest) {
  return request.selected_templates.find(
    (template) =>
      template.required &&
      (isWelcomeTemplate(template) || template.format_label.includes("Fond d'ecran") || template.placeholder === true)
  );
}

function findDiagnosticReferenceTemplate(request: EventPicTemplateRequest) {
  return (
    request.selected_templates.find(
      (template) =>
        !isProductionTaskTemplate(request, template) &&
        (template.layout === "46postcard-p" || template.layout === "46postcard-l")
    ) ??
    request.selected_templates.find((template) => !isProductionTaskTemplate(request, template)) ??
    request.selected_templates[0]
  );
}

function buildManualWelcomeInput(request: EventPicTemplateRequest): ManualWelcomeInput {
  const referenceTemplate = findDiagnosticReferenceTemplate(request);

  return {
    family_key: referenceTemplate ? familyKeyFromTemplate(referenceTemplate) : "",
    template_id: referenceTemplate?.id ?? "",
    post_url: referenceTemplate?.post_url ?? "",
    welcome_screen_url: "",
    welcome_preview_url: "",
    welcome_source_size: "1366x1024",
    welcome_target_size: "1920x1080",
    welcome_touch_to_start: false,
    welcome_source_note: ""
  };
}

function linesOrFallback(values: string[] | undefined, fallback: string) {
  if (!values || values.length === 0) {
    return [fallback];
  }

  return values;
}

function countNonEmptyItems(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return 0;
  }

  return values.filter((value) => value.trim().length > 0).length;
}

function totalFormatsFromBrief(brief: EventPicAiPreparation["brief"]) {
  if (!brief) {
    return 0;
  }

  if (typeof brief.summary?.total_formats === "number" && brief.summary.total_formats > 0) {
    return brief.summary.total_formats;
  }

  if (brief.selected_formats_table && brief.selected_formats_table.length > 0) {
    return brief.selected_formats_table.length;
  }

  if (brief.selected_formats.length > 0) {
    return brief.selected_formats.length;
  }

  const fallbackCount = brief.required_formats.length + brief.optional_formats.length;
  return fallbackCount > 0 ? fallbackCount : 0;
}

function resolveMissingCount(
  total: number,
  available: number,
  missing: string[] | undefined,
  toCreate?: string[] | undefined
) {
  const countedMissing = countNonEmptyItems(missing);
  const countedToCreate = countNonEmptyItems(toCreate);
  const explicitMissing = countedMissing + countedToCreate;

  if (explicitMissing > 0) {
    return total > 0 ? Math.min(total, explicitMissing) : explicitMissing;
  }

  if (total <= 0) {
    return 0;
  }

  return Math.max(total - available, 0);
}

function photoshopStatusLabel(total: number, available: number, missing: number) {
  if (total <= 0) {
    return "Non renseigné";
  }

  if (missing <= 0 && available >= total) {
    return "Prêt";
  }

  if (available <= 0) {
    return "Sources à récupérer";
  }

  return "Sources partiellement récupérées";
}

function canvaStatusSummaryLabel(total: number, available: number, missing: number) {
  if (total <= 0) {
    return "Non renseigné";
  }

  if (missing <= 0 && available >= total) {
    return "Prêt";
  }

  if (available <= 0) {
    return "Liens à renseigner";
  }

  return "Liens partiellement renseignés";
}

function briefModelLabel(brief: EventPicAiPreparation["brief"]) {
  if (!brief) {
    return "gpt-5.4-mini";
  }

  return brief.model_used || "gpt-5.4-mini";
}

function formatBriefForClipboard(request: EventPicTemplateRequest, brief: EventPicAiPreparation["brief"]) {
  if (!brief) {
    return "";
  }

  const ai = aiData(request);
  const summary = brief.summary;
  const status = brief.status_recommended;
  const rows = brief.selected_formats_table ?? [];
  const clientTexts = brief.client_texts;
  const welcome = brief.welcome_screen;
  const photoshop = brief.photoshop;
  const canva = brief.canva;
  const totalFormats = totalFormatsFromBrief(brief);
  const psdAvailableCount = countNonEmptyItems(photoshop?.psd_available ?? brief.source_files_available);
  const psdMissingCount = resolveMissingCount(
    totalFormats,
    psdAvailableCount,
    photoshop?.psd_missing ?? brief.source_files_missing,
    photoshop?.psd_to_create
  );
  const canvaAvailableCount = countNonEmptyItems(canva?.links_available ?? brief.canva_links_available);
  const canvaMissingCount = resolveMissingCount(
    totalFormats,
    canvaAvailableCount,
    canva?.links_missing ?? brief.canva_links_missing,
    canva?.designs_to_create
  );
  const canvaFolderStatus = canva?.global_folder_status ?? (canva?.global_folder_url ? "Disponible" : "Manquant");
  const canvaFormatsAvailableCount =
    typeof canva?.format_links_available_count === "number" ? canva.format_links_available_count : canvaAvailableCount;
  const canvaFormatsTotalCount =
    typeof canva?.format_links_total_count === "number" ? canva.format_links_total_count : totalFormats;
  const canvaFormatsMissingCount =
    typeof canva?.format_links_missing_count === "number"
      ? canva.format_links_missing_count
      : canvaMissingCount;
  const generatedAt = brief.generated_at || ai.completed_at || ai.started_at || request.created_at;
  const startedAt = ai.started_at;
  const completedAt = ai.completed_at;

  const lines: string[] = [];
  lines.push("FICHE DE PRÉPARATION IA — EVENT PIC");
  lines.push(`Générée le : ${formatDateTimeWithAt(generatedAt)}`);
  lines.push(`Lancement IA : ${startedAt ? formatDateTimeWithAt(startedAt) : "Non disponible"}`);
  lines.push(`Fin IA : ${completedAt ? formatDateTimeWithAt(completedAt) : "Non disponible"}`);
  if (ai.status === "running") {
    lines.push("Statut IA : Génération en cours...");
  } else if (ai.status === "error") {
    lines.push(
      `Statut IA : Échec de génération${completedAt ? ` le ${formatDateTimeWithAt(completedAt)}` : ""}${
        ai.error_message ? ` — ${ai.error_message}` : ""
      }`
    );
  }
  lines.push(`Modèle IA utilisé : ${briefModelLabel(brief)}`);
  lines.push("");
  lines.push("Résumé rapide");
  lines.push(`- Client : ${summary?.client ?? "Non renseigné"}`);
  lines.push(`- Email : ${summary?.email ?? "Non renseigné"}`);
  lines.push(`- Téléphone : ${summary?.phone ?? "Non renseigné"}`);
  lines.push(`- Date événement : ${summary?.event_date ?? brief.event_date ?? "Non renseigné"}`);
  lines.push(`- Type événement : ${summary?.event_type ?? brief.event_type ?? "Non renseigné"}`);
  lines.push(`- Template choisi : ${summary?.template_selected ?? "Non renseigné"}`);
  lines.push(`- Nombre total de formats : ${summary?.total_formats ?? rows.length}`);
  lines.push(`- Statut global : ${summary?.global_status ?? status?.status ?? "À préparer"}`);
  lines.push("");
  lines.push("Statut recommandé");
  lines.push(`- ${status?.status ?? "À préparer"}`);
  lines.push(`- Raison : ${status?.reason ?? "Les sources doivent être vérifiées avant production."}`);
  lines.push("");
  lines.push("Actions prioritaires");
  linesOrFallback(brief.priority_actions, "Aucune action prioritaire spécifiée.").forEach((line) => {
    lines.push(`- ${line}`);
  });
  lines.push("");
  lines.push("Formats à produire");
  rows.forEach((row) => {
    lines.push(
      `- ${row.format} | ${row.template_name} | ${row.photo_count} | ${row.requirement} | ${row.source_status} | Canva: ${row.canva_status ?? "À renseigner"} | ${row.expected_action}`
    );
  });
  lines.push("");
  lines.push("Textes client");
  lines.push(`- Texte principal : ${clientTexts?.primary_text ?? brief.primary_text ?? "Non renseigné"}`);
  lines.push(`- Texte secondaire : ${clientTexts?.secondary_text ?? brief.secondary_text ?? "Non renseigné"}`);
  lines.push(`- Consignes particulières : ${clientTexts?.notes ?? brief.special_instructions ?? "Non renseigné"}`);
  lines.push("");
  lines.push("Fond d’écran");
  lines.push(`- Source : ${welcome?.source ?? "Non renseigné"}`);
  lines.push(`- Action : ${welcome?.action ?? "Non renseigné"}`);
  lines.push(`- Statut : ${welcome?.status ?? "Non renseigné"}`);
  lines.push(`- Attention : ${welcome?.attention ?? "Non renseigné"}`);
  lines.push("");
  lines.push("Production Photoshop / PSD");
  lines.push(`- Statut : ${photoshopStatusLabel(totalFormats, psdAvailableCount, psdMissingCount)}`);
  lines.push(`- PSD disponibles : ${psdAvailableCount} / ${totalFormats}`);
  lines.push(`- PSD manquants : ${psdMissingCount} / ${totalFormats}`);
  lines.push("- Action principale : récupérer les sources PSD TemplateBooth, puis intégrer les textes client.");
  lines.push("- Exports attendus : PNG/JPG finaux pour chaque format.");
  lines.push("");
  lines.push("Production Canva");
  lines.push(`- Dossier Canva global : ${canvaFolderStatus}`);
  lines.push(
    `- Statut : ${canvaStatusSummaryLabel(canvaFormatsTotalCount, canvaFormatsAvailableCount, canvaFormatsMissingCount)}`
  );
  lines.push(`- Liens Canva formats disponibles : ${canvaFormatsAvailableCount} / ${canvaFormatsTotalCount}`);
  lines.push(`- Liens Canva formats manquants : ${canvaFormatsMissingCount} / ${canvaFormatsTotalCount}`);
  if (canva?.global_folder_url && canvaFormatsMissingCount > 0) {
    lines.push("- Dossier Canva global disponible, liens format a associer si necessaire.");
  }
  lines.push("- Action principale : renseigner les liens Canva ou créer les designs correspondants.");
  lines.push("- Contrôle attendu : cohérence graphique et textes identiques sur tous les formats.");
  lines.push("");
  lines.push("Checklist LumaBooth");
  linesOrFallback(brief.lumabooth_checklist, "Aucune checklist LumaBooth.").forEach((line) => lines.push(`- ${line}`));
  lines.push("");
  lines.push("Nommage conseillé des fichiers");
  linesOrFallback(brief.final_file_names ?? brief.file_naming_recommendations, "Aucun nom proposé.").forEach((line) =>
    lines.push(`- ${line}`)
  );

  return lines.join("\n");
}

export default function AdminDemandesPage() {
  const [requests, setRequests] = useState<EventPicTemplateRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EventPicTemplateRequest | null>(null);
  const [detailTab, setDetailTab] = useState<AdminRequestDetailTab>("resume");
  const [message, setMessage] = useState("");
  const [aiFeedbackById, setAiFeedbackById] = useState<Record<string, string>>({});
  const [welcomeDiagnosticById, setWelcomeDiagnosticById] = useState<Record<string, WelcomeDiagnosticResponse>>({});
  const [welcomeDiagnosticFeedbackById, setWelcomeDiagnosticFeedbackById] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [canvaPreparingId, setCanvaPreparingId] = useState<string | null>(null);
  const [aiPreparingId, setAiPreparingId] = useState<string | null>(null);
  const [welcomeDiagnosticLoadingId, setWelcomeDiagnosticLoadingId] = useState<string | null>(null);
  const [welcomeApplyLoadingId, setWelcomeApplyLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [preferredPortraitLoadingId, setPreferredPortraitLoadingId] = useState<string | null>(null);
  const [canvaLinkSavingId, setCanvaLinkSavingId] = useState<string | null>(null);
  const [manualWelcomeById, setManualWelcomeById] = useState<Record<string, ManualWelcomeInput>>({});
  const [templateSourceLinks, setTemplateSourceLinks] = useState<TemplateSourceLinkEntry[]>([]);
  const [canvaPendingImports, setCanvaPendingImports] = useState<CanvaImportPendingItem[]>([]);
  const [canvaPendingLoading, setCanvaPendingLoading] = useState(false);
  const [canvaPendingActionId, setCanvaPendingActionId] = useState<string | null>(null);
  const [canvaPendingFeedback, setCanvaPendingFeedback] = useState("");
  const [canvaPendingSelectionById, setCanvaPendingSelectionById] = useState<Record<string, string>>({});
  const [canvaAutoProposals, setCanvaAutoProposals] = useState<CanvaAutoAssociationProposal[]>([]);
  const [canvaAutoProposalLoading, setCanvaAutoProposalLoading] = useState(false);
  const [canvaAutoProposalValidationLoading, setCanvaAutoProposalValidationLoading] = useState(false);
  const [canvaFolderLinkInputByFamilyKey, setCanvaFolderLinkInputByFamilyKey] = useState<Record<string, string>>({});
  const [canvaFolderLinkFeedbackByFamilyKey, setCanvaFolderLinkFeedbackByFamilyKey] = useState<Record<string, string>>({});
  const [canvaFolderSavingKey, setCanvaFolderSavingKey] = useState<string | null>(null);
  const [canvaHarvestRunningRequestId, setCanvaHarvestRunningRequestId] = useState<string | null>(null);
  const [canvaHarvestFeedbackByRequestId, setCanvaHarvestFeedbackByRequestId] = useState<
    Record<string, HarvestCanvaFeedback | undefined>
  >({});
  const [canvaLinkInputByTemplateKey, setCanvaLinkInputByTemplateKey] = useState<Record<string, string>>({});
  const [canvaLinkFeedbackByTemplateKey, setCanvaLinkFeedbackByTemplateKey] = useState<Record<string, string>>({});
  const [canvaDiagnosticByTemplateKey, setCanvaDiagnosticByTemplateKey] = useState<
    Record<string, RawTemplateDiagnosticResponse>
  >({});
  const [canvaDiagnosticFeedbackByTemplateKey, setCanvaDiagnosticFeedbackByTemplateKey] = useState<
    Record<string, string>
  >({});
  const [canvaDiagnosticLoadingId, setCanvaDiagnosticLoadingId] = useState<string | null>(null);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateSearchResults, setTemplateSearchResults] = useState<AdminTemplateSearchResult[]>([]);
  const [templateSearchLoading, setTemplateSearchLoading] = useState(false);
  const categoryLabelMap = new Map<string, string>(EVENT_PIC_CATEGORIES.map((category) => [category.id, category.label]));
  const canvaPendingTemplateOptions = useMemo(() => {
    const options = new Map<
      string,
      {
        key: string;
        template: EventPicSelectedTemplate;
        requestId: string;
        requestLabel: string;
      }
    >();

    for (const request of requests) {
      const requestLabel = `${request.client.first_name} ${request.client.last_name}`.trim();

      for (const template of request.selected_templates) {
        const key = selectedTemplateOptionKey(template);

        if (!options.has(key)) {
          options.set(key, {
            key,
            template,
            requestId: request.id,
            requestLabel
          });
        }
      }
    }

    return [...options.values()].sort((first, second) => {
      const byName = first.template.name.localeCompare(second.template.name);
      if (byName !== 0) {
        return byName;
      }
      return first.template.format_label.localeCompare(second.template.format_label);
    });
  }, [requests]);

  const scopedCanvaPendingImports = useMemo(() => {
    if (!selectedRequest) {
      return canvaPendingImports;
    }

    const referenceTemplate = findDiagnosticReferenceTemplate(selectedRequest);
    if (!referenceTemplate) {
      return canvaPendingImports;
    }

    const referenceFamilyKey = familyKeyFromTemplate(referenceTemplate);
    const referencePostUrl = normalizePostUrl(referenceTemplate.post_url);
    const referenceName = normalizeSearchText(referenceTemplate.name);

    return canvaPendingImports.filter((item) => {
      if (referenceFamilyKey && item.suggested_family_key === referenceFamilyKey) {
        return true;
      }

      if (
        referencePostUrl &&
        (normalizePostUrl(item.parent_templatebooth_url) === referencePostUrl ||
          normalizePostUrl(item.page_url) === referencePostUrl ||
          normalizePostUrl(item.source_page_url) === referencePostUrl)
      ) {
        return true;
      }

      if (referenceName && normalizeSearchText(item.template_name).includes(referenceName)) {
        return true;
      }

      return false;
    });
  }, [canvaPendingImports, selectedRequest]);

  async function loadRequests(autoSelectIfNone = true) {
    const response = await fetch("/api/template-requests");
    const payload = (await response.json()) as RequestsResponse;

    if (!response.ok) {
      setMessage(payload.error ?? "Impossible de charger les demandes.");
      return;
    }

    const nextRequests = payload.requests ?? [];
    setRequests(nextRequests);
    setSelectedRequest((current) => {
      if (!current) {
        return autoSelectIfNone ? (nextRequests[0] ?? null) : null;
      }

      return nextRequests.find((request) => request.id === current.id) ?? nextRequests[0] ?? null;
    });
  }

  async function loadTemplateSourceLinks() {
    try {
      const response = await fetch("/api/admin/template-source-links");
      const payload = (await response.json()) as TemplateSourceLinksResponse;

      if (!response.ok || !payload.ok) {
        return;
      }

      setTemplateSourceLinks(payload.links ?? []);
    } catch {
      // noop
    }
  }

  async function loadCanvaPendingImports() {
    setCanvaPendingLoading(true);

    try {
      const response = await fetch("/api/admin/template-source-links/canva-import-pending", {
        cache: "no-store"
      });
      const payload = (await response.json()) as CanvaImportPendingResponse;

      if (!response.ok || !payload.ok) {
        setCanvaPendingFeedback(payload.error ?? "Chargement des imports Canva en attente impossible.");
        return;
      }

      setCanvaPendingImports(payload.items ?? []);
      setCanvaAutoProposals([]);
      setCanvaPendingFeedback("");
      setCanvaPendingSelectionById((current) => {
        const next = { ...current };

        for (const item of payload.items ?? []) {
          if (!next[item.id]) {
            const fallbackKey =
              canvaPendingTemplateOptions.find((option) => option.template.id === item.suggested_template_id)?.key ?? "";
            if (fallbackKey) {
              next[item.id] = fallbackKey;
            }
          }
        }

        return next;
      });
    } catch {
      setCanvaPendingFeedback("Chargement des imports Canva en attente impossible.");
    } finally {
      setCanvaPendingLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    loadTemplateSourceLinks();
    loadCanvaPendingImports();
  }, []);

  useEffect(() => {
    if (canvaPendingImports.length === 0 || canvaPendingTemplateOptions.length === 0) {
      return;
    }

    setCanvaPendingSelectionById((current) => {
      const next = { ...current };
      let changed = false;

      for (const item of canvaPendingImports) {
        if (next[item.id]) {
          continue;
        }

        const option =
          canvaPendingTemplateOptions.find((candidate) => candidate.template.id === item.suggested_template_id) ??
          canvaPendingTemplateOptions.find(
            (candidate) =>
              normalizePostUrl(candidate.template.post_url) &&
              normalizePostUrl(candidate.template.post_url) === normalizePostUrl(item.page_url)
          );

        if (option) {
          next[item.id] = option.key;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [canvaPendingImports, canvaPendingTemplateOptions]);

  useEffect(() => {
    setDetailTab("resume");
  }, [selectedRequest?.id]);

  async function updateStatus(id: string, status: EventPicTemplateRequestStatus) {
    const response = await fetch(`/api/template-requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const payload = (await response.json()) as PatchResponse;

    if (!response.ok || !payload.request) {
      setMessage(payload.error ?? "Mise a jour impossible.");
      return;
    }

    setMessage("");
    await loadRequests();
  }

  async function copyPostUrl(postUrl?: string) {
    if (!postUrl) {
      setMessage("Aucun post_url disponible pour cette declinaison.");
      return;
    }

    try {
      await navigator.clipboard.writeText(postUrl);
      setMessage("post_url copie.");
    } catch {
      setMessage("Copie impossible depuis ce navigateur.");
    }
  }

  function updateCanvaLinkInput(template: EventPicSelectedTemplate, value: string) {
    const key = templateSourceKey(template);
    setCanvaLinkInputByTemplateKey((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function copyCanvaLink(template: EventPicSelectedTemplate, url: string) {
    const key = templateSourceKey(template);

    if (!url) {
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: "Aucun lien Canva disponible."
      }));
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: "Lien Canva copié."
      }));
    } catch {
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: "Copie du lien Canva impossible."
      }));
    }
  }

  function updateCanvaFolderLinkInput(familyKey: string, value: string) {
    setCanvaFolderLinkInputByFamilyKey((current) => ({
      ...current,
      [familyKey]: value
    }));
  }

  async function copyCanvaFolderLink(familyKey: string, url: string) {
    if (!url) {
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyKey]: "Aucun lien dossier Canva disponible."
      }));
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyKey]: "Lien dossier Canva copie."
      }));
    } catch {
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyKey]: "Copie du lien dossier Canva impossible."
      }));
    }
  }

  async function saveCanvaFolderLink(template: EventPicSelectedTemplate) {
    const familyKey = familyKeyFromTemplate(template);
    const familyInputKey = familyKey || template.id;
    const sourceLinkFamily = findTemplateFamilySourceLink(templateSourceLinks, template);
    const rawValue = canvaFolderLinkInputByFamilyKey[familyInputKey] ?? sourceLinkFamily?.canva_folder_url ?? "";
    const folderUrl = rawValue.trim();

    if (!folderUrl) {
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyInputKey]: "Renseignez un lien dossier Canva avant enregistrement."
      }));
      return;
    }

    setCanvaFolderSavingKey(familyInputKey);
    setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
      ...current,
      [familyInputKey]: ""
    }));

    try {
      const response = await fetch("/api/admin/template-source-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          family_key: familyKey || undefined,
          template_name: template.name,
          post_url: template.post_url,
          canva_folder_url: folderUrl,
          canva_folder_source: "manual",
          notes: sourceLinkFamily?.notes ?? ""
        })
      });
      const payload = (await response.json()) as TemplateSourceLinksResponse;

      if (!response.ok || !payload.ok || !payload.entry) {
        setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
          ...current,
          [familyInputKey]: payload.error ?? "Enregistrement du lien dossier Canva impossible."
        }));
        return;
      }

      const savedEntry = payload.entry;
      setTemplateSourceLinks((current) => {
        const next = [...current];
        const index = next.findIndex((entry) => {
          if (savedEntry.family_key && entry.family_key === savedEntry.family_key && !entry.format_label) {
            return true;
          }
          if (savedEntry.post_url && entry.post_url === savedEntry.post_url && !entry.format_label) {
            return true;
          }
          return false;
        });

        if (index >= 0) {
          next[index] = { ...next[index], ...savedEntry };
        } else {
          next.push(savedEntry);
        }

        return next;
      });
      setCanvaFolderLinkInputByFamilyKey((current) => ({
        ...current,
        [familyInputKey]: savedEntry.canva_folder_url ?? folderUrl
      }));
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyInputKey]: payload.message ?? "Lien dossier Canva enregistre."
      }));
    } catch {
      setCanvaFolderLinkFeedbackByFamilyKey((current) => ({
        ...current,
        [familyInputKey]: "Enregistrement du lien dossier Canva impossible."
      }));
    } finally {
      setCanvaFolderSavingKey(null);
    }
  }

  async function harvestCanvaAutomatically(
    request: EventPicTemplateRequest,
    referenceTemplate: EventPicSelectedTemplate
  ) {
    const requestId = request.id;
    const postUrl = (referenceTemplate.post_url ?? "").trim();
    const isValidTemplateBoothUrl = /^https:\/\/templatesbooth\.com\//i.test(postUrl);

    if (!isValidTemplateBoothUrl) {
      setCanvaHarvestFeedbackByRequestId((current) => ({
        ...current,
        [requestId]: {
          tone: "error",
          message: "URL TemplateBooth manquante : impossible de lancer l'extraction Canva.",
          details: "Le template selectionne ne contient pas de post_url valide https://templatesbooth.com/."
        }
      }));
      return;
    }

    setCanvaHarvestRunningRequestId(requestId);
    setCanvaHarvestFeedbackByRequestId((current) => ({
      ...current,
      [requestId]: {
        tone: "info",
        message: "Ouverture de TemplateBooth..."
      }
    }));

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      setCanvaHarvestFeedbackByRequestId((current) => ({
        ...current,
        [requestId]: {
          tone: "info",
          message: "Recherche des liens Canva..."
        }
      }));

      const formats = request.selected_templates.map((template) => ({
        id: template.id,
        name: template.name,
        post_url: template.post_url,
        format_label: template.format_label,
        layout: template.layout,
        no_of_images: template.no_of_images
      }));

      const response = await fetch("/api/admin/template-source-links/harvest-canva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          request_id: requestId,
          template_name: referenceTemplate.name,
          post_url: postUrl,
          family_key: familyKeyFromTemplate(referenceTemplate),
          formats
        })
      });
      const payload = (await response.json()) as HarvestCanvaResponse;

      if (payload.status === "pending_login") {
        const manualCommands =
          payload.manual_commands && payload.manual_commands.length > 0
            ? payload.manual_commands
            : LOCAL_CANVA_HARVESTER_FALLBACK_COMMANDS;
        setCanvaHarvestFeedbackByRequestId((current) => ({
          ...current,
          [requestId]: {
            tone: "info",
            message:
              payload.message ?? "Connexion TemplateBooth requise. Lancez npm.cmd run login.",
            help:
              "Connexion TemplateBooth requise. Lancez la commande de connexion, connectez-vous, puis relancez l'extraction. Si vous etes deja connecte dans Chrome, utilisez plutot l'extension Chrome locale.",
            manualCommands,
            debugLines: buildHarvesterDebugLines(payload.debug)
          }
        }));
        return;
      }

      if ((!response.ok || payload.ok === false) && payload.status !== "no_links_found") {
        const manualCommands =
          payload.manual_commands && payload.manual_commands.length > 0
            ? payload.manual_commands
            : LOCAL_CANVA_HARVESTER_FALLBACK_COMMANDS;
        const debugCommands =
          payload.debug_commands && payload.debug_commands.length > 0
            ? payload.debug_commands
            : LOCAL_CANVA_HARVESTER_DEBUG_COMMANDS;
        setCanvaHarvestFeedbackByRequestId((current) => ({
          ...current,
          [requestId]: {
            tone: "error",
            message: payload.message ?? "Impossible de lancer l'extracteur Canva local.",
            details: payload.details ?? payload.error ?? payload.code,
            help:
              payload.help ??
              "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
            manualCommands: [...manualCommands, ...debugCommands]
          }
        }));
        return;
      }

      if (payload.status === "no_links_found") {
        const debugLines = buildHarvesterDebugLines(payload.debug);
        const debugCommands =
          payload.manual_commands && payload.manual_commands.length > 0
            ? payload.manual_commands
            : payload.debug_commands && payload.debug_commands.length > 0
              ? payload.debug_commands
              : LOCAL_CANVA_HARVESTER_DEBUG_COMMANDS;
        setCanvaHarvestFeedbackByRequestId((current) => ({
          ...current,
          [requestId]: {
            tone: "info",
            message: payload.message ?? "Aucun lien Canva trouve.",
            details: payload.details ?? "Le diagnostic debug ci-dessous precise le contexte d'extraction.",
            help:
              payload.debug?.loggedInLikely === false
                ? "Vous etes peut-etre connecte dans Chrome, mais pas dans Playwright. Utilisez l'extension Chrome locale ou lancez npm.cmd run login."
                : "Relancez en mode debug pour inspecter la page ouverte localement.",
            manualCommands: debugCommands,
            debugLines
          }
        }));
      } else {
        setCanvaHarvestFeedbackByRequestId((current) => ({
          ...current,
          [requestId]: {
            tone: "success",
            message:
              payload.message ??
              `${payload.found_links ?? 0} liens Canva trouves - ${payload.imported_links ?? 0} enregistres - ${payload.pending_links ?? 0} a valider.`,
            details: `${payload.found_links ?? 0} trouves, ${payload.imported_links ?? 0} importes, ${payload.pending_links ?? 0} en attente.`
          }
        }));
      }

      await loadTemplateSourceLinks();
      await loadCanvaPendingImports();
      await loadRequests(false);
    } catch (error) {
      setCanvaHarvestFeedbackByRequestId((current) => ({
        ...current,
        [requestId]: {
          tone: "error",
          message: "Impossible de lancer l'extracteur Canva local.",
          details: error instanceof Error ? error.message : "Erreur inconnue.",
          help:
            "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
          manualCommands: [...LOCAL_CANVA_HARVESTER_FALLBACK_COMMANDS, ...LOCAL_CANVA_HARVESTER_DEBUG_COMMANDS]
        }
      }));
    } finally {
      setCanvaHarvestRunningRequestId(null);
    }
  }

  async function saveCanvaTemplateLink(template: EventPicSelectedTemplate) {
    const key = templateSourceKey(template);
    const existing = findTemplateSourceLinkForTemplate(templateSourceLinks, template);
    const rawValue = canvaLinkInputByTemplateKey[key] ?? existing?.canva_template_url ?? "";
    const canvaUrl = rawValue.trim();

    if (!canvaUrl) {
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: "Renseignez un lien Canva avant enregistrement."
      }));
      return;
    }

    setCanvaLinkSavingId(key);
    setCanvaLinkFeedbackByTemplateKey((current) => ({
      ...current,
      [key]: ""
    }));

    try {
      const response = await fetch("/api/admin/template-source-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          family_key: familyKeyFromTemplate(template),
          template_id: template.id,
          template_name: template.name,
          format_label: template.format_label,
          layout: template.layout,
          no_of_images: noOfImagesToken(template.no_of_images),
          post_url: template.post_url,
          canva_template_url: canvaUrl,
          canva_source: "manual",
          psd_source_url: getSourceFileUrl(template) ?? undefined,
          notes: existing?.notes ?? ""
        })
      });
      const payload = (await response.json()) as TemplateSourceLinksResponse;

      if (!response.ok || !payload.ok || !payload.entry) {
        setCanvaLinkFeedbackByTemplateKey((current) => ({
          ...current,
          [key]: payload.error ?? "Enregistrement du lien Canva impossible."
        }));
        return;
      }
      const savedEntry = payload.entry;

      setTemplateSourceLinks((current) => {
        const next = [...current];
        const index = next.findIndex((entry) => {
          if (
            entry.template_id &&
            savedEntry.template_id &&
            entry.template_id === savedEntry.template_id &&
            (entry.format_label ?? "") === (savedEntry.format_label ?? "") &&
            (entry.no_of_images ?? "") === (savedEntry.no_of_images ?? "")
          ) {
            return true;
          }

          return false;
        });

        if (index >= 0) {
          next[index] = { ...next[index], ...savedEntry };
        } else {
          next.push(savedEntry);
        }

        return next;
      });

      setCanvaLinkInputByTemplateKey((current) => ({
        ...current,
        [key]: savedEntry.canva_template_url ?? canvaUrl
      }));
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: payload.message ?? "Lien Canva enregistré."
      }));
    } catch {
      setCanvaLinkFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: "Enregistrement du lien Canva impossible."
      }));
    } finally {
      setCanvaLinkSavingId(null);
    }
  }

  function updateCanvaPendingSelection(pendingId: string, value: string) {
    setCanvaPendingSelectionById((current) => ({
      ...current,
      [pendingId]: value
    }));
  }

  async function resolveCanvaPendingImport(item: CanvaImportPendingItem, resolveAs: "folder_global" | "format_link") {
    const optionKey = canvaPendingSelectionById[item.id] ?? "";
    const parsed = optionKey ? parseSelectedTemplateOptionKey(optionKey) : null;
    const option = optionKey
      ? canvaPendingTemplateOptions.find((candidate) => candidate.key === optionKey)
      : undefined;
    const referenceTemplate =
      option?.template ??
      selectedRequest?.selected_templates.find(
        (template) =>
          normalizePostUrl(template.post_url) &&
          normalizePostUrl(template.post_url) === normalizePostUrl(item.page_url)
      ) ??
      selectedRequest?.selected_templates[0];

    if (resolveAs === "format_link" && (!parsed?.templateId || !parsed?.formatLabel || !option)) {
      setCanvaPendingFeedback("Selectionnez un template cible avant de valider l'import Canva.");
      return;
    }

    if (!referenceTemplate) {
      setCanvaPendingFeedback("Association Canva invalide. Aucun template de reference trouve.");
      return;
    }

    setCanvaPendingActionId(item.id);
    setCanvaPendingFeedback("");

    try {
      const response = await fetch("/api/admin/template-source-links/canva-import-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "resolve",
          pending_id: item.id,
          resolve_as: resolveAs,
          family_key: familyKeyFromTemplate(referenceTemplate),
          template_id: resolveAs === "format_link" ? parsed?.templateId : referenceTemplate.id,
          template_name: referenceTemplate.name,
          format_label: resolveAs === "format_link" ? parsed?.formatLabel : referenceTemplate.format_label,
          layout: resolveAs === "format_link" ? option?.template.layout : referenceTemplate.layout,
          no_of_images:
            resolveAs === "format_link" ? parsed?.noOfImages : noOfImagesToken(referenceTemplate.no_of_images),
          post_url: referenceTemplate.post_url
        })
      });
      const payload = (await response.json()) as CanvaImportPendingResponse;

      if (!response.ok || !payload.ok) {
        setCanvaPendingFeedback(payload.error ?? "Validation de l'import Canva impossible.");
        return;
      }

      await loadTemplateSourceLinks();
      await loadCanvaPendingImports();
      setCanvaPendingFeedback("Import Canva associe et enregistre.");
    } catch {
      setCanvaPendingFeedback("Validation de l'import Canva impossible.");
    } finally {
      setCanvaPendingActionId(null);
    }
  }

  async function ignoreCanvaPendingImport(item: CanvaImportPendingItem) {
    setCanvaPendingActionId(item.id);
    setCanvaPendingFeedback("");

    try {
      const response = await fetch("/api/admin/template-source-links/canva-import-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "ignore",
          pending_id: item.id
        })
      });
      const payload = (await response.json()) as CanvaImportPendingResponse;

      if (!response.ok || !payload.ok) {
        setCanvaPendingFeedback(payload.error ?? "Impossible d'ignorer cet import Canva.");
        return;
      }

      await loadCanvaPendingImports();
      setCanvaPendingFeedback("Import Canva ignore.");
    } catch {
      setCanvaPendingFeedback("Impossible d'ignorer cet import Canva.");
    } finally {
      setCanvaPendingActionId(null);
    }
  }

  async function autoAssociateCanvaPendingByOrder() {
    if (!selectedRequest) {
      setCanvaPendingFeedback("Aucune demande selectionnee.");
      return;
    }

    const referenceTemplate = findDiagnosticReferenceTemplate(selectedRequest);
    if (!referenceTemplate) {
      setCanvaPendingFeedback("Impossible de determiner le template de reference.");
      return;
    }

    setCanvaAutoProposalLoading(true);
    setCanvaPendingFeedback("");

    try {
      const response = await fetch("/api/admin/template-source-links/canva-import-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "auto_associate_order",
          family_key: familyKeyFromTemplate(referenceTemplate),
          page_url: referenceTemplate.post_url,
          template_name: referenceTemplate.name
        })
      });
      const payload = (await response.json()) as CanvaImportPendingResponse;

      if (!response.ok || !payload.ok) {
        setCanvaPendingFeedback(payload.error ?? "Association automatique impossible.");
        setCanvaAutoProposals([]);
        return;
      }

      const proposals = payload.proposals ?? [];
      setCanvaAutoProposals(proposals);
      if (proposals.length === 0) {
        setCanvaPendingFeedback("Aucune proposition automatique disponible pour cette famille.");
      } else {
        setCanvaPendingFeedback(`${proposals.length} associations proposees.`);
      }
    } catch {
      setCanvaPendingFeedback("Association automatique impossible.");
      setCanvaAutoProposals([]);
    } finally {
      setCanvaAutoProposalLoading(false);
    }
  }

  async function validateAutoAssociationProposals() {
    if (canvaAutoProposals.length === 0) {
      setCanvaPendingFeedback("Aucune proposition a valider.");
      return;
    }

    setCanvaAutoProposalValidationLoading(true);
    setCanvaPendingFeedback("");

    try {
      const response = await fetch("/api/admin/template-source-links/canva-import-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "validate_auto_associations",
          proposals: canvaAutoProposals.map((proposal) => ({
            pending_id: proposal.pending_id,
            proposed_template_id: proposal.proposed_template_id,
            proposed_template_name: proposal.proposed_template_name,
            proposed_format_label: proposal.proposed_format_label,
            proposed_layout: proposal.proposed_layout,
            proposed_no_of_images: proposal.proposed_no_of_images,
            proposed_family_key: proposal.proposed_family_key,
            post_url: proposal.proposed_post_url
          }))
        })
      });
      const payload = (await response.json()) as CanvaImportPendingResponse;

      if (!response.ok || !payload.ok) {
        setCanvaPendingFeedback(payload.error ?? "Validation automatique impossible.");
        return;
      }

      const successCount = (payload.results ?? []).filter((result) => result.ok).length;
      const failureCount = (payload.results ?? []).length - successCount;
      await loadTemplateSourceLinks();
      await loadCanvaPendingImports();
      setCanvaPendingFeedback(
        failureCount > 0
          ? `Associations validees: ${successCount}. Echecs: ${failureCount}.`
          : `Associations validees: ${successCount}.`
      );
      setCanvaAutoProposals([]);
    } catch {
      setCanvaPendingFeedback("Validation automatique impossible.");
    } finally {
      setCanvaAutoProposalValidationLoading(false);
    }
  }

  function useDetectedCanvaLink(template: EventPicSelectedTemplate, detectedUrl: string) {
    const key = templateSourceKey(template);
    setCanvaLinkInputByTemplateKey((current) => ({
      ...current,
      [key]: detectedUrl
    }));
    setCanvaLinkFeedbackByTemplateKey((current) => ({
      ...current,
      [key]: "Lien Canva detecte. Enregistrez-le pour l'associer au format."
    }));
  }

  async function runCanvaApiDiagnostic(template: EventPicSelectedTemplate, forceRefresh = false) {
    const key = templateSourceKey(template);
    setCanvaDiagnosticLoadingId(key);
    setCanvaDiagnosticFeedbackByTemplateKey((current) => ({
      ...current,
      [key]: ""
    }));

    try {
      const params = new URLSearchParams();
      if (template.id) {
        params.set("templateId", template.id);
      }
      if (template.name) {
        params.set("name", template.name);
        params.set("search", template.name);
      }
      if (template.post_url) {
        params.set("postUrl", template.post_url);
      }
      if (forceRefresh) {
        params.set("refresh", "1");
      }

      const response = await fetch(`/api/admin/templatebooth/raw-template-diagnostic?${params.toString()}`);
      const payload = (await response.json()) as RawTemplateDiagnosticResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Diagnostic Canva API impossible.");
      }

      setCanvaDiagnosticByTemplateKey((current) => ({
        ...current,
        [key]: payload
      }));
      setCanvaDiagnosticFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: payload.conclusion || "Diagnostic Canva termine."
      }));

      const detectedUrl = (payload.canvaDetection?.canva_url ?? payload.canvaDetection?.url ?? "").trim();
      if (detectedUrl) {
        setCanvaLinkInputByTemplateKey((current) => ({
          ...current,
          [key]: current[key] && current[key].trim() ? current[key] : detectedUrl
        }));
      }
    } catch (error) {
      setCanvaDiagnosticFeedbackByTemplateKey((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Diagnostic Canva API impossible."
      }));
    } finally {
      setCanvaDiagnosticLoadingId(null);
    }
  }

  async function syncTemplateBooth() {
    setIsSyncing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/templatebooth/sync", {
        method: "POST"
      });
      const payload = (await response.json()) as SyncResponse;

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Synchronisation TemplateBooth impossible.");
        return;
      }

      const totals = payload.totalByLayout ?? {};
      setMessage(
        `Synchronisation TemplateBooth terminee : ${payload.count ?? 0} templates caches (2x6: ${totals["26strip"] ?? 0}, portrait: ${totals["46postcard-p"] ?? 0}, paysage: ${totals["46postcard-l"] ?? 0}) - familles: ${payload.familyCount ?? 0}, valides: ${payload.validatedCount ?? 0}, a classer: ${payload.toReviewCount ?? 0}.`
      );
      await loadTemplateSourceLinks();
    } catch {
      setMessage("Synchronisation TemplateBooth impossible.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncTemplateBoothMariagePaysageOneImage() {
    setIsSyncing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/templatebooth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "mariage-paysage-1image"
        })
      });
      const payload = (await response.json()) as SyncResponse & {
        mode?: string;
        addedCount?: number;
        pagesTraversed?: number;
      };

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Synchronisation ciblee impossible.");
        return;
      }

      setMessage(
        `Synchronisation ciblee mariage/paysage/1 image terminee : +${payload.addedCount ?? 0} templates (${payload.count ?? 0} en cache).`
      );
      await loadTemplateSourceLinks();
    } catch {
      setMessage("Synchronisation ciblee impossible.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function runTemplateDiagnosticSearch() {
    const query = templateSearchQuery.trim();

    if (query.length < 2) {
      setTemplateSearchResults([]);
      setMessage("Saisissez au moins 2 caracteres pour rechercher un template.");
      return;
    }

    setTemplateSearchLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/templates/search?${new URLSearchParams({ q: query, limit: "60" }).toString()}`
      );
      const payload = (await response.json()) as AdminTemplateSearchResponse;

      if (!response.ok) {
        setMessage(payload.error ?? "Recherche admin template impossible.");
        setTemplateSearchResults([]);
        return;
      }

      setTemplateSearchResults(payload.results ?? []);
      setMessage((payload.results ?? []).length === 0 ? "Aucun template trouve pour cette recherche." : "");
    } catch {
      setMessage("Recherche admin template impossible.");
      setTemplateSearchResults([]);
    } finally {
      setTemplateSearchLoading(false);
    }
  }

  async function prepareCanvaFolder(id: string) {
    setCanvaPreparingId(id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/template-requests/${id}/create-canva-folder`, {
        method: "POST"
      });
      const payload = (await response.json()) as CanvaResponse;

      setMessage(payload.message ?? payload.error ?? "Preparation Canva terminee.");

      if (payload.request) {
        setSelectedRequest(payload.request);
      }

      await loadRequests();
    } catch {
      setMessage("Preparation Canva impossible.");
    } finally {
      setCanvaPreparingId(null);
    }
  }

  async function prepareWithAi(id: string) {
    setAiPreparingId(id);
    setAiFeedbackById((current) => ({ ...current, [id]: "" }));

    try {
      const response = await fetch(`/api/admin/template-requests/${id}/prepare-ai`, {
        method: "POST"
      });
      const payload = (await response.json()) as AiResponse;

      setAiFeedbackById((current) => ({
        ...current,
        [id]: payload.message ?? payload.error ?? "Preparation IA terminee."
      }));

      if (payload.request) {
        setSelectedRequest(payload.request);
      }

      await loadRequests();
    } catch {
      setAiFeedbackById((current) => ({ ...current, [id]: "Preparation IA impossible." }));
    } finally {
      setAiPreparingId(null);
    }
  }

  async function createDeliveryFromTemplateRequest(request: EventPicTemplateRequest) {
    setMessage("");
    setAiFeedbackById((current) => ({
      ...current,
      [request.id]: "Creation de la livraison en cours..."
    }));

    try {
      const response = await fetch("/api/admin/livraisons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "create_from_source",
          source: "template_request",
          event_id: request.id
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Creation livraison impossible.");
      }

      setAiFeedbackById((current) => ({
        ...current,
        [request.id]: "Livraison creee pour cette demande."
      }));
    } catch (error) {
      setAiFeedbackById((current) => ({
        ...current,
        [request.id]:
          error instanceof Error ? error.message : "Creation livraison impossible."
      }));
    }
  }

  async function copyAiBrief(
    id: string,
    request: EventPicTemplateRequest,
    brief: EventPicAiPreparation["brief"]
  ) {
    if (!brief) {
      setAiFeedbackById((current) => ({ ...current, [id]: "Aucune fiche IA à copier." }));
      return;
    }

    try {
      await navigator.clipboard.writeText(formatBriefForClipboard(request, brief));
      setAiFeedbackById((current) => ({ ...current, [id]: "Fiche IA copiée." }));
    } catch {
      setAiFeedbackById((current) => ({ ...current, [id]: "Copie de la fiche IA impossible." }));
    }
  }

  function getManualWelcomeInput(request: EventPicTemplateRequest) {
    return manualWelcomeById[request.id] ?? buildManualWelcomeInput(request);
  }

  function updateManualWelcomeInput<K extends keyof ManualWelcomeInput>(
    requestId: string,
    field: K,
    value: ManualWelcomeInput[K]
  ) {
    setManualWelcomeById((current) => {
      const existing = current[requestId];
      const fallbackRequest = requests.find((request) => request.id === requestId);
      const base = existing ?? (fallbackRequest ? buildManualWelcomeInput(fallbackRequest) : null);

      if (!base) {
        return current;
      }

      return {
        ...current,
        [requestId]: {
          ...base,
          [field]: value
        }
      };
    });
  }

  async function applyManualWelcome(request: EventPicTemplateRequest) {
    const form = getManualWelcomeInput(request);
    const referenceTemplate = findDiagnosticReferenceTemplate(request);
    const payloadForm: ManualWelcomeInput = {
      ...form,
      family_key: form.family_key || (referenceTemplate ? familyKeyFromTemplate(referenceTemplate) : ""),
      template_id: form.template_id || referenceTemplate?.id || "",
      post_url: form.post_url || referenceTemplate?.post_url || "",
      welcome_target_size: "1920x1080"
    };

    if (!payloadForm.welcome_screen_url.trim() && !payloadForm.welcome_preview_url.trim()) {
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]: "Renseignez au moins une URL source ou une URL d'apercu."
      }));
      return;
    }

    setWelcomeApplyLoadingId(`${request.id}:manual`);

    try {
      const response = await fetch(`/api/admin/template-requests/${request.id}/set-welcome-screen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          manual: payloadForm
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        request?: EventPicTemplateRequest;
      };

      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error ?? "Application manuelle du welcome screen impossible.");
      }

      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]: payload.message ?? "Welcome screen manuel applique."
      }));
      setSelectedRequest(payload.request);
      await loadRequests();
    } catch (error) {
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]:
          error instanceof Error ? error.message : "Application manuelle du welcome screen impossible."
      }));
    } finally {
      setWelcomeApplyLoadingId(null);
    }
  }

  async function deleteRequest(request: EventPicTemplateRequest) {
    const confirmed = window.confirm(`Supprimer definitivement la demande de ${clientName(request)} ?`);

    if (!confirmed) {
      return;
    }

    setDeleteLoadingId(request.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/template-requests/${request.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as DeleteResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Suppression impossible.");
      }

      setWelcomeDiagnosticById((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setWelcomeDiagnosticFeedbackById((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setManualWelcomeById((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setSelectedRequest((current) => (current?.id === request.id ? null : current));
      await loadRequests(false);
      setMessage("Demande supprimee.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  async function setPreferredRequiredPortrait(request: EventPicTemplateRequest, template: EventPicSelectedTemplate) {
    const familyKey = familyKeyFromTemplate(template);
    const loadingKey = `${request.id}:${template.id}`;
    setPreferredPortraitLoadingId(loadingKey);

    try {
      const response = await fetch("/api/admin/template-source-links/preferred-portrait", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          family_key: familyKey,
          preferred_required_portrait_id: template.id,
          template_id: template.id,
          post_url: template.post_url ?? undefined,
          notes: "Defini depuis /admin/demandes"
        })
      });
      const payload = (await response.json()) as PreferredPortraitResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Enregistrement du portrait prefere impossible.");
      }

      setMessage(payload.message ?? "Portrait obligatoire prefere enregistre.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement du portrait prefere impossible.");
    } finally {
      setPreferredPortraitLoadingId(null);
    }
  }

  async function runWelcomeDiagnostic(request: EventPicTemplateRequest) {
    const referenceTemplate = findDiagnosticReferenceTemplate(request);

    if (!referenceTemplate) {
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]: "Template de reference introuvable pour le diagnostic."
      }));
      return;
    }

    setWelcomeDiagnosticLoadingId(request.id);
    setWelcomeDiagnosticFeedbackById((current) => ({
      ...current,
      [request.id]: ""
    }));

    try {
      const params = new URLSearchParams();

      params.set("templateId", referenceTemplate.id);
      params.set("name", referenceTemplate.name);

      if (referenceTemplate.post_url) {
        params.set("postUrl", referenceTemplate.post_url);
      }

      if (request.event.type) {
        params.set("category", request.event.type);
      }

      const response = await fetch(`/api/admin/templatebooth/welcome-diagnostic?${params.toString()}`);
      const payload = (await response.json()) as WelcomeDiagnosticResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Diagnostic welcome screen impossible.");
      }

      setWelcomeDiagnosticById((current) => ({
        ...current,
        [request.id]: payload
      }));
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]: payload.conclusion
      }));
    } catch (error) {
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [request.id]: error instanceof Error ? error.message : "Diagnostic welcome screen impossible."
      }));
    } finally {
      setWelcomeDiagnosticLoadingId(null);
    }
  }

  async function applyWelcomeCandidate(requestId: string, candidate: WelcomeDiagnosticCandidate) {
    setWelcomeApplyLoadingId(`${requestId}:${candidate.id}`);
    setWelcomeDiagnosticFeedbackById((current) => ({
      ...current,
      [requestId]: ""
    }));

    try {
      const response = await fetch(`/api/admin/template-requests/${requestId}/set-welcome-screen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ candidate })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        request?: EventPicTemplateRequest;
      };

      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error ?? "Application du welcome screen impossible.");
      }

      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [requestId]: payload.message ?? "Welcome screen applique."
      }));
      setSelectedRequest(payload.request);
      await loadRequests();
    } catch (error) {
      setWelcomeDiagnosticFeedbackById((current) => ({
        ...current,
        [requestId]: error instanceof Error ? error.message : "Application du welcome screen impossible."
      }));
    } finally {
      setWelcomeApplyLoadingId(null);
    }
  }

  const selectedRequestWelcome = selectedRequest ? findWelcomeTemplateForRequest(selectedRequest) : undefined;
  const selectedRequestWelcomeDiagnostic = selectedRequest ? welcomeDiagnosticById[selectedRequest.id] : undefined;
  const selectedRequestWelcomeFeedback = selectedRequest ? welcomeDiagnosticFeedbackById[selectedRequest.id] : undefined;
  const selectedRequestManualWelcome = selectedRequest ? getManualWelcomeInput(selectedRequest) : null;
  const selectedRequestAi = selectedRequest ? aiData(selectedRequest) : null;
  const selectedRequestBrief = selectedRequestAi?.brief ?? null;
  const selectedRequestAiGeneratedAt =
    selectedRequestAi && typeof (selectedRequestAi as { generated_at?: unknown }).generated_at === "string"
      ? ((selectedRequestAi as { generated_at?: string }).generated_at ?? null)
      : null;
  const selectedRequestBriefGeneratedAt = selectedRequest
    ? selectedRequestBrief?.generated_at ??
      selectedRequestAiGeneratedAt ??
      selectedRequestAi?.completed_at ??
      selectedRequestAi?.started_at ??
      selectedRequest.created_at
    : null;
  const selectedRequestAiStatus = selectedRequestAi?.status ?? "not_started";
  const selectedRequestAiStartedAt = selectedRequestAi?.started_at ?? null;
  const selectedRequestAiCompletedAt = selectedRequestAi?.completed_at ?? null;
  const selectedRequestBriefTotalFormats = totalFormatsFromBrief(selectedRequestBrief);
  const selectedRequestPsdAvailableCount = selectedRequestBrief
    ? countNonEmptyItems(selectedRequestBrief.photoshop?.psd_available ?? selectedRequestBrief.source_files_available)
    : 0;
  const selectedRequestPsdMissingCount = selectedRequestBrief
    ? resolveMissingCount(
        selectedRequestBriefTotalFormats,
        selectedRequestPsdAvailableCount,
        selectedRequestBrief.photoshop?.psd_missing ?? selectedRequestBrief.source_files_missing,
        selectedRequestBrief.photoshop?.psd_to_create
      )
    : 0;
  const selectedRequestCanvaAvailableCount = selectedRequestBrief
    ? countNonEmptyItems(selectedRequestBrief.canva?.links_available ?? selectedRequestBrief.canva_links_available)
    : 0;
  const selectedRequestCanvaMissingCount = selectedRequestBrief
    ? resolveMissingCount(
        selectedRequestBriefTotalFormats,
        selectedRequestCanvaAvailableCount,
        selectedRequestBrief.canva?.links_missing ?? selectedRequestBrief.canva_links_missing,
        selectedRequestBrief.canva?.designs_to_create
      )
    : 0;
  const selectedRequestCanvaFolderStatus =
    selectedRequestBrief?.canva?.global_folder_status ??
    (selectedRequestBrief?.canva?.global_folder_url ? "Disponible" : "Manquant");
  const selectedRequestCanvaFormatsAvailableCount =
    typeof selectedRequestBrief?.canva?.format_links_available_count === "number"
      ? selectedRequestBrief.canva.format_links_available_count
      : selectedRequestCanvaAvailableCount;
  const selectedRequestCanvaFormatsTotalCount =
    typeof selectedRequestBrief?.canva?.format_links_total_count === "number"
      ? selectedRequestBrief.canva.format_links_total_count
      : selectedRequestBriefTotalFormats;
  const selectedRequestCanvaFormatsMissingCount =
    typeof selectedRequestBrief?.canva?.format_links_missing_count === "number"
      ? selectedRequestBrief.canva.format_links_missing_count
      : selectedRequestCanvaMissingCount;

  return (
    <main className="admin-page premium-page admin-demandes-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Demandes de templates</h1>
          <p className="admin-hero-subtitle">Suivi des personnalisations clients, sources PSD, liens Canva et preparations IA.</p>
        </div>
        <div className="admin-hero-actions">
          <button type="button" onClick={syncTemplateBooth} disabled={isSyncing}>
            {isSyncing ? "Synchronisation..." : "Synchroniser TemplateBooth"}
          </button>
          <button type="button" onClick={syncTemplateBoothMariagePaysageOneImage} disabled={isSyncing}>
            {isSyncing ? "Synchronisation..." : "Synchroniser Mariage Paysage"}
          </button>
          <a href="/">Site client</a>
          <a href="/admin/dossiers">Dossiers</a>
          <a href="/admin/devis">Devis clients</a>
          <a href="/admin/livreurs">Livreurs</a>
          <a href="/admin/livraisons">Livraisons</a>
          <a href="/admin/planning">Planning evenements</a>
          <a href="/admin/emails">Emails clients</a>
          <a href="/admin/templates">Classement templates</a>
          <div className="admin-count">{requests.length} demandes</div>
        </div>
      </section>

      {message ? <p className="notice">{message}</p> : null}

      <section className="admin-template-diagnostic" aria-labelledby="admin-template-diagnostic-title">
        <h2 id="admin-template-diagnostic-title">Diagnostic template</h2>
        <div className="admin-template-diagnostic-controls">
          <input
            type="search"
            value={templateSearchQuery}
            onChange={(event) => setTemplateSearchQuery(event.target.value)}
            placeholder="Rechercher un template (ex: Purple Celebration)"
            aria-label="Rechercher un template"
          />
          <button type="button" onClick={runTemplateDiagnosticSearch} disabled={templateSearchLoading}>
            {templateSearchLoading ? "Recherche..." : "Rechercher"}
          </button>
        </div>
        {templateSearchResults.length > 0 ? (
          <div className="admin-template-diagnostic-results">
            {templateSearchResults.map((result) => (
              <article key={`admin-search-${result.id}`} className="admin-template-diagnostic-card">
                <img alt={`Apercu ${result.name}`} src={result.preview_url} />
                <strong>{result.name}</strong>
                <small>{`${result.format_label} - ${formatPhotoCount(result.no_of_images)}`}</small>
                <small>
                  {`Categorie actuelle: ${
                    result.primary_category ? (categoryLabelMap.get(result.primary_category) ?? result.primary_category) : "Non classe"
                  }`}
                </small>
                <small>
                  {`Categories detectees: ${
                    result.matched_categories.map((id) => categoryLabelMap.get(id) ?? id).join(", ") || "Aucune"
                  }`}
                </small>
                <small>{`Formats disponibles: ${result.available_formats.join(", ") || "-"}`}</small>
                <small>{`Recherche: ${result.reason}`}</small>
                <small>{`Classement: ${result.classification_reason}`}</small>
                {result.post_url ? <small>{result.post_url}</small> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="admin-layout admin-demandes-layout">
        <div className="admin-table-wrap">
          <table className="admin-table admin-demandes-table">
            <thead>
              <tr>
                <th>Date demande</th>
                <th>Apercus</th>
                <th>Client</th>
                <th>Date evenement</th>
                <th>Type</th>
                <th>Formats (3-5)</th>
                <th>Textes demandes</th>
                <th>Statut</th>
                <th>Preparation IA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={10}>Aucune demande client pour le moment.</td>
                </tr>
              ) : (
                requests.map((request) => {
                  const groups = splitTemplates(request.selected_templates);
                  const ai = aiData(request);
                  const aiRunning = ai.status === "running";

                  return (
                    <tr key={request.id}>
                      <td>{formatDate(request.created_at)}</td>
                      <td>
                        <div className="admin-preview-list">
                          {request.selected_templates.map((template) => (
                            <div className="admin-preview-item" key={template.id}>
                              <img
                                className="admin-preview-thumb"
                                alt={`Apercu ${template.name}`}
                                src={adminPreviewUrl(request, template)}
                              />
                              {isProductionTaskTemplate(request, template) ? (
                                <span className="admin-preview-flag">a creer</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{clientName(request)}</strong>
                        <small>{request.client.email}</small>
                        <small>{request.client.phone}</small>
                      </td>
                      <td>{formatDate(request.event.date)}</td>
                      <td>{request.event.type}</td>
                      <td>
                        <div className="request-formats-cell">
                          <div className="request-format-group">
                            <strong className="request-format-group-title">Obligatoires</strong>
                            <div className="request-format-chip-list">
                              {groups.required.length > 0 ? (
                                groups.required.map((template) => (
                                  <span className="request-format-chip request-format-chip-required" key={`required-${request.id}-${template.id}`}>
                                    {compactFormatLabel(request, template)}
                                  </span>
                                ))
                              ) : (
                                <span className="request-format-chip request-format-chip-empty">Aucun</span>
                              )}
                            </div>
                          </div>
                          <div className="request-format-group">
                            <strong className="request-format-group-title">Optionnels</strong>
                            <div className="request-format-chip-list">
                              {groups.optional.length > 0 ? (
                                groups.optional.map((template) => (
                                  <span className="request-format-chip" key={`optional-${request.id}-${template.id}`}>
                                    {compactFormatLabel(request, template)}
                                  </span>
                                ))
                              ) : (
                                <span className="request-format-chip request-format-chip-empty">Aucun</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{request.customization.main_text}</strong>
                        <small>{request.customization.secondary_text || "Aucun texte secondaire."}</small>
                      </td>
                      <td>
                        <span className={`status-pill status-${request.status}`}>
                          {getEventPicTemplateRequestStatusLabel(request.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ai-status-${ai.status}`}>{aiStatusLabel(ai.status)}</span>
                        {ai.progress_label ? <small>{ai.progress_label}</small> : null}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" onClick={() => setSelectedRequest(request)}>
                            voir detail
                          </button>
                          <a href={`/admin/emails?requestId=${encodeURIComponent(request.id)}`}>
                            Preparer email client
                          </a>
                          <a href={`/admin/planning?focus=${encodeURIComponent(`template_request:${request.id}`)}`}>
                            Voir au planning
                          </a>
                          <a href="/admin/dossiers">
                            Ouvrir dossier
                          </a>
                          <button type="button" onClick={() => createDeliveryFromTemplateRequest(request)}>
                            Creer livraison
                          </button>
                          <button
                            type="button"
                            onClick={() => prepareCanvaFolder(request.id)}
                            disabled={canvaPreparingId === request.id}
                          >
                            {canvaPreparingId === request.id ? "Preparation..." : "Preparer le dossier Canva"}
                          </button>
                          <button
                            type="button"
                            onClick={() => prepareWithAi(request.id)}
                            disabled={aiPreparingId === request.id || aiRunning}
                          >
                            {aiPreparingId === request.id || aiRunning
                              ? "Preparation en cours..."
                              : "Preparer avec IA"}
                          </button>
                          {ai.status === "completed" && ai.brief ? (
                            <button type="button" onClick={() => setSelectedRequest(request)}>
                              Voir fiche IA
                            </button>
                          ) : null}
                          <button
                            className="button-danger"
                            type="button"
                            onClick={() => deleteRequest(request)}
                            disabled={deleteLoadingId === request.id}
                          >
                            {deleteLoadingId === request.id ? "Suppression..." : "Supprimer"}
                          </button>
                          <select
                            aria-label="Changer le statut"
                            value={request.status}
                            onChange={(event) => updateStatus(request.id, event.target.value as EventPicTemplateRequestStatus)}
                          >
                            {TEMPLATE_REQUEST_STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {aiFeedbackById[request.id] ? <small>{aiFeedbackById[request.id]}</small> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="admin-detail admin-demandes-detail" data-detail-tab={detailTab}>
          {selectedRequest ? (
            <>
              <p className="eyebrow">Detail demande</p>
              <h2>{clientName(selectedRequest)}</h2>
              <p className="ai-brief-meta">
                Les liens Canva detectes par l&apos;API TemplateBooth sont repris automatiquement.
                Si l&apos;API ne fournit rien, vous pouvez renseigner le lien manuellement.
              </p>
              <nav className="admin-request-detail-tabs" aria-label="Sections du detail de la demande">
                {ADMIN_REQUEST_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={detailTab === tab.id ? "is-active" : ""}
                    onClick={() => setDetailTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              {detailTab === "canva" ? (
              <details className="canva-pending-imports-panel technical-log-panel">
                <summary>Imports Canva en attente</summary>
                <div className="canva-pending-imports-content">
                <div className="canva-pending-imports-header">
                  <h3>Imports Canva en attente</h3>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="button-diagnostic"
                      onClick={() => void autoAssociateCanvaPendingByOrder()}
                      disabled={
                        canvaPendingLoading ||
                        canvaPendingActionId !== null ||
                        canvaAutoProposalLoading ||
                        canvaAutoProposalValidationLoading
                      }
                    >
                      {canvaAutoProposalLoading ? "Analyse..." : "Associer automatiquement par ordre"}
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => void validateAutoAssociationProposals()}
                      disabled={
                        canvaAutoProposalValidationLoading ||
                        canvaAutoProposalLoading ||
                        canvaAutoProposals.length === 0
                      }
                    >
                      {canvaAutoProposalValidationLoading
                        ? "Validation..."
                        : "Valider les associations proposees"}
                    </button>
                    <button
                      type="button"
                      className="button-diagnostic"
                      onClick={() => void loadCanvaPendingImports()}
                      disabled={canvaPendingLoading || canvaPendingActionId !== null}
                    >
                      {canvaPendingLoading ? "Actualisation..." : "Actualiser"}
                    </button>
                  </div>
                </div>
                <p className="ai-brief-meta">
                  Associez chaque lien detecte a un template/format Event Pic, puis enregistrez ou ignorez.
                </p>
                {canvaPendingFeedback ? <small>{canvaPendingFeedback}</small> : null}
                {canvaAutoProposals.length > 0 ? (
                  <div className="canva-auto-proposals">
                    <strong>Previsualisation association par ordre</strong>
                    <ul>
                      {canvaAutoProposals.map((proposal) => (
                        <li key={proposal.pending_id}>
                          {`Lien ${proposal.order_index} -> ${proposal.proposed_format_label} (${proposal.proposed_template_name}) | confiance ${proposal.confidence}${proposal.section_title ? ` | section ${proposal.section_title}` : ""}${typeof proposal.card_index === "number" ? ` | carte ${proposal.card_index}` : ""}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {scopedCanvaPendingImports.length === 0 ? (
                  <small>Aucun import Canva en attente.</small>
                ) : (
                  <div className="canva-pending-imports-list">
                    {scopedCanvaPendingImports.map((item) => {
                      const currentSelection = canvaPendingSelectionById[item.id] ?? "";
                      const isBusy = canvaPendingActionId === item.id;

                      return (
                        <article className="canva-pending-import-card" key={item.id}>
                          <div className="canva-pending-import-main">
                            {item.image_src ? (
                              <div className="canva-pending-thumb-wrap">
                                <img src={item.image_src} alt={item.image_alt || "Miniature Canva"} className="canva-pending-thumb" />
                              </div>
                            ) : null}
                            <div className="canva-pending-meta">
                              <strong>{item.template_name || "Template non identifie"}</strong>
                              <small>{`Type detecte : ${canvaPendingTypeLabel(item.link_type)}`}</small>
                              <small>{`Section : ${item.section_title || "non detectee"}`}</small>
                              <small>{`Index carte : ${item.card_index ?? "-"}`}</small>
                              <small>{`Confiance : ${item.confidence}`}</small>
                              <small>{`Format detecte : ${item.detected_format || item.detected_layout || "Non detecte"}`}</small>
                              <small>{`Photos detectees : ${item.detected_no_of_images || "non detectees"}`}</small>
                              <small>{`Ratio image : ${item.image_ratio || "-"}`}</small>
                              <small>
                                Lien Canva :{" "}
                                <a href={item.canva_url} target="_blank" rel="noreferrer">
                                  Ouvrir
                                </a>
                              </small>
                              <small>
                                URL TemplateBooth :{" "}
                                {item.parent_templatebooth_url || item.page_url ? (
                                  <a
                                    href={item.parent_templatebooth_url || item.page_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Ouvrir
                                  </a>
                                ) : (
                                  "non disponible"
                                )}
                              </small>
                              <small>
                                Dossier parent Canva :{" "}
                                {item.parent_canva_folder_url ? (
                                  <a href={item.parent_canva_folder_url} target="_blank" rel="noreferrer">
                                    Ouvrir
                                  </a>
                                ) : (
                                  "non detecte"
                                )}
                              </small>
                            </div>
                          </div>
                          <details className="technical-log-panel">
                            <summary>Voir details techniques</summary>
                            <div className="technical-log-scroll">
                              <small>{`URL page source : ${item.source_page_url || item.page_url || "-"}`}</small>
                              <small>{`URL page parent : ${item.parent_templatebooth_url || "-"}`}</small>
                              <small>{`URL Canva : ${item.canva_url}`}</small>
                              {item.parent_canva_folder_url ? (
                                <small>{`Dossier Canva parent : ${item.parent_canva_folder_url}`}</small>
                              ) : null}
                              {item.button_text ? <small>{`Bouton : ${item.button_text}`}</small> : null}
                              {item.image_src ? <small>{`Miniature : ${item.image_src}`}</small> : null}
                              {item.match_reason ? <small>{`Suggestion : ${item.match_reason}`}</small> : null}
                              {item.nearby_text ? <small>{`Contexte : ${item.nearby_text}`}</small> : null}
                            </div>
                          </details>
                          <div className="table-actions canva-pending-actions">
                            <select
                              value={currentSelection}
                              onChange={(event) => updateCanvaPendingSelection(item.id, event.target.value)}
                              disabled={isBusy}
                            >
                              <option value="">Associer a un format...</option>
                              {canvaPendingTemplateOptions.map((option) => (
                                <option key={`${item.id}-${option.key}`} value={option.key}>
                                  {`${option.template.name} | ${option.template.format_label} | ${formatPhotoCount(
                                    option.template.no_of_images
                                  )} | ${option.requestLabel}`}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="button-primary"
                              onClick={() => void resolveCanvaPendingImport(item, "folder_global")}
                              disabled={isBusy}
                            >
                              {isBusy ? "Enregistrement..." : "Associer comme dossier global"}
                            </button>
                            <button
                              type="button"
                              className="button-primary"
                              onClick={() => void resolveCanvaPendingImport(item, "format_link")}
                              disabled={isBusy}
                            >
                              Associer a un format
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => void ignoreCanvaPendingImport(item)}
                              disabled={isBusy}
                            >
                              Ignorer
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                </div>
              </details>
              ) : null}
              {(() => {
                const referenceTemplate = findDiagnosticReferenceTemplate(selectedRequest);
                if (!referenceTemplate) {
                  return null;
                }

                const familyKey = familyKeyFromTemplate(referenceTemplate);
                const familyInputKey = familyKey || referenceTemplate.id;
                const familySourceEntry = findTemplateFamilySourceLink(templateSourceLinks, referenceTemplate);
                const folderUrl = familySourceEntry?.canva_folder_url?.trim() ?? "";
                const folderInputValue = canvaFolderLinkInputByFamilyKey[familyInputKey] ?? folderUrl;
                const folderFeedback = canvaFolderLinkFeedbackByFamilyKey[familyInputKey] ?? "";
                const harvestFeedback = canvaHarvestFeedbackByRequestId[selectedRequest.id];
                const harvestRunning = canvaHarvestRunningRequestId === selectedRequest.id;
                const folderStatus =
                  folderUrl.length > 0 ? "Lien dossier Canva disponible" : "Lien dossier Canva manquant";

                return detailTab === "canva" ? (
                  <section className="admin-card-action-group">
                    <p className="admin-card-action-title">Dossier Canva global</p>
                    <div className="table-actions admin-card-action-row canva-actions">
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => void harvestCanvaAutomatically(selectedRequest, referenceTemplate)}
                        disabled={harvestRunning}
                      >
                        {harvestRunning
                          ? "Recherche automatique..."
                          : "Recuperer liens Canva automatiquement"}
                      </button>
                    </div>
                    {harvestFeedback ? (
                      <div className={`harvest-feedback harvest-feedback-${harvestFeedback.tone}`}>
                        <strong>{harvestFeedback.message}</strong>
                        {harvestFeedback.details ? <small>{harvestFeedback.details}</small> : null}
                        {harvestFeedback.help ? <small>{harvestFeedback.help}</small> : null}
                        {(harvestFeedback.debugLines && harvestFeedback.debugLines.length > 0) ||
                        (harvestFeedback.manualCommands && harvestFeedback.manualCommands.length > 0) ? (
                          <details className="technical-log-panel">
                            <summary>Voir details techniques</summary>
                            <div className="technical-log-scroll">
                              {harvestFeedback.debugLines && harvestFeedback.debugLines.length > 0 ? (
                                <ul className="harvest-debug-list">
                                  {harvestFeedback.debugLines.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              ) : null}
                              {harvestFeedback.manualCommands && harvestFeedback.manualCommands.length > 0 ? (
                                <div className="harvest-feedback-manual">
                                  <small>Lancer manuellement l'extracteur :</small>
                                  <pre>{harvestFeedback.manualCommands.join("\n")}</pre>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                    <details className="technical-log-panel extension-help-panel">
                      <summary>Installer / ouvrir l'aide extension</summary>
                      <div className="technical-log-scroll">
                        <strong>Extraction Canva via Chrome connecte</strong>
                        <small>
                          Vous etes peut-etre connecte dans Chrome, mais pas dans le navigateur Playwright.
                          Utilisez plutot l&apos;extension Chrome locale.
                        </small>
                        <ol>
                          <li>Ouvrez `chrome://extensions` dans Chrome.</li>
                          <li>Activez le mode developpeur.</li>
                          <li>Chargez une extension non empaquetee.</li>
                          <li>
                            Selectionnez le dossier `tools/canva-link-extractor-extension`.
                          </li>
                          <li>Ouvrez TemplateBooth dans Chrome (session connectee).</li>
                          <li>Cliquez l&apos;extension puis &quot;Extraire et importer&quot;.</li>
                        </ol>
                        <small>
                          Les liens trouves sont envoyes vers `http://localhost:3000/api/admin/template-source-links/canva-import`.
                        </small>
                      </div>
                    </details>
                    <small>{folderStatus}</small>
                    <small>
                      Les liens Canva sont a renseigner manuellement depuis l&apos;admin. Une fois enregistres, ils
                      seront repris automatiquement dans les prochaines fiches IA.
                    </small>
                    <div className="table-actions admin-card-action-row canva-actions">
                      {folderUrl ? (
                        <>
                          <a href={folderUrl} target="_blank" rel="noopener noreferrer">
                            Ouvrir dossier Canva
                          </a>
                          <button type="button" onClick={() => copyCanvaFolderLink(familyInputKey, folderUrl)}>
                            Copier lien dossier Canva
                          </button>
                        </>
                      ) : (
                        <span>Lien dossier Canva a renseigner</span>
                      )}
                    </div>
                    <div className="canva-link-editor admin-card-canva-editor">
                      <label htmlFor={`canva-folder-link-${toDomId(familyInputKey)}`}>
                        Lien dossier Canva global
                      </label>
                      <input
                        id={`canva-folder-link-${toDomId(familyInputKey)}`}
                        type="url"
                        value={folderInputValue}
                        placeholder="https://www.canva.com/..."
                        onChange={(event) => updateCanvaFolderLinkInput(familyInputKey, event.target.value)}
                      />
                      <button
                        className="button-primary"
                        type="button"
                        onClick={() => void saveCanvaFolderLink(referenceTemplate)}
                        disabled={canvaFolderSavingKey === familyInputKey}
                      >
                        {canvaFolderSavingKey === familyInputKey
                          ? "Enregistrement..."
                          : "Enregistrer lien dossier Canva"}
                      </button>
                    </div>
                    {folderFeedback ? <small>{folderFeedback}</small> : null}
                  </section>
                ) : null;
              })()}
              {detailTab === "formats" || detailTab === "canva" || detailTab === "sources" ? (
              <div className="admin-selected-template-grid">
                {selectedRequest.selected_templates.map((template) => {
                  const isManualWelcome = isProductionTaskTemplate(selectedRequest, template);
                  const sourceLinkEntry = findTemplateSourceLinkForTemplate(templateSourceLinks, template);
                  const familySourceEntry = findTemplateFamilySourceLink(templateSourceLinks, template);
                  const canvaTemplateUrl = sourceLinkEntry?.canva_template_url?.trim() ?? "";
                  const canvaTemplateKey = templateSourceKey(template);
                  const canvaInputValue = canvaLinkInputByTemplateKey[canvaTemplateKey] ?? canvaTemplateUrl;
                  const canvaDiagnostic = canvaDiagnosticByTemplateKey[canvaTemplateKey];
                  const sourceDetection = canvaDiagnostic?.sourceFilesDetection;
                  const psdUrl = getPsdUrl(template) ?? sourceDetection?.psd_url ?? null;
                  const zipUrl = getZipUrl(template) ?? sourceDetection?.zip_url ?? null;
                  const sourceFileUrl = getSourceFileUrl(template) ?? sourceDetection?.source_file_url ?? null;
                  const sourceStatusText = isManualWelcome
                    ? "Pas de source disponible"
                    : psdUrl
                      ? "PSD detecte par API"
                      : zipUrl
                        ? "ZIP detecte par API"
                        : sourceDetection && sourceDetection.found === false
                          ? "Fichier source non fourni par l'API"
                          : "Fichier source non fourni par l'API";
                  const canvaStatusText = canvaStatusTextForTemplate(sourceLinkEntry, canvaDiagnostic);
                  const canvaFeedback = canvaLinkFeedbackByTemplateKey[canvaTemplateKey];
                  const canvaDiagnosticFeedback = canvaDiagnosticFeedbackByTemplateKey[canvaTemplateKey];

                  return (
                    <article key={template.id} className="admin-selected-template-card">
                      <img
                        className="admin-detail-preview"
                        alt={`Apercu ${template.name}`}
                        src={adminPreviewUrl(selectedRequest, template)}
                      />
                      <strong>{template.format_label}</strong>
                      <small>{template.name}</small>
                      <small>{formatPhotoCount(template.no_of_images)}</small>
                      <small>{sourceStatusText}</small>
                      <small>{`Canva : ${canvaStatusText}`}</small>
                      {welcomeStatus(selectedRequest, template) ? (
                        <small>{welcomeStatus(selectedRequest, template)}</small>
                      ) : null}
                      {template.required ? (
                        <span className="auto-included-pill">
                          {isManualWelcome ? "OBLIGATOIRE - A CREER" : "Inclus automatiquement"}
                        </span>
                      ) : null}
                      <div className="admin-card-action-group">
                        <p className="admin-card-action-title">Source TemplateBooth</p>
                        <div className="table-actions admin-card-action-row source-actions">
                        {!isManualWelcome ? (
                          <>
                            <button type="button" onClick={() => copyPostUrl(template.post_url)}>
                              copier post_url
                            </button>
                            {template.post_url ? (
                              <a href={template.post_url} target="_blank" rel="noopener noreferrer">
                                ouvrir source
                              </a>
                            ) : (
                              <span>post_url non disponible</span>
                            )}
                          </>
                        ) : (
                          <span>Aucune source TemplateBooth disponible - creation Event Pic necessaire</span>
                        )}
                        </div>
                      </div>
                      <details className="admin-card-action-group technical-log-panel">
                        <summary>PSD / ZIP</summary>
                        <div className="table-actions admin-card-action-row psd-actions">
                          {!isManualWelcome && (psdUrl || zipUrl || sourceFileUrl) ? (
                            <>
                              {psdUrl ? (
                                <a href={psdUrl} target="_blank" rel="noopener noreferrer">
                                  Telecharger PSD
                                </a>
                              ) : null}
                              {zipUrl ? (
                                <a href={zipUrl} target="_blank" rel="noopener noreferrer">
                                  Telecharger ZIP
                                </a>
                              ) : null}
                              {!psdUrl && !zipUrl && sourceFileUrl ? (
                                <a href={sourceFileUrl} target="_blank" rel="noopener noreferrer">
                                  Telecharger le fichier source
                                </a>
                              ) : null}
                            </>
                          ) : (
                            <span>{isManualWelcome ? "Pas de source disponible" : "PSD a recuperer manuellement depuis TemplateBooth"}</span>
                          )}
                        </div>
                      </details>
                      <details className="admin-card-action-group technical-log-panel">
                        <summary>Canva</summary>
                        <div className="table-actions admin-card-action-row canva-actions">
                          {canvaTemplateUrl ? (
                            <>
                              <a href={canvaTemplateUrl} target="_blank" rel="noopener noreferrer">
                                Ouvrir Canva
                              </a>
                              <button type="button" onClick={() => copyCanvaLink(template, canvaTemplateUrl)}>
                                Copier lien Canva
                              </button>
                            </>
                          ) : (
                            <span>
                              {familySourceEntry?.canva_folder_url?.trim()
                                ? "Dossier Canva global disponible, lien format a associer."
                                : canvaStatusText === "Lien Canva non fourni par l'API"
                                  ? "Lien Canva non fourni par l'API"
                                  : canvaStatusText === "Diagnostic bloque par rate limit"
                                    ? "Diagnostic bloque par rate limit"
                                    : "Lien Canva a renseigner"}
                            </span>
                          )}
                        </div>
                        {canvaTemplateUrl ? (
                          <small className="canva-link-inline">
                            <a href={canvaTemplateUrl} target="_blank" rel="noreferrer">
                              {canvaTemplateUrl}
                            </a>
                          </small>
                        ) : null}
                        <div className="canva-link-editor admin-card-canva-editor">
                          <label htmlFor={`canva-link-${toDomId(canvaTemplateKey)}`}>Lien Canva du format</label>
                          <input
                            id={`canva-link-${toDomId(canvaTemplateKey)}`}
                            type="url"
                            value={canvaInputValue}
                            placeholder="https://www.canva.com/..."
                            onChange={(event) => updateCanvaLinkInput(template, event.target.value)}
                          />
                          <button
                            className="button-primary"
                            type="button"
                            onClick={() => saveCanvaTemplateLink(template)}
                            disabled={canvaLinkSavingId === canvaTemplateKey}
                          >
                            {canvaLinkSavingId === canvaTemplateKey ? "Enregistrement..." : "Enregistrer lien Canva"}
                          </button>
                        </div>
                      </details>
                      <details className="admin-card-action-group technical-log-panel">
                        <summary>Diagnostic API</summary>
                        <div className="table-actions admin-card-action-row diagnostic-actions">
                        <button
                          className="button-diagnostic"
                          type="button"
                          onClick={() => runCanvaApiDiagnostic(template)}
                          disabled={canvaDiagnosticLoadingId === canvaTemplateKey}
                        >
                          {canvaDiagnosticLoadingId === canvaTemplateKey
                            ? "Diagnostic en cours..."
                            : "Diagnostiquer liens Canva API"}
                        </button>
                        {canvaDiagnostic?.cache?.checked_at ? (
                          <button
                            className="button-diagnostic"
                            type="button"
                            onClick={() => runCanvaApiDiagnostic(template, true)}
                            disabled={canvaDiagnosticLoadingId === canvaTemplateKey}
                          >
                            Relancer diagnostic
                          </button>
                        ) : null}
                        {canvaDiagnostic?.canvaDetection?.canva_url || canvaDiagnostic?.canvaDetection?.url ? (
                          <button
                            className="button-diagnostic"
                            type="button"
                            onClick={() =>
                              useDetectedCanvaLink(
                                template,
                                (canvaDiagnostic.canvaDetection.canva_url ?? canvaDiagnostic.canvaDetection.url)!
                              )
                            }
                          >
                            Utiliser le lien detecte
                          </button>
                        ) : null}
                        </div>
                      </details>
                      {canvaDiagnostic ? (
                        <div className="canva-diagnostic-block">
                          <small>
                            {`Dernier diagnostic : ${formatDateTimeWithAt(
                              canvaDiagnostic.checked_at ?? canvaDiagnostic.cache?.checked_at ?? null
                            )}`}
                          </small>
                          <small>{`Statut : ${canvaDiagnosticStatusLabel(canvaDiagnostic)}`}</small>
                          <small>
                            {`Template teste: ${canvaDiagnostic.selectedTemplate.name ?? template.name}`}
                          </small>
                          <small>{`Champs inspectes: ${canvaDiagnostic.inspectedFieldsCount ?? 0}`}</small>
                          <small>{`Champs suspects: ${canvaDiagnostic.matchingFields.length}`}</small>
                          <small>{`Lien Canva trouve: ${canvaDiagnostic.canvaDetection?.found || canvaDiagnostic.canvaDetection?.url ? "oui" : "non"}`}</small>
                          <small>{canvaDiagnosticStatusMessage(canvaDiagnostic)}</small>
                          <small>{`Conclusion : ${canvaDiagnostic.conclusion}`}</small>
                          <details className="technical-log-panel">
                            <summary>Voir details techniques</summary>
                            <div className="technical-log-scroll">
                              {(canvaDiagnostic.canvaDetection?.canva_url ?? canvaDiagnostic.canvaDetection?.url) ? (
                                <small>
                                  {`Lien Canva detecte : ${
                                    canvaDiagnostic.canvaDetection.canva_url ?? canvaDiagnostic.canvaDetection.url
                                  }`}
                                </small>
                              ) : (
                                <small>
                                  L'API TemplateBooth ne fournit pas de lien Canva exploitable pour ce template. Le bouton Edit in Canva existe probablement uniquement sur la page membre TemplateBooth.
                                </small>
                              )}
                              {canvaDiagnostic.canvaDetection?.key_path || canvaDiagnostic.canvaDetection?.match_path ? (
                                <small>
                                  {`Chemin du champ: ${
                                    canvaDiagnostic.canvaDetection.key_path ??
                                    canvaDiagnostic.canvaDetection.match_path
                                  }`}
                                </small>
                              ) : null}
                              <small>{`PSD detecte par API: ${canvaDiagnostic.sourceFilesDetection?.psd_url ? "oui" : "non"}`}</small>
                              <small>{`ZIP detecte par API: ${canvaDiagnostic.sourceFilesDetection?.zip_url ? "oui" : "non"}`}</small>
                              <small>{`Conclusion sources: ${canvaDiagnostic.source_files_conclusion ?? "-"}`}</small>
                              {canvaDiagnostic.sourceFilesDetection?.psd_url ? (
                                <small>{`PSD API : ${canvaDiagnostic.sourceFilesDetection.psd_url}`}</small>
                              ) : null}
                              {canvaDiagnostic.sourceFilesDetection?.zip_url ? (
                                <small>{`ZIP API : ${canvaDiagnostic.sourceFilesDetection.zip_url}`}</small>
                              ) : null}
                              {!canvaDiagnostic.sourceFilesDetection?.psd_url && !canvaDiagnostic.sourceFilesDetection?.zip_url ? (
                                <small>Fichier source non fourni par l'API.</small>
                              ) : null}
                              <small>
                                {`Cles top-level: ${canvaDiagnostic.availableKeys.length} | Key paths: ${
                                  canvaDiagnostic.allKeyPaths?.length ?? 0
                                }`}
                              </small>
                              {canvaDiagnostic.cache ? (
                                <small>
                                  {`Cache diagnostic : ${
                                    canvaDiagnostic.cache.hit ? "utilise" : "mis a jour"
                                  }${canvaDiagnostic.cache.status ? ` (${canvaDiagnostic.cache.status})` : ""}`}
                                </small>
                              ) : null}
                              {canvaDiagnostic.valueHints && canvaDiagnostic.valueHints.length > 0 ? (
                                <details>
                                  <summary>Valeurs suspectes detectees</summary>
                                  <ul>
                                    {canvaDiagnostic.valueHints.slice(0, 12).map((value) => (
                                      <li key={value}>{value}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                              {canvaDiagnostic.apiQueries && canvaDiagnostic.apiQueries.length > 0 ? (
                                <details>
                                  <summary>Requetes API testees</summary>
                                  <ul>
                                    {canvaDiagnostic.apiQueries.slice(0, 10).map((query) => (
                                      <li key={`${query.label}:${query.url}`}>
                                        {`${query.label} - ${query.count} templates - ${query.pages_searched} page(s) - ${query.url}${
                                          query.error ? ` - ${query.error}` : ""
                                        }`}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                              {canvaDiagnostic.matchingFields.length > 0 ? (
                                <details>
                                  <summary>Champs detectes</summary>
                                  <ul>
                                    {canvaDiagnostic.matchingFields.slice(0, 16).map((field) => (
                                      <li key={`${field.path}:${field.key}`}>{`${field.path} -> ${field.value}`}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </div>
                          </details>
                        </div>
                      ) : null}
                      {canvaDiagnosticFeedback ? <small>{canvaDiagnosticFeedback}</small> : null}
                      {canvaFeedback ? <small>{canvaFeedback}</small> : null}
                      {template.required && template.layout === "46postcard-p" && template.no_of_images === 1 ? (
                        <div className="table-actions admin-card-action-row">
                          <button
                            type="button"
                            onClick={() => setPreferredRequiredPortrait(selectedRequest, template)}
                            disabled={preferredPortraitLoadingId === `${selectedRequest.id}:${template.id}`}
                          >
                            {preferredPortraitLoadingId === `${selectedRequest.id}:${template.id}`
                              ? "Enregistrement..."
                              : "Definir comme portrait obligatoire prefere"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              ) : null}
              {detailTab === "sources" && selectedRequestWelcome ? (
                <section className="welcome-diagnostic-panel">
                  <h3>Diagnostic welcome screen API</h3>
                  <p>
                    Verifiez les candidats welcome screens proposes par l&apos;API TemplateBooth avant de remplacer le
                    placeholder.
                  </p>
                  <div className="table-actions">
                    <button
                      type="button"
                      onClick={() => runWelcomeDiagnostic(selectedRequest)}
                      disabled={welcomeDiagnosticLoadingId === selectedRequest.id}
                    >
                      {welcomeDiagnosticLoadingId === selectedRequest.id
                        ? "Recherche en cours..."
                        : "Rechercher welcome screen API"}
                    </button>
                  </div>
                  {selectedRequestManualWelcome ? (
                    <div className="table-actions">
                      <label>
                        URL welcome source
                        <input
                          type="url"
                          placeholder="https://..."
                          value={selectedRequestManualWelcome.welcome_screen_url}
                          onChange={(event) =>
                            updateManualWelcomeInput(
                              selectedRequest.id,
                              "welcome_screen_url",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        URL apercu welcome
                        <input
                          type="url"
                          placeholder="https://..."
                          value={selectedRequestManualWelcome.welcome_preview_url}
                          onChange={(event) =>
                            updateManualWelcomeInput(
                              selectedRequest.id,
                              "welcome_preview_url",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        Taille source
                        <select
                          value={selectedRequestManualWelcome.welcome_source_size}
                          onChange={(event) =>
                            updateManualWelcomeInput(
                              selectedRequest.id,
                              "welcome_source_size",
                              event.target.value as ManualWelcomeInput["welcome_source_size"]
                            )
                          }
                        >
                          <option value="1366x1024">1366x1024</option>
                          <option value="1920x1080">1920x1080</option>
                        </select>
                      </label>
                      <label>
                        Note source
                        <input
                          type="text"
                          placeholder="Ex: lien manuel pack membre"
                          value={selectedRequestManualWelcome.welcome_source_note}
                          onChange={(event) =>
                            updateManualWelcomeInput(
                              selectedRequest.id,
                              "welcome_source_note",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => applyManualWelcome(selectedRequest)}
                        disabled={welcomeApplyLoadingId === `${selectedRequest.id}:manual`}
                      >
                        {welcomeApplyLoadingId === `${selectedRequest.id}:manual`
                          ? "Application..."
                          : "Forcer ce welcome screen pour cette famille"}
                      </button>
                    </div>
                  ) : null}
                  {selectedRequestWelcomeFeedback ? <p className="inline-feedback">{selectedRequestWelcomeFeedback}</p> : null}
                  {selectedRequestWelcomeDiagnostic ? (
                    <div className="welcome-diagnostic-results">
                      <div className="welcome-diagnostic-summary">
                        <strong>Synthese selection welcome</strong>
                        {selectedRequestWelcomeDiagnostic.bestCandidate ? (
                          <>
                            <small>{`Candidat retenu: ${selectedRequestWelcomeDiagnostic.bestCandidate.name}`}</small>
                            <small>{`Score: ${selectedRequestWelcomeDiagnostic.bestCandidate.score}`}</small>
                            <small>{`Touch to Start: ${selectedRequestWelcomeDiagnostic.bestCandidate.touch_to_start ? "oui" : "non"}`}</small>
                            <small>
                              {`Dimensions: ${
                                selectedRequestWelcomeDiagnostic.bestCandidate.source_width &&
                                selectedRequestWelcomeDiagnostic.bestCandidate.source_height
                                  ? `${selectedRequestWelcomeDiagnostic.bestCandidate.source_width}x${selectedRequestWelcomeDiagnostic.bestCandidate.source_height}`
                                  : "inconnues"
                              }`}
                            </small>
                            <small>
                              {`Source: ${
                                selectedRequestWelcomeDiagnostic.bestCandidateSource === "manual_override"
                                  ? "override manuel"
                                  : selectedRequestWelcomeDiagnostic.bestCandidateSource === "same_pack_cache"
                                    ? "cache meme pack"
                                    : "API TemplateBooth"
                              }`}
                            </small>
                            <small>{`Raison: ${selectedRequestWelcomeDiagnostic.bestCandidate.match_reason || "-"}`}</small>
                          </>
                        ) : (
                          <>
                            <small>Aucun candidat fiable. Placeholder Event Pic recommande.</small>
                            <small>Source: placeholder Event Pic</small>
                          </>
                        )}
                      </div>
                      <div className="welcome-diagnostic-queries">
                        <strong>Requetes API</strong>
                        {selectedRequestWelcomeDiagnostic.apiQueries.map((query) => (
                          <small key={query.url}>{`${query.url} (${query.count})`}</small>
                        ))}
                      </div>
                      <div className="welcome-diagnostic-candidates">
                        {selectedRequestWelcomeDiagnostic.welcomeCandidates.slice(0, 6).map((candidate) => (
                          <article
                            className="welcome-diagnostic-candidate"
                            key={`${candidate.id}-${candidate.post_url ?? "none"}`}
                          >
                            <img
                              alt={`Apercu ${candidate.name}`}
                              src={candidate.src ?? candidate.poster ?? WELCOME_PLACEHOLDER_PREVIEW}
                            />
                            <strong>{candidate.name}</strong>
                            <small>{`Score: ${candidate.score}`}</small>
                            <small>{candidate.match_reason || "Aucun detail de correspondance."}</small>
                            <small>{candidate.type_name ?? candidate.type ?? "Welcome screen"}</small>
                            <small>
                              {`Dimensions: ${
                                candidate.source_width && candidate.source_height
                                  ? `${candidate.source_width}x${candidate.source_height}`
                                  : "inconnues"
                              }`}
                            </small>
                            <small>{`Touch to Start: ${candidate.touch_to_start ? "oui" : "non"}`}</small>
                            {candidate.post_url ? <small>{candidate.post_url}</small> : null}
                            <button
                              type="button"
                              onClick={() => applyWelcomeCandidate(selectedRequest.id, candidate)}
                              disabled={
                                (!isReliableWelcomeCandidate(candidate) && !candidate.touch_to_start) ||
                                welcomeApplyLoadingId === `${selectedRequest.id}:${candidate.id}`
                              }
                            >
                              {welcomeApplyLoadingId === `${selectedRequest.id}:${candidate.id}`
                                ? "Application..."
                                : "Utiliser ce welcome screen"}
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {detailTab === "resume" ? (
              <dl>
                <div>
                  <dt>Date demande</dt>
                  <dd>{formatDate(selectedRequest.created_at)}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedRequest.client.email}</dd>
                </div>
                <div>
                  <dt>Telephone</dt>
                  <dd>{selectedRequest.client.phone}</dd>
                </div>
                <div>
                  <dt>Date evenement</dt>
                  <dd>{formatDate(selectedRequest.event.date)}</dd>
                </div>
                <div>
                  <dt>Type evenement</dt>
                  <dd>{selectedRequest.event.type}</dd>
                </div>
                <div>
                  <dt>Nombre de formats</dt>
                  <dd>{selectedRequest.selected_templates.length} / 5</dd>
                </div>
                <div>
                  <dt>Texte principal</dt>
                  <dd>{selectedRequest.customization.main_text}</dd>
                </div>
                <div>
                  <dt>Texte secondaire</dt>
                  <dd>{selectedRequest.customization.secondary_text || "Aucun texte secondaire."}</dd>
                </div>
                <div>
                  <dt>Consignes</dt>
                  <dd>{selectedRequest.customization.notes || "Aucune consigne particuliere."}</dd>
                </div>
                <div>
                  <dt>Dossier Canva</dt>
                  <dd>
                    <span className={`status-pill canva-status-${selectedRequest.automation.canva_folder_status}`}>
                      {canvaStatusLabel(selectedRequest.automation.canva_folder_status)}
                    </span>
                    {selectedRequest.automation.canva_folder_url ? (
                      <a href={selectedRequest.automation.canva_folder_url} target="_blank" rel="noopener noreferrer">
                        Ouvrir le dossier Canva
                      </a>
                    ) : null}
                    {selectedRequest.automation.canva_error ? <small>{selectedRequest.automation.canva_error}</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>{getEventPicTemplateRequestStatusLabel(selectedRequest.status)}</dd>
                </div>
                <div>
                  <dt>Avancement IA</dt>
                  <dd>
                    <span className={`status-pill ai-status-${aiData(selectedRequest).status}`}>
                      {aiStatusLabel(aiData(selectedRequest).status)}
                    </span>
                    {aiData(selectedRequest).progress_label ? <small>{aiData(selectedRequest).progress_label}</small> : null}
                    {aiData(selectedRequest).started_at ? (
                      <small>{`Lancement: ${formatDate(aiData(selectedRequest).started_at)}`}</small>
                    ) : null}
                    {aiData(selectedRequest).completed_at ? (
                      <small>{`Fin: ${formatDate(aiData(selectedRequest).completed_at)}`}</small>
                    ) : null}
                    {aiData(selectedRequest).error_message ? <small>{aiData(selectedRequest).error_message}</small> : null}
                    {aiData(selectedRequest).status === "not_configured" ? (
                      <small>Ajoutez OPENAI_API_KEY dans .env.local pour activer la preparation IA.</small>
                    ) : null}
                  </dd>
                </div>
              </dl>
              ) : null}

              {detailTab === "ia" &&
              (selectedRequestBrief || selectedRequestAiStatus === "running" || selectedRequestAiStatus === "error") ? (
                <section className="ai-brief-panel">
                  <div className="ai-brief-header">
                    <h3>Fiche de préparation IA</h3>
                    <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => copyAiBrief(selectedRequest.id, selectedRequest, selectedRequestBrief)}
                          disabled={!selectedRequestBrief}
                        >
                          Copier la fiche
                        </button>
                      <button
                        type="button"
                        onClick={() => prepareWithAi(selectedRequest.id)}
                        disabled={aiPreparingId === selectedRequest.id || aiData(selectedRequest).status === "running"}
                      >
                        {aiPreparingId === selectedRequest.id || aiData(selectedRequest).status === "running"
                          ? "Régénération..."
                          : "Régénérer la fiche IA"}
                      </button>
                    </div>
                  </div>
                  <p className="ai-model-label">{`Modèle IA utilisé : ${briefModelLabel(selectedRequestBrief)}`}</p>
                  <p className="ai-brief-meta">
                    {`Date de génération : ${formatDateTimeWithAt(selectedRequestBriefGeneratedAt)}`}
                    {selectedRequestAiStartedAt ? ` | Lancement IA : ${formatDateTimeWithAt(selectedRequestAiStartedAt)}` : ""}
                    {selectedRequestAiCompletedAt ? ` | Fin IA : ${formatDateTimeWithAt(selectedRequestAiCompletedAt)}` : ""}
                  </p>
                  {selectedRequestAiStatus === "running" ? <p className="ai-brief-meta">Génération en cours...</p> : null}
                  {selectedRequestAiStatus === "error" ? (
                    <p className="ai-brief-meta">
                      {`Échec de génération${selectedRequestAiCompletedAt ? ` le ${formatDateTimeWithAt(selectedRequestAiCompletedAt)}` : ""}`}
                    </p>
                  ) : null}

                  {selectedRequestBrief ? (
                    <>
                  <div className="ai-brief-grid">
                    <article className="ai-brief-card">
                      <h4>Résumé rapide</h4>
                      <ul>
                        <li>{`Dossier Canva global : ${selectedRequestCanvaFolderStatus}`}</li>
                        <li>{`Client : ${selectedRequestBrief.summary?.client ?? "Non renseigné"}`}</li>
                        <li>{`Email : ${selectedRequestBrief.summary?.email ?? "Non renseigné"}`}</li>
                        <li>{`Téléphone : ${selectedRequestBrief.summary?.phone ?? "Non renseigné"}`}</li>
                        <li>{`Date événement : ${selectedRequestBrief.summary?.event_date ?? selectedRequestBrief.event_date}`}</li>
                        <li>{`Type événement : ${selectedRequestBrief.summary?.event_type ?? selectedRequestBrief.event_type}`}</li>
                        <li>{`Template choisi : ${selectedRequestBrief.summary?.template_selected ?? "Non renseigné"}`}</li>
                        <li>{`Nombre total de formats : ${selectedRequestBrief.summary?.total_formats ?? selectedRequestBrief.selected_formats.length}`}</li>
                        <li>{`Statut global : ${selectedRequestBrief.summary?.global_status ?? selectedRequestBrief.status_recommended?.status ?? "À préparer"}`}</li>
                      </ul>
                      <p className="ai-status-recommended">
                        <strong>{`Statut recommandé : ${selectedRequestBrief.status_recommended?.status ?? "À préparer"}`}</strong>
                        <span>{selectedRequestBrief.status_recommended?.reason ?? "Les sources doivent être vérifiées avant production."}</span>
                      </p>
                    </article>

                    <article className="ai-brief-card">
                      <h4>Actions prioritaires</h4>
                      <ul>
                        {linesOrFallback(selectedRequestBrief.priority_actions, "Aucune action prioritaire.").map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </article>
                  </div>

                    <article className="ai-brief-card">
                      <h4>Formats à produire</h4>
                      <div className="ai-brief-table-wrap">
                        <table className="ai-brief-table">
                          <thead>
                          <tr>
                            <th>Format</th>
                            <th>Photos</th>
                            <th>Type</th>
                            <th>Source</th>
                            <th>Canva</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedRequestBrief.selected_formats_table ?? []).map((row, index) => (
                            <tr key={`${row.format}-${row.template_name}-${index}`}>
                              <td>
                                <strong>{row.format}</strong>
                                {row.template_name ? <small>{row.template_name}</small> : null}
                              </td>
                              <td>{row.photo_count}</td>
                              <td>{row.requirement}</td>
                              <td>{row.source_status}</td>
                              <td>{row.canva_status ?? "À renseigner"}</td>
                              <td>{row.expected_action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <div className="ai-brief-grid">
                    <article className="ai-brief-card">
                      <h4>Textes client</h4>
                      <ul>
                        <li>{`Texte principal : ${selectedRequestBrief.client_texts?.primary_text ?? selectedRequestBrief.primary_text ?? "Non renseigné"}`}</li>
                        <li>{`Texte secondaire : ${selectedRequestBrief.client_texts?.secondary_text ?? selectedRequestBrief.secondary_text ?? "Non renseigné"}`}</li>
                        <li>{`Consignes particulières : ${selectedRequestBrief.client_texts?.notes ?? selectedRequestBrief.special_instructions ?? "Non renseigné"}`}</li>
                      </ul>
                    </article>

                    <article className="ai-brief-card">
                      <h4>Fond d’écran</h4>
                      <ul>
                        <li>{`Source : ${selectedRequestBrief.welcome_screen?.source ?? "Non renseigné"}`}</li>
                        <li>{`Action : ${selectedRequestBrief.welcome_screen?.action ?? "Non renseigné"}`}</li>
                        <li>{`Statut : ${selectedRequestBrief.welcome_screen?.status ?? "Non renseigné"}`}</li>
                        <li>{`Attention : ${selectedRequestBrief.welcome_screen?.attention ?? "Vérifier la lisibilité sur écran d’accueil LumaBooth."}`}</li>
                      </ul>
                    </article>
                  </div>

                  <div className="ai-brief-grid">
                    <article className="ai-brief-card">
                      <h4>Production Photoshop / PSD</h4>
                      <ul>
                        <li>
                          {`Statut : ${photoshopStatusLabel(
                            selectedRequestBriefTotalFormats,
                            selectedRequestPsdAvailableCount,
                            selectedRequestPsdMissingCount
                          )}`}
                        </li>
                        <li>{`PSD disponibles : ${selectedRequestPsdAvailableCount} / ${selectedRequestBriefTotalFormats}`}</li>
                        <li>{`PSD manquants : ${selectedRequestPsdMissingCount} / ${selectedRequestBriefTotalFormats}`}</li>
                        <li>Action principale : récupérer les sources PSD TemplateBooth, puis intégrer les textes client.</li>
                        <li>Exports attendus : PNG/JPG finaux pour chaque format.</li>
                      </ul>
                    </article>

                    <article className="ai-brief-card">
                      <h4>Production Canva</h4>
                      <p className="ai-brief-note">
                        Les liens Canva detectes par l&apos;API TemplateBooth sont repris automatiquement.
                        Si l&apos;API ne fournit rien, renseignez le lien ici pour les prochaines fiches IA.
                      </p>
                      <ul>
                        <li>{`Dossier Canva global : ${selectedRequestCanvaFolderStatus}`}</li>
                        <li>
                          {`Statut : ${canvaStatusSummaryLabel(
                            selectedRequestCanvaFormatsTotalCount,
                            selectedRequestCanvaFormatsAvailableCount,
                            selectedRequestCanvaFormatsMissingCount
                          )}`}
                        </li>
                        <li>
                          {`Liens Canva formats disponibles : ${selectedRequestCanvaFormatsAvailableCount} / ${selectedRequestCanvaFormatsTotalCount}`}
                        </li>
                        <li>{`Liens Canva formats manquants : ${selectedRequestCanvaFormatsMissingCount} / ${selectedRequestCanvaFormatsTotalCount}`}</li>
                        {selectedRequestBrief.canva?.global_folder_url && selectedRequestCanvaFormatsMissingCount > 0 ? (
                          <li>Dossier Canva global disponible, liens format a associer si necessaire.</li>
                        ) : null}
                        <li>Action principale : renseigner les liens Canva ou créer les designs correspondants.</li>
                        <li>Contrôle attendu : cohérence graphique et textes identiques sur tous les formats.</li>
                      </ul>
                    </article>
                  </div>

                  <div className="ai-brief-grid">
                    <article className="ai-brief-card">
                      <h4>Checklist LumaBooth</h4>
                      <ul>
                        {linesOrFallback(selectedRequestBrief.lumabooth_checklist, "Aucune checklist LumaBooth.").map(
                          (line) => (
                            <li key={`luma-${line}`}>{line}</li>
                          )
                        )}
                      </ul>
                    </article>

                    <article className="ai-brief-card">
                      <h4>Nommage des fichiers</h4>
                      <ul>
                        {linesOrFallback(
                          selectedRequestBrief.final_file_names ?? selectedRequestBrief.file_naming_recommendations,
                          "Aucun nom de fichier proposé."
                        ).map((line) => (
                          <li key={`file-${line}`}>{line}</li>
                        ))}
                      </ul>
                    </article>
                  </div>
                  </>
                  ) : null}
                </section>
              ) : null}

              {detailTab === "historique" ? (
                <section className="admin-card-action-group">
                  <h3>Historique de la demande</h3>
                  <ul>
                    <li>{`Creee le : ${formatDateTimeWithAt(selectedRequest.created_at)}`}</li>
                    <li>{`Statut actuel : ${getEventPicTemplateRequestStatusLabel(selectedRequest.status)}`}</li>
                    <li>{`Nombre de formats : ${selectedRequest.selected_templates.length}`}</li>
                    <li>{`Canva : ${canvaStatusLabel(selectedRequest.automation.canva_folder_status)}`}</li>
                    <li>{`IA : ${aiStatusLabel(aiData(selectedRequest).status)}`}</li>
                    <li>{`Lancement IA : ${formatDateTimeWithAt(aiData(selectedRequest).started_at)}`}</li>
                    <li>{`Fin IA : ${formatDateTimeWithAt(aiData(selectedRequest).completed_at)}`}</li>
                  </ul>
                </section>
              ) : null}

              <div className="table-actions">
                {TEMPLATE_REQUEST_STATUSES.map((status) => (
                  <button key={status.value} type="button" onClick={() => updateStatus(selectedRequest.id, status.value)}>
                    {status.label}
                  </button>
                ))}
                <a href={`/admin/emails?requestId=${encodeURIComponent(selectedRequest.id)}`}>
                  Preparer email client
                </a>
                <a href={`/admin/planning?focus=${encodeURIComponent(`template_request:${selectedRequest.id}`)}`}>
                  Voir au planning
                </a>
                <a href="/admin/dossiers">
                  Ouvrir dossier
                </a>
                <button type="button" onClick={() => createDeliveryFromTemplateRequest(selectedRequest)}>
                  Creer livraison
                </button>
                <button
                  type="button"
                  onClick={() => prepareCanvaFolder(selectedRequest.id)}
                  disabled={canvaPreparingId === selectedRequest.id}
                >
                  {canvaPreparingId === selectedRequest.id ? "Preparation..." : "Preparer le dossier Canva"}
                </button>
                <button
                  type="button"
                  onClick={() => prepareWithAi(selectedRequest.id)}
                  disabled={aiPreparingId === selectedRequest.id || aiData(selectedRequest).status === "running"}
                >
                  {aiPreparingId === selectedRequest.id || aiData(selectedRequest).status === "running"
                    ? "Preparation en cours..."
                    : "Preparer avec IA"}
                </button>
                <button
                  className="button-danger"
                  type="button"
                  onClick={() => deleteRequest(selectedRequest)}
                  disabled={deleteLoadingId === selectedRequest.id}
                >
                  {deleteLoadingId === selectedRequest.id ? "Suppression..." : "Supprimer"}
                </button>
              </div>
              {aiFeedbackById[selectedRequest.id] ? <p className="inline-feedback">{aiFeedbackById[selectedRequest.id]}</p> : null}
            </>
          ) : (
            <div className="empty-state">Selectionnez une demande pour voir le detail.</div>
          )}
        </aside>
      </section>
    </main>
  );
}
