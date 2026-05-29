"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import {
  EVENT_PIC_OPTIONS,
  EVENT_PIC_PHOTOBOOTH_PACKAGES,
  EventPicContactRequest,
  EventPicQuoteRequest,
  EventPicQuoteStatus,
  type DeliveryDistanceStatus,
  formatEventPicOptions
} from "@/src/shared/eventPicPublic";

type AdminDevisResponse = {
  ok?: boolean;
  quote_requests?: EventPicQuoteRequest[];
  contact_requests?: EventPicContactRequest[];
  error?: string;
};

type AdminDevisCreateResponse = {
  ok?: boolean;
  quote_request?: EventPicQuoteRequest;
  message?: string;
  error?: string;
};

type AdminDeliveryEstimateResponse = {
  ok?: boolean;
  estimate?: {
    distance_status: DeliveryDistanceStatus;
    availability_status?: DeliveryDistanceStatus;
    distance_message: string;
    delivery_fee: number | null;
    fee_label: string;
    distance_km: number | null;
    travel_time_minutes: number | null;
    recommended_driver_id: string;
    recommended_driver_name: string;
    driver_start_address: string;
    available_drivers_count: number;
    estimated_total_without_delivery: number;
    estimated_total_with_delivery: number;
  };
  error?: string;
};

type AdminDevisItem = {
  source: "quote" | "contact";
  key: string;
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date: string;
  event_address: string;
  package_id: string;
  package_label: string;
  option_ids: string[];
  options: string[];
  guest_count: number | null;
  amount: number | null;
  delivery_fee: number | null;
  deposit: number | null;
  balance: number | null;
  message: string;
  status: EventPicQuoteStatus;
};

type QuoteLine = {
  id: string;
  label: string;
  description: string;
  amount: string;
};

type QuoteDraft = {
  templateId: QuoteTemplateId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  eventAddress: string;
  guestCount: string;
  packageId: string;
  customPackageAmount: string;
  optionIds: string[];
  deliveryFee: string;
  discount: string;
  deposit: string;
  status: EventPicQuoteStatus;
  internalNotes: string;
  clientMessage: string;
  customLines: QuoteLine[];
};

type QuoteTemplate = {
  id: string;
  label: string;
  audience: string;
  defaultEventType: string;
  defaultPackageId: string;
  suggestedOptionIds: readonly string[];
  intro: string;
  includedLines: readonly string[];
  conclusion: string;
  conditions: readonly string[];
  customLines?: readonly QuoteLine[];
};

type QuotePreview = {
  packageAmount: number;
  optionsTotal: number;
  customLinesTotal: number;
  deliveryFee: number;
  discount: number;
  deposit: number;
  totalWithoutDelivery: number;
  total: number;
  balance: number;
};

type DeliveryEstimateState = {
  status: "empty" | "incomplete" | "estimating" | "calculated" | "manual_required" | "no_driver_available" | "error";
  message: string;
  deliveryFee: number | null;
  distanceKm: number | null;
  travelTimeMinutes: number | null;
  feeLabel: string;
  driverName: string;
  driverAddress: string;
};

type FormulaGuidance = {
  tone: "advice" | "soft";
  message: string;
  estimatedPrintsNeed: number;
  recommendedLabel: string;
};

const QUOTE_STATUSES: Array<{ id: EventPicQuoteStatus; label: string; tone: string }> = [
  { id: "new", label: "Brouillon", tone: "draft" },
  { id: "a_traiter", label: "Prêt à envoyer", tone: "ready" },
  { id: "devis_envoye", label: "Envoyé", tone: "sent" },
  { id: "gagne", label: "Accepté", tone: "won" },
  { id: "perdu", label: "Refusé", tone: "lost" },
  { id: "expire", label: "Expiré", tone: "expired" }
];

