import { NextResponse } from "next/server";
import { EVENT_PIC_CATEGORIES, getEventPicCategory } from "@/src/shared/eventPicTemplates";
import {
  getTemplateBoothCacheStatus,
  getEventPicBusinessCategories,
  getTemplateFamily,
  matchedEventPicCategoryIds,
  listCachedTemplates
} from "@/src/server/eventPicTemplateService";
import {
  TemplateCategoryId,
  TemplateCategoryOverrideEntry,
  listTemplateCategoryOverrides,
  writeTemplateCategoryOverrides
} from "@/src/server/templateCategoryOverrides";

type FamilyStatus = "to_review" | "validated" | "ignored";
type FamilyAction =
  | "validate_suggestion"
  | "set_categories"
  | "add_category"
  | "remove_category"
  | "ignore"
  | "revalidate_family"
  | "bulk_validate_suggestions"
  | "bulk_set_category"
  | "bulk_ignore"
  | "validate_current_classification";

type FamilyActionPayload = {
  action?: FamilyAction;
  family_key?: string;
  family_keys?: string[];
  categories?: string[];
  category?: string;
};

type FamilyRow = {
  family_key: string;
  family_name: string;
  post_url: string;
  preview_url: string;
  detected_categories: TemplateCategoryId[];
  suggested_categories: TemplateCategoryId[];
  validated_categories: TemplateCategoryId[];
  status: FamilyStatus;
  reason: string;
  formats_in_family: Array<{
    template_id: string;
    template_name: string;
    layout: string;
    format_label: string;
    no_of_images: string;
    preview_url: string;
  }>;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
};

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

