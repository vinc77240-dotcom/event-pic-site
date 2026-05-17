import { NextResponse } from "next/server";
import {
  getEventPicTemplateRequest,
  replaceEventPicTemplateRequestWelcomeTemplate
} from "@/src/server/eventPicTemplateRequests";
import {
  isReliableWelcomeCandidate,
  isTouchToStartCandidate,
  templateFromWelcomeCandidate,
  WelcomeDiagnosticCandidate
} from "@/src/server/templateboothWelcomeService";
import { upsertTemplateSourceLink } from "@/src/server/templateSourceLinks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SetWelcomeScreenBody = {
  candidate?: WelcomeDiagnosticCandidate;
  manual?: {
    family_key?: string;
    template_id?: string;
    post_url?: string;
    welcome_screen_url?: string;
    welcome_preview_url?: string;
    welcome_source_size?: string;
    welcome_target_size?: string;
    welcome_touch_to_start?: boolean;
    welcome_source_note?: string;
  };
};

function isWelcomeType(type: string | undefined) {
  return type === "static_welcome_screen" || type === "animated_welcome_screen";
}

function isWelcomeCandidate(candidate: WelcomeDiagnosticCandidate) {
  if (isWelcomeType(candidate.type)) {
    return true;
  }

  const typeName = candidate.type_name?.toLowerCase() ?? "";
  const name = candidate.name?.toLowerCase() ?? "";
  const layout = candidate.layout?.toLowerCase() ?? "";
  const src = candidate.src?.toLowerCase() ?? "";
  const poster = candidate.poster?.toLowerCase() ?? "";

  return (
    typeName.includes("welcome") ||
    name.includes("welcome") ||
    layout.includes("welcome") ||
    src.includes("welcome-screen") ||
    poster.includes("welcome-screen")
  );
}

function findWelcomeTemplateIndex(templates: Array<{ required: boolean; type?: string; format_label: string; placeholder?: boolean }>) {
  return templates.findIndex(
    (template) =>
      template.required &&
      (isWelcomeType(template.type) || template.format_label.includes("Fond d'ecran") || template.placeholder === true)
  );
}

function parseResolution(value: string | undefined) {
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

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.split("?")[0]?.replace(/\/$/, "");
}

function deriveFamilyKey(input: {
  family_key?: string;
  post_url?: string;
  template_id?: string;
  fallback_template_id?: string;
}) {
  const familyKey = input.family_key?.trim();
  if (familyKey) {
    return familyKey;
  }

  const normalizedPostUrl = normalizePostUrl(input.post_url);
  if (normalizedPostUrl) {
    return `post_url:${normalizedPostUrl}`;
  }

  const templateId = input.template_id?.trim() || input.fallback_template_id?.trim();
  if (templateId) {
    return `id:${templateId}`;
  }

  return undefined;
}

