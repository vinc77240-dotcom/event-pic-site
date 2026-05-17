import { NextResponse } from "next/server";
import { exportEmailCampaignResultsCsv } from "@/src/server/emailCampaignService";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const campaignId = cleanText(id);

    if (!campaignId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Campagne introuvable."
        },
        { status: 400 }
      );
    }

    const csv = await exportEmailCampaignResultsCsv(campaignId);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="eventpic-campaign-${campaignId}.csv"`
      }
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/emails/campaigns/[id]/export", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Export campagne impossible."
      },
      { status: 400 }
    );
  }
}
