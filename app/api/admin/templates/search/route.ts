import { NextResponse } from "next/server";
import { searchEventPicTemplates } from "@/src/server/eventPicTemplateService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 100;

  try {
    const result = await searchEventPicTemplates({
      query: q,
      limit,
      includeAdminFields: true
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Event Pic] /api/admin/templates/search", error);
    return NextResponse.json(
      {
        error: "Recherche admin template impossible."
      },
      { status: 500 }
    );
  }
}
