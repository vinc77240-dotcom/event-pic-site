import OpenAI from "openai";
import {
  EventPicSelectedTemplate,
  EventPicTemplateProductionBrief,
  EventPicTemplateRequest
} from "@/src/shared/eventPicTemplates";
import { getTemplateFamily } from "@/src/server/eventPicTemplateService";
import { findTemplateSourceLink, getTemplateSourceLink } from "@/src/server/templateSourceLinks";

type EnrichedSelectedTemplate = {
  template: EventPicSelectedTemplate;
  psdSourceUrl: string | null;
  canvaSourceUrl: string | null;
  familyCanvaFolderUrl: string | null;
  familyCanvaFolderSource:
    | "templatebooth_api"
    | "templatebooth_harvester"
    | "manual"
    | "admin_manual"
    | "unknown";
  canvaSource:
    | "templatebooth_api"
    | "templatebooth_harvester"
    | "manual"
    | "admin_manual"
    | "not_provided_by_api"
    | "unknown";
  canvaMissingReason: string | null;
  sourceFileStatus: "disponible" | "a_recuperer" | "a_creer";
  canvaStatus: "disponible" | "lien_manquant" | "a_creer";
};

type OpenAIFormatRow = {
  format: string;
  template_name: string;
  photo_count: string;
  requirement: string;
  source_status: string;
  canva_status: string;
  expected_action: string;
};

type OpenAIBriefPayload = Partial<EventPicTemplateProductionBrief> & {
  status_recommended?: {
    status?: string;
    reason?: string;
  };
  summary?: {
    client?: string;
    email?: string;
    phone?: string;
    event_date?: string;
    event_type?: string;
    template_selected?: string;
    total_formats?: number;
    global_status?: string;
    global_reason?: string;
  };
  selected_formats?: OpenAIFormatRow[] | string[];
  selected_formats_table?: OpenAIFormatRow[];
  client_texts?: {
    primary_text?: string;
    secondary_text?: string;
    notes?: string;
  };
  welcome_screen?: {
    source?: string;
    action?: string;
    status?: string;
    attention?: string;
  };
  photoshop?: {
    psd_available?: string[];
    psd_missing?: string[];
    psd_to_create?: string[];
    actions?: string[];
  };
  canva?: {
    global_folder_url?: string;
    global_folder_status?: string;
    format_links_available_count?: number;
    format_links_missing_count?: number;
    format_links_total_count?: number;
    links_available?: string[];
    links_missing?: string[];
    designs_to_create?: string[];
    actions?: string[];
  };
  final_file_names?: string[];
};

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

function cleanText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