function buildManualCandidate(
  requestId: string,
  manual: NonNullable<SetWelcomeScreenBody["manual"]>,
  fallbackName: string,
  fallbackPostUrl?: string
): WelcomeDiagnosticCandidate {
  const preview = manual.welcome_preview_url?.trim() || "/welcome-placeholder-event-pic.svg";
  const sourceResolution = parseResolution(manual.welcome_screen_url) ?? parseResolution(manual.welcome_preview_url);
  const sourceType =
    manual.welcome_screen_url?.toLowerCase().includes("animated") ||
    manual.welcome_preview_url?.toLowerCase().includes("animated")
      ? "animated_welcome_screen"
      : "static_welcome_screen";

  return {
    id: `${requestId}__manual_welcome`,
    name: fallbackName,
    post_url: normalizePostUrl(manual.post_url?.trim() || fallbackPostUrl),
    src: preview,
    poster: preview,
    type: sourceType,
    type_name: "manual_welcome_screen",
    layout: "welcome",
    image_type: undefined,
    no_of_images: null,
    published_at: null,
    score: 100,
    match_reason: "manual_welcome_mapping",
    source_width: sourceResolution?.width ?? null,
    source_height: sourceResolution?.height ?? null,
    tags: [],
    touch_to_start:
      manual.welcome_touch_to_start === true ||
      Boolean(
        manual.welcome_screen_url?.toLowerCase().includes("touch") ||
          manual.welcome_preview_url?.toLowerCase().includes("touch")
      ),
    is_landscape:
      typeof sourceResolution?.width === "number" && typeof sourceResolution?.height === "number"
        ? sourceResolution.width >= sourceResolution.height
        : true
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as SetWelcomeScreenBody;
    const candidate = body.candidate;

    if (!candidate) {
      const manual = body.manual;

      if (!manual || (!manual.welcome_screen_url && !manual.welcome_preview_url)) {
        return NextResponse.json({ ok: false, error: "Candidat welcome screen manquant." }, { status: 400 });
      }

      const templateRequest = await getEventPicTemplateRequest(id);

      if (!templateRequest) {
        return NextResponse.json({ ok: false, error: "Demande client introuvable." }, { status: 404 });
      }

      const welcomeIndex = findWelcomeTemplateIndex(templateRequest.selected_templates);

      if (welcomeIndex === -1) {
        return NextResponse.json({ ok: false, error: "Format fond d'ecran obligatoire introuvable." }, { status: 400 });
      }

      const referenceTemplate =
        templateRequest.selected_templates.find(
          (template) =>
            !template.placeholder &&
            (template.layout === "46postcard-p" || template.layout === "46postcard-l")
        ) ?? templateRequest.selected_templates[0];
      const currentWelcomeTemplate = templateRequest.selected_templates[welcomeIndex];
      const manualCandidate = buildManualCandidate(
        id,
        manual,
        `${referenceTemplate?.name ?? "Template Event Pic"} (welcome manuel)`,
        referenceTemplate?.post_url
      );
      const baseTemplate = templateFromWelcomeCandidate(manualCandidate, currentWelcomeTemplate);
      const updatedRequest = await replaceEventPicTemplateRequestWelcomeTemplate(id, {
        ...baseTemplate,
        post_url: manualCandidate.post_url ?? manual.welcome_screen_url ?? referenceTemplate?.post_url,
        photoshop_download_url: null,
        psd_url: null,
        source_file_url: manual.welcome_screen_url?.trim() || null,
        download_url: manual.welcome_screen_url?.trim() || null
      });

      await upsertTemplateSourceLink({
        family_key: deriveFamilyKey({
          family_key: manual.family_key,
          post_url: manual.post_url || referenceTemplate?.post_url,
          template_id: manual.template_id,
          fallback_template_id: referenceTemplate?.id
        }),
        template_id: manual.template_id || referenceTemplate?.id,
        post_url: manual.post_url || referenceTemplate?.post_url,
        welcome_screen_url: manual.welcome_screen_url,
        welcome_preview_url: manual.welcome_preview_url,
        welcome_source_note: manual.welcome_source_note,
        welcome_source_size:
          manual.welcome_source_size ||
          (() => {
            const parsed = parseResolution(
              manual.welcome_screen_url || manual.welcome_preview_url || undefined
            );
            return parsed ? `${parsed.width}x${parsed.height}` : undefined;
          })(),
        welcome_target_size: manual.welcome_target_size || "1920x1080",
        welcome_touch_to_start: manualCandidate.touch_to_start,
        welcome_source: "manual_admin",
        preferred_welcome_preview_url: manual.welcome_preview_url || undefined,
        preferred_welcome_source_note: manual.welcome_source_note || undefined
      });

      return NextResponse.json({
        ok: true,
        message: "Welcome screen manuel force pour cette famille.",
        request: updatedRequest
      });
    }

    const templateRequest = await getEventPicTemplateRequest(id);

    if (!templateRequest) {
      return NextResponse.json({ ok: false, error: "Demande client introuvable." }, { status: 404 });
    }

    const welcomeIndex = findWelcomeTemplateIndex(templateRequest.selected_templates);

    if (welcomeIndex === -1) {
      return NextResponse.json({ ok: false, error: "Format fond d'ecran obligatoire introuvable." }, { status: 400 });
    }

    if (!isWelcomeCandidate(candidate)) {
      return NextResponse.json({ ok: false, error: "Le candidat choisi n'est pas un welcome screen." }, { status: 400 });
    }

    if (!isReliableWelcomeCandidate(candidate) && !isTouchToStartCandidate(candidate)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Le score de correspondance est insuffisant pour appliquer ce welcome screen."
        },
        { status: 400 }
      );
    }

    const currentWelcomeTemplate = templateRequest.selected_templates[welcomeIndex];
    const baseTemplate = templateFromWelcomeCandidate(candidate, currentWelcomeTemplate);
    const updatedRequest = await replaceEventPicTemplateRequestWelcomeTemplate(id, {
      ...baseTemplate,
      post_url: candidate.post_url,
      photoshop_download_url: null,
      psd_url: null,
      source_file_url: null,
      download_url: null
    });

    return NextResponse.json({
      ok: true,
      message: "Welcome screen applique a la demande.",
      request: updatedRequest
    });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-requests/[id]/set-welcome-screen", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Mise a jour du welcome screen impossible."
      },
      { status: 500 }
    );
  }
}
