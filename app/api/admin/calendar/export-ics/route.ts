import { NextResponse } from "next/server";
import { exportCalendarEventsToIcs } from "@/src/server/calendarService";

export async function GET() {
  try {
    const ics = await exportCalendarEventsToIcs();
    const filename = `event-pic-planning-${new Date().toISOString().slice(0, 10)}.ics`;
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Export ICS impossible."
      },
      { status: 500 }
    );
  }
}
