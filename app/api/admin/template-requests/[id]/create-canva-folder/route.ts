import { NextResponse } from "next/server";
import { getEventPicTemplateRequest } from "@/src/server/eventPicTemplateRequests";
import {
  isCanvaAutomationConfigured,
  markCanvaAutomationStatus,
  prepareCanvaAutomation
} from "@/lib/canva/canvaService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const templateRequest = await getEventPicTemplateRequest(id);

    if (!templateRequest) {
      return NextResponse.json({ error: "Demande client introuvable." }, { status: 404 });
    }

    if (!isCanvaAutomationConfigured()) {
      const updated = await markCanvaAutomationStatus(id, {
        canva_folder_status: "not_configured",
        canva_error: "Intégration Canva non configurée."
      });

      return NextResponse.json({
        ok: false,
        message: "Intégration Canva non configurée.",
        request: updated
      });
    }

    const updated = await prepareCanvaAutomation(templateRequest);

    return NextResponse.json({
      ok: true,
      message: "Dossier Canva préparé.",
      request: updated
    });
  } catch (error) {
    const { id } = await context.params;
    const message = error instanceof Error ? error.message : "Préparation Canva impossible.";

    try {
      await markCanvaAutomationStatus(id, {
        canva_folder_status: "error",
        canva_error: message
      });
    } catch {
      // La demande est peut-être introuvable ; l'erreur principale suffit pour l'admin.
    }

    console.error("[Event Pic] POST /api/admin/template-requests/[id]/create-canva-folder", error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
