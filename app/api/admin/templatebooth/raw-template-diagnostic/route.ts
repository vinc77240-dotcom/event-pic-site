import { NextResponse } from "next/server";
import { getRawTemplateDiagnostic } from "@/src/server/templateboothCanvaService";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const diagnostic = await getRawTemplateDiagnostic({
      templateId: url.searchParams.get("templateId") ?? undefined,
      name: url.searchParams.get("name") ?? undefined,
      postUrl: url.searchParams.get("postUrl") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      forceRefresh: url.searchParams.get("refresh") === "1"
    });

    return NextResponse.json(diagnostic);
  } catch (error) {
    console.error("[TemplateBooth] GET /api/admin/templatebooth/raw-template-diagnostic", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diagnostic brut TemplateBooth impossible."
      },
      { status: 500 }
    );
  }
}
