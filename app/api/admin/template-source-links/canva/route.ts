import { NextResponse } from "next/server";
import {
  listTemplateSourceLinks,
  TemplateSourceLink,
  upsertTemplateSourceLink
} from "@/src/server/templateSourceLinks";

type CanvaSourceLinkPayload = {
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

export async function GET() {
  try {
    const links = await listTemplateSourceLinks();
    return NextResponse.json({
      ok: true,
      links
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/template-source-links/canva", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement des liens Canva impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CanvaSourceLinkPayload;
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
    const psdSourceUrl = cleanText(body.psd_source_url);
    const zipUrl = cleanText(body.zip_url);
    const notes = cleanText(body.notes);

    if (!familyKey && !templateId && !postUrl) {
      return NextResponse.json(
        { ok: false, error: "family_key, template_id ou post_url requis." },
        { status: 400 }
      );
    }

    if (!canvaFolderUrl && !canvaTemplateUrl && !psdSourceUrl && !zipUrl && !notes) {
      return NextResponse.json(
        {
          ok: false,
          error: "Aucune donnee a enregistrer (canva_folder_url, canva_template_url, psd_source_url, zip_url ou notes)."
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
    console.error("[Event Pic] POST /api/admin/template-source-links/canva", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Enregistrement du lien Canva impossible."
      },
      { status: 500 }
    );
  }
}
