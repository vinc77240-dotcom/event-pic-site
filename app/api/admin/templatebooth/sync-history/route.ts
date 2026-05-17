import { NextResponse } from "next/server";
import { listTemplateBoothSyncHistory } from "@/src/server/templateboothSyncService";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitValue = url.searchParams.get("limit");
    const parsed = Number.parseInt(limitValue ?? "20", 10);
    const limit = Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : 20;
    const items = await listTemplateBoothSyncHistory(limit);

    return NextResponse.json({
      ok: true,
      items
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/templatebooth/sync-history", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement de l'historique de synchronisation impossible."
      },
      { status: 500 }
    );
  }
}
