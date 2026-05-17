import { NextResponse } from "next/server";
import { getTemplateFilterDiagnostic } from "@/src/server/eventPicTemplateService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "2x6";
  const category = url.searchParams.get("category") ?? "all";

  try {
    const diagnostic = await getTemplateFilterDiagnostic({ format, category });
    return NextResponse.json(diagnostic);
  } catch (error) {
    console.error("[TemplateBooth] GET /api/admin/templatebooth/filter-diagnostic", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diagnostic filtre impossible."
      },
      { status: 500 }
    );
  }
}
