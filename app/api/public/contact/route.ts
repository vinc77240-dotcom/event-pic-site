import { NextResponse } from "next/server";
import { createContactRequest } from "@/src/server/publicLeadService";

type ContactRequestPayload = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  event_date?: string;
  event_address?: string;
  message?: string;
  guest_count?: number;
  estimated_prints_need?: number;
  selected_formula?: string;
  recommended_formula?: string;
  recommended_formula_prints?: number | null;
  formula_insufficient?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactRequestPayload;
    const created = await createContactRequest({
      name: body.name,
      company: body.company,
      email: body.email,
      phone: body.phone,
      event_type: body.event_type,
      event_date: body.event_date,
      event_address: body.event_address,
      message: body.message,
      guest_count: body.guest_count,
      estimated_prints_need: body.estimated_prints_need,
      selected_formula: body.selected_formula,
      recommended_formula: body.recommended_formula,
      recommended_formula_prints: body.recommended_formula_prints,
      formula_insufficient: body.formula_insufficient
    });

    return NextResponse.json({
      ok: true,
      request: { id: created.id },
      request_id: created.id,
      contact_request_id: created.id,
      message:
        "Merci, votre demande a bien ete envoyee. Event Pic vous recontactera rapidement."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi de la demande impossible.";
    const status = message.includes("BLOB_READ_WRITE_TOKEN") ? 500 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status }
    );
  }
}
