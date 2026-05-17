import { NextResponse } from "next/server";
import {
  createEventPicTemplateRequest,
  listEventPicTemplateRequests
} from "@/src/server/eventPicTemplateRequests";

export async function GET() {
  try {
    const requests = await listEventPicTemplateRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("[Event Pic] GET /api/template-requests", error);
    return NextResponse.json({ error: "Impossible de charger les demandes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const templateRequest = await createEventPicTemplateRequest(body);
    return NextResponse.json({ request: { id: templateRequest.id } }, { status: 201 });
  } catch (error) {
    console.error("[Event Pic] POST /api/template-requests", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demande invalide." }, { status: 400 });
  }
}
