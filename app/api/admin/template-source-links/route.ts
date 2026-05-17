import { NextResponse } from "next/server";
import {
  listTemplateSourceLinks,
  TemplateSourceLink,
  upsertTemplateSourceLink
} from "@/src/server/templateSourceLinks";

type TemplateSourceLinkPayload = {
  family_key?: string;
  template_id?: string;
  template_name?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string | number;
  post_url?: string;
  canva_folder_url?: string;
  canva_folder_source?: string;
  canva_folder_detected_at?: string;
  canva_template_url?: string;
  canva_source?: string;
  canva_detected_at?: string;
  welcome_screen_url?: string;
  welcome_preview_url?: string;
  welcome_source_note?: string;
  welcome_source_size?: string;
  welcome_target_size?: string;
  welcome_touch_to_start?: boolean | string;
  welcome_source?: string;
  preferred_welcome_id?: string;
  preferred_welcome_preview_url?: string;
  preferred_welcome_source_note?: string;
  psd_source_url?: string;
  zip_url?: string;
  notes?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNoOfImages(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.floor(value)}images`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    const onlyDigits = trimmed.match(/^(\d+)$/);

    if (onlyDigits) {
      return `${onlyDigits[1]}images`;
    }

    const imagesPattern = trimmed.match(/^(\d+)\s*images?$/i);

    if (imagesPattern) {
      return `${imagesPattern[1]}images`;
    }

    return trimmed;
  }

  return "";
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "oui"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "non"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export async function GET() {
  try {
    const links = await listTemplateSourceLinks();
    return NextResponse.json({
      ok: true,
      links
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/template-source-links", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement des liens templates impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TemplateSourceLinkPayload;
    const familyKey = cleanText(body.family_key);
    const templateId = cleanText(body.template_id);
    const templateName = cleanText(body.template_name);
    const formatLabel = cleanText(body.format_label);
    const layout = cleanText(body.layout);
    const noOfImages = normalizeNoOfImages(body.no_of_images);
    const postUrl = cleanText(body.post_url);
    const canvaFolderUrl = cleanText(body.canva_folder_url);
    const requestedCanvaFolderSource = cleanText(body.canva_folder_source);
    const canvaFolderDetectedAt = cleanText(body.canva_folder_detected_at);
    const canvaTemplateUrl = cleanText(body.canva_template_url);
    const requestedCanvaSource = cleanText(body.canva_source);
    const canvaDetectedAt = cleanText(body.canva_detected_at);
    const welcomeScreenUrl = cleanText(body.welcome_screen_url);
    const welcomePreviewUrl = cleanText(body.welcome_preview_url);
    const welcomeSourceNote = cleanText(body.welcome_source_note);
    const welcomeSourceSize = cleanText(body.welcome_source_size);
    const welcomeTargetSize = cleanText(body.welcome_target_size);
    const welcomeTouchToStart = normalizeBoolean(body.welcome_touch_to_start);
    const requestedWelcomeSource = cleanText(body.welcome_source);
    const preferredWelcomeId = cleanText(body.preferred_welcome_id);
    const preferredWelcomePreviewUrl = cleanText(body.preferred_welcome_preview_url);
    const preferredWelcomeSourceNote = cleanText(body.preferred_welcome_source_note);
    const psdSourceUrl = cleanText(body.psd_source_url);
    const zipUrl = cleanText(body.zip_url);
    const notes = cleanText(body.notes);

    if (!familyKey && !templateId && !postUrl) {
      return NextResponse.json(
        { ok: false, error: "family_key, template_id ou post_url requis." },
        { status: 400 }
      );
    }

    if (
      !canvaFolderUrl &&
      !canvaTemplateUrl &&
      !psdSourceUrl &&
      !zipUrl &&
      !notes &&
      !welcomeScreenUrl &&
      !welcomePreviewUrl &&
      !welcomeSourceNote &&
      !preferredWelcomeId &&
      !preferredWelcomePreviewUrl &&
      !preferredWelcomeSourceNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Aucune donnee a enregistrer (Canva, PSD/ZIP ou override welcome screen)."
        },
        { status: 400 }
      );
    }

    if (canvaTemplateUrl && !formatLabel) {
      return NextResponse.json(
        { ok: false, error: "format_label requis quand canva_template_url est renseigne." },
        { status: 400 }
      );
    }

    const entry: TemplateSourceLink = {
      family_key: familyKey || undefined,
      template_id: templateId,
      template_name: templateName || undefined,
      format_label: formatLabel || undefined,
      layout: layout || undefined,
      no_of_images: noOfImages || undefined,
      post_url: postUrl || undefined,
      canva_folder_url: canvaFolderUrl || undefined,
      canva_folder_source:
        requestedCanvaFolderSource === "templatebooth_api" ||
        requestedCanvaFolderSource === "templatebooth_harvester"
          ? requestedCanvaFolderSource
          : "manual",
      canva_folder_detected_at: canvaFolderDetectedAt || undefined,
      canva_template_url: canvaTemplateUrl || undefined,
      canva_source:
        requestedCanvaSource === "templatebooth_api" ||
        requestedCanvaSource === "templatebooth_harvester" ||
        requestedCanvaSource === "not_provided_by_api"
          ? (requestedCanvaSource as "templatebooth_api" | "templatebooth_harvester" | "not_provided_by_api")
          : "manual",
      canva_detected_at: canvaDetectedAt || undefined,
      welcome_screen_url: welcomeScreenUrl || undefined,
      welcome_preview_url: welcomePreviewUrl || undefined,
      welcome_source_note: welcomeSourceNote || undefined,
      welcome_source_size: welcomeSourceSize || undefined,
      welcome_target_size: welcomeTargetSize || undefined,
      welcome_touch_to_start: welcomeTouchToStart,
      welcome_source:
        requestedWelcomeSource === "manual_admin" ||
        requestedWelcomeSource === "templatebooth_api" ||
        requestedWelcomeSource === "templatebooth_harvester"
          ? requestedWelcomeSource
          : requestedWelcomeSource === "unknown"
            ? "unknown"
            : undefined,
      preferred_welcome_id: preferredWelcomeId || undefined,
      preferred_welcome_preview_url: preferredWelcomePreviewUrl || undefined,
      preferred_welcome_source_note: preferredWelcomeSourceNote || undefined,
      psd_source_url: psdSourceUrl || undefined,
      zip_url: zipUrl || undefined,
      notes: notes || undefined
    };

    const saved = await upsertTemplateSourceLink(entry);

    return NextResponse.json({
      ok: true,
      entry: saved,
      message: "Source Canva/PSD enregistree."
    });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-source-links", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Enregistrement du lien template impossible."
      },
      { status: 500 }
    );
  }
}
