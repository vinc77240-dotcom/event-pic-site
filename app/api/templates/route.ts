import { NextResponse } from "next/server";
import { fetchEventPicTemplates } from "@/src/server/eventPicTemplateService";

function numberParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "2x6";
  const category = url.searchParams.get("category") ?? "all";
  const page = numberParam(url.searchParams.get("page"), 1);
  const per_page = numberParam(url.searchParams.get("per_page"), 48);

  try {
    const result = await fetchEventPicTemplates({
      format,
      category,
      page,
      perPage: per_page
    });

    return NextResponse.json({
      templates: result.templates,
      page: result.page,
      per_page: result.per_page,
      total: result.total,
      total_pages: result.total_pages,
      source: result.source === "local" ? "local" : "api",
      cache: result.cache
    });
  } catch (error) {
    console.error("[Event Pic] /api/templates", error);
    return NextResponse.json({ error: "Impossible de charger les templates." }, { status: 500 });
  }
}
