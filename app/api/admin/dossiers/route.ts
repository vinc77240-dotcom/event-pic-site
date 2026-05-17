import { NextResponse } from "next/server";
import {
  buildDossierDashboardStats,
  createEventDossierFromQuoteId,
  createManualEventDossier,
  getPipelineColumnForStatus,
  listEventDossiers
} from "@/src/server/eventDossierService";
import { EventDossier } from "@/src/shared/eventPicDossiers";

type DossiersPostPayload = {
  action?: "create_manual" | "create_from_quote" | "sync";
  quote_id?: string;
  dossier?: Partial<EventDossier>;
};

export async function GET() {
  try {
    const dossiers = await listEventDossiers({ sync: true });
    const stats = await buildDossierDashboardStats();
    const countsByColumn = dossiers.reduce<Record<string, number>>((acc, dossier) => {
      const key = getPipelineColumnForStatus(dossier.global_status);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      dossiers,
      stats,
      counts_by_column: countsByColumn
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Chargement des dossiers impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DossiersPostPayload;
    const action = body.action || "create_manual";

    if (action === "sync") {
      const dossiers = await listEventDossiers({ sync: true });
      return NextResponse.json({ ok: true, dossiers });
    }

    if (action === "create_from_quote") {
      const quoteId = typeof body.quote_id === "string" ? body.quote_id.trim() : "";
      if (!quoteId) {
        return NextResponse.json(
          { ok: false, error: "quote_id obligatoire." },
          { status: 400 }
        );
      }
      const dossier = await createEventDossierFromQuoteId(quoteId);
      return NextResponse.json({ ok: true, dossier });
    }

    const dossier = await createManualEventDossier(body.dossier ?? {});
    return NextResponse.json({ ok: true, dossier });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Creation dossier impossible."
      },
      { status: 400 }
    );
  }
}