const QUOTE_TEMPLATES = [
  {
    id: "private-event",
    label: "Mariage / anniversaire / événement privé",
    audience: "Privé",
    defaultEventType: "Mariage",
    defaultPackageId: "400-impressions",
    suggestedOptionIds: ["livre-audio", "fond-photo"],
    intro: "Une prestation photobooth premium pour créer une animation élégante et des souvenirs personnalisés.",
    includedLines: [
      "Location photobooth premium",
      "Installation et reprise sur place",
      "Personnalisation du cadre photo et de l’écran d’accueil",
      "Galerie numérique après événement",
      "Accessoires festifs"
    ],
    conclusion: "La date est bloquée après validation du devis et acompte.",
    conditions: ["Acompte conseillé : 100 €", "Solde selon devis", "Disponibilité confirmée après validation"]
  },
  {
    id: "business-event",
    label: "Entreprise / séminaire",
    audience: "Corporate",
    defaultEventType: "Entreprise",
    defaultPackageId: "500-impressions",
    suggestedOptionIds: ["jbl-partybox-310", "fond-photo"],
    intro: "Une animation photobooth soignée, personnalisée à votre image et simple à déployer sur site.",
    includedLines: [
      "Borne photobooth avec écran tactile",
      "Installation, tests et reprise",
      "Cadre photo personnalisé aux couleurs de l’entreprise",
      "Galerie numérique exploitable après événement",
      "Assistance Event Pic"
    ],
    conclusion: "Le devis peut être adapté selon les horaires, l’accès au site et le volume d’invités.",
    conditions: ["Tarif entreprise à confirmer selon contexte", "Facture fournie", "Frais de déplacement confirmés au devis"]
  },
  {
    id: "school-association",
    label: "École / association",
    audience: "Scolaire",
    defaultEventType: "École / association",
    defaultPackageId: "300-impressions",
    suggestedOptionIds: ["fond-photo"],
    intro: "Une animation conviviale et clé en main pour votre événement scolaire ou associatif.",
    includedLines: [
      "Borne photobooth installée sur place",
      "Impressions selon la formule choisie",
      "Cadre photo personnalisé au nom de l’événement",
      "Galerie numérique",
      "Accompagnement avant l’événement"
    ],
    conclusion: "La formule peut être ajustée selon le nombre de familles attendues.",
    conditions: ["Acompte conseillé : 100 €", "Horaires à confirmer", "Accès électrique nécessaire"]
  },
  {
    id: "public-sector",
    label: "Collectivité / mairie",
    audience: "Institutionnel",
    defaultEventType: "Collectivité / mairie",
    defaultPackageId: "500-impressions",
    suggestedOptionIds: ["fond-photo", "jbl-partybox-310"],
    intro: "Une animation adaptée aux événements publics, cérémonies, inaugurations et animations locales.",
    includedLines: [
      "Photobooth premium en libre accès",
      "Installation et tests avant ouverture au public",
      "Cadre photo personnalisé",
      "Galerie numérique",
      "Coordination logistique avec vos équipes"
    ],
    conclusion: "La proposition reste ajustable selon le lieu, les horaires et les contraintes d’installation.",
    conditions: ["Devis sur mesure selon accès", "Frais de déplacement confirmés", "Facture fournie"]
  },
  {
    id: "simple-pack",
    label: "Pack photobooth simple",
    audience: "Essentiel",
    defaultEventType: "Événement privé",
    defaultPackageId: "sans-impression",
    suggestedOptionIds: [],
    intro: "Une animation simple, élégante et digitale, sans impression papier.",
    includedLines: ["Location photobooth premium", "Photos numériques illimitées", "Galerie numérique", "Installation et reprise"],
    conclusion: "Cette formule peut évoluer vers une formule avec impressions si besoin.",
    conditions: ["Acompte conseillé : 100 €", "Sans impression papier", "Galerie numérique incluse"]
  },
  {
    id: "audio-guestbook-pack",
    label: "Pack photobooth + livre d’or audio",
    audience: "Souvenir",
    defaultEventType: "Mariage",
    defaultPackageId: "400-impressions",
    suggestedOptionIds: ["livre-audio", "fond-photo"],
    intro: "Une proposition qui associe photobooth premium et livre d’or audio vintage.",
    includedLines: [
      "Photobooth premium avec impressions selon formule",
      "Livre d’or audio vintage",
      "Personnalisation du cadre photo",
      "Galerie numérique",
      "Installation et reprise"
    ],
    conclusion: "Le livre d’or audio ajoute une dimension émotionnelle complémentaire aux photos.",
    conditions: ["Acompte conseillé : 100 €", "Messages audio remis après événement", "Options ajustables"]
  },
  {
    id: "jbl-pack",
    label: "Pack photobooth + JBL / sonorisation",
    audience: "Ambiance",
    defaultEventType: "Soirée privée",
    defaultPackageId: "500-impressions",
    suggestedOptionIds: ["jbl-partybox-310", "micro-sans-fil"],
    intro: "Une solution avec JBL PartyBox et micro sans fil pour renforcer l’ambiance autour du photobooth.",
    includedLines: ["Photobooth premium", "Enceinte JBL PartyBox 310", "Micro sans fil", "Installation et reprise", "Cadre photo personnalisé"],
    conclusion: "La sonorisation est adaptée aux animations, discours et temps forts.",
    conditions: ["Acompte conseillé : 100 €", "Puissance sonore selon lieu", "À confirmer selon horaires"]
  },
  {
    id: "free-quote",
    label: "Devis libre",
    audience: "Sur mesure",
    defaultEventType: "Autre",
    defaultPackageId: "illimitee",
    suggestedOptionIds: [],
    intro: "Une trame libre pour préparer une proposition sur mesure.",
    includedLines: ["Prestation personnalisée", "Coordination Event Pic", "Préparation selon besoin client"],
    conclusion: "Les montants sont à renseigner manuellement avant envoi au client.",
    conditions: ["Tarif sur devis", "Acompte à définir", "Conditions à préciser"],
    customLines: [{ id: "free-line", label: "Prestation sur mesure", description: "À détailler", amount: "0" }]
  }
] as const satisfies readonly QuoteTemplate[];

type QuoteTemplateId = (typeof QUOTE_TEMPLATES)[number]["id"];

const DEFAULT_TEMPLATE_ID: QuoteTemplateId = "private-event";
const PACKAGE_PRINT_RANKS: Record<string, { rank: number; label: string; prints: number | null }> = {
  "sans-impression": { rank: 0, label: "Sans impression", prints: 0 },
  "300-impressions": { rank: 1, label: "300 impressions", prints: 300 },
  "400-impressions": { rank: 2, label: "400 impressions", prints: 400 },
  "500-impressions": { rank: 3, label: "500 impressions", prints: 500 },
  "700-impressions": { rank: 4, label: "700 impressions", prints: 700 },
  illimitee: { rank: 5, label: "Impression illimitée / sur devis", prints: null }
};
const JBL_310_OPTION_ID = "jbl-partybox-310";
const JBL_710_OPTION_ID = "jbl-partybox-710";
const JBL_MIC_OPTION_ID = "micro-sans-fil";
const JBL_PACK_PRICE = 100;
const JBL_PACK_REGULAR_SPEAKERS_PRICE = 120;
const JBL_MIC_REGULAR_PRICE = 10;
const EMPTY_DELIVERY_ESTIMATE: DeliveryEstimateState = {
  status: "empty",
  message: "Renseignez une adresse événement pour estimer les frais de déplacement.",
  deliveryFee: null,
  distanceKm: null,
  travelTimeMinutes: null,
  feeLabel: "À confirmer",
  driverName: "",
  driverAddress: ""
};
const packageById: Map<string, (typeof EVENT_PIC_PHOTOBOOTH_PACKAGES)[number]> = new Map(
  EVENT_PIC_PHOTOBOOTH_PACKAGES.map((item) => [item.id, item])
);
const optionById: Map<string, (typeof EVENT_PIC_OPTIONS)[number]> = new Map(
  EVENT_PIC_OPTIONS.map((item) => [item.id, item])
);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneLines(lines: readonly QuoteLine[] | undefined) {
  return (lines ?? []).map((line) => ({ ...line, id: createLineId() }));
}