function asFormatRows(value: unknown, fallback: OpenAIFormatRow[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const rows = value
    .map((row) => {
      const item = row as Record<string, unknown>;
      const format = typeof item.format === "string" ? item.format.trim() : "";
      const templateName = typeof item.template_name === "string" ? item.template_name.trim() : "";
      const photoCount = typeof item.photo_count === "string" ? item.photo_count.trim() : "";
      const requirement = typeof item.requirement === "string" ? item.requirement.trim() : "";
      const sourceStatus = typeof item.source_status === "string" ? item.source_status.trim() : "";
      const canvaStatus = typeof item.canva_status === "string" ? item.canva_status.trim() : "";
      const expectedAction = typeof item.expected_action === "string" ? item.expected_action.trim() : "";

      if (!format || !templateName) {
        return null;
      }

      return {
        format,
        template_name: templateName,
        photo_count: photoCount || "Non renseigné",
        requirement: requirement || "Non renseigné",
        source_status: sourceStatus || "Non renseigné",
        canva_status: canvaStatus || "À renseigner",
        expected_action: expectedAction || "Non renseigné"
      } satisfies OpenAIFormatRow;
    })
    .filter((row): row is OpenAIFormatRow => Boolean(row));

  return rows.length > 0 ? rows : fallback;
}

function toSafeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function toPascalToken(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  if (!cleaned) {
    return "Client";
  }

  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function formatPhotoCount(value: number | null | undefined) {
  if (!value) {
    return "Photos selon design";
  }

  return value > 1 ? `${value} photos` : "1 photo";
}

function isWelcomeTemplate(template: EventPicSelectedTemplate) {
  return (
    template.required &&
    (template.type === "static_welcome_screen" ||
      template.type === "animated_welcome_screen" ||
      template.format_label.includes("Fond d'écran") ||
      template.format_label.includes("Fond d'ecran") ||
      template.placeholder === true)
  );
}

function welcomeStatusLabel(request: EventPicTemplateRequest) {
  const welcome = request.selected_templates.find((template) => isWelcomeTemplate(template));

  if (!welcome) {
    return "Fond d’écran 1920x1080 — à préparer par Event Pic";
  }

  if (welcome.placeholder || welcome.production_needed || welcome.source_kind === "event_pic_task") {
    return "Fond d’écran 1920x1080 — à préparer par Event Pic";
  }

  if (welcome.requires_resize && welcome.source_width === 1366 && welcome.source_height === 1024) {
    return "Source 1366x1024 — à adapter en 1920x1080";
  }

  if (welcome.requires_resize) {
    return "Source welcome screen disponible — à adapter en 1920x1080";
  }

  return "Fond d’écran 1920x1080 disponible";
}

function sourceStatusLabel(entry: EnrichedSelectedTemplate) {
  const template = entry.template;

  if (template.placeholder || template.production_needed || template.source_kind === "event_pic_task") {
    return "À créer par Event Pic";
  }

  return entry.psdSourceUrl ? "PSD disponible" : "PSD à récupérer";
}

function canvaStatusLabel(entry: EnrichedSelectedTemplate) {
  const template = entry.template;

  if (template.placeholder || template.production_needed || template.source_kind === "event_pic_task") {
    return "À créer";
  }

  return entry.canvaSourceUrl ? "Disponible" : "À renseigner";
}

function expectedActionLabel(entry: EnrichedSelectedTemplate) {
  const template = entry.template;

  if (template.placeholder || template.production_needed || template.source_kind === "event_pic_task") {
    return "Créer le design à partir du modèle sélectionné";
  }

  if (template.requires_resize) {
    return "Adapter la version source en 1920x1080 et vérifier la lisibilité";
  }

  if (!entry.psdSourceUrl && !entry.canvaSourceUrl) {
    return "Récupérer le PSD et renseigner le lien Canva";
  }

  if (!entry.psdSourceUrl) {
    return "Récupérer le PSD source";
  }

  if (!entry.canvaSourceUrl) {
    if (entry.canvaSource === "not_provided_by_api") {
      return "Renseigner le lien Canva (non fourni par l'API TemplateBooth)";
    }

    return "Renseigner le lien Canva de production";
  }

  return "Intégrer les textes client puis exporter";
}

function recommendedStatus(
  enrichedTemplates: EnrichedSelectedTemplate[],
  welcome: EventPicSelectedTemplate | undefined
) {
  const hasSourceGap = enrichedTemplates.some(
    (entry) => entry.sourceFileStatus !== "disponible" || entry.canvaStatus !== "disponible"
  );

  if (hasSourceGap) {
    return {
      status: "À préparer",
      reason: "Les fichiers sources PSD et les liens Canva doivent être récupérés avant production."
    };
  }

  if (welcome?.requires_resize) {
    return {
      status: "À adapter",
      reason: "Le fond d’écran doit être ajusté en 1920x1080 avant validation finale."
    };
  }

  return {
    status: "Prêt",
    reason: "Toutes les sources principales sont disponibles pour lancer la production."
  };
}

async function enrichSelectedTemplates(request: EventPicTemplateRequest) {
  const enriched = await Promise.all(
    request.selected_templates.map(async (template): Promise<EnrichedSelectedTemplate> => {
      const mapped = await getTemplateSourceLink({
        template_id: template.id,
        post_url: template.post_url,
        format_label: template.format_label,
        layout: template.layout,
        no_of_images: template.no_of_images ?? undefined
      });
      const familyMapped = await findTemplateSourceLink({
        familyKey: getTemplateFamily({ id: template.id, name: template.name, post_url: template.post_url }),
        postUrl: template.post_url
      });

      const psdSourceUrl = firstNonEmpty(
        template.psd_url,
        template.zip_url,
        template.source_file_url,
        template.download_url,
        template.photoshop_download_url,
        mapped?.psd_source_url
      );
      const templateAsRecord = template as Record<string, unknown>;
      const canvaSourceUrl = firstNonEmpty(
        typeof templateAsRecord.canva_edit_url === "string" ? (templateAsRecord.canva_edit_url as string) : undefined,
        typeof templateAsRecord.canva_template_url === "string"
          ? (templateAsRecord.canva_template_url as string)
          : undefined,
        mapped?.canva_template_url
      );
      const canvaSource =
        mapped?.canva_source === "templatebooth_api" ||
        mapped?.canva_source === "templatebooth_harvester" ||
        mapped?.canva_source === "manual" ||
        mapped?.canva_source === "admin_manual" ||
        mapped?.canva_source === "not_provided_by_api"
          ? mapped.canva_source
          : "unknown";
      const familyCanvaFolderUrl = firstNonEmpty(
        mapped?.canva_folder_url,
        familyMapped?.canva_folder_url
      );
      const familyCanvaFolderSource =
        mapped?.canva_folder_source === "templatebooth_api" ||
        mapped?.canva_folder_source === "templatebooth_harvester" ||
        mapped?.canva_folder_source === "manual" ||
        mapped?.canva_folder_source === "admin_manual"
          ? mapped.canva_folder_source
          : familyMapped?.canva_folder_source === "templatebooth_api" ||
              familyMapped?.canva_folder_source === "templatebooth_harvester" ||
              familyMapped?.canva_folder_source === "manual" ||
              familyMapped?.canva_folder_source === "admin_manual"
            ? familyMapped.canva_folder_source
            : "unknown";

      const isProductionNeeded =
        template.placeholder === true ||
        template.production_needed === true ||
        template.source_kind === "event_pic_task";
      const canvaMissingReason =
        isProductionNeeded || canvaSourceUrl
          ? null
          : familyCanvaFolderUrl
            ? "Dossier Canva global disponible, lien format a associer si necessaire"
          : canvaSource === "not_provided_by_api"
            ? "Lien Canva non fourni par l'API TemplateBooth"
            : "Lien Canva a renseigner";

      return {
        template,
        psdSourceUrl,
        canvaSourceUrl,
        familyCanvaFolderUrl,
        familyCanvaFolderSource,
        canvaSource,
        canvaMissingReason,
        sourceFileStatus: isProductionNeeded ? "a_creer" : psdSourceUrl ? "disponible" : "a_recuperer",
        canvaStatus: isProductionNeeded ? "a_creer" : canvaSourceUrl ? "disponible" : "lien_manquant"
      };
    })
  );

  return enriched;
}

function baseBrief(
  request: EventPicTemplateRequest,
  enrichedTemplates: EnrichedSelectedTemplate[]
): EventPicTemplateProductionBrief {
  const modelUsed = getEventPicOpenAiModel();
  const requiredTemplates = enrichedTemplates.filter((entry) => entry.template.required);
  const optionalTemplates = enrichedTemplates.filter((entry) => !entry.template.required);
  const clientLabel = `${request.client.first_name} ${request.client.last_name}`.trim();
  const eventDateToken = toSafeToken(request.event.date || "date");
  const clientPascal = toPascalToken(clientLabel);
  const selectedMainTemplate =
    enrichedTemplates.find((entry) => !isWelcomeTemplate(entry.template) && !entry.template.placeholder)?.template ??
    enrichedTemplates[0]?.template;
  const welcomeTemplate = enrichedTemplates.find((entry) => isWelcomeTemplate(entry.template))?.template;
  const statusRecommended = recommendedStatus(enrichedTemplates, welcomeTemplate);

  const selectedFormatsTable: OpenAIFormatRow[] = enrichedTemplates.map((entry) => ({
    format: entry.template.format_label,
    template_name: entry.template.name,
    photo_count: formatPhotoCount(entry.template.no_of_images),
    requirement: entry.template.required ? "Obligatoire" : "Optionnel",
    source_status: sourceStatusLabel(entry),
    canva_status: canvaStatusLabel(entry),
    expected_action: expectedActionLabel(entry)
  }));

  const selectedFormatsLegacy = selectedFormatsTable.map(
    (row) =>
      `${row.format} | ${row.template_name} | ${row.photo_count} | ${row.requirement.toLowerCase()} | ${row.source_status} | Canva: ${row.canva_status}`
  );

  const psdAvailable = enrichedTemplates
    .filter((entry) => entry.sourceFileStatus === "disponible")
    .map((entry) => `${entry.template.format_label} — ${entry.psdSourceUrl}`);
  const psdMissing = enrichedTemplates
    .filter((entry) => entry.sourceFileStatus === "a_recuperer")
    .map((entry) => `${entry.template.format_label} — PSD à récupérer`);
  const psdToCreate = enrichedTemplates
    .filter((entry) => entry.sourceFileStatus === "a_creer")
    .map((entry) => `${entry.template.format_label} — PSD à créer par Event Pic`);

  const canvaAvailable = enrichedTemplates
    .filter((entry) => entry.canvaStatus === "disponible")
    .map((entry) => `${entry.template.format_label} — ${entry.canvaSourceUrl}`);
  const canvaMissing = enrichedTemplates
    .filter((entry) => entry.canvaStatus === "lien_manquant")
    .map((entry) => `${entry.template.format_label} — Lien Canva à renseigner`);
  const canvaMissingResolved = enrichedTemplates
    .filter((entry) => entry.canvaStatus === "lien_manquant")
    .map((entry) => `${entry.template.format_label} â€” ${entry.canvaMissingReason ?? "Lien Canva a renseigner"}`);
  const canvaToCreate = enrichedTemplates
    .filter((entry) => entry.canvaStatus === "a_creer")
    .map((entry) => `${entry.template.format_label} — Design Canva à créer`);

  const globalCanvaFolderUrl =
    enrichedTemplates.find((entry) => Boolean(entry.familyCanvaFolderUrl))?.familyCanvaFolderUrl ?? null;
  const totalFormatLinks = enrichedTemplates.length;
  const availableFormatLinksCount = canvaAvailable.length;
  const missingFormatLinksCount = Math.max(totalFormatLinks - availableFormatLinksCount, 0);

  const sourceToCollect = [
    ...enrichedTemplates
      .filter((entry) => entry.sourceFileStatus === "a_recuperer")
      .map((entry) => `Récupérer le PSD pour ${entry.template.format_label}`),
    ...enrichedTemplates
      .filter((entry) => entry.canvaStatus === "lien_manquant")
      .map(
        (entry) =>
          `Renseigner le lien Canva pour ${entry.template.format_label} (${entry.canvaMissingReason ?? "Lien Canva a renseigner"})`
      )
  ];

  const secondary = cleanText(request.customization.secondary_text) || "Non renseigné";
  const notes = cleanText(request.customization.notes) || "Non renseigné";
  const templateChosen = selectedMainTemplate?.name || "Non renseigné";

  return {
    generated_at: new Date().toISOString(),
    model_used: modelUsed,
    client_summary: `${clientLabel} — ${request.client.email} — ${request.client.phone}`,
    event_date: request.event.date,
    event_type: request.event.type,
    status_recommended: statusRecommended,
    summary: {
      client: clientLabel || "Non renseigné",
      email: request.client.email || "Non renseigné",
      phone: request.client.phone || "Non renseigné",
      event_date: request.event.date || "Non renseigné",
      event_type: request.event.type || "Non renseigné",
      template_selected: templateChosen,
      total_formats: enrichedTemplates.length,
      global_status: statusRecommended.status,
      global_reason: statusRecommended.reason
    },
    priority_actions: [
      "Récupérer les fichiers sources TemplateBooth",
      "Préparer les déclinaisons Photoshop / Canva",
      "Adapter le fond d’écran 1366x1024 en 1920x1080 si nécessaire",
      "Intégrer les textes client",
      "Exporter les fichiers finaux",
      "Importer / vérifier dans LumaBooth"
    ],
    selected_formats_table: selectedFormatsTable,
    client_texts: {
      primary_text: request.customization.main_text || "Non renseigné",
      secondary_text: secondary,
      notes
    },
    welcome_screen: {
      source:
        welcomeTemplate?.source_width && welcomeTemplate?.source_height
          ? `${welcomeTemplate.source_width}x${welcomeTemplate.source_height}`
          : welcomeTemplate?.placeholder
            ? "Aucune source fiable disponible"
            : "1920x1080",
      action: welcomeTemplate?.requires_resize
        ? "Adapter en 1920x1080"
        : welcomeTemplate?.placeholder
          ? "Créer le fond d’écran 1920x1080 à partir du design sélectionné"
          : "Contrôler et valider le rendu final",
      status: welcomeTemplate?.placeholder
        ? "À préparer"
        : welcomeTemplate?.requires_resize
          ? "À adapter"
          : "Prêt",
      attention: "Vérifier la lisibilité sur écran d’accueil LumaBooth."
    },
    photoshop: {
      psd_available: psdAvailable,
      psd_missing: psdMissing,
      psd_to_create: psdToCreate,
      actions: [
        "Vérifier la cohérence graphique sur tous les formats.",
        "Intégrer le texte principal sur chaque déclinaison.",
        secondary !== "Non renseigné"
          ? "Intégrer le texte secondaire selon les zones prévues."
          : "Aucun texte secondaire à intégrer.",
        "Exporter les fichiers finaux en PNG/JPG."
      ]
    },
    canva: {
      global_folder_url: globalCanvaFolderUrl ?? undefined,
      global_folder_status: globalCanvaFolderUrl ? "Disponible" : "Manquant",
      format_links_available_count: availableFormatLinksCount,
      format_links_missing_count: missingFormatLinksCount,
      format_links_total_count: totalFormatLinks,
      links_available: canvaAvailable,
      links_missing: canvaMissingResolved,
      designs_to_create: canvaToCreate,
      actions: [
        globalCanvaFolderUrl
          ? "Dossier Canva global disponible pour la production."
          : "Dossier Canva global manquant - a renseigner manuellement.",
        globalCanvaFolderUrl && missingFormatLinksCount > 0
          ? "Dossier Canva global disponible, liens format a associer si necessaire."
          : "Renseigner les liens Canva format manquants.",
        "Vérifier les liens Canva disponibles.",
        "Dupliquer ou créer les designs Canva manquants.",
        "Contrôler la cohérence des textes et du style."
      ]
    },
    final_file_names: [
      `EventPic_${clientPascal}_${eventDateToken}_2x6.png`,
      `EventPic_${clientPascal}_${eventDateToken}_4x6_Portrait.png`,
      `EventPic_${clientPascal}_${eventDateToken}_4x6_Paysage.png`,
      `EventPic_${clientPascal}_${eventDateToken}_Welcome_1920x1080.png`
    ],
    selected_formats: selectedFormatsLegacy,
    required_formats: requiredTemplates.map((entry) => `${entry.template.format_label} — ${entry.template.name}`),
    optional_formats: optionalTemplates.map((entry) => `${entry.template.format_label} — ${entry.template.name}`),
    welcome_screen_status: welcomeStatusLabel(request),
    selected_texts: [
      `Texte principal: ${request.customization.main_text || "Non renseigné"}`,
      `Texte secondaire: ${secondary}`,
      `Consignes particulières: ${notes}`
    ],
    primary_text: request.customization.main_text || "Non renseigné",
    secondary_text: secondary,
    special_instructions: notes,
    source_files_available: psdAvailable,
    source_files_missing: [...psdMissing, ...psdToCreate],
    source_files_to_collect:
      sourceToCollect.length > 0 ? sourceToCollect : ["Aucune action de collecte source manquante."],
    photoshop_checklist: [
      "Récupérer les PSD manquants.",
      "Intégrer les textes client.",
      "Vérifier les marges et la lisibilité.",
      "Exporter les formats finaux."
    ],
    canva_links_available: canvaAvailable,
    canva_links_missing: [...canvaMissingResolved, ...canvaToCreate],
    canva_checklist: [
      "Vérifier les liens Canva.",
      "Créer/dupliquer les designs manquants.",
      "Valider les textes et les couleurs."
    ],
    lumabooth_checklist: [
      "Vérifier l’ordre des photos",
      "Vérifier le format 2x6",
      "Vérifier le portrait 10x15 / 4x6",
      "Vérifier le paysage 10x15 / 4x6",
      "Vérifier le welcome screen 1920x1080",
      "Tester le rendu borne",
      "Tester l’impression"
    ],
    file_naming_recommendations: [
      `EventPic_${clientPascal}_${eventDateToken}_2x6.png`,
      `EventPic_${clientPascal}_${eventDateToken}_4x6_Portrait.png`,
      `EventPic_${clientPascal}_${eventDateToken}_4x6_Paysage.png`,
      `EventPic_${clientPascal}_${eventDateToken}_Welcome_1920x1080.png`
    ]
  };
}

function parseJsonObject(text: string) {
  const direct = text.trim();

  if (!direct.startsWith("{")) {
    const start = direct.indexOf("{");
    const end = direct.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(direct.slice(start, end + 1));
    }
  }

  return JSON.parse(direct);
}

export function getEventPicOpenAiModel() {
  const configured = cleanText(process.env.OPENAI_MODEL);
  return configured || DEFAULT_OPENAI_MODEL;
}

async function buildAiBrief(base: EventPicTemplateProductionBrief) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey });

  const systemPrompt = [
    "Tu es responsable de production Event Pic.",
    "Tu dois générer une fiche de production claire, professionnelle et directement exploitable.",
    "Réduis les répétitions : regroupe les éléments similaires.",
    "Écris en français avec accents corrects.",
    "Retourne uniquement un JSON valide (sans markdown)."
  ].join(" ");

  const userPayload = {
    instruction:
      "Utilise exactement les sections demandées. Si un champ est vide, écris « Non renseigné ». N’invente aucun lien source.",
    expected_json_shape: {
      status_recommended: { status: "string", reason: "string" },
      summary: {
        client: "string",
        email: "string",
        phone: "string",
        event_date: "string",
        event_type: "string",
        template_selected: "string",
        total_formats: 0,
        global_status: "string",
        global_reason: "string"
      },
      priority_actions: ["string"],
      selected_formats: [
        {
          format: "string",
          template_name: "string",
          photo_count: "string",
          requirement: "Obligatoire|Optionnel",
          source_status: "string",
          canva_status: "Disponible|À renseigner|À créer",
          expected_action: "string"
        }
      ],
      client_texts: { primary_text: "string", secondary_text: "string", notes: "string" },
      welcome_screen: { source: "string", action: "string", status: "string", attention: "string" },
      photoshop: {
        psd_available: ["string"],
        psd_missing: ["string"],
        psd_to_create: ["string"],
        actions: ["string"]
      },
      canva: {
        global_folder_url: "string",
        global_folder_status: "Disponible|Manquant",
        format_links_available_count: 0,
        format_links_missing_count: 0,
        format_links_total_count: 0,
        links_available: ["string"],
        links_missing: ["string"],
        designs_to_create: ["string"],
        actions: ["string"]
      },
      lumabooth_checklist: ["string"],
      final_file_names: ["string"]
    },
    base_brief: base
  };

  const completion = await client.chat.completions.create({
    model: getEventPicOpenAiModel(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) }
    ]
  });

  const content = completion.choices[0]?.message?.content;

  if (!content || !content.trim()) {
    return null;
  }

  return parseJsonObject(content) as OpenAIBriefPayload;
}