function normalizeNoOfImages(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.floor(value)}images`;
  }

  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  const onlyDigits = normalized.match(/^(\d+)$/);

  if (onlyDigits) {
    return `${onlyDigits[1]}images`;
  }

  const imagesPattern = normalized.match(/^(\d+)\s*images?$/i);

  if (imagesPattern) {
    return `${imagesPattern[1]}images`;
  }

  return normalized;
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

function normalizeCategories(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as TemplateCategoryId[];
  }

  const categories = new Set<TemplateCategoryId>();

  for (const value of values) {
    const normalized = normalizeCategoryId(value);

    if (normalized) {
      categories.add(normalized);
    }
  }

  return [...categories];
}

function numberParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dedupeCategories(values: string[]) {
  return [...new Set(values.map((value) => normalizeCategoryId(value)).filter((value): value is TemplateCategoryId => Boolean(value)))];
}

function mergeFormats(
  first: FamilyRow["formats_in_family"],
  second: FamilyRow["formats_in_family"]
) {
  const byTemplateId = new Map<string, FamilyRow["formats_in_family"][number]>();

  for (const format of first) {
    byTemplateId.set(format.template_id, format);
  }

  for (const format of second) {
    const current = byTemplateId.get(format.template_id);

    if (!current) {
      byTemplateId.set(format.template_id, format);
      continue;
    }

    byTemplateId.set(format.template_id, {
      template_id: format.template_id,
      template_name: format.template_name || current.template_name,
      layout: format.layout || current.layout,
      format_label: format.format_label || current.format_label,
      no_of_images: format.no_of_images || current.no_of_images,
      preview_url: format.preview_url || current.preview_url
    });
  }

  return [...byTemplateId.values()].sort((a, b) => a.template_name.localeCompare(b.template_name));
}

function statusSummary(rows: FamilyRow[]) {
  return {
    to_review: rows.filter((row) => row.status === "to_review").length,
    validated: rows.filter((row) => row.status === "validated").length,
    ignored: rows.filter((row) => row.status === "ignored").length,
    total: rows.length
  };
}

function statusSummaryFromEntries(entries: TemplateCategoryOverrideEntry[]) {
  return {
    to_review: entries.filter((entry) => entry.status === "to_review").length,
    validated: entries.filter((entry) => entry.status === "validated").length,
    ignored: entries.filter((entry) => entry.status === "ignored").length,
    total: entries.length
  };
}

function rowToOverride(row: FamilyRow): TemplateCategoryOverrideEntry {
  return {
    family_key: row.family_key,
    family_name: row.family_name,
    post_url: row.post_url,
    preview_url: row.preview_url,
    detected_categories: [...row.detected_categories],
    suggested_categories: [...row.suggested_categories],
    validated_categories: [...row.validated_categories],
    status: row.status,
    reason: row.reason,
    formats_in_family: row.formats_in_family.map((format) => ({
      template_id: format.template_id,
      template_name: format.template_name,
      layout: format.layout,
      format_label: format.format_label,
      no_of_images: format.no_of_images,
      preview_url: format.preview_url
    })),
    created_at: row.created_at,
    updated_at: row.updated_at,
    validated_at: row.validated_at
  };
}

async function buildFamilyRows() {
  const [templates, overrides] = await Promise.all([listCachedTemplates(), listTemplateCategoryOverrides()]);
  const familyMap = new Map<string, FamilyRow>();
  const overrideByFamilyKey = new Map(overrides.map((entry) => [entry.family_key, entry]));
  const nowIso = new Date().toISOString();

  for (const template of templates) {
    const familyKey = getTemplateFamily(template);
    const existingRow = familyMap.get(familyKey);
    const override = overrideByFamilyKey.get(familyKey);
    const business = getEventPicBusinessCategories(template);
    const matchedCategories = matchedEventPicCategoryIds(template);
    const detectedCategories: TemplateCategoryId[] =
      matchedCategories.length > 0
        ? dedupeCategories([...matchedCategories])
        : business.categories.length > 0
          ? dedupeCategories([...business.categories])
          : [];
    const suggestedCategories: TemplateCategoryId[] =
      detectedCategories.length > 0 ? [...detectedCategories] : (["autres"] as TemplateCategoryId[]);
    const detectedReason =
      business.reasons.length > 0
        ? business.reasons.join(" | ")
        : detectedCategories.length > 0
          ? `Classement detecte par regles Event Pic: ${detectedCategories.join(", ")}`
          : "Aucune categorie metier detectee";
    const formatEntry = {
      template_id: template.id,
      template_name: template.name,
      layout: template.layout,
      format_label: template.format_label,
      no_of_images: normalizeNoOfImages(template.no_of_images),
      preview_url: template.preview_url
    };

    if (!existingRow) {
      familyMap.set(familyKey, {
        family_key: familyKey,
        family_name: override?.family_name || template.name,
        post_url: override?.post_url || template.post_url || "",
        preview_url: override?.preview_url || template.preview_url,
        detected_categories:
          override && override.detected_categories.length > 0 ? [...override.detected_categories] : detectedCategories,
        suggested_categories:
          override && override.suggested_categories.length > 0 ? [...override.suggested_categories] : suggestedCategories,
        validated_categories: override?.validated_categories ?? [],
        status: (override?.status ?? "to_review") as FamilyStatus,
        reason: override?.reason || detectedReason,
        formats_in_family: mergeFormats(override?.formats_in_family ?? [], [formatEntry]),
        created_at: override?.created_at || nowIso,
        updated_at: override?.updated_at || nowIso,
        validated_at: override?.validated_at ?? null
      });
      continue;
    }

    existingRow.formats_in_family = mergeFormats(existingRow.formats_in_family, [formatEntry]);
    existingRow.family_name = existingRow.family_name || template.name;

    if (!existingRow.post_url && template.post_url) {
      existingRow.post_url = template.post_url;
    }

    if (!existingRow.preview_url && template.preview_url) {
      existingRow.preview_url = template.preview_url;
    }

    existingRow.detected_categories = dedupeCategories([
      ...existingRow.detected_categories,
      ...detectedCategories
    ]);

    if (existingRow.suggested_categories.length === 0) {
      existingRow.suggested_categories = suggestedCategories;
    }
  }

  const rows = [...familyMap.values()].sort((first, second) => {
    const statusWeight = (status: FamilyStatus) => {
      if (status === "to_review") {
        return 0;
      }
      if (status === "validated") {
        return 1;
      }
      return 2;
    };

    if (statusWeight(first.status) !== statusWeight(second.status)) {
      return statusWeight(first.status) - statusWeight(second.status);
    }

    return first.family_name.localeCompare(second.family_name);
  });

  return {
    rows,
    overrides
  };
}

function applyStatus(entry: TemplateCategoryOverrideEntry, nowIso: string) {
  entry.validated_categories = dedupeCategories(entry.validated_categories);

  if (entry.status === "ignored") {
    entry.validated_at = null;
    return;
  }

  if (entry.validated_categories.length > 0) {
    entry.status = "validated";
    entry.validated_at = entry.validated_at || nowIso;
    return;
  }

  entry.status = "to_review";
  entry.validated_at = null;
}

const FAST_SINGLE_FAMILY_ACTIONS = new Set<FamilyAction>([
  "validate_suggestion",
  "set_categories",
  "add_category",
  "remove_category",
  "ignore",
  "revalidate_family"
]);

function cloneEntry(entry: TemplateCategoryOverrideEntry): TemplateCategoryOverrideEntry {
  return {
    ...entry,
    detected_categories: [...entry.detected_categories],
    suggested_categories: [...entry.suggested_categories],
    validated_categories: [...entry.validated_categories],
    formats_in_family: entry.formats_in_family.map((format) => ({ ...format }))
  };
}

function mutateSingleFamilyEntry(
  entry: TemplateCategoryOverrideEntry,
  action: FamilyAction,
  normalizedCategory: TemplateCategoryId | undefined,
  normalizedCategories: TemplateCategoryId[],
  nowIso: string
) {
  if (action === "validate_suggestion") {
    entry.validated_categories =
      entry.suggested_categories.length > 0 ? [...entry.suggested_categories] : (["autres"] as TemplateCategoryId[]);
    entry.status = "validated";
  } else if (action === "set_categories") {
    entry.validated_categories = normalizedCategories;
  } else if (action === "add_category") {
    if (!normalizedCategory) {
      throw new Error("family_key et category requis.");
    }
    entry.validated_categories = dedupeCategories([...entry.validated_categories, normalizedCategory]);
  } else if (action === "remove_category") {
    if (!normalizedCategory) {
      throw new Error("family_key et category requis.");
    }
    entry.validated_categories = entry.validated_categories.filter((categoryId) => categoryId !== normalizedCategory);
  } else if (action === "ignore") {
    entry.status = "ignored";
    entry.validated_categories = [];
  } else if (action === "revalidate_family") {
    const detected: TemplateCategoryId[] =
      entry.detected_categories.length > 0 ? [...entry.detected_categories] : (["autres"] as TemplateCategoryId[]);
    entry.validated_categories = [...detected];
    entry.suggested_categories = [...detected];
    entry.status = "validated";
  }

  entry.updated_at = nowIso;
  applyStatus(entry, nowIso);
  return entry;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = normalizeText(url.searchParams.get("status"));
    const statusFilter: FamilyStatus | "all" =
      status === "to_review" || status === "validated" || status === "ignored" || status === "all"
        ? (status as FamilyStatus | "all")
        : "to_review";
    const q = normalizeText(url.searchParams.get("q"));
    const category = normalizeCategoryId(url.searchParams.get("category"));
    const page = Math.max(1, numberParam(url.searchParams.get("page"), 1));
    const perPage = Math.min(200, Math.max(1, numberParam(url.searchParams.get("per_page"), 60)));
    const { rows } = await buildFamilyRows();
    const syncStatus = await getTemplateBoothCacheStatus();

    let filteredRows = rows;

    if (statusFilter !== "all") {
      filteredRows = filteredRows.filter((row) => row.status === statusFilter);
    }

    if (category) {
      filteredRows = filteredRows.filter(
        (row) =>
          row.validated_categories.includes(category) ||
          row.suggested_categories.includes(category) ||
          row.detected_categories.includes(category)
      );
    }

    if (q) {
      const normalizedQuery = normalizeSearchText(q);
      filteredRows = filteredRows.filter((row) => {
        const haystack = normalizeSearchText(
          [
            row.family_name,
            row.post_url,
            row.reason,
            ...row.detected_categories,
            ...row.suggested_categories,
            ...row.validated_categories,
            ...row.formats_in_family.map((format) => format.template_name),
            ...row.formats_in_family.map((format) => format.format_label)
          ].join(" ")
        );

        return haystack.includes(normalizedQuery);
      });
    }

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const start = (page - 1) * perPage;
    const paginatedRows = filteredRows.slice(start, start + perPage);

    return NextResponse.json({
      ok: true,
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      filters: {
        status: statusFilter,
        category: category ?? null,
        q
      },
      summary: statusSummary(rows),
      syncStatus: {
        lastSync: syncStatus.lastSync,
        stale: syncStatus.stale,
        cacheComplete: syncStatus.cacheComplete,
        totalKnownTemplates: syncStatus.totalKnownTemplates,
        totalByLayout: syncStatus.totalByLayout,
        ageHours: syncStatus.ageHours
      },
      categories: MANAGEABLE_CATEGORY_IDS.map((id) => ({
        id,
        label: EVENT_PIC_CATEGORIES.find((categoryItem) => categoryItem.id === id)?.label ?? id
      })),
      items: paginatedRows
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/template-categories", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement du classement templates impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const body = (await request.json()) as FamilyActionPayload;
    const action = normalizeText(body.action) as FamilyAction;

    if (!action) {
      return NextResponse.json({ ok: false, error: "action requise." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    let updatedCount = 0;
    const familyKey = normalizeText(body.family_key);
    const familyKeys = Array.isArray(body.family_keys) ? body.family_keys.map(normalizeText).filter(Boolean) : [];
    const normalizedCategory = normalizeCategoryId(body.category);
    const normalizedCategories = normalizeCategories(body.categories);

    if (FAST_SINGLE_FAMILY_ACTIONS.has(action)) {
      if (!familyKey) {
        return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
      }

      const entries = await listTemplateCategoryOverrides();
      const index = entries.findIndex((entry) => entry.family_key === familyKey);

      if (index >= 0) {
        const nextEntries = [...entries];
        const entry = mutateSingleFamilyEntry(
          cloneEntry(entries[index]),
          action,
          normalizedCategory,
          normalizedCategories,
          nowIso
        );
        nextEntries[index] = entry;
        updatedCount = 1;

        await writeTemplateCategoryOverrides(nextEntries);

        return NextResponse.json({
          ok: true,
          updatedCount,
          summary: statusSummaryFromEntries(nextEntries),
          item: entry,
          duration_ms: Date.now() - startedAt
        });
      }
    }

    const { rows, overrides } = await buildFamilyRows();
    const rowsByFamilyKey = new Map(rows.map((row) => [row.family_key, row]));
    const entries = [...overrides];

    function ensureEntry(familyKey: string) {
      const row = rowsByFamilyKey.get(familyKey);

      if (!row) {
        throw new Error(`Famille introuvable: ${familyKey}`);
      }

      const index = entries.findIndex((entry) => entry.family_key === familyKey);

      if (index >= 0) {
        return {
          index,
          row
        };
      }

      const created = rowToOverride(row);
      entries.push(created);

      return {
        index: entries.length - 1,
        row
      };
    }

    function mutateFamily(familyKey: string, updater: (entry: TemplateCategoryOverrideEntry, row: FamilyRow) => void) {
      const target = ensureEntry(familyKey);
      const entry = { ...entries[target.index] };
      updater(entry, target.row);
      entry.updated_at = nowIso;
      entry.formats_in_family = mergeFormats(target.row.formats_in_family, entry.formats_in_family);
      applyStatus(entry, nowIso);
      entries[target.index] = entry;
      updatedCount += 1;
    }

    if (action === "validate_suggestion") {
      if (!familyKey) {
        return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry) => {
        entry.validated_categories = entry.suggested_categories.length > 0 ? [...entry.suggested_categories] : ["autres"];
        entry.status = "validated";
      });
    } else if (action === "set_categories") {
      if (!familyKey) {
        return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry) => {
        entry.validated_categories = normalizedCategories;
      });
    } else if (action === "add_category") {
      if (!familyKey || !normalizedCategory) {
        return NextResponse.json({ ok: false, error: "family_key et category requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry) => {
        entry.validated_categories = dedupeCategories([...entry.validated_categories, normalizedCategory]);
      });
    } else if (action === "remove_category") {
      if (!familyKey || !normalizedCategory) {
        return NextResponse.json({ ok: false, error: "family_key et category requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry) => {
        entry.validated_categories = entry.validated_categories.filter((categoryId) => categoryId !== normalizedCategory);
      });
    } else if (action === "ignore") {
      if (!familyKey) {
        return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry) => {
        entry.status = "ignored";
        entry.validated_categories = [];
      });
    } else if (action === "revalidate_family") {
      if (!familyKey) {
        return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
      }

      mutateFamily(familyKey, (entry, row) => {
        const detected: TemplateCategoryId[] =
          row.detected_categories.length > 0 ? [...row.detected_categories] : (["autres"] as TemplateCategoryId[]);
        entry.validated_categories = [...detected];
        entry.suggested_categories = [...detected];
        entry.reason = row.reason;
        entry.status = "validated";
      });
    } else if (action === "bulk_validate_suggestions") {
      if (familyKeys.length === 0) {
        return NextResponse.json({ ok: false, error: "family_keys requis." }, { status: 400 });
      }

      for (const currentFamilyKey of familyKeys) {
        mutateFamily(currentFamilyKey, (entry) => {
          entry.validated_categories = entry.suggested_categories.length > 0 ? [...entry.suggested_categories] : ["autres"];
          entry.status = "validated";
        });
      }
    } else if (action === "bulk_set_category") {
      if (familyKeys.length === 0 || !normalizedCategory) {
        return NextResponse.json({ ok: false, error: "family_keys et category requis." }, { status: 400 });
      }

      for (const currentFamilyKey of familyKeys) {
        mutateFamily(currentFamilyKey, (entry) => {
          entry.validated_categories = [normalizedCategory];
          entry.status = "validated";
        });
      }
    } else if (action === "bulk_ignore") {
      if (familyKeys.length === 0) {
        return NextResponse.json({ ok: false, error: "family_keys requis." }, { status: 400 });
      }

      for (const currentFamilyKey of familyKeys) {
        mutateFamily(currentFamilyKey, (entry) => {
          entry.status = "ignored";
          entry.validated_categories = [];
        });
      }
    } else if (action === "validate_current_classification") {
      let analyzedCount = 0;
      let validatedCount = 0;
      let alreadyValidatedCount = 0;
      let noCategoryCount = 0;
      let coveredFormatsCount = 0;

      for (const row of rows) {
        analyzedCount += 1;
        coveredFormatsCount += row.formats_in_family.length;
        const hasDetectedCategories = row.detected_categories.length > 0;
        const existingEntry = entries.find((entry) => entry.family_key === row.family_key);

        if (existingEntry?.status === "validated" && existingEntry.validated_categories.length > 0) {
          alreadyValidatedCount += 1;
          continue;
        }

        if (existingEntry?.status === "ignored") {
          alreadyValidatedCount += 1;
          continue;
        }

        if (!hasDetectedCategories) {
          noCategoryCount += 1;
          continue;
        }

        mutateFamily(row.family_key, (entry) => {
          entry.detected_categories = [...row.detected_categories];
          entry.suggested_categories = [...(row.suggested_categories.length > 0 ? row.suggested_categories : row.detected_categories)];
          entry.validated_categories = [...row.detected_categories];
          entry.reason = row.reason;
          entry.status = "validated";
          entry.validated_at = nowIso;
        });
        validatedCount += 1;
      }

      await writeTemplateCategoryOverrides(entries);

      return NextResponse.json({
        ok: true,
        updatedCount,
        summary: statusSummaryFromEntries(entries),
        validationSummary: {
          analyzedCount,
          validatedCount,
          alreadyValidatedCount,
          noCategoryCount,
          coveredFormatsCount
        }
      });
    } else {
      return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
    }

    await writeTemplateCategoryOverrides(entries);

    return NextResponse.json({
      ok: true,
      updatedCount,
      summary: statusSummaryFromEntries(entries)
    });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-categories", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Mise a jour du classement templates impossible."
      },
      { status: 500 }
    );
  }
}
