export const EVENT_TYPES = [
  "Mariage",
  "Anniversaire",
  "Baptême",
  "Baby shower",
  "Gender reveal",
  "Soirée privée",
  "Événement entreprise",
  "Noël",
  "Nouvel An",
  "Communion",
  "Fiançailles",
  "Autre"
] as const;

export const TEMPLATE_FORMATS = [
  {
    value: "vertical-2x6",
    label: "Bande verticale 2x6",
    badge: "2x6",
    usage: "bande photo verticale",
    query: { layout: "26strip" }
  },
  {
    value: "portrait-4x6",
    label: "Portrait 10x15 / 4x6",
    badge: "4x6 portrait",
    usage: "format portrait classique",
    query: { layout: "46postcard-p" }
  },
  {
    value: "landscape-4x6-multi",
    label: "Paysage 10x15 / 4x6 multi-photos",
    badge: "4x6 paysage",
    usage: "format paysage avec plusieurs photos",
    query: { layout: "46postcard-l" }
  },
  {
    value: "landscape-4x6-full",
    label: "Paysage 10x15 / 4x6 pleine largeur",
    badge: "4x6 pleine largeur",
    usage: "format paysage plus large / visuel principal",
    query: { layout: "46postcard-l" },
    fullWidth: true
  },
  {
    value: "welcome-1920x1080",
    label: "Welcome screen 1920x1080",
    badge: "welcome screen",
    usage: "écran d’accueil LumaBooth",
    query: { type: "static_welcome_screen" },
    alternateQueries: [{ type: "animated_welcome_screen" }]
  }
] as const;

export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number]["value"];
export type EventType = (typeof EVENT_TYPES)[number];

export type TemplateFormatQuery = Partial<{
  page: string;
  per_page: string;
  layout: string;
  image_type: string;
  no_of_images: string;
  tag: string;
  tags: string;
  search: string;
  type: string;
  text_display: string;
}>;

export type TemplateFilterOption = {
  value: TemplateFormat;
  label: string;
  badge: string;
  usage: string;
  query: TemplateFormatQuery;
  available?: boolean;
};

export const REQUEST_STATUS_OPTIONS = [
  { value: "a_personnaliser", label: "à personnaliser" },
  { value: "en_attente_retour_client", label: "en attente retour client" },
  { value: "a_verifier", label: "à vérifier" },
  { value: "a_corriger", label: "à corriger" },
  { value: "valide", label: "validé" },
  { value: "envoye_vers_la_borne", label: "envoyé vers la borne" }
] as const;

export type CustomizationStatus = (typeof REQUEST_STATUS_OPTIONS)[number]["value"];
export type CanvaReviewStatus = Extract<CustomizationStatus, "a_verifier" | "a_corriger" | "valide">;

export type TemplateCompatibility = {
  lumaBooth?: boolean;
  canva?: boolean;
  png?: boolean;
  dslrBooth?: boolean;
  psd?: boolean;
};

export type TemplateAssetLinks = {
  png?: string;
  psd?: string;
  lumaBooth?: string;
  dslrBooth?: string;
};

export type PhotoboothTemplate = {
  id: string;
  templateId: string;
  name: string;
  theme: string;
  format: TemplateFormat;
  photoCount: number;
  mainColors: string[];
  previewImage: string;
  src?: string;
  poster?: string;
  videoUrl?: string;
  mediaType?: "image" | "video";
  compatibility: TemplateCompatibility;
  templateBoothUrl?: string;
  canvaTemplateUrl?: string;
  canvaUrl?: string;
  assets?: TemplateAssetLinks;
  templateBoothType?: string;
  layoutSize?: string;
  orientation?: string;
  publishedAt?: string;
  eventType?: string;
  tags?: string[];
  fullWidth?: boolean;
  source?: "templatebooth" | "local";
};

export type CustomizationRequestInput = {
  reservationToken?: string;
  templateId: string;
  templateName?: string;
  templateFormat?: TemplateFormat;
  templatePreviewImage?: string;
  templateBoothUrl?: string;
  canvaTemplateUrl?: string;
  canvaUrl?: string;
  finalCanvaUrl?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  eventDate: string;
  eventType: string;
  templateText: string;
  desiredColors: string;
  specialInstructions?: string;
};

export type CustomizationRequest = CustomizationRequestInput & {
  id: string;
  templateName: string;
  templateFormat: TemplateFormat;
  templatePreviewImage?: string;
  templateBoothUrl?: string;
  canvaTemplateUrl?: string;
  canvaUrl?: string;
  finalCanvaUrl?: string;
  canvaReviewStatus: CanvaReviewStatus;
  status: CustomizationStatus;
  remoteReference?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateCatalogResult = {
  templates: PhotoboothTemplate[];
  source: "templatebooth" | "local";
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  warning?: string;
};

export type TemplateDetailResult = {
  template: PhotoboothTemplate;
  source: "templatebooth" | "local";
  warning?: string;
};

export function isTemplateFormat(value: unknown): value is TemplateFormat {
  return TEMPLATE_FORMATS.some((format) => format.value === value);
}

export function getTemplateFormatMeta(format: TemplateFormat) {
  return TEMPLATE_FORMATS.find((item) => item.value === format) ?? TEMPLATE_FORMATS[0];
}

export function getStatusLabel(status: CustomizationStatus | string) {
  const legacyLabels: Record<string, string> = {
    en_attente: "à vérifier",
    en_preparation: "à personnaliser",
    envoye_vers_la_borne: "envoyé vers la borne"
  };

  return REQUEST_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? legacyLabels[status] ?? status;
}

export function getCanvaReviewStatusLabel(status: CanvaReviewStatus | string) {
  return getStatusLabel(status);
}

export function getCompatibilityLabel(key: string) {
  const labels: Record<string, string> = {
    lumaBooth: "LumaBooth",
    canva: "Canva",
    png: "PNG",
    dslrBooth: "DSLR Booth",
    psd: "PSD"
  };

  return labels[key] ?? key;
}
