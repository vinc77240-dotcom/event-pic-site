import { NextResponse } from "next/server";
import { importCanvaLinksFromHarvester } from "@/src/server/canvaHarvesterImportService";

type CanvaImportPayload = {
  source?: string;
  items?: unknown[];
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CanvaImportPayload;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Aucun item a importer."
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const result = await importCanvaLinksFromHarvester({
      source: body.source,
      items
    });

    return NextResponse.json(result, {
      headers: corsHeaders()
    });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-source-links/canva-import", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Import Canva impossible."
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
