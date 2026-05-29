import { NextResponse } from "next/server";
import { EVENT_PIC_CATEGORIES, getEventPicCategory } from "@/src/shared/eventPicTemplates";
import {
  TemplateCategoryId,
  TemplateCategoryOverrideEntry,
  listTemplateCategoryOverrides
} from "@/src/server/templateCategoryOverrides";
import { getTemplateBoothCacheStatus } from "@/src/server/eventPicTemplateService";
import { getLatestTemplateBoothSyncHistory } from "@/src/server/templateboothSyncService";

type FamilyStatus = "to_review" | "validated" | "ignored";

const MANAGEABLE_CATEGORY_IDS = EVENT_PIC_CATEGORIES.map((category) => category.id).filter(
  (categoryId) => categoryId !== "all"
) as TemplateCategoryId[];

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCategoryId(value: unknown): TemplateCategoryId | undefined {
  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  const mapped = getEventPicCategory(normalized).id;

  if (mapped === "all") {
    return undefined;
  }

  if (!MANAGEABLE_CATEGORY_IDS.includes(mapped as TemplateCategoryId)) {
    return undefined;
  }

  return mapped as TemplateCategoryId;
}

function computeCounts(entries: TemplateCategoryOverrideEntry[]) {
  const toReview = entries.filter((entry) => entry.status === "to_review").length;
  const validated = entries.filter((entry) => entry.status === "validated").length;
  const ignored = entries.filter((entry) => entry.status === "ignored").length;
  const all = entries.length;

  return {
    to_review: toReview,
    validated,
    ignored,
    all
  };
}

function getNextScheduledSyncLabel() {
  return process.env.CRON_SECRET?.trim()
    ? "03:00 (heure France)"
    : "Synchronisation automatique non configurée";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = normalizeText(url.searchParams.get("status"));
    const statusFilter: FamilyStatus | "all" =
      status === "to_review" || status === "validated" || status === "ignored" || status === "all"
        ? (status as FamilyStatus | "all")
        : "to_review";
    const search = normalizeText(url.searchParams.get("search") ?? url.searchParams.get("q"));
    const category = normalizeCategoryId(url.searchParams.get("category"));
    const page = Math.max(1, numberParam(url.searchParams.get("page"), 1));
    const perPage = Math.min(200, Math.max(1, numberParam(url.searchParams.get("per_page"), 50)));

    const [entries, syncStatus, latestSync] = await Promise.all([
      listTemplateCategoryOverrides(),
      getTemplateBoothCacheStatus(),
      getLatestTemplateBoothSyncHistory()
    ]);
    const counts = computeCounts(entries);
    let filteredEntries = entries;

    if (statusFilter !== "all") {
      filteredEntries = filteredEntries.filter((entry) => entry.status === statusFilter);
    }

    if (category) {
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.validated_categories.includes(category) ||
          entry.suggested_categories.includes(category) ||
          entry.detected_categories.includes(category)
      );
    }

    if (search) {
      const normalizedQuery = normalizeSearchText(search);
      filteredEntries = filteredEntries.filter((entry) => {
        const haystack = normalizeSearchText(
          [
            entry.family_name,
            entry.post_url,
            entry.reason,
            ...entry.detected_categories,
            ...entry.suggested_categories,
            ...entry.validated_categories,
            ...entry.formats_in_family.map((format) => format.template_name),
            ...entry.formats_in_family.map((format) => format.format_label),
            ...entry.formats_in_family.map((format) => format.layout),
            ...entry.formats_in_family.map((format) => format.no_of_images)
          ].join(" ")
        );

        return haystack.includes(normalizedQuery);
      });
    }

    const total = filteredEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * perPage;
    const items = filteredEntries.slice(start, start + perPage);

    return NextResponse.json({
      ok: true,
      items,
      page: safePage,
      per_page: perPage,
      total,
      total_pages: totalPages,
      counts,
      filters: {
        status: statusFilter,
        category: category ?? null,
        search
      },
      syncStatus,
      latestSync: latestSync
        ? {
            started_at: latestSync.started_at,
            completed_at: latestSync.completed_at,
            status: latestSync.status,
            trigger: latestSync.trigger,
            new_families: latestSync.new_families,
            new_templates: latestSync.new_templates,
            total_templates: latestSync.total_templates,
            total_families: latestSync.total_families,
            to_review: latestSync.to_review,
            validated: latestSync.validated,
            ignored: latestSync.ignored,
            error_message: latestSync.error_message
          }
        : null,
      nextScheduledSyncLabel: getNextScheduledSyncLabel(),
      categories: MANAGEABLE_CATEGORY_IDS.map((id) => ({
        id,
        label: EVENT_PIC_CATEGORIES.find((categoryItem) => categoryItem.id === id)?.label ?? id
      }))
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/templates", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement du classement templates impossible."
      },
      { status: 500 }
    );
  }
}
