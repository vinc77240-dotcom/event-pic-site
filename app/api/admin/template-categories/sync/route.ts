import { NextResponse } from "next/server";
import { runTemplateBoothSync } from "@/src/server/templateboothSyncService";
import { listTemplateCategoryOverrides } from "@/src/server/templateCategoryOverrides";

export async function POST() {
  try {
    const result = await runTemplateBoothSync("manual");
    const overrides = await listTemplateCategoryOverrides();
    const coveredFormatsCount = overrides.reduce((sum, entry) => sum + (entry.formats_in_family?.length ?? 0), 0);

    return NextResponse.json(
      {
        ok: result.ok,
        started_at: result.started_at,
        completed_at: result.completed_at,
        trigger: result.trigger,
        syncedCount: result.total_templates,
        newTemplatesCount: result.new_templates,
        familyCount: result.total_families,
        toReviewCount: result.to_review,
        validatedCount: result.validated,
        ignoredCount: result.ignored,
        coveredFormatsCount,
        newFamiliesCount: result.new_families,
        lastSync: result.completed_at,
        error: result.ok ? undefined : result.error_message
      },
      result.ok ? undefined : { status: 500 }
    );
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-categories/sync", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Synchronisation TemplateBooth impossible."
      },
      { status: 500 }
    );
  }
}
