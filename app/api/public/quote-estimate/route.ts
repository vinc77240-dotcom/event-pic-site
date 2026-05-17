import { NextResponse } from "next/server";
import {
  estimateNearestDriverForEvent,
  publicDeliveryEstimateView
} from "@/src/server/deliveryDistanceService";

type QuoteEstimatePayload = {
  event_address?: string;
  event_date?: string;
  delivery_time?: string;
  return_date?: string;
  return_time?: string;
  booth_quantity?: number;
  estimated_total_without_delivery?: number;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }
  return 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuoteEstimatePayload;
    const eventAddress = cleanText(body.event_address);
    const baseTotal = normalizeMoney(body.estimated_total_without_delivery);

    const adminEstimate = await estimateNearestDriverForEvent(eventAddress, {
      event_date: cleanText(body.event_date),
      event_start_time: cleanText(body.delivery_time),
      delivery_time: cleanText(body.delivery_time),
      return_date: cleanText(body.return_date),
      return_time: cleanText(body.return_time),
      booth_quantity:
        typeof body.booth_quantity === "number" && Number.isFinite(body.booth_quantity)
          ? body.booth_quantity
          : 1
    });
    const deliveryView = publicDeliveryEstimateView(adminEstimate);
    const totalWithDelivery =
      deliveryView.delivery_fee === null ? baseTotal : baseTotal + deliveryView.delivery_fee;

    return NextResponse.json({
      ok: true,
      distance_status: deliveryView.distance_status,
      delivery_fee: deliveryView.delivery_fee,
      estimated_total_without_delivery: baseTotal,
      estimated_total_with_delivery: totalWithDelivery,
      deposit: 100,
      estimated_balance: Math.max(totalWithDelivery - 100, 0),
      message: deliveryView.message
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Estimation des frais de deplacement impossible."
      },
      { status: 400 }
    );
  }
}
