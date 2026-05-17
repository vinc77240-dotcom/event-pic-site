import { NextResponse } from "next/server";
import { listTemplateCategoryOverrides } from "@/src/server/templateCategoryOverrides";

export async function GET() {
  try {
    const overrides = await listTemplateCategoryOverrides();
    const items = overrides
      .filter((entry) => entry.status !== "ignored" && entry.post_url && entry.post_url.trim().length > 0)
      .map((entry) => ({
        family_key: entry.family_key,
        template_name: entry.family_name,
        post_url: entry.post_url,
        status: entry.status,
        formats: (entry.formats_in_family ?? []).map((format) => ({
          template_id: format.template_id,
          template_name: format.template_name,
          format_label: format.format_label,
          layout: format.layout,
          no_of_images: format.no_of_images,
          preview_url: format.preview_url
        }))
      }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/templates/export-templatebooth-urls", error);
    return NextResponse.json(
      {
        error: "Export des URLs TemplateBooth impossible."
      },
      { status: 500 }
    );
  }
}