function mergeBrief(base: EventPicTemplateProductionBrief, aiPayload: OpenAIBriefPayload | null): EventPicTemplateProductionBrief {
  if (!aiPayload) {
    return {
      ...base,
      model_used: base.model_used || getEventPicOpenAiModel()
    };
  }

  const fallbackFormatRows: OpenAIFormatRow[] = (base.selected_formats_table ?? []).map((row) => ({
    format: row.format,
    template_name: row.template_name,
    photo_count: row.photo_count,
    requirement: row.requirement,
    source_status: row.source_status,
    canva_status: row.canva_status ?? "À renseigner",
    expected_action: row.expected_action
  }));

  const selectedFormatsTable = asFormatRows(
    aiPayload.selected_formats_table ?? aiPayload.selected_formats,
    fallbackFormatRows
  ).map((row): OpenAIFormatRow => {
    const baseRow =
      base.selected_formats_table?.find(
        (candidate) =>
          candidate.format === row.format &&
          candidate.template_name === row.template_name &&
          candidate.photo_count === row.photo_count
      ) ?? null;

    if (!baseRow) {
      return row;
    }

    if (!row.canva_status || row.canva_status === "À renseigner") {
      return {
        ...row,
        canva_status: baseRow.canva_status ?? row.canva_status ?? "À renseigner"
      };
    }

    return row;
  });

  const selectedFormatsLegacy =
    selectedFormatsTable.length > 0
      ? selectedFormatsTable.map(
          (row) =>
            `${row.format} | ${row.template_name} | ${row.photo_count} | ${row.requirement.toLowerCase()} | ${row.source_status} | Canva: ${row.canva_status}`
        )
      : asStringArray(aiPayload.selected_formats, base.selected_formats);

  const finalNames = asStringArray(
    aiPayload.final_file_names ?? aiPayload.file_naming_recommendations,
    base.final_file_names ?? base.file_naming_recommendations
  );

  const photoshopAvailable = asStringArray(
    aiPayload.photoshop?.psd_available,
    base.photoshop?.psd_available ?? base.source_files_available
  );
  const photoshopMissing = asStringArray(
    aiPayload.photoshop?.psd_missing,
    base.photoshop?.psd_missing ?? base.source_files_missing
  );
  const photoshopToCreate = asStringArray(
    aiPayload.photoshop?.psd_to_create,
    base.photoshop?.psd_to_create ?? []
  );
  const photoshopActions = asStringArray(
    aiPayload.photoshop?.actions,
    base.photoshop?.actions ?? base.photoshop_checklist
  );

  const canvaAvailable = asStringArray(
    aiPayload.canva?.links_available,
    base.canva?.links_available ?? base.canva_links_available ?? []
  );
  const canvaMissing = asStringArray(
    aiPayload.canva?.links_missing,
    base.canva?.links_missing ?? base.canva_links_missing ?? []
  );
  const canvaToCreate = asStringArray(
    aiPayload.canva?.designs_to_create,
    base.canva?.designs_to_create ?? []
  );
  const canvaActions = asStringArray(
    aiPayload.canva?.actions,
    base.canva?.actions ?? base.canva_checklist ?? []
  );
  const canvaGlobalFolderUrl = cleanText(aiPayload.canva?.global_folder_url) || base.canva?.global_folder_url || undefined;
  const canvaGlobalFolderStatus =
    cleanText(aiPayload.canva?.global_folder_status) ||
    base.canva?.global_folder_status ||
    (canvaGlobalFolderUrl ? "Disponible" : "Manquant");
  const canvaFormatLinksTotalCount =
    typeof aiPayload.canva?.format_links_total_count === "number"
      ? aiPayload.canva.format_links_total_count
      : typeof base.canva?.format_links_total_count === "number"
        ? base.canva.format_links_total_count
        : selectedFormatsTable.length;
  const canvaFormatLinksAvailableCount =
    typeof aiPayload.canva?.format_links_available_count === "number"
      ? aiPayload.canva.format_links_available_count
      : typeof base.canva?.format_links_available_count === "number"
        ? base.canva.format_links_available_count
        : canvaAvailable.length;
  const canvaFormatLinksMissingCount =
    typeof aiPayload.canva?.format_links_missing_count === "number"
      ? aiPayload.canva.format_links_missing_count
      : typeof base.canva?.format_links_missing_count === "number"
        ? base.canva.format_links_missing_count
        : Math.max(canvaFormatLinksTotalCount - canvaFormatLinksAvailableCount, 0);

  return {
    generated_at: new Date().toISOString(),
    model_used: cleanText(aiPayload.model_used) || base.model_used || getEventPicOpenAiModel(),
    client_summary: cleanText(aiPayload.client_summary) || base.client_summary,
    event_date: cleanText(aiPayload.event_date) || base.event_date,
    event_type: cleanText(aiPayload.event_type) || base.event_type,
    status_recommended: {
      status: cleanText(aiPayload.status_recommended?.status) || base.status_recommended?.status || "À préparer",
      reason:
        cleanText(aiPayload.status_recommended?.reason) ||
        base.status_recommended?.reason ||
        "Les fichiers sources PSD et les liens Canva doivent être récupérés avant production."
    },
    summary: {
      client: cleanText(aiPayload.summary?.client) || base.summary?.client || "Non renseigné",
      email: cleanText(aiPayload.summary?.email) || base.summary?.email || "Non renseigné",
      phone: cleanText(aiPayload.summary?.phone) || base.summary?.phone || "Non renseigné",
      event_date: cleanText(aiPayload.summary?.event_date) || base.summary?.event_date || base.event_date,
      event_type: cleanText(aiPayload.summary?.event_type) || base.summary?.event_type || base.event_type,
      template_selected:
        cleanText(aiPayload.summary?.template_selected) || base.summary?.template_selected || "Non renseigné",
      total_formats:
        typeof aiPayload.summary?.total_formats === "number"
          ? aiPayload.summary.total_formats
          : base.summary?.total_formats ?? 0,
      global_status: cleanText(aiPayload.summary?.global_status) || base.summary?.global_status || "À préparer",
      global_reason:
        cleanText(aiPayload.summary?.global_reason) ||
        base.summary?.global_reason ||
        "Les sources doivent être vérifiées avant production."
    },
    priority_actions: asStringArray(aiPayload.priority_actions, base.priority_actions ?? []),
    selected_formats_table: selectedFormatsTable,
    client_texts: {
      primary_text:
        cleanText(aiPayload.client_texts?.primary_text) || base.client_texts?.primary_text || base.primary_text,
      secondary_text:
        cleanText(aiPayload.client_texts?.secondary_text) ||
        base.client_texts?.secondary_text ||
        base.secondary_text ||
        "Non renseigné",
      notes:
        cleanText(aiPayload.client_texts?.notes) || base.client_texts?.notes || base.special_instructions || "Non renseigné"
    },
    welcome_screen: {
      source: cleanText(aiPayload.welcome_screen?.source) || base.welcome_screen?.source || "Non renseigné",
      action: cleanText(aiPayload.welcome_screen?.action) || base.welcome_screen?.action || "Non renseigné",
      status: cleanText(aiPayload.welcome_screen?.status) || base.welcome_screen?.status || "À préparer",
      attention:
        cleanText(aiPayload.welcome_screen?.attention) ||
        base.welcome_screen?.attention ||
        "Vérifier la lisibilité sur écran d’accueil LumaBooth."
    },
    photoshop: {
      psd_available: photoshopAvailable,
      psd_missing: photoshopMissing,
      psd_to_create: photoshopToCreate,
      actions: photoshopActions
    },
    canva: {
      global_folder_url: canvaGlobalFolderUrl,
      global_folder_status: canvaGlobalFolderStatus,
      format_links_available_count: canvaFormatLinksAvailableCount,
      format_links_missing_count: canvaFormatLinksMissingCount,
      format_links_total_count: canvaFormatLinksTotalCount,
      links_available: canvaAvailable,
      links_missing: canvaMissing,
      designs_to_create: canvaToCreate,
      actions: canvaActions
    },
    final_file_names: finalNames,
    selected_formats: selectedFormatsLegacy,
    required_formats: asStringArray(aiPayload.required_formats, base.required_formats),
    optional_formats: asStringArray(aiPayload.optional_formats, base.optional_formats),
    welcome_screen_status: cleanText(aiPayload.welcome_screen_status) || base.welcome_screen_status,
    selected_texts: asStringArray(aiPayload.selected_texts, base.selected_texts),
    primary_text: cleanText(aiPayload.primary_text) || base.primary_text,
    secondary_text: cleanText(aiPayload.secondary_text) || base.secondary_text,
    special_instructions: cleanText(aiPayload.special_instructions) || base.special_instructions,
    source_files_available: asStringArray(aiPayload.source_files_available, base.source_files_available),
    source_files_missing: asStringArray(aiPayload.source_files_missing, base.source_files_missing),
    source_files_to_collect: asStringArray(aiPayload.source_files_to_collect, base.source_files_to_collect),
    photoshop_checklist: asStringArray(aiPayload.photoshop_checklist, photoshopActions),
    canva_links_available: asStringArray(aiPayload.canva_links_available, canvaAvailable),
    canva_links_missing: asStringArray(aiPayload.canva_links_missing, canvaMissing),
    canva_checklist: asStringArray(aiPayload.canva_checklist, canvaActions),
    lumabooth_checklist: asStringArray(aiPayload.lumabooth_checklist, base.lumabooth_checklist),
    file_naming_recommendations: asStringArray(aiPayload.file_naming_recommendations, finalNames)
  };
}

export async function prepareTemplateProductionBrief(request: EventPicTemplateRequest) {
  return prepareTemplateProductionBriefWithProgress(request);
}

export async function prepareTemplateProductionBriefWithProgress(
  request: EventPicTemplateRequest,
  onProgress?: (step: string) => Promise<void> | void
) {
  await onProgress?.("Analyse de la demande client");
  const enrichedTemplates = await enrichSelectedTemplates(request);

  await onProgress?.("Identification des formats à produire");
  const base = baseBrief(request, enrichedTemplates);

  await onProgress?.("Préparation des textes à intégrer");
  await onProgress?.("Génération de la check-list production");

  const aiPayload = await buildAiBrief(base);
  const merged = mergeBrief(base, aiPayload);

  await onProgress?.("Fiche de préparation terminée");
  return merged;
}
