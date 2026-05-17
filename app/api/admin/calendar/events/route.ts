import { NextResponse } from "next/server";
import { createCalendarEvent, listCalendarEvents } from "@/src/server/calendarService";
import { EventPicCalendarEvent } from "@/src/shared/eventPicCalendar";
import { listDeliveryDrivers } from "@/src/server/deliveryDistanceService";
import { listEventDossiers } from "@/src/server/eventDossierService";

type CalendarEventsPostPayload = Partial<EventPicCalendarEvent> & {
  reminder_checks?: Record<string, boolean>;
};

export async function GET() {
  try {
    const [events, drivers, dossiers] = await Promise.all([
      listCalendarEvents({ include_conflicts: true }),
      listDeliveryDrivers(),
      listEventDossiers({ sync: true })
    ]);
    const dossierMap = dossiers.reduce<
      Record<string, { dossier_id: string; global_status: string; client_name: string }>
    >((acc, dossier) => {
      if (dossier.quote.quote_id) {
        acc[`quote:${dossier.quote.quote_id}`] = {
          dossier_id: dossier.id,
          global_status: dossier.global_status,
          client_name: dossier.client.full_name
        };
      }
      if (dossier.template.template_request_id) {
        acc[`template_request:${dossier.template.template_request_id}`] = {
          dossier_id: dossier.id,
          global_status: dossier.global_status,
          client_name: dossier.client.full_name
        };
      }
      if (dossier.delivery.delivery_assignment_id) {
        acc[`delivery:${dossier.delivery.delivery_assignment_id}`] = {
          dossier_id: dossier.id,
          global_status: dossier.global_status,
          client_name: dossier.client.full_name
        };
      }
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      events,
      drivers,
      dossier_map: dossierMap
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Chargement du planning impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CalendarEventsPostPayload;
    const created = await createCalendarEvent(body);
    return NextResponse.json({
      ok: true,
      event: created
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Creation de l'evenement planning impossible."
      },
      { status: 400 }
    );
  }
}
