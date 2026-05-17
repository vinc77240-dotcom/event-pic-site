import { NextResponse } from "next/server";
import {
  deleteCalendarEvent,
  updateCalendarEvent
} from "@/src/server/calendarService";
import { EventPicCalendarEvent } from "@/src/shared/eventPicCalendar";

type CalendarEventPatchPayload = Partial<EventPicCalendarEvent> & {
  reminder_checks?: Record<string, boolean>;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as CalendarEventPatchPayload;
    const updated = await updateCalendarEvent(id, body);
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
            : "Mise a jour evenement planning impossible."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    await deleteCalendarEvent(id);
    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Suppression evenement planning impossible."
      },
      { status: 400 }
    );
  }
}
