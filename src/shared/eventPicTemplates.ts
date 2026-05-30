export const EVENT_PIC_FORMATS = [
  {
    id: "2x6",
    label: "Bande verticale 2x6",
    badge: "2x6",
    layout: "26strip"
  },
  {
    id: "portrait",
    label: "Portrait 10x15 / 4x6",
    badge: "4x6 portrait",
    layout: "46postcard-p"
  },
  {
    id: "paysage",
    label: "Paysage 10x15 / 4x6",
    badge: "4x6 paysage",
    layout: "46postcard-l"
  }
] as const;

export const EVENT_PIC_ALLOWED_VARIANT_FORMATS = [
  {
    key: "2x6",
    label: "Bande verticale 2x6",
    badge: "2x6",
    layout: "26strip"
  },
  {
    key: "portrait",
    label: "Portrait 10x15 / 4x6",
    badge: "4x6 portrait",
    layout: "46postcard-p"
  },
  {
    key: "paysage",
    label: "Paysage 10x15 / 4x6",
    badge: "4x6 paysage",
    layout: "46postcard-l"
  },
  {
    key: "welcome",
    label: "Welcome screen 1920x1080",
    badge: "welcome screen",
    types: ["static_welcome_screen", "animated_welcome_screen"]
  }
] as const;

export const EVENT_PIC_CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "mariage", label: "Mariage", query: { tags: "Wedding" } },
  { id: "anniversaire", label: "Anniversaire", query: { tags: "Birthday" } },
  { id: "religieux", label: "Religieux", query: { tags: "Religious" } },
  { id: "fete-bebe", label: "F\u00eate b\u00e9b\u00e9", query: { tags: "Baby Shower" } },
  { id: "soiree-privee", label: "Soir\u00e9e priv\u00e9e", query: { tags: "Nightlife" } },
  { id: "entreprise", label: "Entreprise", query: { tags: "Corporate" } },
  { id: "noel", label: "No\u00ebl", query: { tags: "Christmas" } },
  { id: "nouvel-an", label: "Nouvel An / R\u00e9veillon", query: { tags: "New Year's Eve" } },
  { id: "halloween", label: "Halloween", query: { tags: "Halloween" } },
  { id: "saint-valentin", label: "Saint-Valentin", query: { tags: "Valentines Day" } },
  { id: "tropical", label: "Tropical", query: { tags: "Tropical" } },
  { id: "retro", label: "R\u00e9tro", query: { tags: "Retro" } },
  { id: "western", label: "Western", query: { tags: "Country & Western" } },
  { id: "ecole-diplome", label: "\u00c9cole / Dipl\u00f4me", query: { tags: "Graduation" } },
  { id: "paques", label: "P\u00e2ques", query: { tags: "Easter" } },
  { id: "casino", label: "Casino", query: { tags: "Casino" } },
  { id: "sport", label: "Sport", query: { tags: "Sports" } },
  { id: "autres", label: "Autres" }
] as const;

export const EVENT_TYPES = [
  "Mariage",
  "Anniversaire",
  "Bapt\u00eame",
  "Baby shower",
  "Gender reveal",
  "Soir\u00e9e priv\u00e9e",
  "Entreprise",
  "No\u00ebl",
  "Nouvel An",
  "Communion",
  "Fian\u00e7ailles",
  "Autre"
] as const;

export const TEMPLATE_REQUEST_STATUSES = [
  { value: "a_preparer", label: "\u00e0 pr\u00e9parer" },
  { value: "en_cours", label: "en cours" },
  { value: "a_verifier", label: "\u00e0 v\u00e9rifier" },
  { value: "valide", label: "valid\u00e9" },
  { value: "envoye_vers_la_borne", label: "envoy\u00e9 vers la borne" }
] as const;

export type EventPicFormatId = (typeof EVENT_PIC_FORMATS)[number]["id"];
export type EventPicCategoryId = (typeof EVENT_PIC_CATEGORIES)[number]["id"];
export type EventPicTemplateRequestStatus = (typeof TEMPLATE_REQUEST_STATUSES)[number]["value"];
export type EventPicVariantKey = (typeof EVENT_PIC_ALLOWED_VARIANT_FORMATS)[number]["key"];

export const DEFAULT_EVENT_PIC_FORMAT_ID: EventPicFormatId = "portrait";

export type EventPicTemplate = {
  id: string;
  name: string;
  preview_url: string;
  video_url?: string;
  layout: string;
  format_label: string;
  no_of_images: number | null;
  type?: string;
  type_name: string;
  published_at: string | null;
  required?: boolean;
  placeholder?: boolean;
  requires_resize?: boolean;
  source_width?: number | null;
  source_height?: number | null;
  target_width?: number | null;
  target_height?: number | null;
  photoshop_download_url?: string | null;
  psd_url?: string | null;
  zip_url?: string | null;
  source_file_url?: string | null;
  download_url?: string | null;
  tags?: string[];
  category?: string;
  source?: string;
  production_needed?: boolean;
  source_kind?: "templatebooth" | "event_pic_task";
  post_url?: string;
};

export type EventPicSelectedTemplateInput = Pick<
  EventPicTemplate,
  | "id"
  | "name"
  | "preview_url"
  | "layout"
  | "format_label"
  | "no_of_images"
  | "type"
  | "type_name"
  | "placeholder"
  | "requires_resize"
  | "source_width"
  | "source_height"
  | "target_width"
  | "target_height"
  | "production_needed"
  | "source_kind"
  | "post_url"
