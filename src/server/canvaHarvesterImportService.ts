import { promises as fs } from "node:fs";
import path from "node:path";
import type { CachedTemplate } from "@/src/server/eventPicTemplateService";
import { getTemplateFamily, listCachedTemplates } from "@/src/server/eventPicTemplateService";
import { findTemplateSourceLink, TemplateSourceLink, upsertTemplateSourceLink } from "@/src/server/templateSourceLinks";

const pendingImportsPath = path.join(process.cwd(), "data", "canva-import-pending.json");

export type HarvesterConfidence = "high" | "medium" | "low";
export type CanvaImportPendingStatus = "pending" | "resolved" | "ignored";
export type CanvaPendingLinkType = "folder_global" | "format_link" | "unknown";

export type CanvaHarvesterImportItem = {
  template_id?: string;
  template_name?: string;
  source_page_url?: string;
  page_url?: string;
  parent_templatebooth_url?: string;
  parent_canva_folder_url?: string;
  section_title?: string;
  card_index?: number | string;
  image_src?: string;
  image_alt?: string;
  image_width?: number | string;
  image_height?: number | string;
  image_ratio?: string | number;
  button_text?: string;
  canva_folder_url?: string;
  canva_template_url?: string;
  canva_url?: string;
  detected_type?: CanvaPendingLinkType | string;
  detected_format?: string;
  detected_layout?: string;
  detected_no_of_images?: string;
  confidence: HarvesterConfidence;
  nearby_text?: string;
  detected_at?: string;
};

export type CanvaImportPendingItem = {
  id: string;
  source: "templatebooth_harvester";
  link_type: CanvaPendingLinkType;
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
  confidence: HarvesterConfidence;
  nearby_text: string;
  detected_at: string;
  status: CanvaImportPendingStatus;
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
  resolved_at?: string;
  resolved_template_id?: string;
  resolved_format_label?: string;
  resolved_layout?: string;
  resolved_no_of_images?: string;
  resolved_family_key?: string;
};

export type CanvaAutoAssociationProposal = {
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
  confidence: HarvesterConfidence;
  reason: string;
};

type CandidateMatch = {
  template: CachedTemplate | null;
  score: number;
  threshold: number;
  strongMatch: boolean;
  reason: string;
};

type NormalizedImportLink = {
  template_id?: string;
  template_name?: string;
  source_page_url?: string;
  page_url?: string;
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
  link_type: CanvaPendingLinkType;
  detected_format?: string;
  detected_layout?: string;
  detected_no_of_images?: string;
  confidence: HarvesterConfidence;
  nearby_text?: string;
  detected_at?: string;
};

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

function normalizePostUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? value;
}

