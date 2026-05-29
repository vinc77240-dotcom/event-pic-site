"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import { BrandLogo } from "@/app/components/BrandLogo";

type EmailAttachment = {
  id: string;
  file_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  content_base64?: string;
  blob_path?: string;
};

const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".zip"];
const ACCEPTED_ATTACHMENT_TYPES = [
  ...ALLOWED_ATTACHMENT_EXTENSIONS,
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed"
].join(",");
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;
const EMAIL_ATTACHMENTS_BLOB_PREFIX = "admin/email-attachments";
const EVENT_PIC_EMAIL_LOGO_URL = "https://www.eventpic.fr/images/event-pic/logo-event-pic-email-round.png";
const EVENT_PIC_EMAIL_LOGO_SIZE = 96;
const EVENT_PIC_EMAIL_SIGNATURE_FOOTER_STYLE =
  "font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#090806;font-weight:800;letter-spacing:.08em;text-transform:uppercase;";

type EmailHistoryStatus = "draft" | "sent" | "failed" | "test_sent";

type EmailHistoryEntry = {
  id: string;
  created_at: string;
  sent_at: string | null;
  status: EmailHistoryStatus;
  request_id: string;
  client_name: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  preset_id: string;
  body_preview: string;
  body: string;
  attachments: EmailAttachment[];
  provider: "brevo" | "mailto" | "copy";
  error_message: string;
  is_marketing: boolean;
  marketing_consent: boolean;
  note: string;
  variables: Record<string, string>;
};

type EmailRequestSummary = {
  id: string;
  source?: "template_request" | "quote_request";
  client_first_name: string;
  client_last_name: string;
  client_full_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  event_type: string;
  selected_template_name: string;
  package_label?: string;
  options_summary?: string;
  gallery_url: string;
  google_review_url: string;
};

type EmailAdminConfig = {
  brevo_configured: boolean;
  openai_configured: boolean;
  company_name: string;
  google_review_url: string;
  instagram_url: string;
  phone_number: string;
  email_from_name: string;
  email_from_email: string;
  email_reply_to: string;
};

type EmailsBootstrapResponse = {
  ok?: boolean;
  history?: EmailHistoryEntry[];
  requests?: EmailRequestSummary[];
  config?: EmailAdminConfig;
  error?: string;
};

type EmailSendApiResponse = {
  ok?: boolean;
  message?: string;
  provider?: string;
  messageId?: string;
  mode?: "fallback" | "sent";
  mailto_url?: string;
  entry?: EmailHistoryEntry | null;
  code?: string;
  details?: string;
};

type EmailCampaignContact = {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  city: string;
  target_type: string;
  role: string;
  phone: string;
  event_date: string;
  event_type: string;
  notes: string;
  unsubscribed: boolean;
};

type EmailContactList = {
  id: string;
  name: string;
  created_at: string;
  contacts: EmailCampaignContact[];
};

type EmailCampaignItemStatus = "pending" | "sent" | "failed" | "skipped" | "unsubscribed" | "duplicate";

type EmailCampaignHistoryItem = {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  city: string;
  target_type: string;
  role: string;
  status: EmailCampaignItemStatus;
  message_id: string;
  error_message: string;
  sent_at: string;
};

type EmailCampaignHistoryEntry = {
  id: string;
  created_at: string;
  updated_at: string;
  list_id: string;
  preset_id: string;
  subject: string;
  list_name: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  daily_limit: number;
  batch_size: number;
  status: "draft" | "sending" | "partial" | "completed" | "failed";
  items: EmailCampaignHistoryItem[];
};

type EmailCampaignSettings = {
  batchSize: number;
  delaySeconds: number;
  dailyLimit: number;
  manualBatchMode: boolean;
};

type CampaignsApiResponse = {
  ok?: boolean;
  lists?: EmailContactList[];
  campaigns?: EmailCampaignHistoryEntry[];
  settings?: EmailCampaignSettings;
  error?: string;
};

type CampaignImportPreview = {
  columns: string[];
  contacts: EmailCampaignContact[];
  errors: Array<{ row: number; message: string }>;
  summary: {
    total_rows: number;
    valid: number;
    invalid: number;
    duplicates: number;
    stop: number;
  };
};

type VariableKey =
  | "client_first_name"
  | "client_last_name"
  | "client_full_name"
  | "event_type"
  | "event_date"
  | "event_location"
  | "guest_count"
  | "package_label"
  | "options_summary"
  | "gallery_url"
  | "google_review_url"
  | "coupon_code"
  | "coupon_amount"
  | "custom_message"
  | "organization_name"
  | "contact_role"
  | "company_name"
  | "phone_number"
  | "instagram_url"
  | "cta_label"
  | "cta_url";

type EmailVariables = Record<VariableKey, string>;

type FieldConfig = {
  label: string;
  placeholder: string;
  type?: "text" | "email" | "date" | "textarea" | "number" | "url";
  help?: string;
};

type EmailPresetId =
  | "private-event"
  | "business-prospect"
  | "collectivity-prospect"
  | "school-prospect"
  | "quote-follow-up"
  | "post-event-offer-30"
  | "google-review-request"
  | "free-email";

type EmailPreset = {
  id: EmailPresetId;
  label: string;
  shortLabel: string;
  audience: string;
  usage: string;
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  fields: VariableKey[];
  requiredFields: VariableKey[];
  suggestedAttachments: string[];
  isMarketing: boolean;
  needsConsentWarning?: boolean;
  complianceNote: string;
};