> & {
  required: boolean;
};

export type EventPicSelectedTemplate = EventPicSelectedTemplateInput & {
  post_url?: string;
  photoshop_download_url?: string | null;
  psd_url?: string | null;
  zip_url?: string | null;
  source_file_url?: string | null;
  download_url?: string | null;
};

export type EventPicTemplateRequestInput = {
  client: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  event: {
    date: string;
    type: string;
  };
  selected_templates: EventPicSelectedTemplateInput[];
  customization: {
    main_text: string;
    secondary_text?: string;
    notes?: string;
  };
  linked_contact_request_id?: string;
};

export type EventPicTemplateRequestAutomation = {
  canva_folder_status: "pending" | "created" | "not_configured" | "error";
  canva_folder_id: string | null;
  canva_folder_url: string | null;
  canva_error?: string;
};

export type EventPicTemplateProductionBrief = {
  generated_at: string;
  model_used?: string;
  client_summary: string;
  event_date: string;
  event_type: string;
  status_recommended?: {
    status: string;
    reason: string;
  };
  summary?: {
    client: string;
    email: string;
    phone: string;
    event_date: string;
    event_type: string;
    template_selected: string;
    total_formats: number;
    global_status: string;
    global_reason: string;
  };
  priority_actions?: string[];
  selected_formats_table?: Array<{
    format: string;
    template_name: string;
    photo_count: string;
    requirement: string;
    source_status: string;
    canva_status?: string;
    expected_action: string;
  }>;
  client_texts?: {
    primary_text: string;
    secondary_text: string;
    notes: string;
  };
  welcome_screen?: {
    source: string;
    action: string;
    status: string;
    attention: string;
  };
  photoshop?: {
    psd_available: string[];
    psd_missing: string[];
    psd_to_create: string[];
    actions: string[];
  };
  canva?: {
    global_folder_url?: string;
    global_folder_status?: string;
    format_links_available_count?: number;
    format_links_missing_count?: number;
    format_links_total_count?: number;
    links_available: string[];
    links_missing: string[];
    designs_to_create: string[];
    actions: string[];
  };
  final_file_names?: string[];
  selected_formats: string[];
  required_formats: string[];
  optional_formats: string[];
  welcome_screen_status: string;
  selected_texts: string[];
  primary_text: string;
  secondary_text: string;
  special_instructions: string;
  source_files_available: string[];
  source_files_missing: string[];
  source_files_to_collect: string[];
  photoshop_checklist: string[];
  canva_links_available?: string[];
  canva_links_missing?: string[];
  canva_checklist?: string[];
  lumabooth_checklist: string[];
  file_naming_recommendations: string[];
};

export type EventPicAiPreparationStatus =
  | "not_started"
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "not_configured";

export type EventPicAiPreparation = {
  status: EventPicAiPreparationStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  progress_label: string | null;
  brief: EventPicTemplateProductionBrief | null;
  checklist: string[];
  generated_files: string[];
};

export type EventPicTemplateRequest = Omit<EventPicTemplateRequestInput, "selected_templates"> & {
  id: string;
  status: EventPicTemplateRequestStatus;
  selected_templates: EventPicSelectedTemplate[];
  automation: EventPicTemplateRequestAutomation;
  ai_preparation: EventPicAiPreparation;
  ai_preparation_brief?: EventPicTemplateProductionBrief;
  created_at: string;
  updated_at: string;
};

const FORMAT_ALIASES: Record<string, EventPicFormatId> = {
  "vertical-2x6": "2x6",
  "portrait-4x6": "portrait",
  "landscape-4x6": "paysage"
};

const CATEGORY_ALIASES: Record<string, EventPicCategoryId> = {
  bapteme: "religieux",
  communion: "religieux",
  "baby-shower": "fete-bebe",
  "gender-reveal": "fete-bebe",
  "remise-diplome": "ecole-diplome"
};

export function normalizeEventPicFormatId(id: string | null | undefined): EventPicFormatId {
  if (!id) {
    return DEFAULT_EVENT_PIC_FORMAT_ID;
  }

  if (EVENT_PIC_FORMATS.some((format) => format.id === id)) {
    return id as EventPicFormatId;
  }

  return FORMAT_ALIASES[id] ?? DEFAULT_EVENT_PIC_FORMAT_ID;
}

export function getEventPicFormat(id: string | null | undefined) {
  const normalizedId = normalizeEventPicFormatId(id);
  return (
    EVENT_PIC_FORMATS.find((format) => format.id === normalizedId) ??
    EVENT_PIC_FORMATS.find((format) => format.id === DEFAULT_EVENT_PIC_FORMAT_ID) ??
    EVENT_PIC_FORMATS[0]
  );
}

export function getEventPicCategory(id: string | null | undefined) {
  const normalizedId = id ? CATEGORY_ALIASES[id] ?? id : id;
  return EVENT_PIC_CATEGORIES.find((category) => category.id === normalizedId) ?? EVENT_PIC_CATEGORIES[0];
}

export function isEventPicTemplateRequestStatus(value: unknown): value is EventPicTemplateRequestStatus {
  return TEMPLATE_REQUEST_STATUSES.some((status) => status.value === value);
}

export function getEventPicTemplateRequestStatusLabel(status: EventPicTemplateRequestStatus | string) {
  return TEMPLATE_REQUEST_STATUSES.find((item) => item.value === status)?.label ?? status;
}
