import { NextResponse } from "next/server";
import { updateCalendarEventStatus } from "@/src/server/calendarService";
import { EventPicCalendarStatus, isCalendarStatus } from "@/src/shared/eventPicCalendar";

type StatusPayload = {
  status?: EventPicCalendarStatus;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as StatusPayload;
    if (!isCalendarStatus(body.status)) {
      return NextResponse.json(
        { ok: false, error: "Statut planning invalide." },
        { status: 400 }
      );
    }

    const updated = await updateCalendarEventStatus(id, body.status);
    return NextResponse.json({
      ok: true,
      event: updated
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mise a jour statut planning impossible."
      },
      { status: 400 }
    );
  }
}