type Feedback = {
  tone: "success" | "error" | "warning" | "info";
  message: string;
  details?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_CONFIG: EmailAdminConfig = {
  brevo_configured: false,
  openai_configured: false,
  company_name: "Event Pic",
  google_review_url: "",
  instagram_url: "https://www.instagram.com/_event_pic",
  phone_number: "07 60 42 18 76",
  email_from_name: "Event Pic",
  email_from_email: "",
  email_reply_to: ""
};

const DEFAULT_VARIABLES: EmailVariables = {
  client_first_name: "",
  client_last_name: "",
  client_full_name: "",
  event_type: "",
  event_date: "",
  event_location: "",
  guest_count: "",
  package_label: "",
  options_summary: "",
  gallery_url: "",
  google_review_url: "",
  coupon_code: "EVENT30",
  coupon_amount: "30 EUR",
  custom_message: "",
  organization_name: "",
  contact_role: "",
  company_name: "Event Pic",
  phone_number: "07 60 42 18 76",
  instagram_url: "https://www.instagram.com/_event_pic",
  cta_label: "",
  cta_url: ""
};

const FIELD_CONFIG: Record<VariableKey, FieldConfig> = {
  client_first_name: {
    label: "Prénom client",
    placeholder: "Ex. Léa"
  },
  client_last_name: {
    label: "Nom client",
    placeholder: "Ex. Martin"
  },
  client_full_name: {
    label: "Nom complet",
    placeholder: "Ex. Léa Martin"
  },
  event_type: {
    label: "Type d’événement",
    placeholder: "Ex. mariage, séminaire, kermesse"
  },
  event_date: {
    label: "Date événement",
    placeholder: "2026-07-12",
    type: "date"
  },
  event_location: {
    label: "Ville / lieu",
    placeholder: "Ex. Melun, Paris, salle de réception"
  },
  guest_count: {
    label: "Nombre d’invités",
    placeholder: "Ex. 120",
    type: "number"
  },
  package_label: {
    label: "Formule souhaitée",
    placeholder: "Ex. 400 impressions"
  },
  options_summary: {
    label: "Options souhaitées",
    placeholder: "Ex. livre d’or audio, enceintes JBL, fond photo",
    type: "textarea"
  },
  gallery_url: {
    label: "Lien galerie",
    placeholder: "https://...",
    type: "url"
  },
  google_review_url: {
    label: "Lien avis Google",
    placeholder: "https://g.page/r/...",
    type: "url"
  },
  coupon_code: {
    label: "Code promo",
    placeholder: "EVENT30"
  },
  coupon_amount: {
    label: "Montant remise",
    placeholder: "30 EUR"
  },
  custom_message: {
    label: "Message personnalisé",
    placeholder: "Ajoutez un détail utile, une phrase personnalisée ou une précision.",
    type: "textarea"
  },
  organization_name: {
    label: "Nom établissement / entreprise",
    placeholder: "Ex. Mairie de..., École..., Société..."
  },
  contact_role: {
    label: "Fonction du contact",
    placeholder: "Ex. service événementiel, CSE, direction"
  },
  company_name: {
    label: "Nom société",
    placeholder: "Event Pic"
  },
  phone_number: {
    label: "Téléphone Event Pic",
    placeholder: "07 60 42 18 76"
  },
  instagram_url: {
    label: "Instagram Event Pic",
    placeholder: "https://www.instagram.com/_event_pic",
    type: "url"
  },
  cta_label: {
    label: "CTA",
    placeholder: "Demander mon devis"
  },
  cta_url: {
    label: "Lien CTA",
    placeholder: "https://...",
    type: "url"
  }
};

const EMAIL_PRESETS: EmailPreset[] = [
  {
    id: "private-event",
    label: "Mariage / anniversaire / événement privé",
    shortLabel: "Devis événement privé",
    audience: "B2C",
    usage: "Mariage, anniversaire, baptême, soirée privée.",
    subject: "Votre animation photobooth pour votre événement",
    body: [
      "Bonjour {{client_first_name}},",
      "",
      "Vous préparez un mariage, un anniversaire, un baptême ou une soirée privée ?",
      "",
      "Event Pic vous accompagne avec une borne photobooth élégante, installée sur place, avec impressions instantanées, galerie numérique et cadre photo personnalisé selon votre thème.",
      "",
      "Nous proposons également des options pour compléter votre événement : livre d’or audio, enceintes JBL lumineuses, fond photo et accessoires festifs.",
      "",
      "Indiquez-nous votre date, votre lieu et le nombre d’invités, et nous vous préparerons une proposition adaptée.",
      "",
      "À bientôt,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Demander mon devis",
    ctaUrl: "/contact",
    fields: [
      "client_first_name",
      "client_last_name",
      "event_type",
      "event_date",
      "event_location",
      "guest_count",
      "package_label",
      "options_summary",
      "custom_message"
    ],
    requiredFields: ["client_first_name"],
    suggestedAttachments: ["Lien vers la plaquette Event Pic ou le site"],
    isMarketing: false,
    needsConsentWarning: true,
    complianceNote:
      "Pour les particuliers, vérifiez que le contact a déjà demandé des informations ou accepté d’être contacté."
  },
  {
    id: "business-prospect",
    label: "Entreprise / CSE / séminaire",
    shortLabel: "Prospection entreprise",
    audience: "B2B",
    usage: "Afterwork, séminaire, salon, inauguration, CSE.",
    subject: "Animation photobooth pour vos événements d’entreprise",
    body: [
      "Bonjour,",
      "",
      "Je me permets de vous présenter Event Pic, une animation photobooth premium pour vos événements professionnels en Île-de-France.",
      "",
      "Nous accompagnons les entreprises, CSE et agences événementielles pour les afterworks, séminaires, salons professionnels, inaugurations, arbres de Noël et soirées clients ou collaborateurs.",
      "",
      "La prestation peut inclure l’installation sur site, la personnalisation du cadre photo à vos couleurs, les impressions selon la formule choisie et l’accès à une galerie numérique.",
      "",
      "Nous pouvons également proposer un livre d’or audio, des enceintes JBL et un fond photo pour renforcer l’expérience.",
      "",
      "Serait-il possible de vous transmettre une proposition ou d’échanger avec la personne en charge de vos événements ?",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Recevoir un devis entreprise",
    ctaUrl: "/entreprises",
    fields: [
      "client_first_name",
      "organization_name",
      "contact_role",
      "event_type",
      "event_date",
      "event_location",
      "guest_count",
      "options_summary",
      "custom_message"
    ],
    requiredFields: [],
    suggestedAttachments: ["Lien vers la plaquette Event Pic"],
    isMarketing: true,
    complianceNote:
      "Prospection B2B : le message doit rester lié à l’activité de l’établissement et proposer une opposition simple."
  },
  {
    id: "collectivity-prospect",
    label: "Mairie / collectivité",
    shortLabel: "Prospection mairie / collectivité",
    audience: "Collectivité",
    usage: "Mairie, événement communal, forum, fête locale.",
    subject: "Animation photobooth pour vos événements municipaux",
    body: [
      "Bonjour,",
      "",
      "Je me permets de vous présenter Event Pic, une animation photobooth conviviale et clé en main pour vos événements municipaux et associatifs.",
      "",
      "Notre borne photo peut accompagner vos fêtes communales, forums des associations, cérémonies, animations jeunesse, arbres de Noël ou événements publics.",
      "",
      "Nous assurons l’installation sur site, la personnalisation du cadre photo, les impressions selon la formule choisie et l’accès à une galerie numérique.",
      "",
      "L’objectif est de proposer aux familles et participants un souvenir simple, qualitatif et personnalisé de l’événement.",
      "",
      "Serait-il possible de transmettre notre présentation au service ou à la personne en charge des événements ?",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Demander une proposition",
    ctaUrl: "/contact",
    fields: ["organization_name", "contact_role", "event_type", "event_location", "custom_message"],
    requiredFields: [],
    suggestedAttachments: ["Lien vers la plaquette Event Pic"],
    isMarketing: true,
    complianceNote:
      "Prospection collectivité : gardez un message institutionnel, utile et lié aux événements publics."
  },
  {
    id: "school-prospect",
    label: "École / association scolaire",
    shortLabel: "Prospection école / association scolaire",
    audience: "Scolaire",
    usage: "École, kermesse, spectacle, marché de Noël, association de parents.",
    subject: "Animation photobooth pour votre événement scolaire",
    body: [
      "Bonjour,",
      "",
      "Je me permets de vous présenter Event Pic, une animation photobooth clé en main pour les événements scolaires et associatifs.",
      "",
      "Pour une kermesse, un spectacle, une fête d’école, un marché de Noël ou une porte ouverte, notre borne photo permet aux familles, enfants et équipes de repartir avec un souvenir convivial et personnalisé.",
      "",
      "La prestation peut inclure :",
      "- installation de la borne sur place,",
      "- impressions selon la formule choisie,",
      "- cadre photo personnalisé aux couleurs de l’événement,",
      "- galerie numérique,",
      "- accessoires festifs,",
      "- livre d’or audio en option.",
      "",
      "Nous intervenons en Île-de-France, notamment en Seine-et-Marne, Essonne, Val-de-Marne et Paris selon disponibilité.",
      "",
      "Serait-il possible de transmettre cette présentation à la personne en charge de l’organisation des événements scolaires ?",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Découvrir Event Pic",
    ctaUrl: "https://www.eventpic.fr/",
    fields: ["organization_name", "contact_role", "event_type", "event_location", "custom_message"],
    requiredFields: [],
    suggestedAttachments: ["Lien vers la plaquette Event Pic", "Lien vers les tarifs"],
    isMarketing: true,
    complianceNote:
      "Prospection scolaire : ne placez jamais de fichier de contacts écoles dans /public."
  },
  {
    id: "quote-follow-up",
    label: "Relance devis",
    shortLabel: "Relance devis douce",
    audience: "Relance",
    usage: "Relancer un prospect sans pression commerciale excessive.",
    subject: "Votre devis Event Pic — disponibilité à confirmer",
    body: [
      "Bonjour {{client_first_name}},",
      "",
      "Je me permets de revenir vers vous concernant votre demande pour {{event_type}} prévu le {{event_date}}.",
      "",
      "La date peut encore être disponible, mais elle sera confirmée uniquement après validation du devis et acompte.",
      "",
      "Event Pic peut vous accompagner avec une borne photobooth élégante, un cadre photo personnalisé, des impressions selon la formule choisie et une galerie numérique.",
      "",
      "Je reste disponible si vous souhaitez ajuster la formule ou ajouter une option.",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Confirmer mon devis",
    ctaUrl: "/contact",
    fields: ["client_first_name", "event_type", "event_date", "package_label", "options_summary", "custom_message"],
    requiredFields: ["client_first_name", "event_type", "event_date"],
    suggestedAttachments: ["Devis ou récapitulatif client si disponible"],
    isMarketing: false,
    complianceNote:
      "Relance opérationnelle : à utiliser lorsqu’une demande ou un échange existe déjà."
  },
  {
    id: "post-event-offer-30",
    label: "Offre post-événement - 30 EUR offerts",
    shortLabel: "Offre post-événement - 30 EUR offerts",
    audience: "Post-événement",
    usage: "Après un événement où la personne a déjà découvert Event Pic.",
    subject: "Votre avantage Event Pic pour un prochain événement",
    body: [
      "Bonjour {{client_first_name}},",
      "",
      "Nous nous permettons de vous contacter suite à l’événement où vous avez pu découvrir les bornes photo Event Pic.",
      "",
      "Nous espérons que l’expérience vous a plu.",
      "",
      "Pour vous accompagner lors d’un futur événement — mariage, anniversaire, soirée privée ou événement professionnel — vous bénéficiez de 30 EUR de remise sur votre prochaine réservation.",
      "",
      "Nos prestations incluent une borne photo élégante, une installation sur site, des impressions instantanées selon la formule choisie et des souvenirs personnalisés pour vos invités.",
      "",
      "N’hésitez pas à nous contacter pour vérifier nos disponibilités ou obtenir un devis.",
      "",
      "À bientôt,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Utiliser mon offre de 30 EUR",
    ctaUrl: "/contact",
    fields: ["client_first_name", "event_type", "event_date", "coupon_code", "coupon_amount", "custom_message"],
    requiredFields: ["client_first_name", "coupon_code", "coupon_amount"],
    suggestedAttachments: [],
    isMarketing: true,
    complianceNote:
      "Offre post-événement : utilisez ce modèle uniquement après un contact ou un événement Event Pic."
  },
  {
    id: "google-review-request",
    label: "Demande d’avis Google",
    shortLabel: "Demande d’avis Google",
    audience: "Après prestation",
    usage: "Après une prestation terminée.",
    subject: "Votre avis compte beaucoup pour Event Pic",
    body: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore d’avoir fait confiance à Event Pic pour votre événement.",
      "",
      "Si vous avez apprécié la prestation, votre retour nous aiderait beaucoup.",
      "",
      "Vous pouvez laisser un avis en quelques secondes ici :",
      "{{google_review_url}}",
      "",
      "Merci pour votre confiance,",
      "Event Pic"
    ].join("\n"),
    ctaLabel: "Laisser un avis Google",
    ctaUrl: "{{google_review_url}}",
    fields: ["client_first_name", "event_type", "event_date", "google_review_url", "gallery_url", "custom_message"],
    requiredFields: ["client_first_name", "google_review_url"],
    suggestedAttachments: [],
    isMarketing: false,
    complianceNote:
      "Demande d’avis : à envoyer uniquement après une prestation ou une expérience réelle."
  },
  {
    id: "free-email",
    label: "Email libre",
    shortLabel: "Email libre",
    audience: "Libre",
    usage: "Message manuel sans modèle métier imposé.",
    subject: "Message Event Pic",
    body: ["Bonjour {{client_first_name}},", "", "{{custom_message}}", "", "Cordialement,", "Event Pic"].join("\n"),
    ctaLabel: "",
    ctaUrl: "",
    fields: [
      "client_first_name",
      "client_last_name",
      "event_type",
      "event_date",
      "event_location",
      "custom_message",
      "gallery_url",
      "google_review_url"
    ],
    requiredFields: ["custom_message"],
    suggestedAttachments: [],
    isMarketing: false,
    complianceNote: "Email libre : vérifiez le contexte et le destinataire avant l’envoi."
  }
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 Ko";
  }
  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024)} Ko`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

function makeAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeAttachmentFileName(fileName: string) {
  const cleaned = cleanText(fileName).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned || "piece-jointe";
}

function inferAttachmentMimeType(file: File) {
  const explicitType = cleanText(file.type);
  if (explicitType) {
    return explicitType;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  if (extension === ".pdf") {
    return "application/pdf";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".zip") {
    return "application/zip";
  }
  return "application/octet-stream";
}

function campaignStatusLabel(status: EmailCampaignItemStatus | EmailCampaignHistoryEntry["status"]) {
  const labels: Record<string, string> = {
    pending: "En attente",
    sent: "Envoyé",
    failed: "Erreur",
    skipped: "Ignoré",
    unsubscribed: "Désinscrit / STOP",
    duplicate: "Doublon",
    draft: "Brouillon",
    sending: "Envoi en cours",
    partial: "Partiel",
    completed: "Terminée"
  };

  return labels[status] ?? status;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyEscaped(value: string) {
  return value.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#B88A35;text-decoration:none;font-weight:700;">${url}</a>`
  );
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/g);
      const listLines = lines.filter((line) => line.trim().startsWith("- "));
      if (listLines.length === lines.length && listLines.length > 0) {
        return `<ul style="margin:0 0 14px 20px;padding:0;color:#4d453c;line-height:1.65;font-size:14px;">${listLines
          .map((line) => `<li>${linkifyEscaped(escapeHtml(line.replace(/^- /, "")))}</li>`)
          .join("")}</ul>`;
      }

      return `<p style="margin:0 0 14px;color:#4d453c;line-height:1.7;font-size:14px;">${linkifyEscaped(
        escapeHtml(paragraph).replace(/\n/g, "<br>")
      )}</p>`;
    })
    .join("");
}

