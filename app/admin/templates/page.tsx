"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EVENT_PIC_CATEGORIES } from "@/src/shared/eventPicTemplates";
import { BrandLogo } from "@/app/components/BrandLogo";

type FamilyStatus = "to_review" | "validated" | "ignored";

type FamilyFormat = {
  template_id: string;
  template_name: string;
  layout: string;
  format_label: string;
  no_of_images: string;
  preview_url: string;
};

type TemplateFamilyRow = {
  family_key: string;
  family_name: string;
  post_url: string;
  preview_url: string;
  detected_categories: string[];
  suggested_categories: string[];
  validated_categories: string[];
  status: FamilyStatus;
  reason: string;
  formats_in_family: FamilyFormat[];
  created_at: string;
  updated_at: string;
  validated_at: string | null;
};

type TemplateCategorySummary = {
  to_review: number;
  validated: number;
  ignored: number;
  all: number;
};

type CategoryItem = {
  id: string;
  label: string;
};

type TemplateCategoriesResponse = {
  ok?: boolean;
  items?: TemplateFamilyRow[];
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  counts?: TemplateCategorySummary;
  syncStatus?: {
    lastSync: string | null;
    stale: boolean;
    cacheComplete: boolean;
    totalKnownTemplates: number;
    totalByLayout: Record<string, number>;
    ageHours: number | null;
  };
  latestSync?: {
    started_at: string;
    completed_at: string;
    status: "success" | "error";
    trigger: "cron" | "manual";
    new_families: number;
    new_templates: number;
    total_templates: number;
    total_families: number;
    to_review: number;
    validated: number;
    ignored: number;
    error_message: string;
  } | null;
  nextScheduledSyncLabel?: string;
  categories?: CategoryItem[];
  error?: string;
};

type TemplateCategoriesMutationResponse = {
  ok?: boolean;
  updatedCount?: number;
  summary?: {
    to_review: number;
    validated: number;
    ignored: number;
    all?: number;
    total?: number;
  };
  validationSummary?: {
    analyzedCount: number;
    validatedCount: number;
    alreadyValidatedCount: number;
    noCategoryCount: number;
    coveredFormatsCount: number;
  };
  error?: string;
};

type SyncResponse = {
  ok?: boolean;
  syncedCount?: number;
  newTemplatesCount?: number;
  familyCount?: number;
  toReviewCount?: number;
  validatedCount?: number;
  ignoredCount?: number;
  coveredFormatsCount?: number;
  lastSync?: string | null;
  error?: string;
};

type SyncHistoryEntry = {
  started_at: string;
  completed_at: string;
  status: "success" | "error";
  trigger: "cron" | "manual";
  total_templates: number;
  total_families: number;
  new_families: number;
  new_templates: number;
  to_review: number;
  validated: number;
  ignored: number;
  error_message: string;
};

type SyncHistoryResponse = {
  ok?: boolean;
  items?: SyncHistoryEntry[];
  error?: string;
};

type TemplateSourceLinkEntry = {
  family_key?: string;
  template_id?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string;
  post_url?: string;
  canva_folder_url?: string;
  canva_template_url?: string;
};

type TemplateSourceLinksResponse = {
  ok?: boolean;
  links?: TemplateSourceLinkEntry[];
  entry?: TemplateSourceLinkEntry;
  error?: string;
};

type FamilyCanvaSummary = {
  folderUrl: string;
  formatLinksAvailable: number;
  totalFormats: number;
};

const CATEGORY_OPTIONS = EVENT_PIC_CATEGORIES.filter((category) => category.id !== "all");

function normalizePostUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? value;
}

function familyKeyFromSourceLink(entry: TemplateSourceLinkEntry) {
  if (entry.family_key && entry.family_key.trim()) {
    return entry.family_key.trim();
  }

  const normalizedPostUrl = normalizePostUrl(entry.post_url);
  return normalizedPostUrl ? `post_url:${normalizedPostUrl}` : "";
}

