import { NextResponse } from "next/server";
import { updateEventPicTemplateRequestStatus } from "@/src/server/eventPicTemplateRequests";
import { isEventPicTemplateRequestStatus } from "@/src/shared/eventPicTemplates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: unknown };

    if (!isEventPicTemplateRequestStatus(body.status)) {
      return NextResponse.json({ error: "Statut de demande non reconnu." }, { status: 400 });
    }

    const updated = await updateEventPicTemplateRequestStatus(id, body.status);
    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("[Event Pic] PATCH /api/template-requests/[id]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise a jour impossible." }, { status: 400 });
  }
}