function getTemplate(id: string): QuoteTemplate {
  return QUOTE_TEMPLATES.find((template) => template.id === id) ?? QUOTE_TEMPLATES[0];
}

function createDraftFromTemplate(templateId: QuoteTemplateId = DEFAULT_TEMPLATE_ID): QuoteDraft {
  const template = getTemplate(templateId);
  return {
    templateId,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    eventType: template.defaultEventType,
    eventDate: "",
    eventAddress: "",
    guestCount: "",
    packageId: template.defaultPackageId,
    customPackageAmount: "",
    optionIds: [...template.suggestedOptionIds],
    deliveryFee: "",
    discount: "",
    deposit: "100",
    status: "new",
    internalNotes: "",
    clientMessage: template.conclusion,
    customLines: cloneLines(template.customLines)
  };
}

function parseMoney(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function parseGuestCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRecommendedFormulaByPrintNeed(estimatedPrintsNeed: number) {
  if (estimatedPrintsNeed <= 300) return PACKAGE_PRINT_RANKS["300-impressions"];
  if (estimatedPrintsNeed <= 400) return PACKAGE_PRINT_RANKS["400-impressions"];
  if (estimatedPrintsNeed <= 500) return PACKAGE_PRINT_RANKS["500-impressions"];
  if (estimatedPrintsNeed <= 700) return PACKAGE_PRINT_RANKS["700-impressions"];
  return PACKAGE_PRINT_RANKS.illimitee;
}

function buildQuoteFormulaGuidance(guestCountValue: string, packageId: string): FormulaGuidance | null {
  const guestCount = parseGuestCount(guestCountValue);
  if (!guestCount) return null;

  const selectedFormula = PACKAGE_PRINT_RANKS[packageId] ?? PACKAGE_PRINT_RANKS["400-impressions"];
  if (selectedFormula.rank >= PACKAGE_PRINT_RANKS.illimitee.rank) return null;

  const estimatedPrintsNeed = guestCount * 5;
  const recommendedFormula = getRecommendedFormulaByPrintNeed(estimatedPrintsNeed);

  if (selectedFormula.rank === 0) {
    return {
      tone: "soft",
      estimatedPrintsNeed,
      recommendedLabel: recommendedFormula.label,
      message: `Vous avez choisi une formule sans impression. Pour environ ${guestCount} invités, une formule avec impressions peut être plus adaptée si vous souhaitez offrir des tirages papier.`
    };
  }

  if (selectedFormula.rank < recommendedFormula.rank) {
    return {
      tone: "advice",
      estimatedPrintsNeed,
      recommendedLabel: recommendedFormula.label,
      message: `Attention : pour environ ${guestCount} invités, nous recommandons plutôt la formule ${recommendedFormula.label} afin de prévoir suffisamment de tirages pendant l’événement.`
    };
  }

  return null;
}

function looksLikeAmbiguousStreetAddress(value: string) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return false;
  const hasStreetNumber = /\b\d{1,4}\b/.test(normalized);
  const hasStreetKeyword = /\b(rue|avenue|av\.?|boulevard|bd|chemin|all[ée]e|route|impasse|place|cours|quai)\b/i.test(normalized);
  const hasCityOrPostalHint = /,|\b\d{5}\b|\bfrance\b/i.test(normalized);
  return hasStreetNumber && hasStreetKeyword && !hasCityOrPostalHint;
}

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR");
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function getStatusMeta(status: EventPicQuoteStatus) {
  return QUOTE_STATUSES.find((item) => item.id === status) ?? QUOTE_STATUSES[0];
}