function normalizeNoOfImagesToken(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.floor(value)}images`;
  }

  const text = normalizeText(value);

  if (!text) {
    return "";
  }

  const onlyDigits = text.match(/^(\d+)$/);
  if (onlyDigits) {
    return `${onlyDigits[1]}images`;
  }

  const imagePattern = text.match(/^(\d+)\s*(?:photo|photos|image|images)$/i);
  if (imagePattern) {
    return `${imagePattern[1]}images`;
  }

  return text;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.trim().replace(",", "."));
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return 0;
}

function parseRatio(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }

  if (text.includes(":")) {
    const [firstRaw = "", secondRaw = ""] = text.split(":");
    const first = normalizeNumber(firstRaw);
    const second = normalizeNumber(secondRaw);
    if (first > 0 && second > 0) {
      return first / second;
    }
  }

  return normalizeNumber(text);
}

function parseConfidence(value: unknown): HarvesterConfidence {
  const normalized = normalizeSearchText(normalizeText(value));

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "medium";
}

function isCanvaUrl(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes("canva.com") || normalized.includes("/design/") || normalized.includes("/template/");
}

function normalizeCanvaUrl(value: string) {
  return normalizeText(value).replace(/[)\]}>,.;]+$/g, "");
}

function detectLayoutFromText(text: string) {
  const normalized = normalizeSearchText(text);

  if (!normalized) {
    return "";
  }

  if (
    normalized.includes("2x6") ||
    normalized.includes("strip") ||
    normalized.includes("bande verticale")
  ) {
    return "26strip";
  }

  if (normalized.includes("portrait")) {
    return "46postcard-p";
  }

  if (normalized.includes("paysage") || normalized.includes("landscape")) {
    return "46postcard-l";
  }

  if (
    normalized.includes("welcome") ||
    normalized.includes("fond ecran") ||
    normalized.includes("lumabooth") ||
    normalized.includes("1920x1080") ||
    normalized.includes("1366x1024")
  ) {
    return "welcome";
  }

  return "";
}

function detectNoOfImagesFromText(text: string) {
  const normalized = normalizeSearchText(text);

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/(\d+)\s*(?:photo|photos|image|images)\b/i);
  if (!match) {
    return "";
  }

  return `${match[1]}images`;
}

function normalizeLayout(value: unknown) {
  const text = normalizeSearchText(normalizeText(value));

  if (!text) {
    return "";
  }

  if (text === "26strip" || text === "2x6" || text === "strip") {
    return "26strip";
  }

  if (text === "46postcard p" || text === "46postcard-p" || text.includes("portrait")) {
    return "46postcard-p";
  }

  if (
    text === "46postcard l" ||
    text === "46postcard-l" ||
    text.includes("paysage") ||
    text.includes("landscape")
  ) {
    return "46postcard-l";
  }

  if (text.includes("welcome") || text.includes("1920x1080") || text.includes("1366x1024")) {
    return "welcome";
  }

  return "";
}

function formatLabelFromLayout(layout: string) {
  if (layout === "26strip") {
    return "Bande verticale 2x6";
  }

  if (layout === "46postcard-p") {
    return "Portrait 10x15 / 4x6";
  }

  if (layout === "46postcard-l") {
    return "Paysage 10x15 / 4x6";
  }

  return "Fond d'ecran 1920x1080";
}

function detectLayout(
  item: {
    detected_layout?: unknown;
    detected_format?: unknown;
    nearby_text?: unknown;
    section_title?: unknown;
    image_ratio?: unknown;
  }
) {
  const explicitLayout = normalizeLayout(item.detected_layout);
  if (explicitLayout) {
    return explicitLayout;
  }

  const sectionTitle = normalizeSearchText(normalizeText(item.section_title));
  if (sectionTitle.includes("welcome screen")) {
    return "welcome";
  }

  const ratio = parseRatio(item.image_ratio);
  if (ratio > 0) {
    if (ratio <= 0.58) {
      return "26strip";
    }

    if (ratio >= 1.6) {
      return sectionTitle.includes("welcome") ? "welcome" : "46postcard-l";
    }

    if (ratio < 1) {
      return "46postcard-p";
    }

    if (ratio >= 1) {
      return "46postcard-l";
    }
  }

  return detectLayoutFromText(
    [item.section_title, item.detected_format, item.nearby_text].map((value) => normalizeText(value)).join(" ")
  );
}

function detectNoOfImages(
  item: {
    detected_no_of_images?: unknown;
    detected_format?: unknown;
    nearby_text?: unknown;
    image_alt?: unknown;
  }
) {
  const explicit = normalizeNoOfImagesToken(item.detected_no_of_images);
  if (explicit) {
    return explicit;
  }

  return detectNoOfImagesFromText(
    [item.detected_format, item.nearby_text, item.image_alt].map((value) => normalizeText(value)).join(" ")
  );
}

function inferLinkTypeFromUrl(
  url: string,
  context: string,
  sectionTitle = "",
  buttonText = "",
  parentFolderUrl = ""
): CanvaPendingLinkType {
  const normalizedUrl = normalizeSearchText(url);
  const normalizedContext = normalizeSearchText(context);
  const normalizedSectionTitle = normalizeSearchText(sectionTitle);
  const normalizedButton = normalizeSearchText(buttonText);
  const normalizedParentFolderUrl = normalizeCanvaUrl(parentFolderUrl);

  if (normalizedParentFolderUrl && normalizeCanvaUrl(url) === normalizedParentFolderUrl) {
    return "folder_global";
  }

  if (normalizedSectionTitle.includes("photo booth templates") || normalizedSectionTitle.includes("welcome screen templates")) {
    return "format_link";
  }

  if (normalizedButton.includes("edit in canva") && !normalizedContext.includes("welcome")) {
    return "folder_global";
  }

  if (
    normalizedUrl.includes("/folder") ||
    normalizedUrl.includes("/folders") ||
    normalizedUrl.includes("/projects") ||
    normalizedUrl.includes("/team")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("folder") ||
    normalizedContext.includes("dossier") ||
    normalizedContext.includes("pack canva")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("2x6") ||
    normalizedContext.includes("portrait") ||
    normalizedContext.includes("paysage") ||
    normalizedContext.includes("welcome") ||
    normalizedContext.includes("1920x1080") ||
    normalizedContext.includes("1366x1024")
  ) {
    return "format_link";
  }

  return "unknown";
}

function normalizeDetectedType(value: unknown) {
  const normalized = normalizeSearchText(normalizeText(value));

  if (
    normalized === "folder_global" ||
    normalized === "folder" ||
    normalized === "dossier" ||
    normalized === "global_folder"
  ) {
    return "folder_global" as const;
  }

  if (
    normalized === "format_link" ||
    normalized === "format" ||
    normalized === "template_link" ||
    normalized === "lien_format"
  ) {
    return "format_link" as const;
  }

  if (normalized === "unknown" || normalized === "inconnu") {
    return "unknown" as const;
  }

  return undefined;
}

function asImportItem(value: unknown): CanvaHarvesterImportItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const rawFolder = normalizeCanvaUrl(
    normalizeText(
      item.canva_folder_url ?? item.canvaFolderUrl ?? item.folder_url ?? item.folderUrl ?? item.canva_folder
    )
  );
  const rawTemplate = normalizeCanvaUrl(
    normalizeText(item.canva_template_url ?? item.canvaTemplateUrl ?? item.canva_url ?? item.canvaUrl ?? item.url)
  );
  const detectedAtRaw = normalizeText(item.detected_at ?? item.detectedAt);
  const detectedAt = detectedAtRaw || new Date().toISOString();
  const nearbyText = normalizeText(item.nearby_text ?? item.nearbyText ?? item.context);
  const sectionTitle = normalizeText(item.section_title ?? item.sectionTitle);
  const buttonText = normalizeText(item.button_text ?? item.buttonText);
  const detectedFormat = normalizeText(item.detected_format ?? item.detectedFormat ?? item.format);
  const detectedLayout = normalizeText(item.detected_layout ?? item.detectedLayout ?? item.layout);
  const detectedNoOfImages = normalizeText(item.detected_no_of_images ?? item.detectedNoOfImages ?? item.no_of_images);
  const cardIndex = normalizeNumber(item.card_index ?? item.cardIndex);
  const imageSrc = normalizeCanvaUrl(normalizeText(item.image_src ?? item.imageSrc));
  const imageAlt = normalizeText(item.image_alt ?? item.imageAlt);
  const imageWidth = normalizeNumber(item.image_width ?? item.imageWidth);
  const imageHeight = normalizeNumber(item.image_height ?? item.imageHeight);
  const imageRatio = normalizeText(item.image_ratio ?? item.imageRatio);
  const sourcePageUrl = normalizePostUrl(
    normalizeText(item.source_page_url ?? item.sourcePageUrl ?? item.page_url ?? item.pageUrl ?? item.post_url)
  );
  const parentTemplateBoothUrl = normalizePostUrl(
    normalizeText(
      item.parent_templatebooth_url ??
        item.parentTemplateBoothUrl ??
        item.parent_url ??
        item.parentUrl ??
        sourcePageUrl
    )
  );
  const parentCanvaFolderUrl = normalizeCanvaUrl(
    normalizeText(item.parent_canva_folder_url ?? item.parentCanvaFolderUrl ?? item.canva_folder_url)
  );

  if (!rawFolder && !rawTemplate) {
    return null;
  }

  return {
    template_id: normalizeText(item.template_id ?? item.templateId) || undefined,
    template_name: normalizeText(item.template_name ?? item.templateName ?? item.name) || undefined,
    source_page_url: sourcePageUrl || undefined,
    page_url: sourcePageUrl || undefined,
    parent_templatebooth_url: parentTemplateBoothUrl || undefined,
    parent_canva_folder_url: isCanvaUrl(parentCanvaFolderUrl) ? parentCanvaFolderUrl : undefined,
    section_title: sectionTitle || undefined,
    card_index: cardIndex > 0 ? cardIndex : undefined,
    image_src: imageSrc || undefined,
    image_alt: imageAlt || undefined,
    image_width: imageWidth > 0 ? imageWidth : undefined,
    image_height: imageHeight > 0 ? imageHeight : undefined,
    image_ratio: imageRatio || undefined,
    button_text: buttonText || undefined,
    canva_folder_url: isCanvaUrl(rawFolder) ? rawFolder : undefined,
    canva_template_url: isCanvaUrl(rawTemplate) ? rawTemplate : undefined,
    canva_url: isCanvaUrl(rawTemplate) ? rawTemplate : undefined,
    detected_type: normalizeDetectedType(item.detected_type ?? item.detectedType),
    detected_format: detectedFormat || undefined,
    detected_layout: detectedLayout || undefined,
    detected_no_of_images: detectedNoOfImages || undefined,
    confidence: parseConfidence(item.confidence),
    nearby_text: nearbyText || undefined,
    detected_at: detectedAt
  };
}

function toNormalizedLinks(item: CanvaHarvesterImportItem): NormalizedImportLink[] {
  const links: NormalizedImportLink[] = [];
  const context = [
    item.section_title,
    item.detected_format,
    item.detected_layout,
    item.nearby_text,
    item.button_text,
    item.image_alt
  ]
    .filter(Boolean)
    .join(" ");
  const explicitType = normalizeDetectedType(item.detected_type);
  const folderUrl = normalizeCanvaUrl(normalizeText(item.canva_folder_url));
  const parentFolderUrl = normalizeCanvaUrl(normalizeText(item.parent_canva_folder_url));
  const templateUrl = normalizeCanvaUrl(normalizeText(item.canva_template_url ?? item.canva_url));
  const hasFormatHints = Boolean(
    detectLayout({
      detected_format: item.detected_format,
      detected_layout: item.detected_layout,
      nearby_text: item.nearby_text,
      section_title: item.section_title,
      image_ratio: item.image_ratio
    }) ||
      detectNoOfImages({
        detected_no_of_images: item.detected_no_of_images,
        detected_format: item.detected_format,
        nearby_text: item.nearby_text,
        image_alt: item.image_alt
      })
  );

  if (folderUrl && isCanvaUrl(folderUrl)) {
    links.push({
      template_id: item.template_id,
      template_name: item.template_name,
      source_page_url: item.source_page_url,
      page_url: item.page_url,
      parent_templatebooth_url: item.parent_templatebooth_url,
      parent_canva_folder_url: parentFolderUrl || undefined,
      section_title: item.section_title,
      card_index: item.card_index ? normalizeNumber(item.card_index) : undefined,
      image_src: item.image_src,
      image_alt: item.image_alt,
      image_width: item.image_width ? normalizeNumber(item.image_width) : undefined,
      image_height: item.image_height ? normalizeNumber(item.image_height) : undefined,
      image_ratio: normalizeText(item.image_ratio),
      button_text: item.button_text,
      canva_url: folderUrl,
      link_type: explicitType === "format_link" ? "unknown" : "folder_global",
      detected_format: item.detected_format,
      detected_layout: item.detected_layout,
      detected_no_of_images: item.detected_no_of_images,
      confidence: item.confidence,
      nearby_text: item.nearby_text,
      detected_at: item.detected_at
    });
  }

  if (templateUrl && isCanvaUrl(templateUrl)) {
    let type: CanvaPendingLinkType = "format_link";

    if (explicitType) {
      type = explicitType;
    } else if (!hasFormatHints) {
      type = inferLinkTypeFromUrl(
        templateUrl,
        context,
        normalizeText(item.section_title),
        normalizeText(item.button_text),
        parentFolderUrl
      );
    }

    links.push({
      template_id: item.template_id,
      template_name: item.template_name,
      source_page_url: item.source_page_url,
      page_url: item.page_url,
      parent_templatebooth_url: item.parent_templatebooth_url,
      parent_canva_folder_url: parentFolderUrl || undefined,
      section_title: item.section_title,
      card_index: item.card_index ? normalizeNumber(item.card_index) : undefined,
      image_src: item.image_src,
      image_alt: item.image_alt,
      image_width: item.image_width ? normalizeNumber(item.image_width) : undefined,
      image_height: item.image_height ? normalizeNumber(item.image_height) : undefined,
      image_ratio: normalizeText(item.image_ratio),
      button_text: item.button_text,
      canva_url: templateUrl,
      link_type: type,
      detected_format: item.detected_format,
      detected_layout: item.detected_layout,
      detected_no_of_images: item.detected_no_of_images,
      confidence: item.confidence,
      nearby_text: item.nearby_text,
      detected_at: item.detected_at
    });
  }

  if (links.length === 0 && templateUrl && isCanvaUrl(templateUrl)) {
    links.push({
      template_id: item.template_id,
      template_name: item.template_name,
      source_page_url: item.source_page_url,
      page_url: item.page_url,
      parent_templatebooth_url: item.parent_templatebooth_url,
      parent_canva_folder_url: parentFolderUrl || undefined,
      section_title: item.section_title,
      card_index: item.card_index ? normalizeNumber(item.card_index) : undefined,
      image_src: item.image_src,
      image_alt: item.image_alt,
      image_width: item.image_width ? normalizeNumber(item.image_width) : undefined,
      image_height: item.image_height ? normalizeNumber(item.image_height) : undefined,
      image_ratio: normalizeText(item.image_ratio),
      button_text: item.button_text,
      canva_url: templateUrl,
      link_type: "unknown",
      detected_format: item.detected_format,
      detected_layout: item.detected_layout,
      detected_no_of_images: item.detected_no_of_images,
      confidence: item.confidence,
      nearby_text: item.nearby_text,
      detected_at: item.detected_at
    });
  }

  return links;
}

async function ensurePendingFile() {
  await fs.mkdir(path.dirname(pendingImportsPath), { recursive: true });

  try {
    await fs.access(pendingImportsPath);
  } catch {
    await fs.writeFile(pendingImportsPath, "[]\n", "utf8");
  }
}

async function readPendingImports() {
  await ensurePendingFile();
  const raw = await fs.readFile(pendingImportsPath, "utf8");
  const parsed = JSON.parse(raw) as CanvaImportPendingItem[];

  if (!Array.isArray(parsed)) {
    return [] as CanvaImportPendingItem[];
  }

  return parsed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      ...entry,
      link_type:
        entry.link_type === "folder_global" || entry.link_type === "format_link" || entry.link_type === "unknown"
          ? entry.link_type
          : "unknown",
      source_page_url: normalizePostUrl(normalizeText(entry.source_page_url)),
      canva_url: normalizeText(entry.canva_url),
      canva_folder_url: normalizeText(entry.canva_folder_url) || undefined,
      canva_template_url: normalizeText(entry.canva_template_url) || undefined,
      page_url: normalizePostUrl(normalizeText(entry.page_url)),
      parent_templatebooth_url: normalizePostUrl(normalizeText(entry.parent_templatebooth_url)) || undefined,
      parent_canva_folder_url: normalizeText(entry.parent_canva_folder_url) || undefined,
      section_title: normalizeText(entry.section_title),
      card_index: normalizeNumber(entry.card_index) || undefined,
      image_src: normalizeText(entry.image_src),
      image_alt: normalizeText(entry.image_alt),
      image_width: normalizeNumber(entry.image_width) || undefined,
      image_height: normalizeNumber(entry.image_height) || undefined,
      image_ratio: normalizeText(entry.image_ratio),
      button_text: normalizeText(entry.button_text),
      template_name: normalizeText(entry.template_name),
      detected_format: normalizeText(entry.detected_format),
      detected_layout: normalizeText(entry.detected_layout),
      detected_no_of_images: normalizeNoOfImagesToken(entry.detected_no_of_images),
      nearby_text: normalizeText(entry.nearby_text),
      confidence: parseConfidence(entry.confidence),
      status:
        entry.status === "pending" || entry.status === "resolved" || entry.status === "ignored"
          ? entry.status
          : "pending"
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

async function writePendingImports(entries: CanvaImportPendingItem[]) {
  await ensurePendingFile();
  await fs.writeFile(pendingImportsPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function templateNoOfImagesToken(template: CachedTemplate) {
  return normalizeNoOfImagesToken(template.no_of_images);
}

function scoreTemplateCandidate(template: CachedTemplate, item: NormalizedImportLink) {
  const reasons: string[] = [];
  const templateId = normalizeText(template.id);
  const templateNameNormalized = normalizeSearchText(template.name);
  const itemNameNormalized = normalizeSearchText(item.template_name ?? "");
  const templatePostUrl = normalizePostUrl(template.post_url ?? "");
  const pageUrl =
    normalizePostUrl(item.parent_templatebooth_url ?? "") ||
    normalizePostUrl(item.page_url ?? "") ||
    normalizePostUrl(item.source_page_url ?? "");
  const detectedLayout = detectLayout(item);
  const detectedNoOfImages = detectNoOfImages(item);
  const candidateNoOfImages = templateNoOfImagesToken(template);
  const sectionTitle = normalizeSearchText(item.section_title ?? "");
  const nearbyText = normalizeSearchText(item.nearby_text ?? "");
  const ratio = parseRatio(item.image_ratio);
  let score = 0;

  if (item.template_id && templateId && item.template_id === templateId) {
    score += 120;
    reasons.push("template_id exact");
  }

  if (pageUrl && templatePostUrl && pageUrl === templatePostUrl) {
    score += 100;
    reasons.push("post_url exact");
  }

  if (itemNameNormalized && templateNameNormalized === itemNameNormalized) {
    score += 70;
    reasons.push("nom exact");
  } else if (
    itemNameNormalized &&
    (templateNameNormalized.includes(itemNameNormalized) || itemNameNormalized.includes(templateNameNormalized))
  ) {
    score += 45;
    reasons.push("nom proche");
  }

  if (detectedLayout && template.layout === detectedLayout) {
    score += 35;
    reasons.push(`layout ${detectedLayout}`);
  }

  if (sectionTitle.includes("welcome") && template.layout === "welcome") {
    score += 42;
    reasons.push("section welcome");
  }

  if (sectionTitle.includes("photo booth templates") && template.layout !== "welcome") {
    score += 12;
    reasons.push("section photo booth");
  }

  if (Number.isFinite(ratio) && ratio > 0) {
    if (ratio <= 0.58 && template.layout === "26strip") {
      score += 24;
      reasons.push("ratio vertical");
    } else if (ratio >= 1.6 && template.layout === "welcome") {
      score += 20;
      reasons.push("ratio large welcome");
    } else if (ratio >= 1.05 && ratio < 1.6 && template.layout === "46postcard-l") {
      score += 18;
      reasons.push("ratio paysage");
    } else if (ratio >= 0.58 && ratio < 1.05 && template.layout === "46postcard-p") {
      score += 18;
      reasons.push("ratio portrait");
    }
  }

  if (nearbyText.includes("welcome") && template.layout === "welcome") {
    score += 24;
    reasons.push("texte welcome");
  }

  if (nearbyText.includes("strip") || nearbyText.includes("2x6") || nearbyText.includes("bande")) {
    if (template.layout === "26strip") {
      score += 18;
      reasons.push("texte strip");
    }
  }

  if (nearbyText.includes("landscape") || nearbyText.includes("paysage")) {
    if (template.layout === "46postcard-l") {
      score += 14;
      reasons.push("texte paysage");
    }
  }

  if (nearbyText.includes("portrait") && template.layout === "46postcard-p") {
    score += 14;
    reasons.push("texte portrait");
  }

  if (detectedNoOfImages && candidateNoOfImages && detectedNoOfImages === candidateNoOfImages) {
    score += 25;
    reasons.push(`photos ${detectedNoOfImages}`);
  }

  const confidence = parseConfidence(item.confidence);
  if (confidence === "high") {
    score += 6;
  } else if (confidence === "low") {
    score -= 6;
  }

  if (!item.template_id && !pageUrl && !itemNameNormalized) {
    score -= 40;
    reasons.push("identifiants faibles");
  }

  return {
    score,
    reason: reasons.join(" | ")
  };
}

function matchTemplateForItem(
  templates: CachedTemplate[],
  item: NormalizedImportLink,
  mode: "format" | "family"
): CandidateMatch {
  const pageUrl =
    normalizePostUrl(item.parent_templatebooth_url ?? "") ||
    normalizePostUrl(item.page_url ?? "") ||
    normalizePostUrl(item.source_page_url ?? "");
  const templateId = normalizeText(item.template_id);
  const nameQuery = normalizeSearchText(item.template_name ?? "");
  const detectedLayout = detectLayout(item);
  const detectedNoOfImages = detectNoOfImages(item);
  const initialCandidates = templates.filter((template) => {
    if (templateId) {
      return normalizeText(template.id) === templateId;
    }

    if (pageUrl && normalizePostUrl(template.post_url ?? "") === pageUrl) {
      return true;
    }

    if (nameQuery) {
      const candidateName = normalizeSearchText(template.name);
      return candidateName === nameQuery || candidateName.includes(nameQuery) || nameQuery.includes(candidateName);
    }

    return false;
  });

  const candidates = (initialCandidates.length > 0 ? initialCandidates : templates)
    .filter((template) => {
      if (mode === "format") {
        if (detectedLayout && template.layout !== detectedLayout) {
          return false;
        }

        if (detectedNoOfImages) {
          const token = templateNoOfImagesToken(template);
          if (token && token !== detectedNoOfImages) {
            return false;
          }
        }
      }

      return true;
    })
    .map((template) => {
      const scored = scoreTemplateCandidate(template, item);
      return {
        template,
        score: scored.score,
        reason: scored.reason
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const confidence = parseConfidence(item.confidence);
  let threshold = mode === "family" ? 74 : 82;

  if (confidence === "high") {
    threshold -= 10;
  } else if (confidence === "low") {
    threshold += 12;
  }

  if (
    pageUrl &&
    (normalizeText(item.section_title) ||
      normalizeText(item.detected_layout) ||
      normalizeText(item.detected_no_of_images) ||
      parseRatio(item.image_ratio) > 0)
  ) {
    threshold -= 12;
  }

  if (!pageUrl && !templateId) {
    threshold += 8;
  }

  const scoreGap = best && second ? best.score - second.score : 999;
  const strongMatch = Boolean(best && best.score >= threshold && scoreGap >= 8);

  return {
    template: best?.template ?? null,
    score: best?.score ?? 0,
    threshold,
    strongMatch,
    reason: best?.reason ?? "Aucun candidat fiable"
  };
}

function pendingIdentity(item: NormalizedImportLink) {
  const parentUrl =
    normalizePostUrl(item.parent_templatebooth_url ?? "") ||
    normalizePostUrl(item.page_url ?? "") ||
    normalizePostUrl(item.source_page_url ?? "");
  return `${item.link_type}::${parentUrl}::${normalizeText(item.canva_url)}::${detectLayout(item)}::${detectNoOfImages(item)}::${normalizeText(item.section_title)}::${item.card_index ?? 0}`;
}

function createPendingItem(
  item: NormalizedImportLink,
  match: CandidateMatch,
  existingId?: string
): CanvaImportPendingItem {
  const nowIso = new Date().toISOString();
  const detectedLayout = detectLayout(item);
  const detectedNoOfImages = detectNoOfImages(item);

  return {
    id: existingId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "templatebooth_harvester",
    link_type: item.link_type,
    template_id: item.template_id,
    template_name: normalizeText(item.template_name) || "Template non identifie",
    source_page_url: normalizePostUrl(item.source_page_url ?? "") || undefined,
    page_url:
      normalizePostUrl(item.parent_templatebooth_url ?? "") ||
      normalizePostUrl(item.page_url ?? "") ||
      normalizePostUrl(item.source_page_url ?? ""),
    parent_templatebooth_url: normalizePostUrl(item.parent_templatebooth_url ?? "") || undefined,
    parent_canva_folder_url: normalizeText(item.parent_canva_folder_url) || undefined,
    section_title: normalizeText(item.section_title),
    card_index: item.card_index ? normalizeNumber(item.card_index) : undefined,
    image_src: normalizeText(item.image_src),
    image_alt: normalizeText(item.image_alt),
    image_width: item.image_width ? normalizeNumber(item.image_width) : undefined,
    image_height: item.image_height ? normalizeNumber(item.image_height) : undefined,
    image_ratio: normalizeText(item.image_ratio),
    button_text: normalizeText(item.button_text),
    canva_url: normalizeText(item.canva_url),
    canva_folder_url: item.link_type === "folder_global" ? normalizeText(item.canva_url) : undefined,
    canva_template_url: item.link_type === "format_link" ? normalizeText(item.canva_url) : undefined,
    detected_format: normalizeText(item.detected_format),
    detected_layout: detectedLayout,
    detected_no_of_images: detectedNoOfImages,
    confidence: parseConfidence(item.confidence),
    nearby_text: normalizeText(item.nearby_text),
    detected_at: normalizeText(item.detected_at) || nowIso,
    status: "pending",
    suggested_template_id: match.template?.id,
    suggested_template_name: match.template?.name,
    suggested_format_label: match.template?.format_label,
    suggested_layout: match.template?.layout,
    suggested_no_of_images: match.template ? templateNoOfImagesToken(match.template) : undefined,
    suggested_post_url: match.template?.post_url,
    suggested_family_key: match.template ? getTemplateFamily(match.template) : undefined,
    match_score: match.score,
    match_reason: match.reason,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function summaryForEntry(entry: TemplateSourceLink) {
  return {
    template_id: entry.template_id ?? "",
    template_name: entry.template_name ?? "",
    family_key: entry.family_key ?? "",
    format_label: entry.format_label ?? "",
    layout: entry.layout ?? "",
    no_of_images: entry.no_of_images ?? "",
    canva_folder_url: entry.canva_folder_url ?? "",
    canva_folder_source: entry.canva_folder_source ?? "",
    canva_template_url: entry.canva_template_url ?? "",
    canva_source: entry.canva_source ?? "",
    post_url: entry.post_url ?? ""
  };
}

function deriveFamilyKey(template: CachedTemplate | null, pageUrl: string, suggestedFamilyKey?: string) {
  if (template) {
    return getTemplateFamily(template);
  }

  if (normalizeText(suggestedFamilyKey)) {
    return normalizeText(suggestedFamilyKey);
  }

  const normalizedPostUrl = normalizePostUrl(pageUrl);
  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  return "";
}

export async function listCanvaImportPendingItems() {
  const items = await readPendingImports();
  return items.filter((entry) => entry.status === "pending");
}

function pendingLayoutHint(item: CanvaImportPendingItem) {
  const explicit = normalizeLayout(item.detected_layout);
  if (explicit) {
    return explicit;
  }

  return detectLayout({
    detected_layout: item.detected_layout,
    detected_format: item.detected_format,
    nearby_text: item.nearby_text,
    section_title: item.section_title,
    image_ratio: item.image_ratio
  });
}

function pendingNoOfImagesHint(item: CanvaImportPendingItem) {
  const explicit = normalizeNoOfImagesToken(item.detected_no_of_images);
  if (explicit) {
    return explicit;
  }

  return detectNoOfImages({
    detected_no_of_images: item.detected_no_of_images,
    detected_format: item.detected_format,
    nearby_text: item.nearby_text,
    image_alt: item.image_alt
  });
}

function templateOrderScore(template: CachedTemplate) {
  const noOfImages = templateNoOfImagesToken(template);

  if (template.layout === "46postcard-p") {
    return 100;
  }

  if (template.layout === "46postcard-l" && noOfImages === "1images") {
    return 90;
  }

  if (template.layout === "welcome") {
    return 80;
  }

  if (template.layout === "26strip") {
    return 70;
  }

  if (template.layout === "46postcard-l" && noOfImages === "3images") {
    return 60;
  }

  if (template.layout === "46postcard-l") {
    return 50;
  }

  return 40;
}

function pendingOrderScore(item: CanvaImportPendingItem) {
  const layoutHint = pendingLayoutHint(item);
  const noOfImagesHint = pendingNoOfImagesHint(item);

  if (layoutHint === "46postcard-p") {
    return 100;
  }

  if (layoutHint === "46postcard-l" && noOfImagesHint === "1images") {
    return 90;
  }

  if (layoutHint === "welcome") {
    return 80;
  }

  if (layoutHint === "26strip") {
    return 70;
  }

  if (layoutHint === "46postcard-l" && noOfImagesHint === "3images") {
    return 60;
  }

  if (layoutHint === "46postcard-l") {
    return 50;
  }

  return 40;
}

function buildOrderReason(item: CanvaImportPendingItem, template: CachedTemplate) {
  const reasons: string[] = ["association par ordre"];
  const layoutHint = pendingLayoutHint(item);
  const noOfImagesHint = pendingNoOfImagesHint(item);
  const templateNoOfImages = templateNoOfImagesToken(template);

  if (layoutHint && template.layout === layoutHint) {
    reasons.push(`layout confirme (${layoutHint})`);
  }

  if (noOfImagesHint && templateNoOfImages && noOfImagesHint === templateNoOfImages) {
    reasons.push(`photos confirmees (${noOfImagesHint})`);
  }

  if (normalizeSearchText(item.nearby_text).includes("welcome") && template.layout === "welcome") {
    reasons.push("contexte welcome");
  }

  return reasons.join(" | ");
}

function scoreOrderConfidence(item: CanvaImportPendingItem, template: CachedTemplate): HarvesterConfidence {
  const layoutHint = pendingLayoutHint(item);
  const noOfImagesHint = pendingNoOfImagesHint(item);
  const templateNoOfImages = templateNoOfImagesToken(template);
  let score = 0;

  if (layoutHint && layoutHint === template.layout) {
    score += 2;
  }
  if (noOfImagesHint && templateNoOfImages && noOfImagesHint === templateNoOfImages) {
    score += 2;
  }
  if (item.confidence === "high") {
    score += 1;
  }
  if (normalizeSearchText(item.nearby_text).includes("welcome") && template.layout === "welcome") {
    score += 1;
  }

  if (score >= 4) {
    return "high";
  }
  if (score >= 2) {
    return "medium";
  }
  return "low";
}

export async function proposeCanvaPendingAutoAssociations(input: {
  family_key?: string;
  page_url?: string;
  template_name?: string;
}) {
  const pendingItems = await listCanvaImportPendingItems();
  const pageUrl = normalizePostUrl(normalizeText(input.page_url ?? ""));
  const normalizedTemplateName = normalizeSearchText(normalizeText(input.template_name ?? ""));
  const explicitFamilyKey = normalizeText(input.family_key);

  const scopedPendingItems = pendingItems.filter((item) => {
    if (explicitFamilyKey && normalizeText(item.suggested_family_key) === explicitFamilyKey) {
      return true;
    }

    if (pageUrl && normalizePostUrl(item.page_url) === pageUrl) {
      return true;
    }

    if (
      normalizedTemplateName &&
      normalizeSearchText(item.template_name).includes(normalizedTemplateName)
    ) {
      return true;
    }

    return false;
  });

  if (scopedPendingItems.length === 0) {
    return {
      ok: true,
      family_key: explicitFamilyKey ?? "",
      page_url: pageUrl,
      proposals: [] as CanvaAutoAssociationProposal[]
    };
  }

  const templates = await listCachedTemplates();
  const familyKey =
    explicitFamilyKey ||
    scopedPendingItems.find((item) => normalizeText(item.suggested_family_key))?.suggested_family_key ||
    "";
  const familyTemplates = templates.filter((template) => {
    if (familyKey) {
      return getTemplateFamily(template) === familyKey;
    }

    if (pageUrl) {
      return normalizePostUrl(template.post_url ?? "") === pageUrl;
    }

    return normalizeSearchText(template.name).includes(normalizedTemplateName);
  });

  if (familyTemplates.length === 0) {
    return {
      ok: true,
      family_key: familyKey,
      page_url: pageUrl,
      proposals: [] as CanvaAutoAssociationProposal[]
    };
  }

  const sortedTemplates = [...familyTemplates].sort((first, second) => {
    const scoreGap = templateOrderScore(second) - templateOrderScore(first);
    if (scoreGap !== 0) {
      return scoreGap;
    }
    const firstNoOfImages = templateNoOfImagesToken(first);
    const secondNoOfImages = templateNoOfImagesToken(second);
    if (first.layout === second.layout && firstNoOfImages && secondNoOfImages) {
      return firstNoOfImages.localeCompare(secondNoOfImages);
    }
    return first.name.localeCompare(second.name);
  });

  const uniqueTemplates = sortedTemplates.filter((template, index, collection) => {
    const signature = `${template.layout}::${templateNoOfImagesToken(template)}::${template.format_label}`;
    return (
      collection.findIndex(
        (candidate) =>
          `${candidate.layout}::${templateNoOfImagesToken(candidate)}::${candidate.format_label}` ===
          signature
      ) === index
    );
  });

  const orderedPending = [...scopedPendingItems].sort((first, second) => {
    const byPriority = pendingOrderScore(second) - pendingOrderScore(first);
    if (byPriority !== 0) {
      return byPriority;
    }

    const firstSection = normalizeSearchText(first.section_title ?? "");
    const secondSection = normalizeSearchText(second.section_title ?? "");
    if (firstSection !== secondSection) {
      if (firstSection.includes("welcome")) {
        return 1;
      }
      if (secondSection.includes("welcome")) {
        return -1;
      }
    }

    const firstCardIndex = first.card_index ?? 0;
    const secondCardIndex = second.card_index ?? 0;
    if (firstCardIndex !== secondCardIndex) {
      return firstCardIndex - secondCardIndex;
    }

    return first.created_at.localeCompare(second.created_at);
  });
  const mappingCount = Math.min(orderedPending.length, uniqueTemplates.length);
  const proposals: CanvaAutoAssociationProposal[] = [];
  const availableTemplates = [...uniqueTemplates];

  for (let index = 0; index < mappingCount; index += 1) {
    const pendingItem = orderedPending[index];
    const layoutHint = pendingLayoutHint(pendingItem);
    const noOfImagesHint = pendingNoOfImagesHint(pendingItem);
    const preferredTemplate =
      availableTemplates.find((candidate) => {
        if (layoutHint && candidate.layout !== layoutHint) {
          return false;
        }
        if (noOfImagesHint) {
          const token = templateNoOfImagesToken(candidate);
          if (token && token !== noOfImagesHint) {
            return false;
          }
        }
        return true;
      }) ?? availableTemplates[0];
    const template = preferredTemplate ?? null;

    if (!template) {
      continue;
    }

    const templateIndex = availableTemplates.findIndex((candidate) => candidate.id === template.id);
    if (templateIndex >= 0) {
      availableTemplates.splice(templateIndex, 1);
    }

    const layoutMismatch = Boolean(layoutHint && template.layout !== layoutHint);
    const photosMismatch = Boolean(
      noOfImagesHint &&
        templateNoOfImagesToken(template) &&
        templateNoOfImagesToken(template) !== noOfImagesHint
    );

    proposals.push({
      pending_id: pendingItem.id,
      order_index: index + 1,
      canva_url: pendingItem.canva_url,
      page_url: pendingItem.page_url,
      section_title: pendingItem.section_title,
      card_index: pendingItem.card_index,
      template_name: pendingItem.template_name,
      proposed_template_id: template.id,
      proposed_template_name: template.name,
      proposed_format_label: template.format_label || formatLabelFromLayout(template.layout),
      proposed_layout: template.layout,
      proposed_no_of_images: templateNoOfImagesToken(template),
      proposed_family_key: getTemplateFamily(template),
      proposed_post_url: template.post_url,
      confidence:
        layoutMismatch || photosMismatch
          ? "low"
          : scoreOrderConfidence(pendingItem, template),
      reason: `${buildOrderReason(pendingItem, template)}${
        layoutMismatch ? " | mismatch layout" : ""
      }${photosMismatch ? " | mismatch photos" : ""}`
    });
  }

  return {
    ok: true,
    family_key: familyKey,
    page_url: pageUrl,
    proposals
  };
}

export async function importCanvaLinksFromHarvester(params: {
  source?: string;
  items: unknown[];
}) {
  const source = normalizeText(params.source);

  if (source && source !== "templatebooth_harvester") {
    throw new Error("Source d'import Canva non autorisee.");
  }

  const templates = await listCachedTemplates();
  const parsedItems = (params.items ?? [])
    .map((item) => asImportItem(item))
    .filter((item): item is CanvaHarvesterImportItem => Boolean(item));
  const normalizedLinks = parsedItems.flatMap((item) => toNormalizedLinks(item));
  const dedupedByIdentity = new Map<string, NormalizedImportLink>();

  for (const item of normalizedLinks) {
    dedupedByIdentity.set(pendingIdentity(item), item);
  }

  const entries = [...dedupedByIdentity.values()];
  const pending = await readPendingImports();
  const pendingByIdentity = new Map<string, CanvaImportPendingItem>();
  for (const item of pending) {
    const identity = pendingIdentity({
      template_id: item.template_id,
      template_name: item.template_name,
      source_page_url: item.source_page_url,
      page_url: item.page_url,
      parent_templatebooth_url: item.parent_templatebooth_url,
      parent_canva_folder_url: item.parent_canva_folder_url,
      section_title: item.section_title,
      card_index: item.card_index,
      image_src: item.image_src,
      image_alt: item.image_alt,
      image_width: item.image_width,
      image_height: item.image_height,
      image_ratio: item.image_ratio,
      button_text: item.button_text,
      canva_url: item.canva_url,
      link_type: item.link_type,
      detected_format: item.detected_format,
      detected_layout: item.detected_layout,
      detected_no_of_images: item.detected_no_of_images,
      confidence: item.confidence,
      nearby_text: item.nearby_text,
      detected_at: item.detected_at
    });
    pendingByIdentity.set(identity, item);
  }

  const imported: TemplateSourceLink[] = [];
  const pendingUpdates = [...pending];
  let importedCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;

  for (const item of entries) {
    const effectiveLinkType =
      item.link_type === "unknown"
        ? inferLinkTypeFromUrl(
            item.canva_url,
            [item.section_title, item.detected_format, item.nearby_text, item.button_text].join(" "),
            item.section_title,
            item.button_text,
            item.parent_canva_folder_url
          )
        : item.link_type;
    const scopedItem: NormalizedImportLink = {
      ...item,
      link_type: effectiveLinkType
    };
    const match = matchTemplateForItem(
      templates,
      scopedItem,
      effectiveLinkType === "format_link" ? "format" : "family"
    );
    const detectedLayout = detectLayout(item);
    const detectedNoOfImages = detectNoOfImages(item);
    const identity = pendingIdentity(scopedItem);

    if (effectiveLinkType !== "unknown" && match.template && match.strongMatch) {
      const template = match.template;

      if (effectiveLinkType === "folder_global") {
        const familyKey = deriveFamilyKey(
          template,
          item.parent_templatebooth_url ?? item.page_url ?? "",
          undefined
        );
        const existing = await findTemplateSourceLink({
          familyKey,
          postUrl: template.post_url
        });
        const keepManualFolder =
          existing?.canva_folder_source === "manual" && Boolean(existing.canva_folder_url?.trim());
        const saved = await upsertTemplateSourceLink({
          family_key: familyKey || undefined,
          template_name: existing?.template_name ?? template.name,
          post_url: template.post_url || existing?.post_url,
          canva_folder_url:
            keepManualFolder ? existing?.canva_folder_url : item.parent_canva_folder_url || item.canva_url,
          canva_folder_source: keepManualFolder ? "manual" : "templatebooth_harvester",
          canva_folder_detected_at: keepManualFolder ? existing?.canva_folder_detected_at : item.detected_at,
          notes:
            existing?.notes ??
            `Import dossier Canva automatique (harvester, confiance ${item.confidence})`
        });
        imported.push(saved);
        importedCount += 1;
      } else {
        const noOfImages = templateNoOfImagesToken(template) || detectedNoOfImages;
        const existing = await findTemplateSourceLink({
          templateId: template.id,
          postUrl: template.post_url,
          formatLabel: template.format_label,
          layout: template.layout,
          noOfImages
        });
        const keepManualLink = existing?.canva_source === "manual" && Boolean(existing.canva_template_url?.trim());
        const saved = await upsertTemplateSourceLink({
          family_key: getTemplateFamily(template),
          template_id: template.id,
          template_name: template.name,
          format_label: template.format_label || formatLabelFromLayout(template.layout),
          layout: template.layout || detectedLayout,
          no_of_images: noOfImages || undefined,
          post_url: template.post_url,
          canva_template_url: keepManualLink ? existing?.canva_template_url : item.canva_url,
          canva_source: keepManualLink ? "manual" : "templatebooth_harvester",
          canva_detected_at: keepManualLink ? existing?.canva_detected_at : item.detected_at ?? new Date().toISOString(),
          psd_source_url:
            existing?.psd_source_url ??
            template.psd_url ??
            template.source_file_url ??
            template.photoshop_download_url ??
            undefined,
          notes: existing?.notes ?? `Import Canva automatique (harvester, confiance ${item.confidence})`
        });
        imported.push(saved);
        importedCount += 1;

        if (item.parent_canva_folder_url && isCanvaUrl(item.parent_canva_folder_url)) {
          const familyKey = deriveFamilyKey(
            template,
            item.parent_templatebooth_url ?? item.page_url ?? "",
            getTemplateFamily(template)
          );
          const familyExisting = await findTemplateSourceLink({
            familyKey,
            postUrl: template.post_url
          });
          const keepManualFolder =
            familyExisting?.canva_folder_source === "manual" &&
            Boolean(familyExisting.canva_folder_url?.trim());
          await upsertTemplateSourceLink({
            family_key: familyKey || undefined,
            template_name: familyExisting?.template_name ?? template.name,
            post_url: template.post_url || familyExisting?.post_url,
            canva_folder_url: keepManualFolder
              ? familyExisting?.canva_folder_url
              : item.parent_canva_folder_url,
            canva_folder_source: keepManualFolder ? "manual" : "templatebooth_harvester",
            canva_folder_detected_at: keepManualFolder
              ? familyExisting?.canva_folder_detected_at
              : item.detected_at,
            notes:
              familyExisting?.notes ??
              `Import dossier Canva global automatique (harvester, confiance ${item.confidence})`
          });
        }
      }

      const pendingIndex = pendingUpdates.findIndex((entry) => entry.id === pendingByIdentity.get(identity)?.id);
      if (pendingIndex >= 0) {
        pendingUpdates[pendingIndex] = {
          ...pendingUpdates[pendingIndex],
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_template_id: template.id,
          resolved_format_label: template.format_label,
          resolved_layout: template.layout,
          resolved_no_of_images: templateNoOfImagesToken(template),
          resolved_family_key: getTemplateFamily(template),
          updated_at: new Date().toISOString()
        };
      }

      continue;
    }

    const existingPending = pendingByIdentity.get(identity);
    const nextPending = createPendingItem(scopedItem, match, existingPending?.id);
    const existingIndex = pendingUpdates.findIndex((entry) => entry.id === nextPending.id);

    if (existingIndex >= 0) {
      pendingUpdates[existingIndex] = {
        ...pendingUpdates[existingIndex],
        ...nextPending,
        created_at: pendingUpdates[existingIndex].created_at,
        updated_at: new Date().toISOString(),
        status: "pending"
      };
    } else {
      pendingUpdates.unshift(nextPending);
    }

    pendingCount += 1;
  }

  if (entries.length === 0) {
    skippedCount = 1;
  }

  await writePendingImports(pendingUpdates);

  return {
    ok: true,
    source: "templatebooth_harvester" as const,
    received: (params.items ?? []).length,
    parsed: entries.length,
    imported_count: importedCount,
    pending_count: pendingCount,
    skipped_count: skippedCount,
    imported: imported.map(summaryForEntry)
  };
}

export async function resolveCanvaImportPendingItem(params: {
  pending_id: string;
  resolve_as?: "folder_global" | "format_link";
  family_key?: string;
  template_id?: string;
  template_name?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string | number;
  post_url?: string;
  notes?: string;
}) {
  const pending = await readPendingImports();
  const pendingIndex = pending.findIndex((entry) => entry.id === normalizeText(params.pending_id));

  if (pendingIndex === -1) {
    throw new Error("Import Canva en attente introuvable.");
  }

  const current = pending[pendingIndex];
  if (current.status !== "pending") {
    throw new Error("Cet import Canva n'est plus en attente.");
  }

  const resolveAs = params.resolve_as ?? (current.link_type === "folder_global" ? "folder_global" : "format_link");
  const templates = await listCachedTemplates();
  const explicitTemplateId = normalizeText(params.template_id);
  const explicitLayout = normalizeLayout(params.layout);
  const explicitNoOfImages = normalizeNoOfImagesToken(params.no_of_images);
  let template =
    (explicitTemplateId ? templates.find((candidate) => candidate.id === explicitTemplateId) : undefined) ?? null;

  if (!template) {
    const inferredItem: NormalizedImportLink = {
      template_id: current.template_id,
      template_name: current.template_name,
      source_page_url: current.source_page_url,
      page_url: current.page_url,
      parent_templatebooth_url: current.parent_templatebooth_url,
      parent_canva_folder_url: current.parent_canva_folder_url,
      section_title: current.section_title,
      card_index: current.card_index,
      image_src: current.image_src,
      image_alt: current.image_alt,
      image_width: current.image_width,
      image_height: current.image_height,
      image_ratio: current.image_ratio,
      button_text: current.button_text,
      canva_url: current.canva_url,
      link_type: current.link_type,
      detected_format: current.detected_format,
      detected_layout: current.detected_layout,
      detected_no_of_images: current.detected_no_of_images,
      confidence: current.confidence,
      nearby_text: current.nearby_text,
      detected_at: current.detected_at
    };
    const match = matchTemplateForItem(templates, inferredItem, resolveAs === "format_link" ? "format" : "family");
    template = match.template;
  }

  if (resolveAs === "folder_global") {
    const postUrl =
      normalizePostUrl(normalizeText(params.post_url)) ||
      normalizePostUrl(template?.post_url ?? "") ||
      normalizePostUrl(current.suggested_post_url ?? "") ||
      normalizePostUrl(current.page_url);
    const familyKey =
      normalizeText(params.family_key) ||
      deriveFamilyKey(template, postUrl, current.suggested_family_key);

    if (!familyKey && !postUrl) {
      throw new Error("Association impossible : family_key ou post_url requis.");
    }

    const existing = await findTemplateSourceLink({
      familyKey,
      postUrl
    });
    const saved = await upsertTemplateSourceLink({
      family_key: familyKey || undefined,
      template_name:
        normalizeText(params.template_name) ||
        existing?.template_name ||
        template?.name ||
        current.suggested_template_name ||
        current.template_name,
      post_url: postUrl || undefined,
      canva_folder_url: current.canva_folder_url || current.parent_canva_folder_url || current.canva_url,
      canva_folder_source: "templatebooth_harvester",
      canva_folder_detected_at: current.detected_at,
      notes: normalizeText(params.notes) || existing?.notes || "Import dossier Canva valide depuis la file d'attente"
    });

    pending[pendingIndex] = {
      ...current,
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_template_id: saved.template_id,
      resolved_family_key: saved.family_key ?? familyKey,
      updated_at: new Date().toISOString()
    };

    await writePendingImports(pending);

    return {
      ok: true,
      pending: pending[pendingIndex],
      saved: summaryForEntry(saved)
    };
  }

  const layout =
    explicitLayout ||
    template?.layout ||
    normalizeLayout(current.suggested_layout) ||
    normalizeLayout(current.detected_layout) ||
    detectLayoutFromText([current.detected_layout, current.detected_format, current.nearby_text].join(" "));
  const noOfImages =
    explicitNoOfImages ||
    normalizeNoOfImagesToken(template?.no_of_images) ||
    normalizeNoOfImagesToken(current.suggested_no_of_images) ||
    normalizeNoOfImagesToken(current.detected_no_of_images);
  const formatLabel =
    normalizeText(params.format_label) ||
    normalizeText(template?.format_label) ||
    normalizeText(current.suggested_format_label) ||
    formatLabelFromLayout(layout || "welcome");
  const templateId =
    explicitTemplateId ||
    normalizeText(template?.id) ||
    normalizeText(current.suggested_template_id) ||
    normalizeText(current.template_id);
  const templateName =
    normalizeText(params.template_name) ||
    normalizeText(template?.name) ||
    normalizeText(current.suggested_template_name) ||
    current.template_name;
  const postUrl =
    normalizePostUrl(normalizeText(params.post_url)) ||
    normalizePostUrl(template?.post_url ?? "") ||
    normalizePostUrl(current.suggested_post_url ?? "") ||
    normalizePostUrl(current.page_url);
  const familyKey = normalizeText(params.family_key) || deriveFamilyKey(template, postUrl, current.suggested_family_key);

  if (!templateId && !postUrl) {
    throw new Error("Association impossible : template_id ou post_url requis.");
  }

  const existing = await findTemplateSourceLink({
    templateId,
    postUrl,
    formatLabel,
    layout,
    noOfImages
  });

  const saved = await upsertTemplateSourceLink({
    family_key: familyKey || undefined,
    template_id: templateId || undefined,
    template_name: templateName || undefined,
    format_label: formatLabel || undefined,
    layout: layout || undefined,
    no_of_images: noOfImages || undefined,
    post_url: postUrl || undefined,
    canva_template_url: current.canva_template_url || current.canva_url,
    canva_source: "templatebooth_harvester",
    canva_detected_at: current.detected_at,
    psd_source_url:
      existing?.psd_source_url ??
      template?.psd_url ??
      template?.source_file_url ??
      template?.photoshop_download_url ??
      undefined,
    notes: normalizeText(params.notes) || existing?.notes || "Import Canva valide depuis la file d'attente"
  });

  pending[pendingIndex] = {
    ...current,
    status: "resolved",
    resolved_at: new Date().toISOString(),
    resolved_template_id: saved.template_id,
    resolved_format_label: saved.format_label,
    resolved_layout: saved.layout,
    resolved_no_of_images: saved.no_of_images,
    resolved_family_key: saved.family_key ?? familyKey,
    updated_at: new Date().toISOString()
  };

  await writePendingImports(pending);

  return {
    ok: true,
    pending: pending[pendingIndex],
    saved: summaryForEntry(saved)
  };
}

export async function ignoreCanvaImportPendingItem(pendingId: string) {
  const pending = await readPendingImports();
  const index = pending.findIndex((entry) => entry.id === normalizeText(pendingId));

  if (index === -1) {
    throw new Error("Import Canva en attente introuvable.");
  }

  pending[index] = {
    ...pending[index],
    status: "ignored",
    updated_at: new Date().toISOString()
  };

  await writePendingImports(pending);

  return {
    ok: true,
    pending: pending[index]
  };
}
