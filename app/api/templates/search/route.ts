import { NextResponse } from "next/server";
import { searchEventPicTemplates } from "@/src/server/eventPicTemplateService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "60", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : 60;

  try {
    const result = await searchEventPicTemplates({
      query: q,
      limit,
      includeAdminFields: false
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Event Pic] /api/templates/search", error);
    return NextResponse.json(
      {
        error: "Recherche template impossible."
      },
      { status: 500 }
    );
  }
}
