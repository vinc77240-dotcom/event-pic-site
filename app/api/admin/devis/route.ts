import { NextResponse } from "next/server";
import {
  listContactRequests,
  listQuoteRequests,
  recalculateQuoteRequestDelivery,
  updateQuoteRequestOptionSelection,
  updateQuoteRequestBoothQuantity,
  updateContactRequestStatus,
  updateQuoteRequestDeliveryData,
  updateQuoteRequestManualDistance,
  updateQuoteRequestRecommendedDriver,
  updateQuoteRequestStatus
} from "@/src/server/publicLeadService";
import { EventPicQuoteStatus } from "@/src/shared/eventPicPublic";
import { listDeliveryDrivers } from "@/src/server/deliveryDistanceService";
import { createEventDossierFromQuoteId } from "@/src/server/eventDossierService";

type AdminDevisPatchPayload = {
  action?:
    | "update_status"
    | "recalculate_distance"
    | "set_driver"
    | "set_manual_distance"
    | "set_delivery_fee"
    | "set_booth_quantity"
    | "set_option_selection";
  source?: "quote" | "contact";
  id?: string;
  status?: EventPicQuoteStatus;
  driver_id?: string;
  distance_km?: number;
  delivery_fee?: number;
  booth_quantity?: number;
  force_when_unavailable?: boolean;
  option_id?: string;
  enabled?: boolean;
};

export async function GET() {
  try {
    const [quoteRequests, contactRequests] = await Promise.all([
      listQuoteRequests(),
      listContactRequests()
    ]);
    const drivers = await listDeliveryDrivers();

    return NextResponse.json({
      ok: true,
      quote_requests: quoteRequests,
      contact_requests: contactRequests,
      drivers
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Chargement des devis impossible."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as AdminDevisPatchPayload;
    const action = body.action ?? "update_status";
    const source = body.source;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!source || !id) {
      return NextResponse.json(
        {
          ok: false,
          error: "source et id sont obligatoires."
        },
        { status: 400 }
      );
    }

    if (action === "update_status") {
      const status = body.status;
      if (!status) {
        return NextResponse.json(
          { ok: false, error: "status est obligatoire." },
          { status: 400 }
        );
      }

      if (source === "quote") {
        const updated = await updateQuoteRequestStatus(id, status);
        if (status === "gagne" || status === "devis_envoye") {
          await createEventDossierFromQuoteId(id).catch(() => {
            // do not block status update if dossier sync fails
          });
        }
        return NextResponse.json({ ok: true, updated, source });
      }

      if (source === "contact") {
        const updated = await updateContactRequestStatus(id, status);
        return NextResponse.json({ ok: true, updated, source });
      }

      return NextResponse.json(
        { ok: false, error: "Source de demande invalide." },
        { status: 400 }
      );
    }

    if (source !== "quote") {
      return NextResponse.json(
        { ok: false, error: "Cette action est disponible uniquement pour les devis." },
        { status: 400 }
      );
    }

    if (action === "recalculate_distance") {
      const updated = await recalculateQuoteRequestDelivery(id);
      return NextResponse.json({ ok: true, updated, source: "quote" });
    }

    if (action === "set_driver") {
      const driverId = typeof body.driver_id === "string" ? body.driver_id.trim() : "";
      if (!driverId) {
        return NextResponse.json(
          { ok: false, error: "driver_id obligatoire." },
          { status: 400 }
        );
      }
      const updated = await updateQuoteRequestRecommendedDriver(id, driverId, {
        force_when_unavailable: body.force_when_unavailable === true
      });
      return NextResponse.json({ ok: true, updated, source: "quote" });
    }

    if (action === "set_manual_distance") {
      const distanceKm =
        typeof body.distance_km === "number" ? body.distance_km : Number.NaN;
      if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        return NextResponse.json(
          { ok: false, error: "distance_km invalide." },
          { status: 400 }
        );
      }
      const updated = await updateQuoteRequestManualDistance(id, distanceKm);
      return NextResponse.json({ ok: true, updated, source: "quote" });
    }

    if (action === "set_booth_quantity") {
      const boothQuantity =
        typeof body.booth_quantity === "number" ? body.booth_quantity : Number.NaN;
      if (!Number.isFinite(boothQuantity) || boothQuantity <= 0) {
        return NextResponse.json(
          { ok: false, error: "booth_quantity invalide." },
          { status: 400 }
        );
      }
      const updated = await updateQuoteRequestBoothQuantity(id, boothQuantity);
      return NextResponse.json({ ok: true, updated, source: "quote" });
    }

    if (action === "set_option_selection") {
      const optionId = typeof body.option_id === "string" ? body.option_id.trim() : "";
      if (!optionId) {
        return NextResponse.json(
          { ok: false, error: "option_id obligatoire." },
          { status: 400 }
        );
      }

      const enabled = body.enabled === true;
      const { updated, option } = await updateQuoteRequestOptionSelection(id, optionId, enabled);
      return NextResponse.json({
        ok: true,
        updated,
        source: "quote",
        option,
        enabled
      });
    }

    if (action === "set_delivery_fee") {
      if (typeof body.delivery_fee !== "number" || !Number.isFinite(body.delivery_fee) || body.delivery_fee < 0) {
        return NextResponse.json(
          { ok: false, error: "delivery_fee invalide." },
          { status: 400 }
        );
      }

      const quotes = await listQuoteRequests();
      const current = quotes.find((item) => item.id === id);
      if (!current) {
        return NextResponse.json(
          { ok: false, error: "Demande devis introuvable." },
          { status: 404 }
        );
      }
      const updated = await updateQuoteRequestDeliveryData(id, {
        delivery_fee: body.delivery_fee,
        distance_status: "calculated",
        estimated_total_without_delivery: current.estimated_total_without_delivery,
        estimated_total_with_delivery: current.estimated_total_without_delivery + body.delivery_fee
      });
      return NextResponse.json({ ok: true, updated, source: "quote" });
    }

    return NextResponse.json(
      { ok: false, error: "Action devis non reconnue." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Mise a jour du statut impossible."
      },
      { status: 400 }
    );
  }
}
