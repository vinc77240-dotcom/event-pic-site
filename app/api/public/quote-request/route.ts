import { NextResponse } from "next/server";
import { createQuoteRequest } from "@/src/server/publicLeadService";

type QuoteRequestPayload = {
  name?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  event_date?: string;
  event_address?: string;
  delivery_time?: string;
  return_date?: string;
  return_time?: string;
  booth_quantity?: number;
  package_id?: string;
  package?: string;
  option_ids?: string[];
  options?: string[];
  estimated_total_without_delivery?: number;
  estimated_total_with_delivery?: number;
  estimated_total?: number;
  estimated_balance?: number;
  custom_quote?: boolean;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuoteRequestPayload;
    const created = await createQuoteRequest({
      name: body.name,
      email: body.email,
      phone: body.phone,
      event_type: body.event_type,
      event_date: body.event_date,
      event_address: body.event_address,
      delivery_time: body.delivery_time,
      return_date: body.return_date,
      return_time: body.return_time,
      booth_quantity: body.booth_quantity,
      package_id: body.package_id,
      package: body.package,
      option_ids: body.option_ids,
      options: body.options,
      estimated_total_without_delivery: body.estimated_total_without_delivery,
      estimated_total_with_delivery: body.estimated_total_with_delivery,
      estimated_total: body.estimated_total,
      estimated_balance: body.estimated_balance,
      custom_quote: body.custom_quote,
      message: body.message
    });

    return NextResponse.json({
      ok: true,
      request_id: created.id,
      estimate: {
        distance_status: created.distance_status,
        delivery_fee:
          created.distance_status === "calculated" ? created.delivery_fee : null,
        estimated_total: created.estimated_total_with_delivery,
        deposit: created.deposit,
        estimated_balance: created.estimated_balance
      },
      message: "Merci, votre demande de devis a bien ete envoyee."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Envoi de la demande impossible."
      },
      { status: 400 }
    );
  }
}
