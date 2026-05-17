import { NextResponse } from "next/server";
import {
  getEventPicTemplateRequest,
  updateEventPicTemplateRequestAiBrief,
  updateEventPicTemplateRequestAiPreparation
} from "@/src/server/eventPicTemplateRequests";
import {
  getEventPicOpenAiModel,
  prepareTemplateProductionBriefWithProgress
} from "@/lib/ai/templatePreparationService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isQuotaError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : typeof error === "string" ? error.toLowerCase() : "";

  if (!message) {
    return false;
  }

  return message.includes("insufficient_quota") || message.includes("quota") || message.includes("429");
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const modelUsed = getEventPicOpenAiModel();

  try {
    const templateRequest = await getEventPicTemplateRequest(id);

    if (!templateRequest) {
      return NextResponse.json({ ok: false, error: "Demande client introuvable." }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const updated = await updateEventPicTemplateRequestAiPreparation(id, {
        status: "not_configured",
        started_at: null,
        completed_at: null,
        error_message: null,
        progress_label: "IA non configuree",
        brief: null,
        checklist: [],
        generated_files: []
      });

      return NextResponse.json(
        {
          ok: false,
          message: `IA non configurée. Modèle IA utilisé : ${modelUsed}`,
          modelUsed,
          request: updated
        },
        { status: 200 }
      );
    }

    await updateEventPicTemplateRequestAiPreparation(id, {
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
      progress_label: "Analyse de la demande client",
      brief: null,
      checklist: [],
      generated_files: []
    });

    const brief = await prepareTemplateProductionBriefWithProgress(templateRequest, async (step) => {
      await updateEventPicTemplateRequestAiPreparation(id, {
        status: "running",
        progress_label: step
      });
    });
    const updated = await updateEventPicTemplateRequestAiBrief(id, brief);

    return NextResponse.json({
      ok: true,
      message: `Fiche de préparation IA terminée. Modèle IA utilisé : ${modelUsed}`,
      modelUsed,
      request: updated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preparation IA impossible.";
    const safeMessage = isQuotaError(error) ? "Crédit API insuffisant." : message;

    await updateEventPicTemplateRequestAiPreparation(id, {
      status: "error",
      completed_at: new Date().toISOString(),
      error_message: safeMessage,
      progress_label: "Erreur IA"
    }).catch(() => {
      // noop
    });

    console.error("[Event Pic] POST /api/admin/template-requests/[id]/prepare-ai", error);
    return NextResponse.json({ ok: false, error: safeMessage, modelUsed }, { status: 400 });
  }
}
