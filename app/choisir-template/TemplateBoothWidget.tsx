"use client";

import { useMemo, useState } from "react";

type EventPicFormat = {
  id: string;
  label: string;
  badge: string;
  query: Array<[string, string]>;
};

type TemplateBoothCategoryFilter = {
  key: "category" | "tag" | "search";
  value: string;
};

type EventPicCategory = {
  id: string;
  label: string;
  filter?: TemplateBoothCategoryFilter;
};

const EVENT_PIC_FORMATS: EventPicFormat[] = [
  {
    id: "vertical-2x6",
    label: "Bande verticale 2x6",
    badge: "2x6",
    query: [["layout", "26strip"]]
  },
  {
    id: "portrait-4x6",
    label: "Portrait 10x15 / 4x6",
    badge: "4x6 portrait",
    query: [["layout", "46postcard-p"]]
  },
  {
    id: "landscape-4x6",
    label: "Paysage 10x15 / 4x6",
    badge: "4x6 paysage",
    query: [["layout", "46postcard-l"]]
  }
];

const EVENT_PIC_CATEGORIES: EventPicCategory[] = [
  { id: "all", label: "Tous" },
  { id: "mariage", label: "Mariage", filter: { key: "category", value: "Wedding" } },
  { id: "anniversaire", label: "Anniversaire", filter: { key: "category", value: "Birthday" } },
  { id: "bapteme", label: "Bapteme", filter: { key: "category", value: "Religious" } },
  { id: "baby-shower", label: "Baby shower", filter: { key: "category", value: "Baby Shower" } },
  { id: "gender-reveal", label: "Gender reveal", filter: { key: "search", value: "Gender Reveal" } },
  { id: "soiree-privee", label: "Soiree privee", filter: { key: "category", value: "Nightlife" } },
  { id: "entreprise", label: "Entreprise", filter: { key: "category", value: "Corporate" } },
  { id: "noel", label: "Noel", filter: { key: "category", value: "Christmas" } },
  { id: "nouvel-an", label: "Nouvel An", filter: { key: "category", value: "New Year's Eve" } },
  { id: "communion", label: "Communion", filter: { key: "category", value: "Religious" } },
  { id: "fiancailles", label: "Fiancailles", filter: { key: "search", value: "Engagement" } }
];

const TEMPLATEBOOTH_FILTER_KEYS = [
  "layout",
  "type",
  "image_type",
  "no_of_images",
  "category",
  "tag",
  "tags",
  "search",
  "text_display"
];

function buildFilteredWidgetUrl(widgetUrl: string, format: EventPicFormat, category: EventPicCategory) {
  if (!widgetUrl) {
    return "";
  }

  try {
    const url = new URL(widgetUrl);

    for (const key of TEMPLATEBOOTH_FILTER_KEYS) {
      url.searchParams.delete(key);
    }

    for (const [key, value] of format.query) {
      url.searchParams.append(key, value);
    }

    if (category.filter) {
      // URLSearchParams gere l'encodage automatiquement.
      url.searchParams.set(category.filter.key, category.filter.value);
    }

    return url.toString();
  } catch {
    return widgetUrl;
  }
}

export function TemplateBoothWidget({ widgetUrl }: { widgetUrl: string }) {
  const [selectedFormatId, setSelectedFormatId] = useState(EVENT_PIC_FORMATS[0].id);
  const [selectedCategoryId, setSelectedCategoryId] = useState(EVENT_PIC_CATEGORIES[0].id);
  const selectedFormat = EVENT_PIC_FORMATS.find((format) => format.id === selectedFormatId) ?? EVENT_PIC_FORMATS[0];
  const selectedCategory =
    EVENT_PIC_CATEGORIES.find((category) => category.id === selectedCategoryId) ?? EVENT_PIC_CATEGORIES[0];
  const filteredWidgetUrl = useMemo(
    () => buildFilteredWidgetUrl(widgetUrl, selectedFormat, selectedCategory),
    [widgetUrl, selectedFormat, selectedCategory]
  );

  return (
    <>
      <section className="format-reminder" aria-labelledby="formats-title">
        <div className="section-heading">
          <p>Formats Event Pic</p>
          <h2 id="formats-title">Choisissez votre format</h2>
        </div>
        <div className="format-reminder-grid" role="group" aria-label="Filtres de formats Event Pic">
          {EVENT_PIC_FORMATS.map((format) => (
            <button
              className={format.id === selectedFormatId ? "format-filter-button is-active" : "format-filter-button"}
              key={format.id}
              onClick={() => setSelectedFormatId(format.id)}
              type="button"
            >
              <span>{format.badge}</span>
              {format.label}
            </button>
          ))}
        </div>
      </section>

      <section className="category-filter-panel" aria-labelledby="categories-title">
        <div className="section-heading">
          <p>Recherche par theme</p>
          <h2 id="categories-title">Categorie</h2>
        </div>
        <div className="category-segment-list" role="group" aria-label="Filtres de categories Event Pic">
          {EVENT_PIC_CATEGORIES.map((category) => (
            <button
              className={category.id === selectedCategoryId ? "category-segment-button is-active" : "category-segment-button"}
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="widget-frame-section" aria-label="Widget de choix de template">
        <div className="widget-frame-heading">
          <div>
            <p className="eyebrow">Selection du design</p>
            <h2>{selectedFormat.label}</h2>
          </div>
          <p>Choisissez un design photo, completez le formulaire, puis validez votre demande sans quitter Event Pic.</p>
        </div>
        {filteredWidgetUrl ? (
          <div className="templatebooth-widget-crop">
            {/* Les filtres TemplateBooth sont masques par recadrage car le widget est dans une iframe externe. */}
            <iframe
              className="templatebooth-widget-frame"
              key={filteredWidgetUrl}
              src={filteredWidgetUrl}
              title={`Choix de template Event Pic - ${selectedFormat.label}`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write; fullscreen"
            />
          </div>
        ) : (
          <div className="widget-config-empty">
            <p className="eyebrow">Configuration</p>
            <h2>Widget en cours de configuration</h2>
            <p>L'espace de choix de template apparaitra ici des que l'URL publique du widget sera ajoutee.</p>
          </div>
        )}
      </section>
    </>
  );
}

