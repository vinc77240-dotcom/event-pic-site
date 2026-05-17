import { NextResponse } from "next/server";
import { syncMariagePaysageOneImageCache, syncTemplateBoothCatalog } from "@/src/server/eventPicTemplateService";
import { listTemplateCategoryOverrides } from "@/src/server/templateCategoryOverrides";
import { runTemplateBoothSync } from "@/src/server/templateboothSyncService";

async function readBody(request: Request) {
  try {
    const raw = await request.text();
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const mode = typeof body.mode === "string" ? body.mode : "";
    const readCategorySummary = async () => {
      const overrides = await listTemplateCategoryOverrides();
      return {
        familyCount: overrides.length,
        toReviewCount: overrides.filter((entry) => entry.status === "to_review").length,
        validatedCount: overrides.filter((entry) => entry.status === "validated").length,
        ignoredCount: overrides.filter((entry) => entry.status === "ignored").length
      };
    };

    if (mode === "mariage-paysage-1image") {
      const targeted = await syncMariagePaysageOneImageCache();
      const categories = await readCategorySummary();

      return NextResponse.json({
        ok: true,
        mode,
        lastSync: targeted.cache.lastSync,
        count: targeted.cache.templates.length,
        addedCount: targeted.addedCount,
        previousCount: targeted.previousCount,
        newCount: targeted.newCount,
        pagesTraversed: targeted.pagesTraversed,
        totalLive: targeted.totalLive,
        firstUrl: targeted.firstUrl,
        canvaDetectedCount: targeted.canvaDetectedCount ?? 0,
        canvaSavedCount: targeted.canvaSavedCount ?? 0,
        categoryOverrideAddedCount: targeted.categoryOverrideAddedCount ?? 0,
        ...categories,
        totalByLayout: {
          "26strip": targeted.cache.totalByLayout?.["26strip"] ?? 0,
          "46postcard-p": targeted.cache.totalByLayout?.["46postcard-p"] ?? 0,
          "46postcard-l": targeted.cache.totalByLayout?.["46postcard-l"] ?? 0
        }
      });
    }

    const result = await runTemplateBoothSync("manual");
    const cache = result.ok ? await syncTemplateBoothCatalog({ force: false, full: false }) : null;
    const categories = await readCategorySummary();
    const totalByLayout = cache?.totalByLayout ?? {};
    const payload = {
      ok: result.ok,
      started_at: result.started_at,
      completed_at: result.completed_at,
      trigger: result.trigger,
      lastSync: result.completed_at,
      count: result.total_templates,
      newCount: result.new_templates,
      newFamiliesCount: result.new_families,
      cacheComplete: cache?.cacheComplete === true,
      lastFullSync: cache?.lastFullSync ?? null,
      totalKnownTemplates: cache?.totalKnownTemplates ?? result.total_templates,
      ...categories,
      totalByLayout: {
        "26strip": totalByLayout["26strip"] ?? 0,
        "46postcard-p": totalByLayout["46postcard-p"] ?? 0,
        "46postcard-l": totalByLayout["46postcard-l"] ?? 0
      },
      error: result.ok ? undefined : result.error_message
    };

    return NextResponse.json(payload, result.ok ? undefined : { status: 500 });
  } catch (error) {
    console.error("[TemplateBooth] Synchronisation admin echouee.", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Synchronisation TemplateBooth impossible."
      },
      { status: 500 }
    );
  }
}