function buildFamilyCanvaSummaries(items: TemplateFamilyRow[], links: TemplateSourceLinkEntry[]) {
  const summaries = new Map<string, FamilyCanvaSummary>();

  for (const item of items) {
    summaries.set(item.family_key, {
      folderUrl: "",
      formatLinksAvailable: 0,
      totalFormats: item.formats_in_family.length
    });
  }

  const formatLinkSets = new Map<string, Set<string>>();

  for (const link of links) {
    const familyKey = familyKeyFromSourceLink(link);
    if (!familyKey || !summaries.has(familyKey)) {
      continue;
    }

    const summary = summaries.get(familyKey)!;

    if (typeof link.canva_folder_url === "string" && link.canva_folder_url.trim().length > 0) {
      summary.folderUrl = link.canva_folder_url.trim();
    }

    if (typeof link.canva_template_url === "string" && link.canva_template_url.trim().length > 0) {
      const key = [
        link.template_id ?? "",
        link.format_label ?? "",
        link.layout ?? "",
        link.no_of_images ?? "",
        link.canva_template_url.trim()
      ].join("::");
      if (!formatLinkSets.has(familyKey)) {
        formatLinkSets.set(familyKey, new Set<string>());
      }
      formatLinkSets.get(familyKey)!.add(key);
    }
  }

  for (const [familyKey, set] of formatLinkSets.entries()) {
    const summary = summaries.get(familyKey);
    if (!summary) {
      continue;
    }
    summary.formatLinksAvailable = set.size;
  }

  return summaries;
}

function categoryLabelMap(categories: CategoryItem[]) {
  const map = new Map<string, string>();

  for (const category of categories) {
    map.set(category.id, category.label);
  }

  return map;
}

function categoryListLabel(categoryIds: string[], map: Map<string, string>) {
  if (categoryIds.length === 0) {
    return "Non classe";
  }

  return categoryIds.map((categoryId) => map.get(categoryId) ?? categoryId).join(", ");
}

function statusLabel(status: FamilyStatus) {
  if (status === "to_review") {
    return "A classer";
  }

  if (status === "validated") {
    return "Valide";
  }

  return "Ignore";
}

function formatCoverageLabel(formats: FamilyFormat[]) {
  const labels = new Set<string>();

  for (const format of formats) {
    if (format.layout === "26strip") {
      labels.add("2x6");
      continue;
    }

    if (format.layout === "46postcard-p") {
      labels.add("portrait");
      continue;
    }

    if (format.layout === "46postcard-l") {
      labels.add("paysage");
      continue;
    }

    const lowerName = `${format.template_name} ${format.format_label}`.toLowerCase();

    if (lowerName.includes("welcome")) {
      labels.add("welcome");
    }
  }

  return labels.size > 0 ? [...labels].join(", ") : "-";
}