function renderTemplate(template: string, variables: EmailVariables) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key as VariableKey];
    return typeof value === "string" ? value : "";
  });
}

function buildEmailPreviewHtml(input: {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isMarketing: boolean;
  phoneNumber: string;
  instagramUrl: string;
}) {
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<div style="margin:18px 0 4px;"><a href="${escapeHtml(
          input.ctaUrl
        )}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#090806;color:#fff;text-decoration:none;border:1px solid #c7a15a;border-radius:10px;padding:12px 18px;font-weight:700;">${escapeHtml(
          input.ctaLabel
        )}</a></div>`
      : "";

  const marketingFooter = input.isMarketing
    ? `<p style="margin:18px 0 0;color:#756b5e;font-size:12px;line-height:1.55;">Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP à cet email.</p>`
    : "";

  return `
    <div style="background:#fbf7ef;padding:20px;border-radius:18px;">
      <div style="max-width:620px;margin:0 auto;background:#fffdf8;border:1px solid #eadac0;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(20,16,10,.08);font-family:Arial,Helvetica,sans-serif;">
        <div style="background:#f3eadc;border-bottom:1px solid #eadac0;padding:22px;text-align:center;">
          <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 10px;border-collapse:collapse;">
            <tr>
              <td align="center" width="${EVENT_PIC_EMAIL_LOGO_SIZE}" height="${EVENT_PIC_EMAIL_LOGO_SIZE}" style="width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;height:${EVENT_PIC_EMAIL_LOGO_SIZE}px;border-radius:50%;overflow:hidden;line-height:0;background:transparent;">
                <img src="${EVENT_PIC_EMAIL_LOGO_URL}" alt="Event Pic" width="${EVENT_PIC_EMAIL_LOGO_SIZE}" height="${EVENT_PIC_EMAIL_LOGO_SIZE}" style="width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;height:${EVENT_PIC_EMAIL_LOGO_SIZE}px;max-width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;border-radius:50%;object-fit:cover;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:24px;">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:500;color:#090806;">${escapeHtml(
            input.subject || "Sujet email"
          )}</h1>
          ${textToHtml(input.body || "-")}
          ${cta}
          <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eadac0;color:#4d453c;font-size:13px;line-height:1.65;">
            <strong style="display:block;margin:0 0 6px;${EVENT_PIC_EMAIL_SIGNATURE_FOOTER_STYLE}">Event Pic</strong>
            Photobooth & animations événementielles<br />
            Île-de-France<br />
            ${escapeHtml(input.phoneNumber)}<br />
            Email : <a href="mailto:contact@eventpic.fr" style="color:#b88a35;text-decoration:none;">contact@eventpic.fr</a><br />
            Instagram : ${escapeHtml(input.instagramUrl)}
          </div>
          ${marketingFooter}
        </div>
      </div>
    </div>
  `.trim();
}

function buildTextPreview(input: {
  subject: string;
  body: string;
  isMarketing: boolean;
  phoneNumber: string;
  instagramUrl: string;
}) {
  return [
    `Sujet : ${input.subject || "Sujet email"}`,
    "",
    input.body || "-",
    "",
    "Event Pic",
    "Photobooth & animations événementielles",
    "Île-de-France",
    `Téléphone : ${input.phoneNumber}`,
    "Email : contact@eventpic.fr",
    `Instagram : ${input.instagramUrl}`,
    ...(input.isMarketing
      ? ["", "Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP à cet email."]
      : [])
  ].join("\n");
}

function normalizeUrl(value: string) {
  const trimmed = cleanText(value);
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("{{")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return typeof window === "undefined" ? trimmed : `${window.location.origin}${trimmed}`;
  }
  return trimmed;
}

function getRequestIdFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("requestId") ?? "";
}

export default function AdminEmailsPage() {
  const [requests, setRequests] = useState<EmailRequestSummary[]>([]);
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [config, setConfig] = useState<EmailAdminConfig>(DEFAULT_CONFIG);
  const [selectedPresetId, setSelectedPresetId] = useState<EmailPresetId>("private-event");
  const [sourceMode, setSourceMode] = useState<"request" | "prospecting" | "free" | "campaign">("prospecting");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState(EMAIL_PRESETS[0].subject);
  const [bodyTemplate, setBodyTemplate] = useState(EMAIL_PRESETS[0].body);
  const [variables, setVariables] = useState<EmailVariables>(DEFAULT_VARIABLES);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [note, setNote] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatedOnce, setGeneratedOnce] = useState(false);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [campaignLists, setCampaignLists] = useState<EmailContactList[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<EmailCampaignHistoryEntry[]>([]);
  const [campaignSettings, setCampaignSettings] = useState<EmailCampaignSettings>({
    batchSize: 25,
    delaySeconds: 0,
    dailyLimit: 100,
    manualBatchMode: true
  });
  const [campaignListId, setCampaignListId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaignCsvContent, setCampaignCsvContent] = useState("");
  const [campaignListName, setCampaignListName] = useState("");
  const [campaignPreview, setCampaignPreview] = useState<CampaignImportPreview | null>(null);
  const [campaignConfirm, setCampaignConfirm] = useState(false);
  const [campaignSending, setCampaignSending] = useState(false);
  const [campaignTestTo, setCampaignTestTo] = useState("");

  const selectedPreset = useMemo(
    () => EMAIL_PRESETS.find((preset) => preset.id === selectedPresetId) ?? EMAIL_PRESETS[0],
    [selectedPresetId]
  );

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const selectedCampaignList = useMemo(
    () => campaignLists.find((list) => list.id === campaignListId) ?? null,
    [campaignLists, campaignListId]
  );

  const activeCampaign = useMemo(
    () => campaignHistory.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignHistory, campaignId]
  );

  const campaignCompatiblePresets = useMemo(
    () =>
      EMAIL_PRESETS.filter((preset) =>
        [
          "business-prospect",
          "collectivity-prospect",
          "school-prospect",
          "quote-follow-up",
          "post-event-offer-30"
        ].includes(preset.id)
      ),
    []
  );

  const renderedSubject = useMemo(
    () => renderTemplate(subjectTemplate, variables).trim(),
    [subjectTemplate, variables]
  );

  const renderedBody = useMemo(() => renderTemplate(bodyTemplate, variables).trim(), [bodyTemplate, variables]);

  const resolvedCtaUrl = useMemo(() => {
    const templateValue = selectedPreset.ctaUrl === "{{google_review_url}}" ? variables.google_review_url : selectedPreset.ctaUrl;
    return normalizeUrl(renderTemplate(templateValue, variables));
  }, [selectedPreset, variables]);

  const effectiveVariables = useMemo<EmailVariables>(
    () => ({
      ...variables,
      cta_label: selectedPreset.ctaLabel,
      cta_url: resolvedCtaUrl
    }),
    [variables, selectedPreset.ctaLabel, resolvedCtaUrl]
  );

  const missingVariables = useMemo(() => {
    const missing = selectedPreset.requiredFields.filter((field) => !cleanText(variables[field]));
    if (sourceMode === "campaign") {
      return missing;
    }
    if (!EMAIL_RE.test(to.trim())) {
      return ["email_destinataire", ...missing];
    }
    return missing;
  }, [selectedPreset.requiredFields, sourceMode, to, variables]);

  const previewHtml = useMemo(
    () =>
      buildEmailPreviewHtml({
        subject: renderedSubject,
        body: renderedBody,
        ctaLabel: selectedPreset.ctaLabel,
        ctaUrl: resolvedCtaUrl,
        isMarketing: selectedPreset.isMarketing,
        phoneNumber: variables.phone_number,
        instagramUrl: variables.instagram_url
      }),
    [renderedBody, renderedSubject, resolvedCtaUrl, selectedPreset, variables.instagram_url, variables.phone_number]
  );

  const previewText = useMemo(
    () =>
      buildTextPreview({
        subject: renderedSubject,
        body: renderedBody,
        isMarketing: selectedPreset.isMarketing,
        phoneNumber: variables.phone_number,
        instagramUrl: variables.instagram_url
      }),
    [renderedBody, renderedSubject, selectedPreset.isMarketing, variables.instagram_url, variables.phone_number]
  );

  const totalAttachmentSize = useMemo(
    () => attachments.reduce((total, attachment) => total + attachment.size, 0),
    [attachments]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setFeedback(null);
      try {
        const response = await fetch("/api/admin/emails", { cache: "no-store" });
        const payload = (await response.json()) as EmailsBootstrapResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Chargement de l’outil emails impossible.");
        }

        if (!mounted) {
          return;
        }

        const nextConfig = payload.config ?? DEFAULT_CONFIG;
        const nextRequests = payload.requests ?? [];
        setRequests(nextRequests);
        setHistory(payload.history ?? []);
        setConfig(nextConfig);

        const campaignResponse = await fetch("/api/admin/emails/campaigns", { cache: "no-store" });
        const campaignPayload = (await campaignResponse.json()) as CampaignsApiResponse;
        if (campaignResponse.ok && campaignPayload.ok) {
          const nextLists = campaignPayload.lists ?? [];
          const nextCampaigns = campaignPayload.campaigns ?? [];
          setCampaignLists(nextLists);
          setCampaignHistory(nextCampaigns);
          setCampaignSettings(campaignPayload.settings ?? campaignSettings);
          setCampaignListId((current) => current || nextLists[0]?.id || "");
          setCampaignId((current) => current || nextCampaigns[0]?.id || "");
        }

        setVariables((current) => ({
          ...current,
          company_name: nextConfig.company_name || "Event Pic",
          phone_number: nextConfig.phone_number || "07 60 42 18 76",
          instagram_url: nextConfig.instagram_url || "https://www.instagram.com/_event_pic",
          google_review_url: nextConfig.google_review_url || current.google_review_url
        }));

        const initialRequestId = getRequestIdFromLocation();
        if (initialRequestId) {
          const request = nextRequests.find((item) => item.id === initialRequestId);
          if (request) {
            setSourceMode("request");
            setSelectedRequestId(request.id);
            applyRequest(request, nextConfig);
          }
        }
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Chargement impossible."
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSubjectTemplate(selectedPreset.subject);
    setBodyTemplate(selectedPreset.body);
    setMarketingConsent(!selectedPreset.isMarketing);
    setGeneratedOnce(false);
  }, [selectedPreset]);

  function updateVariable(field: VariableKey, value: string) {
    setVariables((current) => ({
      ...current,
      [field]: value
    }));
  }

  function applyRequest(request: EmailRequestSummary, currentConfig = config) {
    const first = cleanText(request.client_first_name);
    const last = cleanText(request.client_last_name);
    const full = cleanText(request.client_full_name) || `${first} ${last}`.trim();

    setSelectedRequestId(request.id);
    setTo(request.client_email);
    setVariables((current) => ({
      ...current,
      client_first_name: first,
      client_last_name: last,
      client_full_name: full,
      event_type: cleanText(request.event_type),
      event_date: cleanText(request.event_date),
      package_label: cleanText(request.package_label),
      options_summary: cleanText(request.options_summary),
      gallery_url: cleanText(request.gallery_url),
      google_review_url: cleanText(request.google_review_url) || currentConfig.google_review_url || current.google_review_url,
      company_name: currentConfig.company_name || current.company_name,
      phone_number: currentConfig.phone_number || current.phone_number,
      instagram_url: currentConfig.instagram_url || current.instagram_url
    }));
  }

  function choosePreset(preset: EmailPreset) {
    setSelectedPresetId(preset.id);
    if (preset.id === "free-email") {
      setSourceMode("free");
    } else if (sourceMode === "free") {
      setSourceMode("prospecting");
    }
  }

  async function uploadFileViaApi(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/admin/emails/attachments", {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as { ok?: boolean; attachment?: EmailAttachment; error?: string };
    if (!response.ok || !payload.ok || !payload.attachment) {
      throw new Error(payload.error || "Upload pièce jointe impossible.");
    }
    return payload.attachment;
  }

  async function uploadFileToBlob(file: File) {
    const id = makeAttachmentId();
    const safeFileName = sanitizeAttachmentFileName(file.name);
    const storedName = `${id}-${safeFileName}`;
    const mimeType = inferAttachmentMimeType(file);
    const pathname = `${EMAIL_ATTACHMENTS_BLOB_PREFIX}/${storedName}`;
    const uploaded = await uploadBlob(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/admin/emails/attachments/blob",
      contentType: mimeType,
      clientPayload: JSON.stringify({
        file_name: file.name,
        mime_type: mimeType,
        size: file.size
      })
    });

    return {
      id,
      file_name: file.name,
      stored_name: storedName,
      mime_type: mimeType,
      size: file.size,
      uploaded_at: new Date().toISOString(),
      blob_path: uploaded.pathname
    } satisfies EmailAttachment;
  }

  async function uploadEmailAttachment(file: File) {
    try {
      return await uploadFileToBlob(file);
    } catch {
      if (file.size > VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES) {
        throw new Error(
          "Upload direct Blob indisponible. Ce fichier dépasse la limite Vercel de 4,5 Mo pour les routes API : il ne peut pas être envoyé sans stockage Blob actif."
        );
      }
      return uploadFileViaApi(file);
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const invalidFiles = files.filter((file) => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      return !ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension);
    });
    if (invalidFiles.length > 0) {
      setFeedback({
        tone: "error",
        message: "Format non autorisé. Formats acceptés : PDF, PNG, JPG, JPEG, ZIP.",
        details: invalidFiles.map((file) => file.name).join(", ")
      });
      event.target.value = "";
      return;
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setFeedback({
        tone: "error",
        message: "Fichier trop lourd. Chaque pièce jointe doit rester sous 10 Mo.",
        details: oversizedFiles.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")
      });
      event.target.value = "";
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      const uploaded: EmailAttachment[] = [];
      for (const file of files) {
        uploaded.push(await uploadEmailAttachment(file));
      }
      setAttachments((current) => [...current, ...uploaded]);
      setFeedback({
        tone: "success",
        message:
          uploaded.length > 1
            ? "Pièces jointes prêtes pour l’envoi."
            : "Pièce jointe prête pour l’envoi.",
        details: uploaded.map((attachment) => `${attachment.file_name} (${formatBytes(attachment.size)})`).join(", ")
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload impossible."
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function removeAttachment(attachment: EmailAttachment) {
    const previousAttachments = attachments;
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/emails/attachments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ stored_name: attachment.stored_name, blob_path: attachment.blob_path ?? "" })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Suppression pièce jointe impossible.");
      }
      setFeedback({ tone: "success", message: "Pièce jointe retirée." });
    } catch (error) {
      setAttachments(previousAttachments);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Suppression impossible."
      });
    }
  }

  async function reloadCampaigns() {
    const response = await fetch("/api/admin/emails/campaigns", { cache: "no-store" });
    const payload = (await response.json()) as CampaignsApiResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Chargement des campagnes impossible.");
    }

    const nextLists = payload.lists ?? [];
    const nextCampaigns = payload.campaigns ?? [];
    setCampaignLists(nextLists);
    setCampaignHistory(nextCampaigns);
    setCampaignSettings(payload.settings ?? campaignSettings);
    setCampaignListId((current) => current || nextLists[0]?.id || "");
    setCampaignId((current) => current || nextCampaigns[0]?.id || "");
    return { lists: nextLists, campaigns: nextCampaigns };
  }

  async function readCampaignFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
      setFeedback({
        tone: "warning",
        message:
          "Import XLSX non activé sans dépendance dédiée. Exportez le fichier en CSV puis importez-le ici pour garder les contacts côté admin."
      });
      event.target.value = "";
      return;
    }

    const content = await file.text();
    setCampaignCsvContent(content);
    setCampaignListName((current) => current || file.name.replace(/\.[^.]+$/, ""));
    event.target.value = "";
  }

  async function previewCampaignCsv() {
    setFeedback(null);
    const response = await fetch("/api/admin/emails/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview_csv",
        csv_content: campaignCsvContent
      })
    });
    const payload = (await response.json()) as { ok?: boolean; preview?: CampaignImportPreview; error?: string };
    if (!response.ok || !payload.ok || !payload.preview) {
      throw new Error(payload.error || "Prévisualisation CSV impossible.");
    }
    setCampaignPreview(payload.preview);
  }

  async function importCampaignCsv() {
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/emails/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_csv_list",
          list_name: campaignListName,
          csv_content: campaignCsvContent
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        list?: EmailContactList;
        preview?: CampaignImportPreview;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.list) {
        throw new Error(payload.error || "Import CSV impossible.");
      }
      setCampaignPreview(payload.preview ?? null);
      setCampaignListId(payload.list.id);
      setCampaignId("");
      await reloadCampaigns();
      setFeedback({
        tone: "success",
        message: "Liste de contacts importée côté admin.",
        details: `${payload.list.contacts.length} contact(s) valide(s).`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Import impossible." });
    }
  }

  async function sendCampaignBatch() {
    setGeneratedOnce(true);
    setFeedback(null);

    if (!selectedCampaignList) {
      setFeedback({ tone: "warning", message: "Sélectionnez ou importez une liste de contacts." });
      return;
    }
    if (!cleanText(subjectTemplate) || !cleanText(bodyTemplate)) {
      setFeedback({ tone: "warning", message: "Sujet et message obligatoires avant campagne." });
      return;
    }
    if (selectedPreset.isMarketing && !bodyTemplate.toLowerCase().includes("stop")) {
      setFeedback({ tone: "warning", message: "La mention STOP est obligatoire pour une campagne de prospection." });
      return;
    }
    if (selectedPreset.isMarketing && !campaignConfirm) {
      setFeedback({
        tone: "warning",
        message: "Confirmez que ces contacts peuvent recevoir ce message et disposent d’un moyen d’opposition."
      });
      return;
    }

    setCampaignSending(true);
    try {
      const response = await fetch("/api/admin/emails/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_campaign",
          campaign_id: activeCampaign?.id ?? "",
          list_id: selectedCampaignList.id,
          preset_id: selectedPreset.id,
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
          variables: effectiveVariables,
          is_marketing: selectedPreset.isMarketing,
          marketing_consent: selectedPreset.isMarketing ? campaignConfirm : true,
          confirm_opt_in: true,
          batch_size: campaignSettings.batchSize,
          delay_seconds: campaignSettings.delaySeconds,
          daily_limit: campaignSettings.dailyLimit
        })
      });
      const payload = (await response.json()) as { ok?: boolean; campaign?: EmailCampaignHistoryEntry; error?: string };
      if (!response.ok || !payload.ok || !payload.campaign) {
        throw new Error(payload.error || "Envoi campagne impossible.");
      }
      setCampaignId(payload.campaign.id);
      await reloadCampaigns();
      setFeedback({
        tone: "success",
        message: "Lot de campagne traité.",
        details: `${payload.campaign.sent} envoyé(s), ${payload.campaign.pending} en attente, ${payload.campaign.failed} erreur(s).`
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Campagne impossible." });
    } finally {
      setCampaignSending(false);
    }
  }

  async function sendCampaignTest() {
    setFeedback(null);
    if (!selectedCampaignList) {
      setFeedback({ tone: "warning", message: "Sélectionnez une liste avant le test." });
      return;
    }
    if (!EMAIL_RE.test(campaignTestTo.trim())) {
      setFeedback({ tone: "warning", message: "Adresse email de test invalide." });
      return;
    }

    setCampaignSending(true);
    try {
      const response = await fetch("/api/admin/emails/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_campaign_test",
          list_id: selectedCampaignList.id,
          to: campaignTestTo,
          preset_id: selectedPreset.id,
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
          variables: effectiveVariables,
          is_marketing: selectedPreset.isMarketing,
          marketing_consent: selectedPreset.isMarketing ? campaignConfirm : true
        })
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || "Email test de campagne impossible.");
      }
      setFeedback({ tone: "success", message: payload.message || "Email test de campagne envoyé." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Test campagne impossible." });
    } finally {
      setCampaignSending(false);
    }
  }

  async function submitEmail(action: "create_draft" | "send_test" | "send") {
    setGeneratedOnce(true);
    setFeedback(null);

    if (missingVariables.length > 0 && action !== "create_draft") {
      setFeedback({
        tone: "warning",
        message: `Variable manquante : ${missingVariables.map((field) => fieldLabel(field)).join(", ")}`
      });
      return;
    }

    if (selectedPreset.isMarketing && !marketingConsent && action !== "create_draft") {
      setFeedback({
        tone: "warning",
        message: "Confirmez la règle de conformité avant l’envoi."
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        request_id: sourceMode === "request" ? selectedRequest?.id ?? null : null,
        client_name:
          cleanText(variables.client_full_name) ||
          `${cleanText(variables.client_first_name)} ${cleanText(variables.client_last_name)}`.trim(),
        to,
        cc,
        bcc,
        preset_id: selectedPreset.id,
        subject: subjectTemplate,
        subject_template: subjectTemplate,
        body: bodyTemplate,
        body_template: bodyTemplate,
        variables: effectiveVariables,
        attachments,
        note,
        is_marketing: selectedPreset.isMarketing,
        marketing_consent: selectedPreset.isMarketing ? marketingConsent : true,
        is_test: action === "send_test"
      };

      if (action === "create_draft") {
        const response = await fetch("/api/admin/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...payload,
            action: "create_draft"
          })
        });
        const result = (await response.json()) as { ok?: boolean; entry?: EmailHistoryEntry; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Brouillon impossible.");
        }
        if (result.entry) {
          setHistory((current) => [result.entry!, ...current.filter((entry) => entry.id !== result.entry!.id)]);
        }
        setFeedback({ tone: "success", message: "Brouillon enregistré." });
        return;
      }

      const response = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as EmailSendApiResponse;
      if (!response.ok || !result.ok) {
        throw new Error(cleanText(result.details) || cleanText(result.message) || "Envoi impossible.");
      }

      if (result.entry) {
        setHistory((current) => [result.entry!, ...current.filter((entry) => entry.id !== result.entry!.id)]);
      }

      if (result.mode === "fallback" && result.mailto_url) {
        setFeedback({
          tone: "warning",
          message: result.message || "Brevo non configuré. Ouverture du logiciel mail."
        });
        window.location.href = result.mailto_url;
      } else {
        const attachmentSummary =
          attachments.length > 0
            ? ` avec ${attachments.length} pièce(s) jointe(s) (${formatBytes(totalAttachmentSize)}).`
            : ".";
        setFeedback({
          tone: "success",
          message:
            action === "send_test"
              ? `Email test envoyé avec succès${attachmentSummary}`
              : `Email envoyé avec succès${attachmentSummary}`,
          details: result.messageId ? `MessageId Brevo : ${result.messageId}` : undefined
        });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Opération email impossible."
      });
    } finally {
      setSaving(false);
    }
  }

  function fieldLabel(field: string) {
    if (field === "email_destinataire") {
      return "Email destinataire";
    }
    return FIELD_CONFIG[field as VariableKey]?.label ?? field;
  }

  if (loading) {
    return (
      <main className="admin-page premium-page admin-emails-page">
        <section className="admin-hero admin-hero-logo">
          <BrandLogo alt="Event Pic" className="admin-hero-brand-logo" />
          <h1>Emails clients</h1>
          <p>Chargement de l’assistant email...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page premium-page admin-emails-page">
      <section className="admin-hero admin-hero-logo">
        <BrandLogo alt="Event Pic" className="admin-hero-brand-logo" />
        <h1>Emails clients</h1>
        <p>Préparation, prévisualisation et envoi d’emails Event Pic selon la cible.</p>
      </section>

      <nav className="admin-tabs" aria-label="Navigation admin">
        <Link href="/admin/demandes">Demandes</Link>
        <Link href="/admin/devis">Devis</Link>
        <Link href="/admin/dossiers">Dossiers</Link>
        <Link href="/admin/planning">Planning</Link>
        <Link href="/admin/livraisons">Livraisons</Link>
        <Link href="/admin/livreurs">Livreurs</Link>
        <Link href="/admin/templates">Templates</Link>
        <Link href="/admin/emails" aria-current="page">
          Emails clients
        </Link>
      </nav>

      <section className="admin-template-diagnostic email-assistant-toolbar">
        <button type="button" className={sourceMode === "request" ? "admin-button-dark" : ""} onClick={() => setSourceMode("request")}>
          Charger depuis une demande client
        </button>
        <button type="button" className={sourceMode === "prospecting" ? "admin-button-dark" : ""} onClick={() => setSourceMode("prospecting")}>
          Créer un email de prospection
        </button>
        <button
          type="button"
          className={sourceMode === "free" ? "admin-button-dark" : ""}
          onClick={() => {
            setSourceMode("free");
            setSelectedPresetId("free-email");
          }}
        >
          Créer un email libre
        </button>
        <button
          type="button"
          className={sourceMode === "campaign" ? "admin-button-dark" : ""}
          onClick={() => {
            setSourceMode("campaign");
            if (!campaignCompatiblePresets.some((preset) => preset.id === selectedPreset.id)) {
              setSelectedPresetId("school-prospect");
            }
          }}
        >
          Campagne email
        </button>
      </section>

      {feedback ? (
        <section className={`email-feedback email-feedback-${feedback.tone}`}>
          <strong>{feedback.message}</strong>
          {feedback.details ? <span>{feedback.details}</span> : null}
        </section>
      ) : null}

      <section className="admin-template-diagnostic email-deliverability-checklist">
        <div>
          <h2>Délivrabilité email</h2>
          <p>À vérifier dans la configuration DNS de votre domaine si le système ne peut pas le confirmer automatiquement.</p>
        </div>
        <ul>
          <li>SPF configuré</li>
          <li>DKIM configuré</li>
          <li>DMARC configuré</li>
          <li>Domaine d’envoi vérifié</li>
          <li>Pièces jointes contrôlées : 10 Mo/fichier</li>
          <li>Version texte incluse</li>
          <li>Mention STOP présente pour prospection</li>
        </ul>
      </section>

      {sourceMode === "campaign" ? (
        <section className="email-assistant-layout email-campaign-layout">
          <section className="email-assistant-main">
            <section className="email-assistant-step premium-card">
              <div className="email-step-heading">
                <span>Campagne email</span>
                <h2>Envoyer en lot sans email groupé</h2>
              </div>
              <p className="email-muted-copy">
                Règle appliquée : 1 email individuel par destinataire. Aucun contact n’est placé en À multiple, CC ou CCI.
                Les lots sont envoyés manuellement pour garder un rythme compatible délivrabilité.
              </p>
              <div className="email-campaign-settings-grid">
                <article>
                  <span>Lot</span>
                  <strong>{campaignSettings.batchSize}</strong>
                  <small>emails maximum par action</small>
                </article>
                <article>
                  <span>Limite jour</span>
                  <strong>{campaignSettings.dailyLimit}</strong>
                  <small>emails maximum au départ</small>
                </article>
                <article>
                  <span>Rythme</span>
                  <strong>{campaignSettings.manualBatchMode ? "Manuel" : `${campaignSettings.delaySeconds}s`}</strong>
                  <small>attendre 5 à 10 min entre deux lots</small>
                </article>
              </div>
            </section>

            <section className="email-assistant-step premium-card">
              <div className="email-step-heading">
                <span>Étape 1</span>
                <h2>Choisir un preset compatible campagne</h2>
              </div>
              <div className="email-preset-grid">
                {campaignCompatiblePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`email-preset-card ${selectedPreset.id === preset.id ? "is-selected" : ""}`}
                    onClick={() => choosePreset(preset)}
                  >
                    <span>{preset.audience}</span>
                    <strong>{preset.label}</strong>
                    <small>{preset.usage}</small>
                  </button>
                ))}
              </div>
              <div className="email-compliance-warning">
                Les campagnes B2B, écoles et mairies doivent rester liées à l’activité ou à l’établissement. La prospection B2C froide vers particuliers inconnus n’est pas proposée par défaut.
              </div>
            </section>

            <section className="email-assistant-step premium-card">
              <div className="email-step-heading">
                <span>Étape 2</span>
                <h2>Importer ou sélectionner les destinataires</h2>
              </div>
              <div className="email-compose-grid">
                <label>
                  Liste existante
                  <select
                    value={campaignListId}
                    onChange={(event) => {
                      setCampaignListId(event.target.value);
                      setCampaignId("");
                    }}
                  >
                    <option value="">Sélectionner une liste</option>
                    {campaignLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} - {list.contacts.length} contact(s)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nom de la nouvelle liste
                  <input
                    value={campaignListName}
                    onChange={(event) => setCampaignListName(event.target.value)}
                    placeholder="Ex. Écoles 77 - mai 2026"
                  />
                </label>
                <label className="email-input-full">
                  Import CSV
                  <input accept=".csv,.txt,.xlsx,.xlsm,.xls" onChange={(event) => void readCampaignFile(event)} type="file" />
                  <small>Colonnes acceptées : email, prénom, nom, établissement, ville, type_cible, fonction, téléphone, notes, stop.</small>
                </label>
                <label className="email-input-full">
                  Coller un CSV
                  <textarea
                    value={campaignCsvContent}
                    onChange={(event) => setCampaignCsvContent(event.target.value)}
                    placeholder="email;prenom;nom;etablissement;ville;type_cible;fonction;notes;stop"
                  />
                </label>
              </div>
              <div className="email-actions-row">
                <button type="button" onClick={() => void previewCampaignCsv()}>
                  Prévisualiser le CSV
                </button>
                <button type="button" className="admin-button-dark" onClick={() => void importCampaignCsv()}>
                  Importer côté admin
                </button>
              </div>
              {campaignPreview ? (
                <div className="email-campaign-preview">
                  <strong>Résumé import</strong>
                  <ul>
                    <li>{campaignPreview.summary.valid} contact(s) valide(s)</li>
                    <li>{campaignPreview.summary.invalid} email(s) invalide(s)</li>
                    <li>{campaignPreview.summary.duplicates} doublon(s) ignoré(s)</li>
                    <li>{campaignPreview.summary.stop} contact(s) STOP / désinscrit(s)</li>
                  </ul>
                  {campaignPreview.errors.length > 0 ? (
                    <small>{campaignPreview.errors.slice(0, 4).map((error) => `Ligne ${error.row}: ${error.message}`).join(" · ")}</small>
                  ) : null}
                </div>
              ) : null}
              {selectedCampaignList ? (
                <div className="email-campaign-preview">
                  <strong>{selectedCampaignList.name}</strong>
                  <small>{selectedCampaignList.contacts.length} contact(s) dans la liste sélectionnée.</small>
                  <small>Les fichiers restent dans /data côté admin, jamais dans /public.</small>
                </div>
              ) : null}
            </section>

            <section className="email-assistant-step premium-card">
              <div className="email-step-heading">
                <span>Étape 3</span>
                <h2>Prévisualiser le message de campagne</h2>
              </div>
              <label className="email-input-full">
                Sujet
                <input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} />
              </label>
              <label className="email-input-full">
                Message
                <textarea value={bodyTemplate} onChange={(event) => setBodyTemplate(event.target.value)} />
              </label>
              <div className="email-compliance-box">
                <strong>Pièces jointes</strong>
                <p>Les pièces jointes lourdes augmentent le risque d’indésirable. Pour une campagne, privilégiez un lien vers la plaquette, le site, la page Entreprises ou la page Événements privés.</p>
              </div>
            </section>

            <section className="email-assistant-step premium-card">
              <div className="email-step-heading">
                <span>Étape 4</span>
                <h2>Confirmer et envoyer les prochains lots</h2>
              </div>
              <label className="email-marketing-consent">
                <input checked={campaignConfirm} onChange={(event) => setCampaignConfirm(event.target.checked)} type="checkbox" />
                Je confirme que ces contacts peuvent recevoir ce message et qu’ils disposent d’un moyen d’opposition.
              </label>
              <div className="email-campaign-preview">
                <strong>Avant envoi</strong>
                <ul>
                  <li>Preset : {selectedPreset.shortLabel}</li>
                  <li>Destinataires : {selectedCampaignList?.contacts.length ?? 0}</li>
                  <li>En attente : {activeCampaign?.pending ?? selectedCampaignList?.contacts.filter((contact) => !contact.unsubscribed).length ?? 0}</li>
                  <li>Envoyés : {activeCampaign?.sent ?? 0}</li>
                  <li>Erreurs : {activeCampaign?.failed ?? 0}</li>
                  <li>STOP / ignorés : {activeCampaign?.skipped ?? selectedCampaignList?.contacts.filter((contact) => contact.unsubscribed).length ?? 0}</li>
                </ul>
              </div>
              <div className="email-compose-grid">
                <label>
                  Email test
                  <input value={campaignTestTo} onChange={(event) => setCampaignTestTo(event.target.value)} placeholder="vous@eventpic.fr" type="email" />
                </label>
              </div>
              <div className="email-actions-row">
                <button type="button" disabled={campaignSending} onClick={() => void sendCampaignTest()}>
                  Envoyer un test
                </button>
                <button type="button" className="admin-button-dark" disabled={campaignSending} onClick={() => void sendCampaignBatch()}>
                  {campaignSending ? "Envoi du lot..." : `Envoyer les ${campaignSettings.batchSize} suivants`}
                </button>
              </div>
              {activeCampaign ? (
                <div className="email-history-table-wrap email-campaign-status-table">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Statut</th>
                        <th>Organisation</th>
                        <th>Erreur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCampaign.items.slice(0, 8).map((item) => (
                        <tr key={`${activeCampaign.id}-${item.email}`}>
                          <td>{item.email}</td>
                          <td>{campaignStatusLabel(item.status)}</td>
                          <td>{item.organization_name || item.city || "-"}</td>
                          <td>{item.error_message || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section className="admin-template-diagnostic email-history-panel">
              <h2>Historique campagnes</h2>
              <div className="email-history-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Liste</th>
                      <th>Statut</th>
                      <th>Envoyés</th>
                      <th>En attente</th>
                      <th>Erreurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignHistory.slice(0, 10).map((campaign) => (
                      <tr key={campaign.id}>
                        <td>{formatDateTime(campaign.updated_at || campaign.created_at)}</td>
                        <td>{campaign.list_name}</td>
                        <td>{campaignStatusLabel(campaign.status)}</td>
                        <td>{campaign.sent}</td>
                        <td>{campaign.pending}</td>
                        <td>{campaign.failed}</td>
                      </tr>
                    ))}
                    {campaignHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6}>Aucune campagne enregistrée.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <aside className="email-compose-preview premium-card">
            <h2>Aperçu campagne</h2>
            <div className="email-preview-meta">
              <span>Destinataires</span>
              <strong>{selectedCampaignList ? `${selectedCampaignList.contacts.length} contact(s)` : "Aucune liste"}</strong>
              <span>Sujet</span>
              <strong>{renderedSubject || "Non renseigné"}</strong>
              <span>Envoi</span>
              <strong>1 email individuel par destinataire</strong>
            </div>
            <div className="email-preview-tabs" role="tablist" aria-label="Mode aperçu campagne">
              <button type="button" className={previewMode === "html" ? "is-active" : ""} onClick={() => setPreviewMode("html")}>
                HTML Outlook/Gmail
              </button>
              <button type="button" className={previewMode === "text" ? "is-active" : ""} onClick={() => setPreviewMode("text")}>
                Texte brut
              </button>
            </div>
            {previewMode === "html" ? (
              <div className="email-html-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <pre className="email-text-preview">{previewText}</pre>
            )}
            <div className="email-compliance-box">
              <strong>Délivrabilité</strong>
              <p>SPF, DKIM, DMARC, domaine vérifié, version texte incluse, pièces jointes contrôlées, mention STOP et envoi progressif.</p>
            </div>
          </aside>
        </section>
      ) : (
      <section className="email-assistant-layout">
        <section className="email-assistant-main">
          <section className="email-assistant-step premium-card">
            <div className="email-step-heading">
              <span>Étape 1</span>
              <h2>Choisir le type d’email</h2>
            </div>
            <div className="email-preset-grid">
              {EMAIL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`email-preset-card ${selectedPreset.id === preset.id ? "is-selected" : ""}`}
                  onClick={() => choosePreset(preset)}
                >
                  <span>{preset.audience}</span>
                  <strong>{preset.label}</strong>
                  <small>{preset.usage}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="email-assistant-step premium-card">
            <div className="email-step-heading">
              <span>Étape 2</span>
              <h2>Renseigner les informations utiles</h2>
            </div>

            {sourceMode === "request" ? (
              <label className="email-input-full">
                Demande client
                <select
                  value={selectedRequestId}
                  onChange={(event) => {
                    const request = requests.find((item) => item.id === event.target.value);
                    if (request) {
                      applyRequest(request);
                    } else {
                      setSelectedRequestId("");
                    }
                  }}
                >
                  <option value="">Sélectionner une demande</option>
                  {requests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.client_full_name || request.client_email} - {request.event_type || "Événement"} - {request.event_date || "date non renseignée"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedRequest ? (
              <div className="email-request-summary">
                <strong>{selectedRequest.client_full_name || selectedRequest.client_email}</strong>
                <small>{selectedRequest.client_email}</small>
                <small>
                  {selectedRequest.event_type || "Événement"} {selectedRequest.event_date ? `- ${selectedRequest.event_date}` : ""}
                </small>
              </div>
            ) : null}

            <div className="email-compose-grid">
              <label>
                Email destinataire
                <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="client@email.fr" type="email" />
              </label>
              <label>
                Copie
                <input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="cc@email.fr" type="email" />
              </label>
              <label>
                Copie cachée
                <input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="bcc@email.fr" type="email" />
              </label>
              <label>
                Modèle IA utilisé
                <input value="Aucun - modèle Event Pic préparé" readOnly />
              </label>
            </div>

            <div className="email-variables-readable">
              {selectedPreset.fields.map((field) => {
                const fieldConfig = FIELD_CONFIG[field];
                return (
                  <label key={field} className={fieldConfig.type === "textarea" ? "email-input-full" : ""}>
                    {fieldConfig.label}
                    {fieldConfig.type === "textarea" ? (
                      <textarea
                        value={variables[field]}
                        onChange={(event) => updateVariable(field, event.target.value)}
                        placeholder={fieldConfig.placeholder}
                      />
                    ) : (
                      <input
                        value={variables[field]}
                        onChange={(event) => updateVariable(field, event.target.value)}
                        placeholder={fieldConfig.placeholder}
                        type={fieldConfig.type ?? "text"}
                      />
                    )}
                    {fieldConfig.help ? <small>{fieldConfig.help}</small> : null}
                  </label>
                );
              })}
            </div>

            {selectedPreset.needsConsentWarning ? (
              <div className="email-compliance-warning">{selectedPreset.complianceNote}</div>
            ) : null}
          </section>

          <section className="email-assistant-step premium-card">
            <div className="email-step-heading">
              <span>Étape 3</span>
              <h2>Générer le message</h2>
            </div>
            <div className="email-preset-summary">
              <div>
                <span>Preset</span>
                <strong>{selectedPreset.shortLabel}</strong>
                <small>{selectedPreset.usage}</small>
              </div>
              <button type="button" className="admin-button-dark" onClick={() => setGeneratedOnce(true)}>
                Générer le message
              </button>
            </div>

            <label className="email-input-full">
              Sujet
              <input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} />
            </label>
            <label className="email-input-full">
              Message
              <textarea value={bodyTemplate} onChange={(event) => setBodyTemplate(event.target.value)} />
            </label>

            <div className="email-suggested-attachments">
              <strong>Pièces jointes suggérées</strong>
              {selectedPreset.suggestedAttachments.length > 0 ? (
                <ul>
                  {selectedPreset.suggestedAttachments.map((attachment) => (
                    <li key={attachment}>{attachment}</li>
                  ))}
                </ul>
              ) : (
                <small>Aucune pièce jointe obligatoire pour ce modèle.</small>
              )}
            </div>

            <label className="email-input-full">
              Note interne
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Contexte, source du contact, rappel utile..."
              />
            </label>
          </section>

          <section className="email-assistant-step premium-card">
            <div className="email-step-heading">
              <span>Étape 4</span>
              <h2>Prévisualiser et envoyer</h2>
            </div>
            {selectedPreset.isMarketing ? (
              <label className="email-marketing-consent">
                <input
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  type="checkbox"
                />
                Le message est pertinent pour le destinataire et contient une opposition simple.
              </label>
            ) : null}

            {missingVariables.length > 0 && generatedOnce ? (
              <div className="email-required-variables">
                <strong>Variables manquantes</strong>
                <small>{missingVariables.map((field) => fieldLabel(field)).join(", ")}</small>
              </div>
            ) : null}

            <div className="email-actions-row">
              <button type="button" disabled={saving} onClick={() => void submitEmail("create_draft")}>
                Enregistrer le brouillon
              </button>
              <button type="button" disabled={saving || missingVariables.length > 0} onClick={() => void submitEmail("send_test")}>
                Envoyer un email test
              </button>
              <button
                type="button"
                className="admin-button-dark"
                disabled={saving || missingVariables.length > 0}
                onClick={() => void submitEmail("send")}
              >
                {saving ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </section>

          <section className="admin-template-diagnostic email-attachments-panel">
            <h2>Pièces jointes</h2>
            <p>Formats autorisés : PDF, PNG, JPG, JPEG, ZIP. Les fichiers restent côté admin et ne sont pas exposés au public.</p>
            <p>Limite claire : 10 Mo par fichier, 20 Mo par email. Un PDF de 4,7 Mo est accepté si le stockage Blob est actif.</p>
            <button
              type="button"
              className="email-upload-button"
              disabled={uploading}
              onClick={() => attachmentInputRef.current?.click()}
            >
              {uploading ? "Upload en cours..." : "Ajouter une pièce jointe"}
            </button>
            <input
              ref={attachmentInputRef}
              className="email-upload-input"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              disabled={uploading}
              multiple
              onChange={(event) => void uploadFiles(event)}
              type="file"
            />
            {attachments.length > 0 ? (
              <div className="email-attachments-list">
                {attachments.map((attachment) => (
                  <article key={attachment.id} className="email-attachment-item">
                    <strong>{attachment.file_name}</strong>
                    <small>
                      {formatBytes(attachment.size)} ·{" "}
                      {attachment.blob_path ? "prête via stockage sécurisé" : "prête pour l’envoi"}
                    </small>
                    <button type="button" onClick={() => void removeAttachment(attachment)}>
                      Retirer
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="admin-template-diagnostic email-history-panel">
            <h2>Historique emails</h2>
            <div className="email-history-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Destinataire</th>
                    <th>Sujet</th>
                    <th>Preset</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 12).map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.sent_at || entry.created_at)}</td>
                      <td>{entry.status}</td>
                      <td>{entry.to}</td>
                      <td>{entry.subject}</td>
                      <td>{entry.preset_id}</td>
                    </tr>
                  ))}
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Aucun email enregistré.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="email-compose-preview premium-card">
          <h2>Aperçu email</h2>
          <div className="email-preview-meta">
            <span>Destinataire</span>
            <strong>{to || "Non renseigné"}</strong>
            <span>Sujet</span>
            <strong>{renderedSubject || "Non renseigné"}</strong>
            <span>Pièces jointes</span>
            <strong>
              {attachments.length > 0
                ? `${attachments.length} fichier(s) · ${formatBytes(totalAttachmentSize)}`
                : "Aucune"}
            </strong>
          </div>

          {missingVariables.length > 0 ? (
            <div className="email-required-variables">
              <strong>Envoi bloqué</strong>
              <small>{missingVariables.map((field) => `Variable manquante : ${fieldLabel(field)}`).join(" · ")}</small>
            </div>
          ) : null}

          <div className="email-preview-tabs" role="tablist" aria-label="Mode aperçu email">
            <button
              type="button"
              className={previewMode === "html" ? "is-active" : ""}
              onClick={() => setPreviewMode("html")}
            >
              HTML Outlook/Gmail
            </button>
            <button
              type="button"
              className={previewMode === "text" ? "is-active" : ""}
              onClick={() => setPreviewMode("text")}
            >
              Texte brut
            </button>
          </div>

          {previewMode === "html" ? (
            <div className="email-html-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <pre className="email-text-preview">{previewText}</pre>
          )}

          <div className="email-compliance-box">
            <strong>Conformité</strong>
            <p>{selectedPreset.complianceNote}</p>
            {selectedPreset.isMarketing ? (
              <p>La mention STOP est ajoutée automatiquement dans les emails de prospection.</p>
            ) : null}
          </div>

          <div className="email-deliverability-mini">
            <strong>Configuration</strong>
            <small>{config.brevo_configured ? "Brevo configuré" : "Brevo non configuré : fallback mailto possible"}</small>
            <small>{`Expéditeur : ${config.email_from_email || "contact@eventpic.fr"}`}</small>
          </div>
        </aside>
      </section>
      )}
    </main>
  );
}
