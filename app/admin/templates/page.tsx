"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

type TemplateHoverPreview = {
  src: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
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
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<TemplateHoverPreview | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  const categoryMap = useMemo(() => categoryLabelMap(categories), [categories]);
  const selectedSet = useMemo(() => new Set(selectedFamilyKeys), [selectedFamilyKeys]);
  const selectedFamily = useMemo(
    () => items.find((item) => item.family_key === selectedFamilyKey) ?? items[0] ?? null,
    [items, selectedFamilyKey]
  );

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

  useEffect(() => {
    if (items.length === 0) {
      setSelectedFamilyKey(null);
      return;
    }

    if (!selectedFamilyKey || !items.some((item) => item.family_key === selectedFamilyKey)) {
      setSelectedFamilyKey(items[0].family_key);
    }
  }, [items, selectedFamilyKey]);

  useEffect(() => {
    if (!hoverPreview) {
      return;
    }

    const clearPreview = () => setHoverPreview(null);
    window.addEventListener("scroll", clearPreview, true);
    window.addEventListener("resize", clearPreview);

    return () => {
      window.removeEventListener("scroll", clearPreview, true);
      window.removeEventListener("resize", clearPreview);
    };
  }, [hoverPreview]);

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

  function handleViewDetails(familyKey: string, options?: { scroll?: boolean }) {
    setSelectedFamilyKey(familyKey);

    if (options?.scroll && typeof window !== "undefined" && window.innerWidth <= 1280) {
      window.requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function showTemplateHoverPreview(element: HTMLElement, src: string, title: string, subtitle: string) {
    if (!src || typeof window === "undefined") {
      return;
    }

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const gap = 16;
    const width = Math.min(392, window.innerWidth - 32);
    const estimatedHeight = Math.min(560, window.innerHeight - 32);
    let x = rect.right + gap;

    if (x + width > window.innerWidth - 16) {
      x = rect.left - width - gap;
    }

    x = Math.max(16, Math.min(x, window.innerWidth - width - 16));

    const y = Math.max(16, Math.min(rect.top - 24, window.innerHeight - estimatedHeight - 16));

    setHoverPreview({
      src,
      title,
      subtitle,
      x,
      y
    });
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

  function categoryDraftFor(item: TemplateFamilyRow) {
    return categoryDraftByFamilyKey[item.family_key] ?? item.validated_categories[0] ?? item.suggested_categories[0] ?? "mariage";
  }

  function canvaSummaryFor(item: TemplateFamilyRow): FamilyCanvaSummary {
    return (
      familyCanvaSummaries[item.family_key] ?? {
        folderUrl: "",
        formatLinksAvailable: 0,
        totalFormats: item.formats_in_family.length
      }
    );
  }

  return (
    <main className="admin-page premium-page admin-templates-page">
      <section className="admin-hero premium-hero admin-templates-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow admin-brand-line"><span className="event-pic-signature admin-brand-signature">Event Pic</span><span className="admin-brand-suffix">Admin</span></p>
          <h1>Classement des templates</h1>
          <p className="admin-hero-subtitle">Pilotez rapidement les familles TemplateBooth, leurs formats, leurs categories et leurs liens Canva.</p>
        </div>
        <div className="admin-hero-actions admin-template-hero-actions">
          <div className="admin-template-action-strip" aria-label="Actions principales templates">
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
              {showSyncHistory ? "Masquer historique" : "Historique synchronisation"}
            </button>
          </div>
          <nav className="admin-template-nav" aria-label="Navigation admin Event Pic">
            <Link href="/">Site client</Link>
            <Link href="/admin/dossiers">Dossiers</Link>
            <Link href="/admin/devis">Devis clients</Link>
            <Link href="/admin/livreurs">Livreurs</Link>
            <Link href="/admin/livraisons">Livraisons</Link>
            <Link href="/admin/planning">Planning evenements</Link>
            <Link href="/admin/emails">Emails clients</Link>
            <Link href="/admin/demandes">Voir les demandes</Link>
          </nav>
          <div className="admin-count">{summary.all} familles</div>
        </div>
      </section>

      {message ? <p className="notice">{message}</p> : null}

      <section className="admin-template-kpi-grid" aria-label="Statistiques classement templates">
        <button
          type="button"
          className={statusFilter === "to_review" ? "admin-template-kpi is-active" : "admin-template-kpi"}
          onClick={() => {
            setStatusFilter("to_review");
            setPage(1);
          }}
        >
          <span>A classer</span>
          <strong>{summary.to_review}</strong>
          <small>Familles a valider</small>
        </button>
        <button
          type="button"
          className={statusFilter === "validated" ? "admin-template-kpi is-active" : "admin-template-kpi"}
          onClick={() => {
            setStatusFilter("validated");
            setPage(1);
          }}
        >
          <span>Valides</span>
          <strong>{summary.validated}</strong>
          <small>Categories confirmees</small>
        </button>
        <button
          type="button"
          className={statusFilter === "ignored" ? "admin-template-kpi is-active" : "admin-template-kpi"}
          onClick={() => {
            setStatusFilter("ignored");
            setPage(1);
          }}
        >
          <span>Ignores</span>
          <strong>{summary.ignored}</strong>
          <small>Familles masquees</small>
        </button>
        <button
          type="button"
          className={statusFilter === "all" ? "admin-template-kpi is-active" : "admin-template-kpi"}
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
        >
          <span>Total</span>
          <strong>{summary.all}</strong>
          <small>Familles indexees</small>
        </button>
      </section>

      {syncStatus ? (
        <section className={syncStatus.stale ? "admin-template-sync-card is-stale" : "admin-template-sync-card"} aria-label="Etat synchronisation TemplateBooth">
          <div>
            <span>Derniere synchronisation</span>
            <strong>{syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString("fr-FR") : "Inconnue"}</strong>
          </div>
          <div>
            <span>Dernier declenchement</span>
            <strong>{latestSync ? (latestSync.trigger === "cron" ? "Automatique" : "Manuel") : "Non disponible"}</strong>
          </div>
          <div>
            <span>Statut</span>
            <strong>{latestSync ? (latestSync.status === "success" ? "Succes" : "Erreur") : syncStatus.stale ? "A synchroniser" : "OK"}</strong>
          </div>
          <div>
            <span>Prochaine synchronisation</span>
            <strong>{nextScheduledSyncLabel}</strong>
          </div>
        </section>
      ) : null}

      {showSyncHistory ? (
        <section className="admin-template-history" aria-label="Historique synchronisation TemplateBooth">
          <div className="admin-template-section-heading">
            <div>
              <span className="eyebrow">Synchronisation</span>
              <h2>Historique TemplateBooth</h2>
            </div>
            <button type="button" onClick={() => void loadSyncHistory()} disabled={syncHistoryLoading}>
              {syncHistoryLoading ? "Chargement..." : "Actualiser"}
            </button>
          </div>
          {syncHistoryLoading ? <p className="ai-brief-meta">Chargement de l&apos;historique...</p> : null}
          {!syncHistoryLoading && syncHistory.length === 0 ? <p className="ai-brief-meta">Aucun historique disponible.</p> : null}
          {!syncHistoryLoading && syncHistory.length > 0 ? (
            <div className="admin-template-history-list">
              {syncHistory.map((entry) => (
                <article key={`${entry.started_at}-${entry.trigger}`}>
                  <strong>{new Date(entry.completed_at || entry.started_at).toLocaleString("fr-FR")}</strong>
                  <span>{entry.trigger === "cron" ? "Automatique" : "Manuel"}</span>
                  <span>{entry.status === "success" ? "Succes" : `Erreur${entry.error_message ? `: ${entry.error_message}` : ""}`}</span>
                  <small>{`${entry.new_templates} nouveaux templates, ${entry.new_families} nouvelles familles`}</small>
                  <small>{`${entry.total_templates} templates / ${entry.total_families} familles`}</small>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="admin-template-toolbar" aria-label="Filtres classement templates">
        <div className="admin-template-toolbar-main">
          <div className="admin-template-search-field">
            <label htmlFor="template-search">Recherche</label>
            <div>
              <input
                id="template-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nom, famille, URL ou format..."
                aria-label="Rechercher un template"
              />
              <button type="button" onClick={() => setPage(1)} disabled={loading || saving}>
                Rechercher
              </button>
            </div>
          </div>
          <label className="admin-template-category-filter">
            Categorie
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Toutes les categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-template-status-tabs" role="group" aria-label="Filtrer par statut">
          <button
            type="button"
            className={statusFilter === "to_review" ? "is-active" : ""}
            onClick={() => {
              setStatusFilter("to_review");
              setPage(1);
            }}
          >
            A classer <span>{summary.to_review}</span>
          </button>
          <button
            type="button"
            className={statusFilter === "validated" ? "is-active" : ""}
            onClick={() => {
              setStatusFilter("validated");
              setPage(1);
            }}
          >
            Valides <span>{summary.validated}</span>
          </button>
          <button
            type="button"
            className={statusFilter === "all" ? "is-active" : ""}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            Tous <span>{summary.all}</span>
          </button>
          <button
            type="button"
            className={statusFilter === "ignored" ? "is-active" : ""}
            onClick={() => {
              setStatusFilter("ignored");
              setPage(1);
            }}
          >
            Ignores <span>{summary.ignored}</span>
          </button>
        </div>

        <div className="admin-template-bulk-actions">
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
            Valider les propositions de la page
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
            Categoriser la selection
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

      {loading ? <p className="ai-brief-meta admin-template-loading">Chargement des familles...</p> : null}

      <section className="admin-template-workbench" aria-label="Tableau de bord classement templates">
        <div className="admin-template-list-panel">
          <div className="admin-template-list-header">
            <div>
              <span className="eyebrow">Familles templates</span>
              <h2>{total} resultat(s)</h2>
            </div>
            <label>
              <input
                type="checkbox"
                checked={items.length > 0 && items.every((item) => selectedSet.has(item.family_key))}
                onChange={toggleSelectAllCurrentPage}
                aria-label="Selectionner toutes les familles de la page"
              />
              Selectionner la page
            </label>
          </div>

          <div className="admin-template-family-list">
            {loading && items.length === 0 ? (
              Array.from({ length: 6 }, (_, index) => (
                <article className="admin-template-family-card is-skeleton" key={`skeleton-${index}`}>
                  <div />
                  <span />
                  <span />
                </article>
              ))
            ) : items.length === 0 ? (
              <div className="empty-state admin-template-empty-state">
                <strong>Aucune famille trouvee.</strong>
                <span>Ajustez la recherche, le statut ou la categorie pour retrouver un template.</span>
              </div>
            ) : (
              items.map((item) => {
                const categoryDraft = categoryDraftFor(item);
                const canvaSummary = canvaSummaryFor(item);
                const isSelected = selectedFamily?.family_key === item.family_key;

                return (
                  <article className={isSelected ? "admin-template-family-card is-selected" : "admin-template-family-card"} key={item.family_key}>
                    <div className="admin-template-family-select">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.family_key)}
                        onChange={() => toggleSelection(item.family_key)}
                        aria-label={`Selectionner ${item.family_name}`}
                      />
                      <span className={`status-pill ai-status-${item.status}`}>{statusLabel(item.status)}</span>
                    </div>
                    <button
                      type="button"
                      className="admin-template-family-preview"
                      onClick={() => handleViewDetails(item.family_key, { scroll: true })}
                      onPointerEnter={(event) =>
                        showTemplateHoverPreview(event.currentTarget, item.preview_url, item.family_name, "Aperçu famille")
                      }
                      onPointerLeave={() => setHoverPreview(null)}
                      onFocus={(event) =>
                        showTemplateHoverPreview(event.currentTarget, item.preview_url, item.family_name, "Aperçu famille")
                      }
                      onBlur={() => setHoverPreview(null)}
                      aria-label={`Voir le detail visuel de ${item.family_name}`}
                      aria-pressed={isSelected}
                    >
                      <img
                        alt={`Apercu ${item.family_name}`}
                        src={item.preview_url}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    <div className="admin-template-family-content">
                      <div>
                        <h3>{item.family_name}</h3>
                        <small>{item.post_url ? item.post_url : "post_url non renseigne"}</small>
                      </div>
                      <div className="admin-template-format-badges">
                        <span>{`${item.formats_in_family.length} format(s)`}</span>
                        <span>{formatCoverageLabel(item.formats_in_family)}</span>
                        <span>{canvaSummary.folderUrl ? "Canva OK" : "Canva manquant"}</span>
                      </div>
                      <div className="admin-template-family-meta">
                        <span>{`Propose: ${categoryListLabel(item.suggested_categories, categoryMap)}`}</span>
                        <span>{`Valide: ${categoryListLabel(item.validated_categories, categoryMap)}`}</span>
                      </div>
                      <div className="admin-template-card-actions">
                        <button type="button" onClick={() => handleViewDetails(item.family_key, { scroll: true })}>
                          Voir le détail
                        </button>
                        <select
                          value={categoryDraft}
                          onChange={(event) =>
                            setCategoryDraftByFamilyKey((previous) => ({
                              ...previous,
                              [item.family_key]: event.target.value
                            }))
                          }
                          aria-label={`Categorie pour ${item.family_name}`}
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
                          Valider
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="admin-template-pagination">
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
        </div>

        <aside className="admin-template-detail-panel" aria-label="Detail de la famille selectionnee" ref={detailPanelRef}>
          {selectedFamily ? (
            (() => {
              const item = selectedFamily;
              const categoryDraft = categoryDraftFor(item);
              const canvaSummary = canvaSummaryFor(item);
              const canvaFolderInput = familyCanvaFolderInput[item.family_key] ?? canvaSummary.folderUrl ?? "";
              const canvaFolderFeedback = familyCanvaFolderFeedback[item.family_key] ?? "";

              return (
                <>
                  <div className="admin-template-detail-header">
                    <div>
                      <span className="eyebrow">Famille selectionnee</span>
                      <h2>{item.family_name}</h2>
                      <p>{item.reason || "Aucune raison de classement disponible."}</p>
                    </div>
                    <span className={`status-pill ai-status-${item.status}`}>{statusLabel(item.status)}</span>
                  </div>

                  <figure className="admin-template-detail-main-preview">
                    <img
                      alt={`Apercu grand format ${item.family_name}`}
                      src={item.preview_url}
                      loading="eager"
                      decoding="async"
                    />
                    <figcaption>
                      <strong>Aperçu grand format</strong>
                      <span>{`${item.formats_in_family.length} format(s) disponibles`}</span>
                    </figcaption>
                  </figure>

                  <div className="admin-template-detail-preview-grid">
                    {item.formats_in_family.slice(0, 8).map((format) => (
                      <figure key={`${format.template_id}-${format.format_label}`}>
                        <button
                          type="button"
                          className="admin-template-detail-preview-button"
                          onClick={() => handleViewDetails(item.family_key)}
                          onPointerEnter={(event) =>
                            showTemplateHoverPreview(
                              event.currentTarget,
                              format.preview_url || item.preview_url,
                              format.format_label || format.template_name,
                              item.family_name
                            )
                          }
                          onPointerLeave={() => setHoverPreview(null)}
                          onFocus={(event) =>
                            showTemplateHoverPreview(
                              event.currentTarget,
                              format.preview_url || item.preview_url,
                              format.format_label || format.template_name,
                              item.family_name
                            )
                          }
                          onBlur={() => setHoverPreview(null)}
                          aria-label={`Apercu agrandi ${format.format_label || format.template_name}`}
                        >
                          <img
                            alt={`Apercu ${format.format_label || format.template_name}`}
                            src={format.preview_url || item.preview_url}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                        <figcaption>
                          <strong>{format.format_label || format.template_name}</strong>
                          <span>{format.layout}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>

                  <section className="admin-template-detail-section">
                    <h3>Resume</h3>
                    <dl>
                      <div>
                        <dt>Detecte</dt>
                        <dd>{categoryListLabel(item.detected_categories, categoryMap)}</dd>
                      </div>
                      <div>
                        <dt>Propose</dt>
                        <dd>{categoryListLabel(item.suggested_categories, categoryMap)}</dd>
                      </div>
                      <div>
                        <dt>Valide</dt>
                        <dd>{categoryListLabel(item.validated_categories, categoryMap)}</dd>
                      </div>
                      <div>
                        <dt>Formats</dt>
                        <dd>{`${item.formats_in_family.length} format(s) - ${formatCoverageLabel(item.formats_in_family)}`}</dd>
                      </div>
                      <div>
                        <dt>Canva</dt>
                        <dd>{`${canvaSummary.folderUrl ? "Dossier global disponible" : "Dossier global manquant"} - ${canvaSummary.formatLinksAvailable} / ${canvaSummary.totalFormats} liens formats`}</dd>
                      </div>
                      <div>
                        <dt>Derniere mise a jour</dt>
                        <dd>{item.updated_at ? new Date(item.updated_at).toLocaleString("fr-FR") : "Non disponible"}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="admin-template-detail-section">
                    <h3>Categorie</h3>
                    <div className="admin-template-category-editor">
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
                          <option key={`detail-${item.family_key}-${category.id}`} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-template-action-group">
                      <button type="button" disabled={saving} onClick={() => void mutate("validate_suggestion", { family_key: item.family_key })}>
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
                      <button type="button" disabled={saving} onClick={() => void mutate("revalidate_family", { family_key: item.family_key })}>
                        Revalider cette famille
                      </button>
                      <button type="button" disabled={saving} onClick={() => void mutate("ignore", { family_key: item.family_key })}>
                        Ignorer
                      </button>
                    </div>
                  </section>

                  <section className="admin-template-detail-section">
                    <h3>Canva</h3>
                    <div className="admin-template-canva-row">
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
                        {familyCanvaFolderSavingKey === item.family_key ? "Enregistrement..." : "Enregistrer dossier Canva"}
                      </button>
                    </div>
                    {canvaFolderFeedback ? <p className="admin-template-feedback">{canvaFolderFeedback}</p> : null}
                  </section>

                  <section className="admin-template-detail-section">
                    <h3>Sources</h3>
                    <div className="admin-template-source-list">
                      <span>{item.family_key}</span>
                      {item.post_url ? (
                        <a href={item.post_url} target="_blank" rel="noopener noreferrer">
                          Ouvrir TemplateBooth
                        </a>
                      ) : (
                        <span>TemplateBooth non renseigne</span>
                      )}
                      {item.validated_at ? <span>{`Valide le ${new Date(item.validated_at).toLocaleString("fr-FR")}`}</span> : null}
                    </div>
                  </section>
                </>
              );
            })()
          ) : (
            <div className="empty-state admin-template-empty-state">
              <strong>Aucune famille selectionnee.</strong>
              <span>Chargez ou recherchez des familles templates pour afficher le detail.</span>
            </div>
          )}
        </aside>
      </section>

      {hoverPreview ? (
        <div
          className="admin-template-visual-preview"
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
          aria-hidden="true"
        >
          <img src={hoverPreview.src} alt="" />
          <div>
            <strong>{hoverPreview.title}</strong>
            <span>{hoverPreview.subtitle}</span>
          </div>
        </div>
      ) : null}
    </main>
  );
}