export default function AdminTemplateCategoriesPage() {
  const [items, setItems] = useState<TemplateFamilyRow[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(
    CATEGORY_OPTIONS.map((category) => ({ id: category.id, label: category.label }))
  );
  const [summary, setSummary] = useState<TemplateCategorySummary>({
    to_review: 0,
    validated: 0,
    ignored: 0,
    all: 0
  });
  const [statusFilter, setStatusFilter] = useState<FamilyStatus | "all">("to_review");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<TemplateCategoriesResponse["syncStatus"] | null>(null);
  const [latestSync, setLatestSync] = useState<TemplateCategoriesResponse["latestSync"] | null>(null);
  const [nextScheduledSyncLabel, setNextScheduledSyncLabel] = useState<string>("03:00 (heure France)");
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [selectedFamilyKeys, setSelectedFamilyKeys] = useState<string[]>([]);
  const [categoryDraftByFamilyKey, setCategoryDraftByFamilyKey] = useState<Record<string, string>>({});
  const [massCategory, setMassCategory] = useState<string>("mariage");
  const [familyCanvaSummaries, setFamilyCanvaSummaries] = useState<Record<string, FamilyCanvaSummary>>({});
  const [familyCanvaFolderInput, setFamilyCanvaFolderInput] = useState<Record<string, string>>({});
  const [familyCanvaFolderFeedback, setFamilyCanvaFolderFeedback] = useState<Record<string, string>>({});
  const [familyCanvaFolderSavingKey, setFamilyCanvaFolderSavingKey] = useState<string | null>(null);

  const categoryMap = useMemo(() => categoryLabelMap(categories), [categories]);
  const selectedSet = useMemo(() => new Set(selectedFamilyKeys), [selectedFamilyKeys]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, searchQuery, page]);

  useEffect(() => {
    setSelectedFamilyKeys((previous) => previous.filter((familyKey) => items.some((item) => item.family_key === familyKey)));
  }, [items]);

  async function fetchRows() {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        per_page: "50"
      });

      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/admin/templates?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as TemplateCategoriesResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement du classement templates impossible.");
      }

      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setTotal(payload.total ?? 0);
      setTotalPages(payload.total_pages ?? 1);
      setSummary(
        payload.counts
          ? payload.counts
          : {
              to_review: 0,
              validated: 0,
              ignored: 0,
              all: 0
            }
      );
      setSyncStatus(payload.syncStatus ?? null);
      setLatestSync(payload.latestSync ?? null);
      setNextScheduledSyncLabel(payload.nextScheduledSyncLabel ?? "03:00 (heure France)");
      setCategories(payload.categories ?? categories);
      setCategoryDraftByFamilyKey((previous) => {
        const next = { ...previous };

        for (const row of nextItems) {
          if (!next[row.family_key]) {
            next[row.family_key] = row.validated_categories[0] ?? row.suggested_categories[0] ?? "mariage";
          }
        }

        return next;
      });
      await loadFamilyCanvaSummaries(nextItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFamilyCanvaSummaries(nextItems: TemplateFamilyRow[]) {
    try {
      const response = await fetch("/api/admin/template-source-links", { cache: "no-store" });
      const payload = (await response.json()) as TemplateSourceLinksResponse;

      if (!response.ok || !payload.ok) {
        return;
      }

      const summariesMap = buildFamilyCanvaSummaries(nextItems, payload.links ?? []);
      const nextSummaries: Record<string, FamilyCanvaSummary> = {};
      for (const [familyKey, summary] of summariesMap.entries()) {
        nextSummaries[familyKey] = summary;
      }
      setFamilyCanvaSummaries(nextSummaries);
      setFamilyCanvaFolderInput((previous) => {
        const next = { ...previous };
        for (const item of nextItems) {
          if (!next[item.family_key]) {
            next[item.family_key] = nextSummaries[item.family_key]?.folderUrl ?? "";
          }
        }
        return next;
      });
    } catch {
      // ignore source link side panel errors on list load
    }
  }

  async function mutate(action: string, payload: Record<string, unknown>) {
    setSaving(true);
    let nextMessage: string | null = null;

    try {
      const response = await fetch("/api/admin/template-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...payload
        })
      });
      const result = (await response.json()) as TemplateCategoriesMutationResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Mise a jour impossible.");
      }

      if (result.validationSummary) {
        nextMessage = 
          `${result.validationSummary.analyzedCount} familles analysees, ${result.validationSummary.validatedCount} validees, ${result.validationSummary.alreadyValidatedCount} deja validees, ${result.validationSummary.noCategoryCount} sans categorie claire, ${result.validationSummary.coveredFormatsCount} formats couverts.`
      }

      if (result.summary) {
        setSummary({
          to_review: result.summary.to_review ?? 0,
          validated: result.summary.validated ?? 0,
          ignored: result.summary.ignored ?? 0,
          all: result.summary.all ?? result.summary.total ?? 0
        });
      }

      await fetchRows();
      if (nextMessage) {
        setMessage(nextMessage);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise a jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function syncTemplates() {
    setSyncing(true);
    setMessage("Synchronisation en cours...");

    try {
      const response = await fetch("/api/admin/template-categories/sync", {
        method: "POST"
      });
      const payload = (await response.json()) as SyncResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Synchronisation TemplateBooth impossible.");
      }

      setMessage(
        `${payload.syncedCount ?? 0} templates recuperes, ${payload.familyCount ?? 0} familles detectees, ${payload.newTemplatesCount ?? 0} nouveaux templates, ${payload.validatedCount ?? 0} familles deja validees, ${payload.toReviewCount ?? 0} familles a classer, ${payload.coveredFormatsCount ?? 0} formats couverts.${payload.lastSync ? ` Derniere synchronisation: ${new Date(payload.lastSync).toLocaleString("fr-FR")}.` : ""}`
      );
      setPage(1);
      await fetchRows();
      if (showSyncHistory) {
        await loadSyncHistory();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synchronisation impossible.");
    } finally {
      setSyncing(false);
    }
  }

  async function loadSyncHistory() {
    setSyncHistoryLoading(true);

    try {
      const response = await fetch("/api/admin/templatebooth/sync-history?limit=20", {
        cache: "no-store"
      });
      const payload = (await response.json()) as SyncHistoryResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement de l'historique impossible.");
      }

      setSyncHistory(payload.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement de l'historique impossible.");
    } finally {
      setSyncHistoryLoading(false);
    }
  }

  function toggleSelection(familyKey: string) {
    setSelectedFamilyKeys((previous) =>
      previous.includes(familyKey) ? previous.filter((key) => key !== familyKey) : [...previous, familyKey]
    );
  }

  function toggleSelectAllCurrentPage() {
    const currentPageKeys = items.map((item) => item.family_key);
    const allSelected = currentPageKeys.every((key) => selectedSet.has(key));

    if (allSelected) {
      setSelectedFamilyKeys((previous) => previous.filter((key) => !currentPageKeys.includes(key)));
      return;
    }

    setSelectedFamilyKeys((previous) => [...new Set([...previous, ...currentPageKeys])]);
  }

  async function saveFamilyCanvaFolder(item: TemplateFamilyRow) {
    const canvaFolderUrl = (familyCanvaFolderInput[item.family_key] ?? "").trim();
    if (!canvaFolderUrl) {
      setFamilyCanvaFolderFeedback((previous) => ({
        ...previous,
        [item.family_key]: "Renseignez un lien dossier Canva avant enregistrement."
      }));
      return;
    }

    setFamilyCanvaFolderSavingKey(item.family_key);
    setFamilyCanvaFolderFeedback((previous) => ({
      ...previous,
      [item.family_key]: ""
    }));

    try {
      const response = await fetch("/api/admin/template-source-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_key: item.family_key,
          template_name: item.family_name,
          post_url: item.post_url || undefined,
          canva_folder_url: canvaFolderUrl,
          canva_folder_source: "manual"
        })
      });
      const payload = (await response.json()) as TemplateSourceLinksResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Enregistrement du dossier Canva impossible.");
      }

      await loadFamilyCanvaSummaries(items);
      setFamilyCanvaFolderFeedback((previous) => ({
        ...previous,
        [item.family_key]: "Lien dossier Canva enregistre."
      }));
    } catch (error) {
      setFamilyCanvaFolderFeedback((previous) => ({
        ...previous,
        [item.family_key]: error instanceof Error ? error.message : "Enregistrement du dossier Canva impossible."
      }));
    } finally {
      setFamilyCanvaFolderSavingKey(null);
    }
  }

  return (
    <main className="admin-page premium-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow">Event Pic Admin</p>
          <h1>Classement des templates</h1>
          <p className="admin-hero-subtitle">Validez les categories proposees ou deplacez les modeles a votre convenance.</p>
        </div>
        <div className="admin-hero-actions">
          <button type="button" onClick={syncTemplates} disabled={syncing || saving}>
            {syncing ? "Synchronisation..." : "Synchroniser TemplateBooth"}
          </button>
          <button
            type="button"
            disabled={saving || syncing}
            onClick={() => {
              if (
                !window.confirm(
                  "Cette action va valider toutes les familles actuellement classees par les regles Event Pic. Les validations manuelles existantes ne seront pas ecrasees."
                )
              ) {
                return;
              }

              setMessage("Validation en cours...");
              void mutate("validate_current_classification", {});
            }}
          >
            Valider tout le classement actuel
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !showSyncHistory;
              setShowSyncHistory(next);

              if (next && syncHistory.length === 0) {
                void loadSyncHistory();
              }
            }}
            disabled={syncHistoryLoading}
          >
            {showSyncHistory ? "Masquer historique synchronisation" : "Voir historique synchronisation"}
          </button>
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/devis">Devis clients</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/planning">Planning evenements</Link>
          <Link href="/admin/photobooths">Photos photobooth</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <Link href="/admin/demandes">Voir les demandes</Link>
          <div className="admin-count">{summary.all} familles</div>
        </div>
      </section>

      {message ? <p className="notice">{message}</p> : null}
      {syncStatus ? (
        <div className={syncStatus.stale ? "notice" : "ai-brief-meta"} style={{ display: "grid", gap: 4 }}>
          <span>
            {`Derniere synchronisation TemplateBooth : ${
              syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString("fr-FR") : "inconnue"
            }${syncStatus.stale ? " - Synchronisation recommandee." : ""}`}
          </span>
          {latestSync ? (
            <>
              <span>{`Dernier declenchement : ${latestSync.trigger === "cron" ? "automatique" : "manuel"}`}</span>
              <span>{`Statut : ${latestSync.status === "success" ? "succes" : "erreur"}`}</span>
              <span>{`Nouveaux templates detectes : ${latestSync.new_templates}`}</span>
            </>
          ) : null}
          <span>{`Prochaine synchronisation prevue : ${nextScheduledSyncLabel}`}</span>
        </div>
      ) : null}

      {showSyncHistory ? (
        <section className="admin-template-diagnostic" aria-label="Historique synchronisation TemplateBooth">
          <h2 style={{ marginTop: 0 }}>Historique synchronisation</h2>
          {syncHistoryLoading ? <p className="ai-brief-meta">Chargement de l&apos;historique...</p> : null}
          {!syncHistoryLoading && syncHistory.length === 0 ? <p className="ai-brief-meta">Aucun historique disponible.</p> : null}
          {!syncHistoryLoading && syncHistory.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Declenchement</th>
                    <th>Statut</th>
                    <th>Nouveaux templates</th>
                    <th>Nouvelles familles</th>
                    <th>Totaux</th>
                  </tr>
                </thead>
                <tbody>
                  {syncHistory.map((entry) => (
                    <tr key={`${entry.started_at}-${entry.trigger}`}>
                      <td>{new Date(entry.completed_at || entry.started_at).toLocaleString("fr-FR")}</td>
                      <td>{entry.trigger === "cron" ? "automatique" : "manuel"}</td>
                      <td>{entry.status === "success" ? "succes" : `erreur${entry.error_message ? `: ${entry.error_message}` : ""}`}</td>
                      <td>{entry.new_templates}</td>
                      <td>{entry.new_families}</td>
                      <td>{`${entry.total_templates} templates / ${entry.total_families} familles`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="admin-template-diagnostic" aria-label="Filtres classement templates">
        <div className="admin-template-diagnostic-controls">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Rechercher un template..."
            aria-label="Rechercher un template"
          />
          <button type="button" onClick={() => setPage(1)} disabled={loading || saving}>
            Rechercher
          </button>
        </div>

        <div className="table-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={statusFilter === "to_review" ? "status-pill ai-status-running" : ""}
            onClick={() => {
              setStatusFilter("to_review");
              setPage(1);
            }}
          >
            A classer ({summary.to_review})
          </button>
          <button
            type="button"
            className={statusFilter === "validated" ? "status-pill ai-status-completed" : ""}
            onClick={() => {
              setStatusFilter("validated");
              setPage(1);
            }}
          >
            Valides ({summary.validated})
          </button>
          <button
            type="button"
            className={statusFilter === "all" ? "status-pill" : ""}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            Tous ({summary.all})
          </button>
          <button
            type="button"
            className={statusFilter === "ignored" ? "status-pill ai-status-error" : ""}
            onClick={() => {
              setStatusFilter("ignored");
              setPage(1);
            }}
          >
            Ignores ({summary.ignored})
          </button>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Par categorie: toutes</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="table-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              if (items.length === 0) {
                return;
              }

              if (!window.confirm("Valider les propositions de toutes les familles affichees ?")) {
                return;
              }

              void mutate("bulk_validate_suggestions", {
                family_keys: items.map((item) => item.family_key)
              });
            }}
            disabled={saving || items.length === 0}
          >
            Valider les propositions (page)
          </button>
          <select value={massCategory} onChange={(event) => setMassCategory(event.target.value)}>
            {categories.map((category) => (
              <option key={`mass-${category.id}`} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || selectedFamilyKeys.length === 0}
            onClick={() => {
              if (!window.confirm(`Mettre ${selectedFamilyKeys.length} famille(s) dans cette categorie ?`)) {
                return;
              }

              void mutate("bulk_set_category", {
                family_keys: selectedFamilyKeys,
                category: massCategory
              });
            }}
          >
            Mettre la selection dans la categorie
          </button>
          <button
            type="button"
            disabled={saving || selectedFamilyKeys.length === 0}
            onClick={() => {
              if (!window.confirm(`Ignorer ${selectedFamilyKeys.length} famille(s) ?`)) {
                return;
              }

              void mutate("bulk_ignore", {
                family_keys: selectedFamilyKeys
              });
            }}
          >
            Ignorer la selection
          </button>
        </div>
      </section>

      {loading ? <p className="ai-brief-meta">Chargement des familles...</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((item) => selectedSet.has(item.family_key))}
                  onChange={toggleSelectAllCurrentPage}
                  aria-label="Selectionner toutes les familles de la page"
                />
              </th>
              <th>Famille</th>
              <th>Formats</th>
              <th>Proposition</th>
              <th>Valide</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              [...Array.from({ length: 8 }).keys()].map((index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={7}>
                    <div
                      style={{
                        height: 16,
                        width: "100%",
                        borderRadius: 6,
                        background: "#ece6df"
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>Aucune famille trouvee.</td>
              </tr>
            ) : (
              items.map((item) => {
                const categoryDraft = categoryDraftByFamilyKey[item.family_key] ?? item.validated_categories[0] ?? item.suggested_categories[0] ?? "mariage";
                const canvaSummary = familyCanvaSummaries[item.family_key] ?? {
                  folderUrl: "",
                  formatLinksAvailable: 0,
                  totalFormats: item.formats_in_family.length
                };
                const canvaFolderInput = familyCanvaFolderInput[item.family_key] ?? canvaSummary.folderUrl ?? "";
                const canvaFolderFeedback = familyCanvaFolderFeedback[item.family_key] ?? "";

                return (
                  <tr key={item.family_key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.family_key)}
                        onChange={() => toggleSelection(item.family_key)}
                        aria-label={`Selectionner ${item.family_name}`}
                      />
                    </td>
                    <td>
                      <img
                        alt={`Apercu ${item.family_name}`}
                        src={item.preview_url}
                        loading="lazy"
                        decoding="async"
                        className="admin-preview-thumb"
                        style={{ width: 74, height: 98, marginBottom: 8 }}
                      />
                      <strong>{item.family_name}</strong>
                      <small>{item.post_url ? `post_url: ${item.post_url}` : "post_url non renseigne"}</small>
                      <small>{item.family_key}</small>
                    </td>
                    <td>
                      <small>{`${item.formats_in_family.length} format(s)`}</small>
                      <small>{`Couverture: ${formatCoverageLabel(item.formats_in_family)}`}</small>
                      <small>{item.formats_in_family.map((format) => format.format_label).join(" | ")}</small>
                      <small>{`Canva dossier global: ${canvaSummary.folderUrl ? "disponible" : "manquant"}`}</small>
                      <small>{`Liens Canva formats: ${canvaSummary.formatLinksAvailable} / ${canvaSummary.totalFormats}`}</small>
                    </td>
                    <td>
                      <small>{`Detecte: ${categoryListLabel(item.detected_categories, categoryMap)}`}</small>
                      <small>{`Propose: ${categoryListLabel(item.suggested_categories, categoryMap)}`}</small>
                      <small>{item.reason || "Aucune raison disponible."}</small>
                    </td>
                    <td>
                      <small>{categoryListLabel(item.validated_categories, categoryMap)}</small>
                      {item.validated_at ? <small>{`Valide le ${new Date(item.validated_at).toLocaleString("fr-FR")}`}</small> : null}
                    </td>
                    <td>
                      <span className={`status-pill ai-status-${item.status}`}>{statusLabel(item.status)}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {canvaSummary.folderUrl ? (
                          <a href={canvaSummary.folderUrl} target="_blank" rel="noopener noreferrer">
                            Ouvrir dossier Canva
                          </a>
                        ) : null}
                        <input
                          type="url"
                          value={canvaFolderInput}
                          onChange={(event) =>
                            setFamilyCanvaFolderInput((previous) => ({
                              ...previous,
                              [item.family_key]: event.target.value
                            }))
                          }
                          placeholder="Lien dossier Canva global"
                        />
                        <button
                          type="button"
                          disabled={saving || familyCanvaFolderSavingKey === item.family_key}
                          onClick={() => void saveFamilyCanvaFolder(item)}
                        >
                          {familyCanvaFolderSavingKey === item.family_key
                            ? "Enregistrement..."
                            : "Enregistrer dossier Canva"}
                        </button>
                        {canvaFolderFeedback ? <small>{canvaFolderFeedback}</small> : null}
                        <select
                          value={categoryDraft}
                          onChange={(event) =>
                            setCategoryDraftByFamilyKey((previous) => ({
                              ...previous,
                              [item.family_key]: event.target.value
                            }))
                          }
                        >
                          {categories.map((category) => (
                            <option key={`${item.family_key}-${category.id}`} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void mutate("validate_suggestion", { family_key: item.family_key })}
                        >
                          Valider la proposition
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void mutate("set_categories", {
                              family_key: item.family_key,
                              categories: [categoryDraft]
                            })
                          }
                        >
                          Modifier categories
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void mutate("add_category", {
                              family_key: item.family_key,
                              category: categoryDraft
                            })
                          }
                        >
                          Ajouter categorie
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void mutate("remove_category", {
                              family_key: item.family_key,
                              category: categoryDraft
                            })
                          }
                        >
                          Retirer categorie
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void mutate("revalidate_family", { family_key: item.family_key })}
                        >
                          Revalider cette famille
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void mutate("ignore", { family_key: item.family_key })}
                        >
                          Ignorer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-actions" style={{ marginTop: 14 }}>
        <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
          Precedent
        </button>
        <span>{`Page ${page} / ${totalPages} - ${total} famille(s)`}</span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={page >= totalPages || loading}
        >
          Suivant
        </button>
      </div>
    </main>
  );
}
