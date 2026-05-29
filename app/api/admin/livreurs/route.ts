import { NextResponse } from "next/server";
import { listDeliveryAssignments } from "@/src/server/deliveryService";
import {
  createDriverUnavailability,
  deleteDriverUnavailability,
  deleteOrDeactivateDeliveryDriver,
  listDeliveryDrivers,
  listDriverUnavailabilities,
  updateDriverUnavailability,
  upsertDeliveryDrivers
} from "@/src/server/driverAvailabilityService";
import { listEventDossiers } from "@/src/server/eventDossierService";
import { DeliveryDriver, DriverUnavailability } from "@/src/shared/eventPicPublic";

type LivreursPayload = {
  action?:
    | "save_drivers"
    | "add_unavailability"
    | "update_unavailability"
    | "delete_unavailability"
    | "delete_or_deactivate_driver";
  drivers?: DeliveryDriver[];
  driver_id?: string;
  unavailability?: Partial<DriverUnavailability>;
  unavailability_id?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const [drivers, unavailabilities, assignments, dossiers] = await Promise.all([
      listDeliveryDrivers(),
      listDriverUnavailabilities(),
      listDeliveryAssignments(),
      listEventDossiers({ sync: false })
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

    const dependenciesByDriver = drivers.reduce<
      Record<
        string,
        {
          assignment_count: number;
          unavailability_count: number;
          event_count: number;
          has_dependencies: boolean;
        }
      >
    >((acc, driver) => {
      const assignmentCount = assignmentsByDriver[driver.id]?.length ?? 0;
      const unavailabilityCount = unavailabilities.filter((entry) => entry.driver_id === driver.id).length;
      const eventCount = dossiers.filter(
        (dossier) =>
          dossier.delivery.assigned_driver_id === driver.id ||
          dossier.delivery.recommended_driver_id === driver.id
      ).length;
      acc[driver.id] = {
        assignment_count: assignmentCount,
        unavailability_count: unavailabilityCount,
        event_count: eventCount,
        has_dependencies: assignmentCount + unavailabilityCount + eventCount > 0
      };
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      drivers,
      unavailabilities,
      assignments_by_driver: assignmentsByDriver,
      dependencies_by_driver: dependenciesByDriver
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

    if (action === "delete_or_deactivate_driver") {
      const driverId = cleanText(body.driver_id);
      if (!driverId) {
        return NextResponse.json(
          { ok: false, error: "driver_id manquant." },
          { status: 400 }
        );
      }

      const dossiers = await listEventDossiers({ sync: false });
      const eventCount = dossiers.filter(
        (dossier) =>
          dossier.delivery.assigned_driver_id === driverId ||
          dossier.delivery.recommended_driver_id === driverId
      ).length;
      const result = await deleteOrDeactivateDeliveryDriver(driverId, { event_count: eventCount });
      return NextResponse.json({ ok: true, ...result });
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
