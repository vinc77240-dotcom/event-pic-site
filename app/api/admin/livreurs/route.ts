import { NextResponse } from "next/server";
import { listDeliveryAssignments } from "@/src/server/deliveryService";
import {
  createDriverUnavailability,
  deleteDriverUnavailability,
  listDeliveryDrivers,
  listDriverUnavailabilities,
  updateDriverUnavailability,
  upsertDeliveryDrivers
} from "@/src/server/driverAvailabilityService";
import { DeliveryDriver, DriverUnavailability } from "@/src/shared/eventPicPublic";

type LivreursPayload = {
  action?: "save_drivers" | "add_unavailability" | "update_unavailability" | "delete_unavailability";
  drivers?: DeliveryDriver[];
  unavailability?: Partial<DriverUnavailability>;
  unavailability_id?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const [drivers, unavailabilities, assignments] = await Promise.all([
      listDeliveryDrivers(),
      listDriverUnavailabilities(),
      listDeliveryAssignments()
    ]);

    const assignmentsByDriver = drivers.reduce<
      Record<
        string,
        Array<{
          assignment_id: string;
          client_name: string;
          event_date: string;
          status: string;
          booth_quantity: number;
        }>
      >
    >((acc, driver) => {
      const items = assignments
        .filter((assignment) => assignment.assigned_driver_id === driver.id)
        .map((assignment) => ({
          assignment_id: assignment.id,
          client_name: assignment.client_name,
          event_date: assignment.event_date,
          status: assignment.status,
          booth_quantity: assignment.booth_quantity || 1
        }));
      acc[driver.id] = items;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      drivers,
      unavailabilities,
      assignments_by_driver: assignmentsByDriver
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Chargement des livreurs impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LivreursPayload;
    const action = cleanText(body.action);

    if (action === "save_drivers") {
      if (!Array.isArray(body.drivers)) {
        return NextResponse.json(
          { ok: false, error: "Liste de livreurs invalide." },
          { status: 400 }
        );
      }
      const drivers = await upsertDeliveryDrivers(body.drivers);
      return NextResponse.json({ ok: true, drivers });
    }

    if (action === "add_unavailability") {
      const entry = await createDriverUnavailability(body.unavailability ?? {});
      return NextResponse.json({ ok: true, unavailability: entry });
    }

    if (action === "update_unavailability") {
      const id = cleanText(body.unavailability_id || body.unavailability?.id);
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "unavailability_id manquant." },
          { status: 400 }
        );
      }
      const entry = await updateDriverUnavailability(id, body.unavailability ?? {});
      return NextResponse.json({ ok: true, unavailability: entry });
    }

    if (action === "delete_unavailability") {
      const id = cleanText(body.unavailability_id);
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "unavailability_id manquant." },
          { status: 400 }
        );
      }
      await deleteDriverUnavailability(id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Action livreurs non reconnue." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Operation livreurs impossible."
      },
      { status: 400 }
    );
  }
}
