import { NextResponse } from "next/server";
import { serializeTemplateBoothError, TemplateBoothError } from "@/src/server/templatebooth/errors";
import type { CustomizationStatus, CanvaReviewStatus } from "@/src/shared/templatebooth";
import {
  getCustomizationRequest,
  isCanvaReviewStatus,
  isCustomizationStatus,
  updateCustomizationRequest
} from "@/src/server/templatebooth/requestStore";
import { deleteEventPicTemplateRequest } from "@/src/server/eventPicTemplateRequests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const request = await getCustomizationRequest(id);

    if (!request) {
      throw new TemplateBoothError("Demande client introuvable.", "template_not_found", 404);
    }

    return NextResponse.json({ request });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: unknown; canvaReviewStatus?: unknown; adminNote?: string };

    let status: CustomizationStatus | undefined;
    let canvaReviewStatus: CanvaReviewStatus | undefined;

    if (body.status !== undefined) {
      if (!isCustomizationStatus(body.status)) {
        throw new TemplateBoothError("Statut de demande non reconnu.", "invalid_request", 400);
      }

      status = body.status;
    }

    if (body.canvaReviewStatus !== undefined) {
      if (!isCanvaReviewStatus(body.canvaReviewStatus)) {
        throw new TemplateBoothError("Statut Canva non reconnu.", "invalid_request", 400);
      }

      canvaReviewStatus = body.canvaReviewStatus;
    }

    const updated = await updateCustomizationRequest(id, {
      status,
      canvaReviewStatus,
      adminNote: body.adminNote
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteEventPicTemplateRequest(id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression impossible.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