function splitName(value: string) {
  const parts = cleanText(value).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function optionDisplayLabel(label: string) {
  return label === "Fond photo" ? "Décor photo / fond photo" : label;
}

function packageIdFromLabel(label: string) {
  const normalized = cleanText(label).toLowerCase();
  return EVENT_PIC_PHOTOBOOTH_PACKAGES.find((item) => item.label.toLowerCase() === normalized)?.id ?? "400-impressions";
}

function isJblPackActive(optionIds: readonly string[]) {
  return optionIds.includes(JBL_310_OPTION_ID) && optionIds.includes(JBL_710_OPTION_ID);
}

function computeOptionsTotal(optionIds: readonly string[]) {
  if (!isJblPackActive(optionIds)) {
    return optionIds.reduce((sum, optionId) => sum + (optionById.get(optionId)?.price ?? 0), 0);
  }

  return optionIds.reduce((sum, optionId) => {
    if (optionId === JBL_310_OPTION_ID || optionId === JBL_710_OPTION_ID || optionId === JBL_MIC_OPTION_ID) {
      return sum;
    }
    return sum + (optionById.get(optionId)?.price ?? 0);
  }, JBL_PACK_PRICE);
}

function itemFromQuote(item: EventPicQuoteRequest): AdminDevisItem {
  return {
    source: "quote",
    key: `quote:${item.id}`,
    id: item.id,
    created_at: item.created_at,
    name: item.name,
    email: item.email,
    phone: item.phone,
    event_type: item.event_type,
    event_date: item.event_date,
    event_address: item.event_address || "",
    package_id: item.package_id || packageIdFromLabel(item.package),
    package_label: item.package || "-",
    option_ids: item.option_ids ?? [],
    options: item.options ?? [],
    guest_count: null,
    amount: item.estimated_total_with_delivery || item.estimated_total || null,
    delivery_fee: typeof item.delivery_fee === "number" ? item.delivery_fee : null,
    deposit: typeof item.deposit === "number" ? item.deposit : 100,
    balance: typeof item.estimated_balance === "number" ? item.estimated_balance : null,
    message: item.message,
    status: item.status
  };
}

function itemFromContact(item: EventPicContactRequest): AdminDevisItem {
  return {
    source: "contact",
    key: `contact:${item.id}`,
    id: item.id,
    created_at: item.created_at,
    name: item.name,
    email: item.email,
    phone: item.phone,
    event_type: item.event_type,
    event_date: item.event_date,
    event_address: item.event_address || "",
    package_id: packageIdFromLabel(item.selected_formula || ""),
    package_label: item.selected_formula || "À définir",
    option_ids: [],
    options: [],
    guest_count: typeof item.guest_count === "number" ? item.guest_count : null,
    amount: null,
    delivery_fee: null,
    deposit: null,
    balance: null,
    message: item.message,
    status: item.status
  };
}

function computePreview(draft: QuoteDraft): QuotePreview {
  const selectedPackage = packageById.get(draft.packageId) ?? EVENT_PIC_PHOTOBOOTH_PACKAGES[0];
  const packageAmount = selectedPackage.price === null ? parseMoney(draft.customPackageAmount) : selectedPackage.price;
  const optionsTotal = computeOptionsTotal(draft.optionIds);
  const customLinesTotal = draft.customLines.reduce((sum, line) => sum + parseMoney(line.amount), 0);
  const deliveryFee = parseMoney(draft.deliveryFee);
  const discount = Math.min(parseMoney(draft.discount), packageAmount + optionsTotal + customLinesTotal);
  const deposit = parseMoney(draft.deposit) || 100;
  const totalWithoutDelivery = Math.max(packageAmount + optionsTotal + customLinesTotal - discount, 0);
  const total = Math.max(totalWithoutDelivery + deliveryFee, 0);
  return { packageAmount, optionsTotal, customLinesTotal, deliveryFee, discount, deposit, totalWithoutDelivery, total, balance: Math.max(total - deposit, 0) };
}

function buildPersistedMessage(draft: QuoteDraft, preview: QuotePreview) {
  const template = getTemplate(draft.templateId);
  const packSummary = isJblPackActive(draft.optionIds)
    ? "Pack JBL PartyBox 310 + 710 : 100 EUR au lieu de 120 EUR. Micro sans fil offert : 0 EUR (valeur habituelle 10 EUR)."
    : "";
  const customLines = draft.customLines
    .map((line) => `${line.label}${line.amount ? ` (${formatMoney(parseMoney(line.amount))})` : ""} - ${line.description}`)
    .join("\n");
  return [
    `Trame : ${template.label}`,
    `Introduction : ${template.intro}`,
    `Lignes incluses : ${template.includedLines.join(" | ")}`,
    packSummary,
    customLines ? `Lignes personnalisées :\n${customLines}` : "",
    `Message client : ${draft.clientMessage}`,
    `Conditions : ${template.conditions.join(" | ")}`,
    `Nombre d'invités : ${draft.guestCount || "non renseigné"}`,
    `Remise : ${formatMoney(preview.discount)}`,
    `Notes internes : ${draft.internalNotes || "-"}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function AdminDevisPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<EventPicQuoteRequest[]>([]);
  const [contacts, setContacts] = useState<EventPicContactRequest[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<QuoteDraft>(() => createDraftFromTemplate());
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimateState>(EMPTY_DELIVERY_ESTIMATE);
  const autoDeliveryFeeRef = useRef<string | null>(null);
  const [panelMode, setPanelMode] = useState<"create" | "preview">("create");

  const items = useMemo<AdminDevisItem[]>(
    () => [...quotes.map(itemFromQuote), ...contacts.map(itemFromContact)].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [contacts, quotes]
  );
  const selectedItem = useMemo(() => items.find((item) => item.key === selectedKey) ?? items[0] ?? null, [items, selectedKey]);
  const preview = useMemo(() => computePreview(draft), [draft]);
  const selectedTemplate = getTemplate(draft.templateId);
  const selectedPackage = packageById.get(draft.packageId) ?? EVENT_PIC_PHOTOBOOTH_PACKAGES[0];
  const formulaGuidance = useMemo(
    () => buildQuoteFormulaGuidance(draft.guestCount, draft.packageId),
    [draft.guestCount, draft.packageId]
  );
  const deliveryEstimateDetails = useMemo(() => {
    if (deliveryEstimate.status !== "calculated") return "";
    const parts = [
      deliveryEstimate.distanceKm !== null ? `${deliveryEstimate.distanceKm} km estimés` : "",
      deliveryEstimate.travelTimeMinutes !== null ? `${deliveryEstimate.travelTimeMinutes} min` : "",
      deliveryEstimate.driverName ? `base retenue : ${deliveryEstimate.driverName}` : "",
      deliveryEstimate.deliveryFee !== null ? `frais : ${formatMoney(deliveryEstimate.deliveryFee)}` : ""
    ].filter(Boolean);
    return parts.join(" · ");
  }, [deliveryEstimate]);

  const kpis = useMemo(() => {
    const totalPotential = quotes.reduce((sum, quote) => sum + (quote.estimated_total_with_delivery || quote.estimated_total || 0), 0);
    return [
      { label: "Demandes à suivre", value: String(items.length), detail: `${quotes.length} devis · ${contacts.length} contacts` },
      { label: "Brouillons", value: String(items.filter((item) => item.status === "new").length), detail: "À préparer" },
      { label: "Prêts / envoyés", value: String(items.filter((item) => item.status === "a_traiter" || item.status === "devis_envoye").length), detail: "Suivi actif" },
      { label: "Acceptés", value: String(items.filter((item) => item.status === "gagne").length), detail: "À transformer en dossier" },
      { label: "Refusés / expirés", value: String(items.filter((item) => item.status === "perdu" || item.status === "expire").length), detail: "À archiver" },
      { label: "Potentiel", value: formatMoney(totalPotential), detail: "Montants disponibles" }
    ];
  }, [contacts.length, items, quotes]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedKey && items[0]) setSelectedKey(items[0].key);
  }, [items, selectedKey]);

  useEffect(() => {
    const eventAddress = cleanText(draft.eventAddress);
    if (!eventAddress) {
      setDeliveryEstimate(EMPTY_DELIVERY_ESTIMATE);
      setDraft((current) => {
        if (!autoDeliveryFeeRef.current || current.deliveryFee !== autoDeliveryFeeRef.current) return current;
        autoDeliveryFeeRef.current = null;
        return { ...current, deliveryFee: "" };
      });
      return;
    }

    if (looksLikeAmbiguousStreetAddress(eventAddress)) {
      setDeliveryEstimate({
        status: "incomplete",
        message: "Adresse à préciser : ajoutez la ville ou le code postal avant de calculer les frais.",
        deliveryFee: null,
        distanceKm: null,
        travelTimeMinutes: null,
        feeLabel: "À confirmer",
        driverName: "",
        driverAddress: ""
      });
      setDraft((current) => {
        if (!autoDeliveryFeeRef.current || current.deliveryFee !== autoDeliveryFeeRef.current) return current;
        autoDeliveryFeeRef.current = null;
        return { ...current, deliveryFee: "" };
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setDeliveryEstimate((current) => ({
        ...current,
        status: "estimating",
        message: "Calcul automatique des frais de déplacement en cours..."
      }));

      void fetch("/api/admin/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "estimate_delivery",
          event_address: eventAddress,
          event_date: draft.eventDate,
          booth_quantity: 1,
          estimated_total_without_delivery: preview.totalWithoutDelivery
        })
      })
        .then(async (response) => {
          const payload = (await response.json()) as AdminDeliveryEstimateResponse;
          if (!response.ok || !payload.ok || !payload.estimate) {
            throw new Error(payload.error || "Calcul des frais de déplacement impossible.");
          }
          const estimate = payload.estimate;
          if (estimate.distance_status === "calculated" && typeof estimate.delivery_fee === "number") {
            const nextFee = String(estimate.delivery_fee);
            autoDeliveryFeeRef.current = nextFee;
            setDraft((current) => (current.deliveryFee === nextFee ? current : { ...current, deliveryFee: nextFee }));
            setDeliveryEstimate({
              status: "calculated",
              message: "Frais de déplacement calculés automatiquement.",
              deliveryFee: estimate.delivery_fee,
              distanceKm: estimate.distance_km,
              travelTimeMinutes: estimate.travel_time_minutes,
              feeLabel: estimate.fee_label,
              driverName: estimate.recommended_driver_name,
              driverAddress: estimate.driver_start_address
            });
            return;
          }

          setDeliveryEstimate({
            status: estimate.distance_status === "no_driver_available" ? "no_driver_available" : "manual_required",
            message: estimate.distance_message || "Frais de déplacement à confirmer.",
            deliveryFee: null,
            distanceKm: null,
            travelTimeMinutes: null,
            feeLabel: "À confirmer",
            driverName: estimate.recommended_driver_name,
            driverAddress: estimate.driver_start_address
          });
          setDraft((current) => {
            if (!autoDeliveryFeeRef.current || current.deliveryFee !== autoDeliveryFeeRef.current) return current;
            autoDeliveryFeeRef.current = null;
            return { ...current, deliveryFee: "" };
          });
        })
        .catch((estimateError) => {
          if (controller.signal.aborted) return;
          setDeliveryEstimate({
            status: "error",
            message:
              estimateError instanceof Error
                ? estimateError.message
                : "Frais de déplacement à confirmer.",
            deliveryFee: null,
            distanceKm: null,
            travelTimeMinutes: null,
            feeLabel: "À confirmer",
            driverName: "",
            driverAddress: ""
          });
        });
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draft.eventAddress, draft.eventDate, preview.totalWithoutDelivery]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/devis", { cache: "no-store" });
      const payload = (await response.json()) as AdminDevisResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Chargement des devis impossible.");
      setQuotes(payload.quote_requests ?? []);
      setContacts(payload.contact_requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  function applyTemplate(templateId: QuoteTemplateId) {
    const nextDraft = createDraftFromTemplate(templateId);
    setDraft((current) => ({
      ...nextDraft,
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
      phone: current.phone,
      eventDate: current.eventDate,
      eventAddress: current.eventAddress,
      guestCount: current.guestCount,
      deliveryFee: current.deliveryFee,
      discount: current.discount,
      deposit: current.deposit || nextDraft.deposit,
      internalNotes: current.internalNotes
    }));
  }

  function startManualQuote() {
    setDraft(createDraftFromTemplate());
    setPanelMode("create");
    setMessage(null);
    setError(null);
  }

  function prefillFromItem(item: AdminDevisItem) {
    const nameParts = splitName(item.name);
    setDraft((current) => ({
      ...current,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: item.email,
      phone: item.phone,
      eventType: item.event_type || current.eventType,
      eventDate: item.event_date,
      eventAddress: item.event_address,
      guestCount: item.guest_count ? String(item.guest_count) : current.guestCount,
      packageId: item.package_id || current.packageId,
      customPackageAmount: item.package_id === "illimitee" && item.amount ? String(Math.max(item.amount - (item.delivery_fee ?? 0), 0)) : current.customPackageAmount,
      optionIds: item.option_ids,
      deliveryFee: item.delivery_fee ? String(item.delivery_fee) : current.deliveryFee,
      deposit: item.deposit ? String(item.deposit) : current.deposit,
      status: item.status,
      clientMessage: item.message || current.clientMessage,
      internalNotes: item.source === "contact" ? "Créé depuis une demande contact." : "Dupliqué depuis une demande devis."
    }));
    setPanelMode("create");
  }

  function updateDraft<K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateDeliveryFee(value: string) {
    autoDeliveryFeeRef.current = null;
    setDraft((current) => ({ ...current, deliveryFee: value }));
    if (cleanText(value)) {
      setDeliveryEstimate((current) => ({
        ...current,
        message: "Frais de déplacement saisis manuellement.",
        deliveryFee: parseMoney(value),
        feeLabel: "Saisie manuelle"
      }));
    }
  }

  function toggleOption(optionId: string) {
    setDraft((current) => ({
      ...current,
      optionIds: current.optionIds.includes(optionId)
        ? current.optionIds.filter((id) => id !== optionId)
        : [...current.optionIds, optionId]
    }));
  }

  function addCustomLine() {
    setDraft((current) => ({
      ...current,
      customLines: [...current.customLines, { id: createLineId(), label: "Ligne personnalisée", description: "", amount: "0" }]
    }));
  }

  function updateCustomLine(id: string, updates: Partial<QuoteLine>) {
    setDraft((current) => ({
      ...current,
      customLines: current.customLines.map((line) => (line.id === id ? { ...line, ...updates } : line))
    }));
  }

  function removeCustomLine(id: string) {
    setDraft((current) => ({ ...current, customLines: current.customLines.filter((line) => line.id !== id) }));
  }

  async function createManualQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("create");
    setMessage(null);
    setError(null);
    const fullName = `${draft.firstName} ${draft.lastName}`.trim();
    if (!fullName || !draft.email || !draft.phone || !draft.eventType) {
      setError("Renseignez au minimum le nom, l’email, le téléphone et le type d’événement.");
      setSaving(null);
      return;
    }
    try {
      const customOptionLabels = draft.customLines.map((line) => line.label).filter((label) => label.trim().length > 0);
      const response = await fetch("/api/admin/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_manual",
          name: fullName,
          email: draft.email,
          phone: draft.phone,
          event_type: draft.eventType,
          event_date: draft.eventDate,
          event_address: draft.eventAddress,
          booth_quantity: 1,
          package_id: draft.packageId,
          package: selectedPackage.label,
          option_ids: draft.optionIds,
          options: customOptionLabels,
          estimated_total_without_delivery: preview.totalWithoutDelivery,
          estimated_total_with_delivery: preview.total,
          estimated_total: preview.total,
          estimated_balance: preview.balance,
          delivery_fee: preview.deliveryFee,
          deposit: preview.deposit,
          custom_quote: selectedPackage.price === null || draft.customLines.length > 0 || preview.discount > 0 || isJblPackActive(draft.optionIds),
          message: buildPersistedMessage(draft, preview),
          status: draft.status
        })
      });
      const payload = (await response.json()) as AdminDevisCreateResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Création du devis impossible.");
      setMessage(payload.message || "Devis créé.");
      await load();
      if (payload.quote_request) setSelectedKey(`quote:${payload.quote_request.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Création du devis impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function updateStatus(item: AdminDevisItem, status: EventPicQuoteStatus) {
    setSaving(`${item.source}:${item.id}:${status}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/devis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", source: item.source, id: item.id, status })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Mise à jour impossible.");
      setMessage("Statut mis à jour.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="admin-page premium-page admin-quotes-page">
      <section className="admin-hero premium-hero admin-quotes-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Devis clients</h1>
          <p className="admin-hero-subtitle">Créez, préparez et suivez vos devis Event Pic depuis une seule page.</p>
        </div>
        <div className="admin-hero-actions admin-quotes-nav">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/planning">Planning événements</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/livreurs">Livreurs</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <button type="button" onClick={startManualQuote}>Créer un devis</button>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-quotes-kpis" aria-label="Synthèse devis">
        {kpis.map((item) => (
          <article className="admin-quote-kpi" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="admin-quotes-workspace">
        <div className="admin-quotes-main">
          <div className="admin-quotes-section-heading">
            <div>
              <p className="eyebrow">Suivi</p>
              <h2>Demandes et devis</h2>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading}>Actualiser</button>
          </div>

          {loading ? (
            <div className="admin-quote-empty">Chargement des devis...</div>
          ) : items.length === 0 ? (
            <div className="admin-quote-empty">
              <strong>Aucun devis pour le moment.</strong>
              <p>Créez un devis manuel ou attendez une demande issue du calculateur/contact.</p>
              <button type="button" onClick={startManualQuote}>Créer un devis manuel</button>
            </div>
          ) : (
            <div className="admin-quotes-table-wrap">
              <table className="admin-quotes-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Client</th>
                    <th>Événement</th>
                    <th>Formule</th>
                    <th>Options</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const status = getStatusMeta(item.status);
                    return (
                      <tr key={item.key} className={selectedItem?.key === item.key ? "is-selected" : ""}>
                        <td>{formatDateTime(item.created_at)}</td>
                        <td><span className="admin-quote-source">{item.source === "quote" ? "Calculateur" : "Contact"}</span></td>
                        <td><strong>{item.name || "Client non renseigné"}</strong><small>{item.email || "Email manquant"}</small><small>{item.phone || "Téléphone manquant"}</small></td>
                        <td><strong>{item.event_type || "À définir"}</strong><small>{formatDate(item.event_date)}</small><small>{item.event_address || "Adresse à confirmer"}</small></td>
                        <td><strong>{item.package_label}</strong>{item.guest_count ? <small>{`${item.guest_count} invités`}</small> : null}</td>
                        <td>{item.options.length > 0 ? <small>{formatEventPicOptions(item.options).map(optionDisplayLabel).join(", ")}</small> : <small>Aucune option</small>}</td>
                        <td><strong>{formatMoney(item.amount)}</strong>{item.delivery_fee ? <small>{`Déplacement : ${formatMoney(item.delivery_fee)}`}</small> : null}</td>
                        <td><span className={`admin-quote-status admin-quote-status-${status.tone}`}>{status.label}</span></td>
                        <td>
                          <div className="admin-quote-actions">
                            <button type="button" onClick={() => { setSelectedKey(item.key); setPanelMode("preview"); }}>Prévisualiser</button>
                            <button type="button" onClick={() => { setSelectedKey(item.key); prefillFromItem(item); }}>Voir / modifier</button>
                            {item.source === "quote" ? <Link href={`/admin/emails?requestId=${encodeURIComponent(item.id)}`}>Préparer email devis</Link> : <button type="button" onClick={() => prefillFromItem(item)}>Créer depuis contact</button>}
                            <button type="button" onClick={() => prefillFromItem(item)}>Dupliquer</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="admin-quotes-side-panel">
          <div className="admin-quotes-panel-tabs" role="tablist" aria-label="Mode devis">
            <button type="button" className={panelMode === "create" ? "is-active" : ""} onClick={() => setPanelMode("create")}>Créer / préparer</button>
            <button type="button" className={panelMode === "preview" ? "is-active" : ""} onClick={() => setPanelMode("preview")}>Aperçu sélection</button>
          </div>

          {panelMode === "create" ? (
            <form className="admin-quote-form" onSubmit={(event) => void createManualQuote(event)}>
              <div className="admin-quotes-section-heading compact"><div><p className="eyebrow">Création</p><h2>Trame de devis</h2></div></div>
              <label>Trame<select value={draft.templateId} onChange={(event) => applyTemplate(event.target.value as QuoteTemplateId)}>{QUOTE_TEMPLATES.map((template) => <option value={template.id} key={template.id}>{template.label}</option>)}</select></label>
              <div className="admin-quote-template-card"><span>{selectedTemplate.audience}</span><strong>{selectedTemplate.label}</strong><p>{selectedTemplate.intro}</p></div>
              <div className="admin-quote-form-grid">
                <label>Prénom<input value={draft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} placeholder="Camille" /></label>
                <label>Nom<input value={draft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} placeholder="Martin" /></label>
                <label>Email<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="client@email.fr" /></label>
                <label>Téléphone<input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="07..." /></label>
                <label>Type d’événement<input value={draft.eventType} onChange={(event) => updateDraft("eventType", event.target.value)} /></label>
                <label>Date événement<input type="date" value={draft.eventDate} onChange={(event) => updateDraft("eventDate", event.target.value)} /></label>
                <label>Nombre d’invités<input type="number" min="0" value={draft.guestCount} onChange={(event) => updateDraft("guestCount", event.target.value)} placeholder="120" /></label>
                <label>Adresse événement<input value={draft.eventAddress} onChange={(event) => updateDraft("eventAddress", event.target.value)} placeholder="Ville, adresse" /></label>
              </div>
              <div className="admin-quote-form-grid">
                <div className="admin-quote-formula-field">
                  <label>Formule principale<select value={draft.packageId} onChange={(event) => updateDraft("packageId", event.target.value)}>{EVENT_PIC_PHOTOBOOTH_PACKAGES.map((pack) => <option value={pack.id} key={pack.id}>{`${pack.label} ${pack.price === null ? "- sur devis" : `- ${pack.price} €`}`}</option>)}</select></label>
                  {formulaGuidance ? (
                    <div className={`admin-quote-formula-alert is-${formulaGuidance.tone}`} aria-live="polite">
                      <strong>{formulaGuidance.tone === "soft" ? "Conseil formule" : "Formule recommandée"}</strong>
                      <span>{formulaGuidance.message}</span>
                      <small>{`Besoin estimé : ${formulaGuidance.estimatedPrintsNeed} impressions conseillées.`}</small>
                    </div>
                  ) : null}
                </div>
                {selectedPackage.price === null ? <label>Montant manuel formule<input type="number" min="0" value={draft.customPackageAmount} onChange={(event) => updateDraft("customPackageAmount", event.target.value)} placeholder="0" /></label> : null}
                <div className="admin-quote-delivery-field">
                  <label>Frais déplacement<input type="number" min="0" value={draft.deliveryFee} onChange={(event) => updateDeliveryFee(event.target.value)} placeholder="À confirmer" /></label>
                  <div className={`admin-quote-delivery-estimate is-${deliveryEstimate.status}`} aria-live="polite">
                    <strong>
                      {deliveryEstimate.status === "calculated"
                        ? "Calculé automatiquement"
                        : deliveryEstimate.status === "estimating"
                          ? "Calcul en cours"
                          : "À confirmer"}
                    </strong>
                    <span>{deliveryEstimate.message}</span>
                    {deliveryEstimateDetails ? <small>{deliveryEstimateDetails}</small> : null}
                  </div>
                </div>
                <label>Remise éventuelle<input type="number" min="0" value={draft.discount} onChange={(event) => updateDraft("discount", event.target.value)} placeholder="0" /></label>
                <label>Acompte<input type="number" min="0" value={draft.deposit} onChange={(event) => updateDraft("deposit", event.target.value)} placeholder="100" /></label>
                <label>Statut initial<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as EventPicQuoteStatus)}>{QUOTE_STATUSES.map((status) => <option value={status.id} key={status.id}>{status.label}</option>)}</select></label>
              </div>
              <div className="admin-quote-options-grid">{EVENT_PIC_OPTIONS.map((option) => <label key={option.id} className="admin-quote-option-card"><input type="checkbox" checked={draft.optionIds.includes(option.id)} onChange={() => toggleOption(option.id)} /><span><strong>{optionDisplayLabel(option.label)}</strong><small>{option.description}</small></span><strong>{formatMoney(option.price)}</strong></label>)}</div>
              <div className="admin-quote-lines-editor">
                <div className="admin-quotes-section-heading compact"><div><p className="eyebrow">Lignes libres</p><h3>Prestations manuelles</h3></div><button type="button" onClick={addCustomLine}>Ajouter une ligne</button></div>
                {draft.customLines.length === 0 ? <small>Aucune ligne libre. Les lignes standard de la trame restent affichées dans l’aperçu.</small> : null}
                {draft.customLines.map((line) => <div className="admin-quote-line-row" key={line.id}><input value={line.label} onChange={(event) => updateCustomLine(line.id, { label: event.target.value })} placeholder="Libellé" /><input value={line.description} onChange={(event) => updateCustomLine(line.id, { description: event.target.value })} placeholder="Détail" /><input type="number" min="0" value={line.amount} onChange={(event) => updateCustomLine(line.id, { amount: event.target.value })} placeholder="Montant" /><button type="button" onClick={() => removeCustomLine(line.id)}>Retirer</button></div>)}
              </div>
              <label>Message client<textarea value={draft.clientMessage} onChange={(event) => updateDraft("clientMessage", event.target.value)} rows={4} /></label>
              <label>Notes internes<textarea value={draft.internalNotes} onChange={(event) => updateDraft("internalNotes", event.target.value)} rows={3} placeholder="Informations non visibles dans l’aperçu client." /></label>
              <QuotePreviewCard draft={draft} preview={preview} template={selectedTemplate} />
              <div className="admin-quote-submit-row"><button className="admin-button-dark" type="submit" disabled={saving === "create"}>{saving === "create" ? "Création..." : "Créer le devis"}</button><Link href="/admin/emails">Ouvrir Emails clients</Link></div>
            </form>
          ) : selectedItem ? (
            <div className="admin-quote-selected-panel">
              <p className="eyebrow">Aperçu suivi</p>
              <h2>{selectedItem.name || "Client non renseigné"}</h2>
              <div className="admin-quote-selected-grid"><span>Email</span><strong>{selectedItem.email || "-"}</strong><span>Téléphone</span><strong>{selectedItem.phone || "-"}</strong><span>Événement</span><strong>{selectedItem.event_type || "-"}</strong><span>Date</span><strong>{formatDate(selectedItem.event_date)}</strong><span>Adresse</span><strong>{selectedItem.event_address || "-"}</strong><span>Formule</span><strong>{selectedItem.package_label}</strong><span>Montant</span><strong>{formatMoney(selectedItem.amount)}</strong></div>
              {selectedItem.message ? <p className="admin-quote-message-preview">{selectedItem.message}</p> : null}
              <div className="admin-quote-status-actions">{QUOTE_STATUSES.map((status) => <button key={status.id} type="button" disabled={saving === `${selectedItem.source}:${selectedItem.id}:${status.id}`} onClick={() => void updateStatus(selectedItem, status.id)}>{status.label}</button>)}</div>
              <div className="admin-quote-submit-row"><button type="button" onClick={() => prefillFromItem(selectedItem)}>Dupliquer / modifier</button>{selectedItem.source === "quote" ? <Link href={`/admin/emails?requestId=${encodeURIComponent(selectedItem.id)}`}>Préparer email devis</Link> : null}</div>
            </div>
          ) : <div className="admin-quote-empty">Sélectionnez un devis pour afficher l’aperçu.</div>}
        </aside>
      </section>
    </main>
  );
}

function QuotePreviewCard({ draft, preview, template }: { draft: QuoteDraft; preview: QuotePreview; template: QuoteTemplate }) {
  const selectedPackage = packageById.get(draft.packageId) ?? EVENT_PIC_PHOTOBOOTH_PACKAGES[0];
  const selectedOptions = draft.optionIds.map((optionId) => optionById.get(optionId)).filter((option): option is (typeof EVENT_PIC_OPTIONS)[number] => Boolean(option));
  const jblPackActive = isJblPackActive(draft.optionIds);
  const regularOptions = jblPackActive
    ? selectedOptions.filter(
        (option) =>
          option.id !== JBL_310_OPTION_ID &&
          option.id !== JBL_710_OPTION_ID &&
          option.id !== JBL_MIC_OPTION_ID
      )
    : selectedOptions;
  const fullName = `${draft.firstName} ${draft.lastName}`.trim() || "Client à renseigner";
  const status = getStatusMeta(draft.status);
  return (
    <article className="admin-quote-preview-card" aria-label="Aperçu devis">
      <div className="admin-quote-preview-header"><BrandLogo alt="Event Pic" className="admin-quote-preview-logo" /><div><span>Devis Event Pic</span><strong>{template.label}</strong></div><em className={`admin-quote-status admin-quote-status-${status.tone}`}>{status.label}</em></div>
      <div className="admin-quote-preview-meta"><div><span>Client</span><strong>{fullName}</strong><small>{draft.email || "Email à renseigner"}</small></div><div><span>Événement</span><strong>{draft.eventType || "À définir"}</strong><small>{draft.eventDate ? formatDate(draft.eventDate) : "Date à confirmer"}</small></div><div><span>Lieu</span><strong>{draft.eventAddress || "Adresse à confirmer"}</strong><small>{draft.guestCount ? `${draft.guestCount} invités` : "Nombre d’invités à préciser"}</small></div></div>
      <p>{template.intro}</p>
      <div className="admin-quote-preview-lines">
        <div className="admin-quote-preview-line is-priced"><span>{selectedPackage.label}</span><strong>{formatMoney(preview.packageAmount)}</strong></div>
        {template.includedLines.map((line) => <div className="admin-quote-preview-line" key={line}><span>{line}</span><strong>Inclus</strong></div>)}
        {jblPackActive ? (
          <>
            <div className="admin-quote-preview-line is-priced is-pack" key="jbl-pack">
              <span>Pack JBL PartyBox 310 + 710<small>Au lieu de 120 € — réduction de 20 € soit environ -17 %</small></span>
              <strong>{formatMoney(JBL_PACK_PRICE)}</strong>
            </div>
            <div className="admin-quote-preview-line is-priced is-gift" key="jbl-micro-gift">
              <span>Micro sans fil offert<small>0 € — valeur habituelle 10 €</small></span>
              <strong>{formatMoney(0)}</strong>
            </div>
          </>
        ) : null}
        {regularOptions.map((option) => <div className="admin-quote-preview-line is-priced" key={option.id}><span>{optionDisplayLabel(option.label)}</span><strong>{formatMoney(option.price)}</strong></div>)}
        {draft.customLines.map((line) => <div className="admin-quote-preview-line is-priced" key={line.id}><span>{line.label || "Ligne personnalisée"}<small>{line.description}</small></span><strong>{formatMoney(parseMoney(line.amount))}</strong></div>)}
        {preview.deliveryFee > 0 ? <div className="admin-quote-preview-line is-priced"><span>Frais de déplacement</span><strong>{formatMoney(preview.deliveryFee)}</strong></div> : null}
        {preview.discount > 0 ? <div className="admin-quote-preview-line is-discount"><span>Remise commerciale</span><strong>{`-${formatMoney(preview.discount)}`}</strong></div> : null}
      </div>
      <div className="admin-quote-preview-total"><span>Total estimé</span><strong>{formatMoney(preview.total)}</strong><small>{`Acompte : ${formatMoney(preview.deposit)} · Solde : ${formatMoney(preview.balance)}`}</small></div>
      <div className="admin-quote-preview-notes"><strong>Message client</strong><p>{draft.clientMessage || template.conclusion}</p><strong>Conditions principales</strong><ul>{template.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div>
    </article>
  );
}
