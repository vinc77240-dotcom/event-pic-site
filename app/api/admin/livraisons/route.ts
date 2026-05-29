import { NextResponse } from "next/server";
import {
  createDeliveryAssignmentFromSource,
  createManualDeliveryAssignment,
  isDeliveryStatus,
  listDeliveryAssignments,
  listDeliverySourceEvents,
  listDrivers,
  updateDeliveryAssignment,
  upsertDrivers
} from "@/src/server/deliveryService";
import { DeliveryAssignmentSource, DeliveryDriver } from "@/src/shared/eventPicPublic";

type DeliveryActionPayload = {
  action?:
    | "create_from_source"
    | "create_manual"
    | "assign_driver"
    | "update_status"
    | "update_assignment"
    | "save_drivers";
  source?: DeliveryAssignmentSource;
  event_id?: string;
  assignment_id?: string;
  driver_id?: string;
  driver_name?: string;
  status?: string;
  updates?: Record<string, unknown>;
  assignment?: Record<string, unknown>;
  drivers?: DeliveryDriver[];
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const [assignments, drivers, sourceEvents] = await Promise.all([
      listDeliveryAssignments(),
      listDrivers(),
      listDeliverySourceEvents()
    ]);

    return NextResponse.json({
      ok: true,
      assignments,
      drivers,
      source_events: sourceEvents
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Chargement des livraisons impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeliveryActionPayload;
    const action = cleanText(body.action);

    if (action === "create_from_source") {
      const source = body.source;
      const eventId = cleanText(body.event_id);
      if (!source || !eventId) {
        return NextResponse.json(
          { ok: false, error: "source et event_id sont obligatoires." },
          { status: 400 }
        );
      }

      const assignment = await createDeliveryAssignmentFromSource({
        source,
        event_id: eventId
      });
      return NextResponse.json({ ok: true, assignment });
    }

    if (action === "create_manual") {
      const assignment = await createManualDeliveryAssignment(body.assignment ?? {});
      return NextResponse.json({ ok: true, assignment });
    }

    if (action === "assign_driver") {
      const assignmentId = cleanText(body.assignment_id);
      if (!assignmentId) {
        return NextResponse.json(
          { ok: false, error: "assignment_id obligatoire." },
          { status: 400 }
        );
      }
      const driverId = cleanText(body.driver_id);
      const driverName = cleanText(body.driver_name);
      if (driverId) {
        const drivers = await listDrivers();
        const driver = drivers.find((item) => item.id === driverId);
        if (!driver || !driver.active) {
          return NextResponse.json(
            { ok: false, error: "Livreur inactif ou introuvable pour une nouvelle affectation." },
            { status: 400 }
          );
        }
      }
      const maybeStatus = cleanText(body.status);
      const assignment = await updateDeliveryAssignment(assignmentId, {
        assigned_driver_id: driverId,
        assigned_driver_name: driverName,
        status: isDeliveryStatus(maybeStatus) ? maybeStatus : "affecte"
      });
      return NextResponse.json({ ok: true, assignment });
    }

    if (action === "update_status") {
      const assignmentId = cleanText(body.assignment_id);
      const status = cleanText(body.status);
      if (!assignmentId || !status) {
        return NextResponse.json(
          { ok: false, error: "assignment_id et status obligatoires." },
          { status: 400 }
        );
      }
      if (!isDeliveryStatus(status)) {
        return NextResponse.json(
          { ok: false, error: "Statut livraison invalide." },
          { status: 400 }
        );
      }
      const assignment = await updateDeliveryAssignment(assignmentId, { status });
      return NextResponse.json({ ok: true, assignment });
    }

    if (action === "update_assignment") {
      const assignmentId = cleanText(body.assignment_id);
      if (!assignmentId) {
        return NextResponse.json(
          { ok: false, error: "assignment_id obligatoire." },
          { status: 400 }
        );
      }
      const nextDriverId = cleanText(body.updates?.assigned_driver_id);
      if (nextDriverId) {
        const drivers = await listDrivers();
        const driver = drivers.find((item) => item.id === nextDriverId);
        if (!driver || !driver.active) {
          return NextResponse.json(
            { ok: false, error: "Livreur inactif ou introuvable pour une nouvelle affectation." },
            { status: 400 }
          );
        }
      }
      const assignment = await updateDeliveryAssignment(assignmentId, body.updates ?? {});
      return NextResponse.json({ ok: true, assignment });
    }

    if (action === "save_drivers") {
      if (!Array.isArray(body.drivers)) {
        return NextResponse.json(
          { ok: false, error: "Liste drivers invalide." },
          { status: 400 }
        );
      }
      const drivers = await upsertDrivers(body.drivers);
      return NextResponse.json({ ok: true, drivers });
    }

    return NextResponse.json(
      { ok: false, error: "Action livraison non reconnue." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Operation livraison impossible."
      },
      { status: 400 }
    );
  }
}
