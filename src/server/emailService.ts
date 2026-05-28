import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { listEventPicTemplateRequests } from "@/src/server/eventPicTemplateRequests";
import { listQuoteRequests } from "@/src/server/publicLeadService";
import { EventPicTemplateRequest } from "@/src/shared/eventPicTemplates";

const EMAIL_PRESETS_PATH = path.join(process.cwd(), "data", "email-presets.json");
const EMAIL_HISTORY_PATH = path.join(process.cwd(), "data", "email-history.json");
const EMAIL_ATTACHMENTS_DIR = path.join(process.cwd(), "data", "email-attachments");
const CAN_WRITE_EMAIL_ATTACHMENTS_TO_DISK = process.env.VERCEL !== "1";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EMAIL_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const VERIFIED_BREVO_SENDER_EMAIL = "contact@eventpic.fr";
const LEGACY_OUTLOOK_CONTACT_EMAIL = "event_pic@outlook.fr";
const BREVO_REPLY_TO_NAME = "Event Pic";
const BREVO_REPLY_TO_EMAIL = LEGACY_OUTLOOK_CONTACT_EMAIL;
const EVENT_PIC_SITE_URL = "https://www.eventpic.fr";
const EVENT_PIC_EMAIL_LOGO_URL = `${EVENT_PIC_SITE_URL}/images/event-pic/logo-event-pic-email-round.png`;
const EVENT_PIC_EMAIL_LOGO_SIZE = 96;
const EVENT_PIC_EMAIL_SIGNATURE_STYLE =
  "font-family:'Great Vibes','Allura','Parisienne','Brush Script MT','Segoe Script',cursive;font-size:28px;line-height:1;color:#B88A35;font-weight:400;letter-spacing:0;text-transform:none;";
const EVENT_PIC_EMAIL_SIGNATURE_FOOTER_STYLE =
  "font-family:'Great Vibes','Allura','Parisienne','Brush Script MT','Segoe Script',cursive;font-size:24px;line-height:1;color:#B88A35;font-weight:400;letter-spacing:0;text-transform:none;";
const MARKETING_UNSUBSCRIBE_LINE =
  "Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP à cet email.";
const NON_BLOCKING_MISSING_VARIABLES = new Set(["gallery_url"]);
const GOOGLE_REVIEW_CTA_PRESET_IDS = new Set([
  "demande-avis-google",
  "relance-avis-douce",
  "google-review-request",
  "relance-galerie-avis"
]);
const GALLERY_REQUIRED_PRESET_IDS = new Set([
  "remerciement-galerie",
  "mail-mariage-premium",
  "mail-anniversaire",
  "mail-entreprise",
  // Compat legacy presets
  "remerciement-apres-evenement",
  "envoi-galerie-photos",
  "relance-galerie-avis"
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".zip"]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip"
]);

export type EmailPresetCategory = "operational" | "marketing" | "custom";

export type EmailPreset = {
  id: string;
  label: string;
  subject_template: string;
  body_template: string;
  category: EmailPresetCategory;
  marketing_required: boolean;
};

export type EmailAttachmentMeta = {
  id: string;
  file_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  content_base64?: string;
};

export type EmailHistoryStatus = "draft" | "sent" | "failed" | "test_sent";

export type EmailHistoryEntry = {
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
  attachments: EmailAttachmentMeta[];
  provider: "brevo" | "mailto" | "copy";
  message_id: string;
  error_message: string;
  is_marketing: boolean;
  marketing_consent: boolean;
  note: string;
  variables: Record<string, string>;
};

export type EmailRequestSummary = {
  id: string;
  source: "template_request" | "quote_request";
  client_first_name: string;
  client_last_name: string;
  client_full_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  event_type: string;
  selected_template_name: string;
  package_label: string;
  options_summary: string;
  gallery_url: string;
  google_review_url: string;
};

export type EmailTemplateVariables = Record<string, string>;

export type RenderedTemplateResult = {
  rendered: string;
  missing_variables: string[];
  used_variables: string[];
};

export type EmailPayload = {
  request_id?: string | null;
  client_name?: string | null;
  to?: string;
  cc?: string;
  bcc?: string;
  subject_template?: string;
  body_template?: string;
  preset_id?: string;
  variables?: Record<string, unknown>;
  attachments?: Array<Partial<EmailAttachmentMeta>>;
  note?: string;
  marketing_consent?: boolean;
  is_marketing?: boolean;
};

type ValidateEmailPayloadOptions = {
  allow_missing_variables?: boolean;
  require_marketing_consent?: boolean;
  require_recipient?: boolean;
};

type ValidatedAttachment = EmailAttachmentMeta & {
  absolute_path?: string;
  content_base64?: string;
};

type ValidatedEmailPayload = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject_template: string;
  body_template: string;
  rendered_subject: string;
  rendered_body: string;
  preset_id: string;
  variables: Record<string, string>;
  attachments: ValidatedAttachment[];
  note: string;
  request_id: string;
  client_name: string;
  missing_variables: string[];
  blocking_missing_variables: string[];
  unresolved_variables: string[];
  used_variables: string[];
  unresolved_placeholders: boolean;
  is_marketing: boolean;
  marketing_consent: boolean;
};

const DEFAULT_EMAIL_PRESETS: EmailPreset[] = [
  {
    id: "remerciement-galerie",
    label: "Remerciement après événement + galerie",
    category: "operational",
    marketing_required: false,
    subject_template: "Merci pour votre confiance - vos photos Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore pour votre confiance lors de votre événement du {{event_date}}.",
      "",
      "Nous espérons que le photobooth a apporté une belle animation et de beaux souvenirs à vos invités.",
      "",
      "Votre galerie photo est disponible ici :",
      "{{gallery_url}}",
      "",
      "Merci encore,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "remerciement-sans-galerie",
    label: "Remerciement sans galerie",
    category: "operational",
    marketing_required: false,
    subject_template: "Merci pour votre confiance - Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore pour votre confiance lors de votre événement du {{event_date}}.",
      "",
      "Nous espérons que notre prestation a contribué à créer de beaux souvenirs pour vous et vos invités.",
      "",
      "Au plaisir de vous accompagner à nouveau sur un prochain événement.",
      "",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "demande-avis-google",
    label: "Demande d'avis Google",
    category: "operational",
    marketing_required: false,
    subject_template: "Votre avis compte pour Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore pour votre confiance.",
      "",
      "Si vous avez apprécié notre prestation, vous pouvez laisser un avis Google ici :",
      "",
      "{{google_review_url}}",
      "",
      "Votre retour nous aide beaucoup à développer Event Pic.",
      "",
      "Merci par avance,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "offre-30-euros",
    label: "Avantage Event Pic prochaine réservation",
    category: "marketing",
    marketing_required: true,
    subject_template: "Votre avantage Event Pic pour un prochain événement",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore pour votre confiance.",
      "",
      "Pour vous remercier, vous bénéficiez de 30 EUR de remise sur votre prochaine réservation Event Pic.",
      "",
      "Code avantage :",
      "{{coupon_code}}",
      "",
      "À bientôt,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "relance-avis-douce",
    label: "Relance avis Google douce",
    category: "marketing",
    marketing_required: true,
    subject_template: "Petit retour sur votre expérience Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "J’espère que vous avez passé un excellent moment lors de votre événement.",
      "",
      "Si notre prestation vous a plu, votre avis Google nous aiderait beaucoup :",
      "",
      "{{google_review_url}}",
      "",
      "Merci encore pour votre confiance.",
      "",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "mail-mariage-premium",
    label: "Mail mariage premium",
    category: "operational",
    marketing_required: false,
    subject_template: "Merci pour votre confiance - Event Pic Mariage",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci de nous avoir fait confiance pour votre mariage.",
      "",
      "Nous esperons que le photobooth a apporte une touche elegante, conviviale et memorable a votre reception.",
      "",
      "Vous pouvez retrouver vos photos ici :",
      "{{gallery_url}}",
      "",
      "Avec tous nos voeux de bonheur,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "mail-anniversaire",
    label: "Mail anniversaire",
    category: "operational",
    marketing_required: false,
    subject_template: "Merci pour votre anniversaire avec Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci encore pour votre confiance pour votre anniversaire.",
      "",
      "Nous esperons que vos invites ont apprecie le photobooth et que vous garderez de beaux souvenirs de cette journee.",
      "",
      "Votre galerie est disponible ici :",
      "{{gallery_url}}",
      "",
      "A bientot,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "mail-entreprise",
    label: "Mail entreprise",
    category: "operational",
    marketing_required: false,
    subject_template: "Merci pour votre evenement professionnel - Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "Merci pour votre confiance lors de votre evenement professionnel.",
      "",
      "Nous esperons que notre animation photobooth a contribue a creer une experience conviviale et marquante pour vos invites.",
      "",
      "Vous pouvez consulter les photos ici :",
      "{{gallery_url}}",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "relance-commerciale-douce",
    label: "Relance commerciale douce",
    category: "marketing",
    marketing_required: true,
    subject_template: "Un nouveau projet evenementiel ?",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "J'espere que vous allez bien.",
      "",
      "Nous serions ravis de vous accompagner a nouveau pour un prochain evenement : mariage, anniversaire, soiree privee ou evenement professionnel.",
      "",
      "N'hesitez pas a nous contacter pour une nouvelle prestation Event Pic.",
      "",
      "A bientot,",
      "Event Pic"
    ].join("\n")
  },
  {
    id: "mail-personnalise-libre",
    label: "Mail personnalise libre",
    category: "custom",
    marketing_required: false,
    subject_template: "Message Event Pic",
    body_template: [
      "Bonjour {{client_first_name}},",
      "",
      "{{custom_message}}",
      "",
      "Cordialement,",
      "Event Pic"
    ].join("\n")
  }
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanBase64(value: unknown) {
  const text = cleanText(value);
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    return "";
  }
  return text;
}

function toLower(value: string) {
  return value.toLowerCase();
}

function resolveBrevoSenderEmail() {
  const configuredEmail = cleanText(process.env.EMAIL_FROM_EMAIL);

  if (!configuredEmail || toLower(configuredEmail) === LEGACY_OUTLOOK_CONTACT_EMAIL) {
    return VERIFIED_BREVO_SENDER_EMAIL;
  }

  return configuredEmail;
}

function resolveBrevoReplyTo() {
  return {
    email: BREVO_REPLY_TO_EMAIL,
    name: BREVO_REPLY_TO_NAME
  };
}

function ensureNoPathTraversal(fileName: string) {
  const baseName = path.basename(fileName);

  if (!baseName || baseName !== fileName) {
    throw new Error("Nom de fichier invalide.");
  }

  return baseName;
}

function isAllowedAttachment(fileName: string, mimeType: string) {
  const extension = toLower(path.extname(fileName));
  const mime = toLower(mimeType);
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) && ALLOWED_ATTACHMENT_MIME_TYPES.has(mime);
}

function isValidEmail(value: string) {
  return EMAIL_RE.test(value);
}

function parseEmailList(value: string) {
  if (!value.trim()) {
    return [] as string[];
  }

  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureJsonFile(filePath: string, defaultContents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultContents, "utf8");
  }
}

async function ensureAttachmentsDir() {
  await fs.mkdir(EMAIL_ATTACHMENTS_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return (parsed as T) ?? fallback;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizePreset(input: Partial<EmailPreset>): EmailPreset | null {
  const id = cleanText(input.id);
  const label = cleanText(input.label);
  const subjectTemplate = cleanText(input.subject_template);
  const bodyTemplate = cleanText(input.body_template);

  if (!id || !label || !subjectTemplate || !bodyTemplate) {
    return null;
  }

  const category: EmailPresetCategory =
    input.category === "marketing" || input.category === "custom" ? input.category : "operational";

  return {
    id,
    label,
    subject_template: subjectTemplate,
    body_template: bodyTemplate,
    category,
    marketing_required: input.marketing_required === true || category === "marketing"
  };
}

function normalizeAttachment(input: Partial<EmailAttachmentMeta>): EmailAttachmentMeta | null {
  const id = cleanText(input.id);
  const fileName = cleanText(input.file_name);
  const storedName = cleanText(input.stored_name);
  const mimeType = cleanText(input.mime_type);
  const contentBase64 = cleanBase64(input.content_base64);
  const size =
    typeof input.size === "number" && Number.isFinite(input.size) && input.size > 0
      ? Math.floor(input.size)
      : 0;
  const uploadedAt = cleanText(input.uploaded_at) || new Date().toISOString();

  if (!id || !fileName || !storedName || !mimeType || size <= 0) {
    return null;
  }

  return {
    id,
    file_name: fileName,
    stored_name: storedName,
    mime_type: mimeType,
    size,
    uploaded_at: uploadedAt,
    ...(contentBase64 ? { content_base64: contentBase64 } : {})
  };
}

function normalizeHistoryEntry(input: Partial<EmailHistoryEntry>): EmailHistoryEntry | null {
  const id = cleanText(input.id);

  if (!id) {
    return null;
  }

  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .map((attachment) => normalizeAttachment(attachment))
        .filter((attachment): attachment is EmailAttachmentMeta => Boolean(attachment))
    : [];

  const status: EmailHistoryStatus =
    input.status === "sent" || input.status === "failed" || input.status === "test_sent"
      ? input.status
      : "draft";
  const provider: EmailHistoryEntry["provider"] =
    input.provider === "brevo" || input.provider === "mailto" ? input.provider : "copy";

  return {
    id,
    created_at: cleanText(input.created_at) || new Date().toISOString(),
    sent_at: cleanText(input.sent_at) || null,
    status,
    request_id: cleanText(input.request_id),
    client_name: cleanText(input.client_name),
    to: cleanText(input.to),
    cc: cleanText(input.cc),
    bcc: cleanText(input.bcc),
    subject: cleanText(input.subject),
    preset_id: cleanText(input.preset_id),
    body_preview: cleanText(input.body_preview),
    body: cleanText(input.body),
    attachments,
    provider,
    message_id: cleanText(input.message_id),
    error_message: cleanText(input.error_message),
    is_marketing: input.is_marketing === true,
    marketing_consent: input.marketing_consent === true,
    note: cleanText(input.note),
    variables:
      input.variables && typeof input.variables === "object"
        ? Object.entries(input.variables).reduce<Record<string, string>>((acc, [key, value]) => {
            const normalized = cleanText(value);
            if (normalized) {
              acc[key] = normalized;
            }
            return acc;
          }, {})
        : {}
  };
}

async function appendHistoryEntry(entry: EmailHistoryEntry) {
  const history = await listEmailHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 1000);
  await writeJsonFile(EMAIL_HISTORY_PATH, trimmed);
  return entry;
}

function buildBodyPreview(body: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 260) {
    return normalized;
  }
  return `${normalized.slice(0, 257)}...`;
}

function containsTemplatePlaceholders(value: string) {
  return /{{\s*[a-zA-Z0-9_]+\s*}}/.test(value);
}

function hasPlaceholder(value: string, placeholderName: string) {
  return new RegExp(`{{\\s*${escapeRegExp(placeholderName)}\\s*}}`, "i").test(value);
}

function ensurePlaceholdersPreserved(
  original: string,
  candidate: string,
  options: { appendMode: "line" | "inline" }
) {
  const required = extractTemplateVariables(original);
  if (required.length === 0) {
    return cleanText(candidate);
  }

  let output = cleanText(candidate);
  for (const variableName of required) {
    if (hasPlaceholder(output, variableName)) {
      continue;
    }

    const placeholder = `{{${variableName}}}`;
    output =
      options.appendMode === "line"
        ? `${output}\n${placeholder}`.trim()
        : `${output} ${placeholder}`.trim();
  }

  return output;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtmlContent(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function linkifyEscapedText(value: string) {
  return value.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#B88A35;text-decoration:none;font-weight:600;">${url}</a>`
  );
}

function renderBodyToPremiumHtml(body: string) {
  const paragraphs = body
    .split(/\r?\n\r?\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return `<p style="margin:0 0 12px 0;color:#4A4238;line-height:1.7;font-size:15px;">-</p>`;
  }

  return paragraphs
    .map((paragraph) => {
      const withLinks = linkifyEscapedText(textToHtmlContent(paragraph));
      return `<p style="margin:0 0 12px 0;color:#4A4238;line-height:1.72;font-size:15px;">${withLinks}</p>`;
    })
    .join("");
}

function buildCtaButton(label: string, url: string) {
  const safeUrl = escapeHtml(url);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0;">
    <tr>
      <td bgcolor="#050403" style="border:1px solid #B88A35;padding:12px 18px;">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:18px;">${escapeHtml(
          label
        )}</a>
      </td>
    </tr>
  </table>`;
}

function buildPremiumEmailHtml(input: {
  subject: string;
  body: string;
  variables: Record<string, string>;
  isMarketing: boolean;
  presetId: string;
}) {
  const galleryUrl = cleanText(input.variables.gallery_url);
  const googleReviewUrl = cleanText(input.variables.google_review_url);
  const couponCode = cleanText(input.variables.coupon_code);
  const ctaLabel = cleanText(input.variables.cta_label);
  const ctaUrl = cleanText(input.variables.cta_url);
  const logoUrl = EVENT_PIC_EMAIL_LOGO_URL;
  const companyName = cleanText(input.variables.company_name) || "Event Pic";
  const phoneNumber = cleanText(input.variables.phone_number) || "07 60 42 18 76";
  const fromEmail = resolveBrevoSenderEmail();
  const instagramUrl =
    cleanText(input.variables.instagram_url) || "https://www.instagram.com/_event_pic";
  const couponAmount = cleanText(input.variables.coupon_amount) || "30 €";

  const ctas: string[] = [];
  if (galleryUrl) {
    ctas.push(buildCtaButton("Voir la galerie photo", galleryUrl));
  }
  if (googleReviewUrl && GOOGLE_REVIEW_CTA_PRESET_IDS.has(input.presetId)) {
    ctas.push(buildCtaButton("Laisser un avis Google", googleReviewUrl));
  }
  if (ctaLabel && ctaUrl && !(googleReviewUrl && ctaLabel === "Laisser un avis Google" && ctaUrl === googleReviewUrl)) {
    ctas.push(buildCtaButton(ctaLabel, ctaUrl));
  }

  const couponBox = input.presetId === "post-event-offer-30" && couponCode
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 0 0;border:1px dashed #B88A35;background:#FBF7EF;border-collapse:collapse;">
         <tr>
           <td style="padding:14px 16px;">
             <p style="margin:0 0 4px 0;font-size:13px;color:#6B6258;line-height:18px;">Code avantage</p>
             <p style="margin:0;font-size:18px;font-weight:700;color:#050403;line-height:24px;">${escapeHtml(couponCode)}</p>
             <p style="margin:3px 0 0 0;font-size:13px;color:#6B6258;line-height:18px;">Valeur: ${escapeHtml(couponAmount)}</p>
           </td>
         </tr>
       </table>`
    : "";

  const marketingFooter = input.isMarketing
    ? `<p style="margin:16px 0 0 0;font-size:12px;color:#6B6258;line-height:1.6;">${escapeHtml(
        MARKETING_UNSUBSCRIBE_LINE
      )}</p>`
    : "";

  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FBF7EF;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fffdf9;border:1px solid #E8D9C2;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 20px 28px;background:#F6EFE3;border-bottom:1px solid #E8D9C2;text-align:center;">
                <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 10px auto;border-collapse:collapse;">
                  <tr>
                    <td align="center" width="${EVENT_PIC_EMAIL_LOGO_SIZE}" height="${EVENT_PIC_EMAIL_LOGO_SIZE}" style="width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;height:${EVENT_PIC_EMAIL_LOGO_SIZE}px;border-radius:50%;overflow:hidden;line-height:0;background:transparent;">
                      <img src="${escapeHtml(logoUrl)}" alt="Event Pic" width="${EVENT_PIC_EMAIL_LOGO_SIZE}" height="${EVENT_PIC_EMAIL_LOGO_SIZE}" style="width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;height:${EVENT_PIC_EMAIL_LOGO_SIZE}px;max-width:${EVENT_PIC_EMAIL_LOGO_SIZE}px;border-radius:50%;object-fit:cover;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;" />
                    </td>
                  </tr>
                </table>
                <div style="${EVENT_PIC_EMAIL_SIGNATURE_STYLE}">${escapeHtml(companyName)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.35;color:#050403;">${escapeHtml(
                  input.subject
                )}</h1>
                ${renderBodyToPremiumHtml(input.body)}
                ${couponBox}
                ${
                  ctas.length > 0
                    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 4px 0;border-collapse:collapse;"><tr><td>${ctas[0]}</td></tr></table>`
                    : ""
                }
                <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E8D9C2;">
                  <div style="${EVENT_PIC_EMAIL_SIGNATURE_FOOTER_STYLE}">Event Pic</div>
                  <div style="color:#4A4238;font-size:13px;line-height:1.6;">
                    Photobooth & animations evenementielles<br />
                    Ile-de-France<br />
                    ${escapeHtml(phoneNumber)}<br />
                    Email : <a href="mailto:${escapeHtml(
                      fromEmail
                    )}" style="color:#B88A35;text-decoration:none;">${escapeHtml(fromEmail)}</a><br />
                    Instagram : <a href="${escapeHtml(
                      instagramUrl
                    )}" target="_blank" rel="noopener noreferrer" style="color:#B88A35;text-decoration:none;">${escapeHtml(
                      instagramUrl
                    )}</a>
                  </div>
                </div>
                ${marketingFooter}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

function buildPlainTextEmail(input: {
  subject: string;
  body: string;
  variables: Record<string, string>;
  isMarketing: boolean;
}) {
  const phoneNumber = cleanText(input.variables.phone_number) || "07 60 42 18 76";
  const fromEmail = resolveBrevoSenderEmail();
  const instagramUrl = cleanText(input.variables.instagram_url) || "https://www.instagram.com/_event_pic";
  const footer = [
    "",
    "Event Pic",
    "Photobooth & animations evenementielles",
    "Ile-de-France",
    `Telephone : ${phoneNumber}`,
    `Email : ${fromEmail}`,
    `Instagram : ${instagramUrl}`
  ];

  if (input.isMarketing) {
    footer.push("", MARKETING_UNSUBSCRIBE_LINE);
  }

  return [`Sujet : ${input.subject}`, "", input.body.trim(), ...footer].join("\n").trim();
}

function extractIpAddress(value: string) {
  const match = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  return match?.[0] ?? "";
}

function normalizeBrevoErrorMessage(rawMessage: string) {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes("brevo api error (401)") &&
    (lower.includes("unrecognised ip address") || lower.includes("unrecognized ip address"))
  ) {
    const ip = extractIpAddress(rawMessage);
    const prefix = ip
      ? `Brevo bloque l'envoi : IP non autorisee (${ip}).`
      : "Brevo bloque l'envoi : IP non autorisee.";
    return `${prefix} ${rawMessage}`.trim();
  }
  return rawMessage;
}

function applyMarketingFooter(body: string, isMarketing: boolean) {
  if (!isMarketing) {
    return body;
  }

  const normalizedBody = body.trimEnd();

  if (normalizedBody.toLowerCase().includes(MARKETING_UNSUBSCRIBE_LINE.toLowerCase())) {
    return normalizedBody;
  }

  return `${normalizedBody}\n\n${MARKETING_UNSUBSCRIBE_LINE}`;
}

function requiresGalleryUrlForPreset(presetId: string) {
  return GALLERY_REQUIRED_PRESET_IDS.has(cleanText(presetId));
}

function resolveClientName(payload: EmailPayload, variables: Record<string, string>) {
  const direct = cleanText(payload.client_name);
  if (direct) {
    return direct;
  }

  const full = cleanText(variables.client_full_name);
  if (full) {
    return full;
  }

  const first = cleanText(variables.client_first_name);
  const last = cleanText(variables.client_last_name);
  return `${first} ${last}`.trim();
}

async function resolveAttachments(
  attachmentsInput: Array<Partial<EmailAttachmentMeta>>
): Promise<ValidatedAttachment[]> {
  if (!Array.isArray(attachmentsInput) || attachmentsInput.length === 0) {
    return [];
  }

  const resolved: ValidatedAttachment[] = [];
  let totalSize = 0;

  for (const rawAttachment of attachmentsInput) {
    const attachment = normalizeAttachment(rawAttachment);
    if (!attachment) {
      throw new Error("Piece jointe invalide.");
    }

    if (!isAllowedAttachment(attachment.file_name, attachment.mime_type)) {
      throw new Error(
        `Type de piece jointe non autorise (${attachment.file_name}). Formats autorises: PDF, PNG, JPG, JPEG, ZIP.`
      );
    }

    if (attachment.content_base64) {
      const buffer = Buffer.from(attachment.content_base64, "base64");
      if (buffer.length === 0) {
        throw new Error(`Piece jointe invalide: ${attachment.file_name}`);
      }

      if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
        throw new Error(`La piece jointe ${attachment.file_name} depasse 10 MB.`);
      }

      totalSize += buffer.length;

      if (totalSize > MAX_EMAIL_ATTACHMENTS_BYTES) {
        throw new Error("La taille totale des pieces jointes depasse 20 MB.");
      }

      resolved.push({
        ...attachment,
        size: buffer.length,
        content_base64: attachment.content_base64
      });
      continue;
    }

    await ensureAttachmentsDir();
    const storedName = ensureNoPathTraversal(attachment.stored_name);
    const absolutePath = path.join(EMAIL_ATTACHMENTS_DIR, storedName);
    const stats = await fs.stat(absolutePath).catch(() => null);

    if (!stats || !stats.isFile()) {
      throw new Error(`Piece jointe introuvable: ${attachment.file_name}`);
    }

    if (stats.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`La piece jointe ${attachment.file_name} depasse 10 MB.`);
    }

    totalSize += stats.size;

    if (totalSize > MAX_EMAIL_ATTACHMENTS_BYTES) {
      throw new Error("La taille totale des pieces jointes depasse 20 MB.");
    }

    resolved.push({
      ...attachment,
      size: stats.size,
      absolute_path: absolutePath
    });
  }

  return resolved;
}

function buildMailtoLink(input: {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
}) {
  const to = input.to.join(",");
  const params = new URLSearchParams();

  if (input.cc.length > 0) {
    params.set("cc", input.cc.join(","));
  }
  if (input.bcc.length > 0) {
    params.set("bcc", input.bcc.join(","));
  }
  params.set("subject", input.subject);
  params.set("body", input.body);

  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

async function sendViaBrevo(input: {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  htmlContent?: string;
  textContent?: string;
  isMarketing: boolean;
  attachments: ValidatedAttachment[];
}) {
  const apiKey = cleanText(process.env.BREVO_API_KEY);
  const fromEmail = resolveBrevoSenderEmail();
  const fromName = cleanText(process.env.EMAIL_FROM_NAME) || "Event Pic";
  const replyTo = resolveBrevoReplyTo();

  if (!apiKey) {
    throw new Error("Envoi automatique non configure.");
  }

  const attachmentPayload =
    input.attachments.length > 0
      ? await Promise.all(
          input.attachments.map(async (attachment) => {
            if (attachment.content_base64) {
              return {
                name: attachment.file_name,
                content: attachment.content_base64
              };
            }

            let fileBuffer: Buffer;
            try {
              if (!attachment.absolute_path) {
                throw new Error("missing attachment path");
              }
              fileBuffer = await fs.readFile(attachment.absolute_path);
            } catch {
              throw new Error(`Impossible de joindre le fichier ${attachment.file_name}.`);
            }
            return {
              name: attachment.file_name,
              content: fileBuffer.toString("base64")
            };
          })
        )
      : undefined;

  const unsubscribeUrl = cleanText(process.env.EMAIL_UNSUBSCRIBE_URL);
  const unsubscribeEmail = replyTo.email || fromEmail;
  const unsubscribeHeaders = input.isMarketing
    ? {
        "List-Unsubscribe": unsubscribeUrl
          ? `<mailto:${unsubscribeEmail}?subject=STOP>, <${unsubscribeUrl}>`
          : `<mailto:${unsubscribeEmail}?subject=STOP>`,
        ...(unsubscribeUrl ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {})
      }
    : {};

  const payload = {
    sender: {
      name: fromName,
      email: fromEmail
    },
    to: input.to.map((email) => ({ email })),
    subject: input.subject,
    htmlContent: cleanText(input.htmlContent) || textToHtmlContent(input.body),
    textContent: cleanText(input.textContent) || input.body,
    attachment: attachmentPayload,
    ...(Object.keys(unsubscribeHeaders).length > 0 ? { headers: unsubscribeHeaders } : {}),
    ...(input.cc.length > 0 ? { cc: input.cc.map((email) => ({ email })) } : {}),
    ...(input.bcc.length > 0 ? { bcc: input.bcc.map((email) => ({ email })) } : {}),
    replyTo
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Brevo API error (${response.status}): ${responseText}`);
  }

  const parsed = (() => {
    try {
      return JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const messageId = cleanText(parsed.messageId) || cleanText(parsed.message_id);
  return {
    provider: "brevo" as const,
    messageId,
    responseStatus: response.status
  };
}

function isBrevoConfigured() {
  return Boolean(cleanText(process.env.BREVO_API_KEY) && resolveBrevoSenderEmail());
}

function isOpenAiConfigured() {
  return Boolean(cleanText(process.env.OPENAI_API_KEY));
}

export function extractTemplateVariables(template: string) {
  const matches = template.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) ?? [];
  const unique = new Set<string>();

  for (const match of matches) {
    const name = match.replace(/[{}]/g, "").trim().replace(/\s+/g, "");
    if (name) {
      unique.add(name);
    }
  }

  return [...unique];
}

export function renderEmailTemplate(template: string, variables: EmailTemplateVariables): RenderedTemplateResult {
  const used = extractTemplateVariables(template);
  const missing: string[] = [];
  let rendered = template;

  for (const variableName of used) {
    const rawValue = variables[variableName];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      missing.push(variableName);
      continue;
    }

    rendered = rendered.replace(new RegExp(`{{\\s*${escapeRegExp(variableName)}\\s*}}`, "g"), value);
  }

  return {
    rendered,
    missing_variables: missing,
    used_variables: used
  };
}

export async function listEmailPresets() {
  await ensureJsonFile(EMAIL_PRESETS_PATH, `${JSON.stringify(DEFAULT_EMAIL_PRESETS, null, 2)}\n`);
  const parsed = await readJsonFile<unknown>(EMAIL_PRESETS_PATH, DEFAULT_EMAIL_PRESETS);

  if (!Array.isArray(parsed)) {
    return DEFAULT_EMAIL_PRESETS;
  }

  const normalized = parsed
    .map((entry) => normalizePreset(entry as Partial<EmailPreset>))
    .filter((entry): entry is EmailPreset => Boolean(entry));

  return normalized.length > 0 ? normalized : DEFAULT_EMAIL_PRESETS;
}

export async function listEmailHistory() {
  await ensureJsonFile(EMAIL_HISTORY_PATH, "[]\n");
  const parsed = await readJsonFile<unknown>(EMAIL_HISTORY_PATH, []);

  if (!Array.isArray(parsed)) {
    return [] as EmailHistoryEntry[];
  }

  return parsed
    .map((entry) => normalizeHistoryEntry(entry as Partial<EmailHistoryEntry>))
    .filter((entry): entry is EmailHistoryEntry => Boolean(entry))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getTemplateName(request: EventPicTemplateRequest) {
  const withoutWelcome = request.selected_templates.find(
    (template) => template.layout !== "static" && template.layout !== "animated"
  );
  return withoutWelcome?.name ?? request.selected_templates[0]?.name ?? "Template non renseigne";
}

function getGalleryUrlFromRequest(request: EventPicTemplateRequest) {
  const rawRequest = request as unknown as Record<string, unknown>;
  const galleryCandidates = [
    rawRequest.gallery_url,
    rawRequest.galleryUrl,
    rawRequest.gallery_link,
    rawRequest.galleryLink
  ];

  for (const candidate of galleryCandidates) {
    const value = cleanText(candidate);
    if (value) {
      return value;
    }
  }

  return "";
}

export async function listEmailRequestSummaries() {
  const [templateRequests, quoteRequests] = await Promise.all([
    listEventPicTemplateRequests(),
    listQuoteRequests()
  ]);
  const googleReviewUrl = cleanText(process.env.GOOGLE_REVIEW_URL);

  const templateSummaries = templateRequests.map((request) => {
    const firstName = request.client.first_name;
    const lastName = request.client.last_name;
    return {
      id: request.id,
      source: "template_request",
      client_first_name: firstName,
      client_last_name: lastName,
      client_full_name: `${firstName} ${lastName}`.trim(),
      client_email: request.client.email,
      client_phone: request.client.phone,
      event_date: request.event.date,
      event_type: request.event.type,
      selected_template_name: getTemplateName(request),
      package_label: "",
      options_summary: "",
      gallery_url: getGalleryUrlFromRequest(request),
      google_review_url: googleReviewUrl
    } satisfies EmailRequestSummary;
  });

  const quoteSummaries = quoteRequests.map((quote) => {
    const fullName = cleanText(quote.name);
    const nameParts = fullName.split(/\s+/g).filter((item) => item.length > 0);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");

    return {
      id: quote.id,
      source: "quote_request",
      client_first_name: firstName,
      client_last_name: lastName,
      client_full_name: fullName,
      client_email: cleanText(quote.email),
      client_phone: cleanText(quote.phone),
      event_date: cleanText(quote.event_date),
      event_type: cleanText(quote.event_type),
      selected_template_name: quote.package || "Devis calculateur",
      package_label: cleanText(quote.package),
      options_summary: quote.options.length > 0 ? quote.options.join(", ") : "",
      gallery_url: "",
      google_review_url: googleReviewUrl
    } satisfies EmailRequestSummary;
  });

  return [...templateSummaries, ...quoteSummaries].sort((a, b) =>
    a.client_full_name.localeCompare(b.client_full_name, "fr")
  );
}

export function getEmailAdminConfig() {
  return {
    brevo_configured: isBrevoConfigured(),
    openai_configured: isOpenAiConfigured(),
    company_name: "Event Pic",
    google_review_url: cleanText(process.env.GOOGLE_REVIEW_URL),
    instagram_url: cleanText(process.env.EVENTPIC_INSTAGRAM_URL) || "https://www.instagram.com/_event_pic",
    phone_number: cleanText(process.env.EVENTPIC_PHONE) || "07 60 42 18 76",
    email_from_name: cleanText(process.env.EMAIL_FROM_NAME) || "Event Pic",
    email_from_email: resolveBrevoSenderEmail(),
    email_reply_to: resolveBrevoReplyTo().email
  };
}

export function getEmailDeliveryDiagnostic() {
  return {
    brevoConfigured: isBrevoConfigured(),
    fromEmail: resolveBrevoSenderEmail(),
    replyTo: resolveBrevoReplyTo().email,
    hasApiKey: Boolean(cleanText(process.env.BREVO_API_KEY))
  };
}

export async function getLastKnownBrevoError() {
  const history = await listEmailHistory();
  const latestBrevoFailure = history.find((entry) => {
    const message = cleanText(entry.error_message).toLowerCase();
    return entry.status === "failed" && (entry.provider === "brevo" || message.includes("brevo"));
  });

  return cleanText(latestBrevoFailure?.error_message);
}

export function buildDefaultEmailVariables(
  requestSummary: EmailRequestSummary | null | undefined,
  manualInput?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    event_date?: string;
    event_type?: string;
    gallery_url?: string;
    google_review_url?: string;
  }
) {
  const config = getEmailAdminConfig();
  const firstName = cleanText(requestSummary?.client_first_name) || cleanText(manualInput?.first_name);
  const lastName = cleanText(requestSummary?.client_last_name) || cleanText(manualInput?.last_name);
  const fullName = cleanText(requestSummary?.client_full_name) || `${firstName} ${lastName}`.trim();

  return {
    client_first_name: firstName,
    client_last_name: lastName,
    client_full_name: fullName,
    event_date: cleanText(requestSummary?.event_date) || cleanText(manualInput?.event_date),
    event_type: cleanText(requestSummary?.event_type) || cleanText(manualInput?.event_type),
    gallery_url: cleanText(requestSummary?.gallery_url) || cleanText(manualInput?.gallery_url),
    google_review_url:
      cleanText(requestSummary?.google_review_url) ||
      cleanText(manualInput?.google_review_url) ||
      config.google_review_url,
    coupon_code: "EVENT30",
    coupon_amount: "30 €",
    custom_message: "",
    company_name: config.company_name,
    instagram_url: config.instagram_url,
    phone_number: config.phone_number
  } satisfies EmailTemplateVariables;
}

export async function validateEmailPayload(
  payload: EmailPayload,
  options: ValidateEmailPayloadOptions = {}
): Promise<ValidatedEmailPayload> {
  const allowMissingVariables = options.allow_missing_variables === true;
  const requireMarketingConsent = options.require_marketing_consent !== false;
  const requireRecipient = options.require_recipient !== false;

  const toList = parseEmailList(cleanText(payload.to));
  const ccList = parseEmailList(cleanText(payload.cc));
  const bccList = parseEmailList(cleanText(payload.bcc));

  if (requireRecipient && toList.length === 0) {
    throw new Error("Le destinataire est obligatoire.");
  }

  for (const email of [...toList, ...ccList, ...bccList]) {
    if (!isValidEmail(email)) {
      throw new Error(`Adresse email invalide: ${email}`);
    }
  }

  const subjectTemplate = cleanText(payload.subject_template);
  const bodyTemplate = cleanText(payload.body_template);
  const presetId = cleanText(payload.preset_id) || "mail-personnalise-libre";

  if (!subjectTemplate) {
    throw new Error("Le sujet est obligatoire.");
  }
  if (!bodyTemplate) {
    throw new Error("Le message est obligatoire.");
  }

  const variables =
    payload.variables && typeof payload.variables === "object"
      ? Object.entries(payload.variables).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = cleanText(value);
          return acc;
        }, {})
      : {};

  if (!cleanText(variables.coupon_amount)) {
    variables.coupon_amount = "30 €";
  }
  if (!cleanText(variables.coupon_code)) {
    variables.coupon_code = "EVENT30";
  }

  const renderedSubjectResult = renderEmailTemplate(subjectTemplate, variables);
  const renderedBodyResult = renderEmailTemplate(bodyTemplate, variables);
  const missingVariables = [...new Set([...renderedSubjectResult.missing_variables, ...renderedBodyResult.missing_variables])];
  const galleryUrlRequired = requiresGalleryUrlForPreset(presetId);
  const blockingMissingVariables = missingVariables.filter((variableName) => {
    if (variableName !== "gallery_url") {
      return !NON_BLOCKING_MISSING_VARIABLES.has(variableName);
    }
    return galleryUrlRequired;
  });

  if (!allowMissingVariables && blockingMissingVariables.length > 0) {
    throw new Error(`Variables manquantes: ${blockingMissingVariables.join(", ")}`);
  }

  const isMarketing = payload.is_marketing === true;
  const marketingConsent = payload.marketing_consent === true;

  if (isMarketing && requireMarketingConsent && !marketingConsent) {
    throw new Error("Confirmation client obligatoire pour un email marketing.");
  }

  const renderedBodyWithFooter = applyMarketingFooter(renderedBodyResult.rendered, isMarketing);
  const unresolvedVariables = [
    ...new Set([
      ...extractTemplateVariables(renderedSubjectResult.rendered),
      ...extractTemplateVariables(renderedBodyWithFooter)
    ])
  ];
  const attachments = await resolveAttachments(Array.isArray(payload.attachments) ? payload.attachments : []);

  return {
    to: toList,
    cc: ccList,
    bcc: bccList,
    subject_template: subjectTemplate,
    body_template: bodyTemplate,
    rendered_subject: renderedSubjectResult.rendered,
    rendered_body: renderedBodyWithFooter,
    preset_id: presetId,
    variables,
    attachments,
    note: cleanText(payload.note),
    request_id: cleanText(payload.request_id),
    client_name: resolveClientName(payload, variables),
    missing_variables: missingVariables,
    blocking_missing_variables: blockingMissingVariables,
    unresolved_variables: unresolvedVariables,
    used_variables: [...new Set([...renderedSubjectResult.used_variables, ...renderedBodyResult.used_variables])],
    unresolved_placeholders: unresolvedVariables.length > 0,
    is_marketing: isMarketing,
    marketing_consent: marketingConsent
  };
}

function createHistoryPayload(
  validated: ValidatedEmailPayload,
  options: {
    status: EmailHistoryStatus;
    sent_at: string | null;
    provider: EmailHistoryEntry["provider"];
    message_id?: string;
    error_message?: string;
  }
) {
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    sent_at: options.sent_at,
    status: options.status,
    request_id: validated.request_id,
    client_name: validated.client_name,
    to: validated.to.join(", "),
    cc: validated.cc.join(", "),
    bcc: validated.bcc.join(", "),
    subject: validated.rendered_subject,
    preset_id: validated.preset_id,
    body_preview: buildBodyPreview(validated.rendered_body),
    body: validated.rendered_body,
    attachments: validated.attachments.map(
      ({ absolute_path: _absolutePath, content_base64: _contentBase64, ...attachment }) => attachment
    ),
    provider: options.provider,
    message_id: cleanText(options.message_id),
    error_message: cleanText(options.error_message),
    is_marketing: validated.is_marketing,
    marketing_consent: validated.marketing_consent,
    note: validated.note,
    variables: validated.variables
  } satisfies EmailHistoryEntry;
}

export async function createEmailDraft(payload: EmailPayload) {
  const validated = await validateEmailPayload(payload, {
    allow_missing_variables: true,
    require_marketing_consent: false,
    require_recipient: false
  });
  const entry = createHistoryPayload(validated, {
    status: "draft",
    sent_at: null,
    provider: "copy"
  });
  await appendHistoryEntry(entry);

  return {
    entry,
    rendered_subject: validated.rendered_subject,
    rendered_body: validated.rendered_body,
    missing_variables: validated.missing_variables,
    unresolved_variables: validated.unresolved_variables
  };
}

export async function sendEmail(payload: EmailPayload) {
  const validated = await validateEmailPayload(payload, {
    allow_missing_variables: false,
    require_marketing_consent: true,
    require_recipient: true
  });

  console.info("[Event Pic][Email] send requested", {
    to: validated.to.join(", "),
    subject: validated.rendered_subject,
    has_attachments: validated.attachments.length > 0,
    attachment_count: validated.attachments.length
  });

  if (!isBrevoConfigured()) {
    const entry = createHistoryPayload(validated, {
      status: "failed",
      sent_at: null,
      provider: "mailto",
      error_message: "Brevo non configure."
    });
    await appendHistoryEntry(entry);

    return {
      mode: "fallback" as const,
      entry,
      provider: "mailto" as const,
      code: "BREVO_NOT_CONFIGURED",
      message:
        "Envoi automatique non configure. Vous pouvez copier le message ou ouvrir votre logiciel mail.",
      mailto_url: buildMailtoLink({
        to: validated.to,
        cc: validated.cc,
        bcc: validated.bcc,
        subject: validated.rendered_subject,
        body: validated.rendered_body
      }),
      missing_variables: validated.missing_variables,
      unresolved_variables: validated.unresolved_variables,
      unresolved_placeholders: validated.unresolved_placeholders
    };
  }

  try {
    const brevoResult = await sendViaBrevo({
      to: validated.to,
      cc: validated.cc,
      bcc: validated.bcc,
      subject: validated.rendered_subject,
      body: validated.rendered_body,
      htmlContent: buildPremiumEmailHtml({
        subject: validated.rendered_subject,
        body: validated.rendered_body,
        variables: validated.variables,
        isMarketing: validated.is_marketing,
        presetId: validated.preset_id
      }),
      textContent: buildPlainTextEmail({
        subject: validated.rendered_subject,
        body: validated.rendered_body,
        variables: validated.variables,
        isMarketing: validated.is_marketing
      }),
      isMarketing: validated.is_marketing,
      attachments: validated.attachments
    });

    console.info("[Event Pic][Email] Brevo response", {
      to: validated.to.join(", "),
      status: brevoResult.responseStatus,
      messageId: brevoResult.messageId || "(none)"
    });

    const entry = createHistoryPayload(validated, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider: "brevo",
      message_id: brevoResult.messageId
    });
    await appendHistoryEntry(entry);

    return {
      mode: "sent" as const,
      entry,
      provider: "brevo" as const,
      messageId: brevoResult.messageId,
      message: "Email envoye avec succes.",
      missing_variables: validated.missing_variables,
      unresolved_variables: validated.unresolved_variables,
      unresolved_placeholders: validated.unresolved_placeholders
    };
  } catch (error) {
    const rawErrorMessage = error instanceof Error ? error.message : "Envoi impossible.";
    const errorMessage = normalizeBrevoErrorMessage(rawErrorMessage);
    console.error("[Event Pic][Email] Brevo send failed", {
      to: validated.to.join(", "),
      subject: validated.rendered_subject,
      has_attachments: validated.attachments.length > 0,
      error: errorMessage
    });
    const entry = createHistoryPayload(validated, {
      status: "failed",
      sent_at: null,
      provider: "brevo",
      error_message: errorMessage
    });
    await appendHistoryEntry(entry);
    throw new Error(errorMessage);
  }
}

export async function sendTestEmail(payload: EmailPayload) {
  const validated = await validateEmailPayload(payload, {
    allow_missing_variables: false,
    require_marketing_consent: false,
    require_recipient: true
  });

  console.info("[Event Pic][Email] send test requested", {
    to: validated.to.join(", "),
    subject: `[TEST] ${validated.rendered_subject}`,
    has_attachments: validated.attachments.length > 0,
    attachment_count: validated.attachments.length
  });

  if (!isBrevoConfigured()) {
    const entry = createHistoryPayload(validated, {
      status: "failed",
      sent_at: null,
      provider: "copy",
      error_message: "Brevo non configure."
    });
    await appendHistoryEntry(entry);

    return {
      mode: "fallback" as const,
      entry,
      provider: "copy" as const,
      code: "BREVO_NOT_CONFIGURED",
      message:
        "Envoi automatique non configure. Vous pouvez copier le message ou ouvrir votre logiciel mail.",
      mailto_url: buildMailtoLink({
        to: validated.to,
        cc: validated.cc,
        bcc: validated.bcc,
        subject: `[TEST] ${validated.rendered_subject}`,
        body: validated.rendered_body
      }),
      missing_variables: validated.missing_variables,
      unresolved_variables: validated.unresolved_variables,
      unresolved_placeholders: validated.unresolved_placeholders
    };
  }

  try {
    const brevoResult = await sendViaBrevo({
      to: validated.to,
      cc: validated.cc,
      bcc: validated.bcc,
      subject: `[TEST] ${validated.rendered_subject}`,
      body: validated.rendered_body,
      htmlContent: buildPremiumEmailHtml({
        subject: `[TEST] ${validated.rendered_subject}`,
        body: validated.rendered_body,
        variables: validated.variables,
        isMarketing: validated.is_marketing,
        presetId: validated.preset_id
      }),
      textContent: buildPlainTextEmail({
        subject: `[TEST] ${validated.rendered_subject}`,
        body: validated.rendered_body,
        variables: validated.variables,
        isMarketing: validated.is_marketing
      }),
      isMarketing: validated.is_marketing,
      attachments: validated.attachments
    });

    console.info("[Event Pic][Email] Brevo test response", {
      to: validated.to.join(", "),
      status: brevoResult.responseStatus,
      messageId: brevoResult.messageId || "(none)"
    });

    const entry = createHistoryPayload(validated, {
      status: "test_sent",
      sent_at: new Date().toISOString(),
      provider: "brevo",
      message_id: brevoResult.messageId
    });
    await appendHistoryEntry(entry);

    return {
      mode: "sent" as const,
      entry,
      provider: "brevo" as const,
      messageId: brevoResult.messageId,
      message: "Email test envoye avec succes.",
      missing_variables: validated.missing_variables,
      unresolved_variables: validated.unresolved_variables,
      unresolved_placeholders: validated.unresolved_placeholders
    };
  } catch (error) {
    const rawErrorMessage = error instanceof Error ? error.message : "Envoi test impossible.";
    const errorMessage = normalizeBrevoErrorMessage(rawErrorMessage);
    console.error("[Event Pic][Email] Brevo test failed", {
      to: validated.to.join(", "),
      subject: `[TEST] ${validated.rendered_subject}`,
      has_attachments: validated.attachments.length > 0,
      error: errorMessage
    });
    const entry = createHistoryPayload(validated, {
      status: "failed",
      sent_at: null,
      provider: "brevo",
      error_message: errorMessage
    });
    await appendHistoryEntry(entry);
    throw new Error(errorMessage);
  }
}

export async function resendEmailFromHistory(historyId: string) {
  const id = cleanText(historyId);
  if (!id) {
    throw new Error("Historique email introuvable.");
  }

  const history = await listEmailHistory();
  const found = history.find((entry) => entry.id === id);

  if (!found) {
    throw new Error("Entree historique introuvable.");
  }

  return sendEmail({
    request_id: found.request_id,
    client_name: found.client_name,
    to: found.to,
    cc: found.cc,
    bcc: found.bcc,
    subject_template: found.subject,
    body_template: found.body,
    preset_id: found.preset_id,
    variables: found.variables,
    attachments: found.attachments,
    note: found.note,
    is_marketing: found.is_marketing,
    marketing_consent: found.marketing_consent
  });
}

export async function saveUploadedEmailAttachment(input: {
  file_name: string;
  mime_type: string;
  content: Buffer;
}) {
  const fileName = cleanText(input.file_name);
  const mimeType = cleanText(input.mime_type);
  const content = input.content;

  if (!fileName || content.length === 0) {
    throw new Error("Piece jointe invalide.");
  }

  if (!isAllowedAttachment(fileName, mimeType)) {
    throw new Error("Type de fichier non autorise. Formats autorises: PDF, PNG, JPG, JPEG, ZIP.");
  }

  if (content.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("La piece jointe depasse 10 MB.");
  }

  const id = randomUUID();
  const storedName = `${id}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;

  if (CAN_WRITE_EMAIL_ATTACHMENTS_TO_DISK) {
    await ensureAttachmentsDir();
    const absolutePath = path.join(EMAIL_ATTACHMENTS_DIR, storedName);
    await fs.writeFile(absolutePath, content);
  }

  return {
    id,
    file_name: fileName,
    stored_name: storedName,
    mime_type: mimeType,
    size: content.length,
    uploaded_at: new Date().toISOString(),
    content_base64: content.toString("base64")
  } satisfies EmailAttachmentMeta;
}

export async function deleteUploadedEmailAttachment(storedName: string) {
  if (!CAN_WRITE_EMAIL_ATTACHMENTS_TO_DISK) {
    return;
  }
  await ensureAttachmentsDir();
  const safeStoredName = ensureNoPathTraversal(cleanText(storedName));
  const absolutePath = path.join(EMAIL_ATTACHMENTS_DIR, safeStoredName);
  await fs.unlink(absolutePath).catch(() => {
    // ignore
  });
}

export async function improveEmailDraftWithAi(input: {
  subject: string;
  body: string;
  event_type?: string;
  client_name?: string;
}) {
  const apiKey = cleanText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("IA non configuree.");
  }

  const model = cleanText(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Tu es redacteur email pour Event Pic.",
          "Ton style: premium, clair, chaleureux, professionnel, sans blabla.",
          "Corrige la langue francaise et les fautes.",
          "Conserve strictement les placeholders de variables au format {{variable_name}}.",
          "Ne supprime jamais un placeholder present dans le sujet ou le message d'origine.",
          "Retourne uniquement du JSON valide."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Reformule ce mail et propose 3 objets. Garde les informations utiles, reduis les repetitions, et reste concret.",
          context: {
            client_name: cleanText(input.client_name),
            event_type: cleanText(input.event_type)
          },
          subject: cleanText(input.subject),
          body: cleanText(input.body),
          output_shape: {
            subject_options: ["string", "string", "string"],
            improved_body: "string",
            short_body: "string"
          }
        })
      }
    ]
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw || !raw.trim()) {
    throw new Error("Aucune suggestion IA recue.");
  }

  const parsed = JSON.parse(raw) as {
    subject_options?: unknown;
    improved_body?: unknown;
    short_body?: unknown;
  };

  const subjectOptions = Array.isArray(parsed.subject_options)
    ? parsed.subject_options
        .map((value) => cleanText(value))
        .filter((value) => value.length > 0)
        .slice(0, 3)
    : [];

  const improvedBodyRaw = cleanText(parsed.improved_body) || cleanText(input.body);
  const shortBodyRaw = cleanText(parsed.short_body) || cleanText(input.body);
  const normalizedSubjects =
    subjectOptions.length > 0
      ? subjectOptions.map((subject) =>
          ensurePlaceholdersPreserved(input.subject, subject, { appendMode: "inline" })
        )
      : [ensurePlaceholdersPreserved(input.subject, cleanText(input.subject), { appendMode: "inline" })];

  const improvedBody = ensurePlaceholdersPreserved(input.body, improvedBodyRaw, {
    appendMode: "line"
  });
  const shortBody = ensurePlaceholdersPreserved(input.body, shortBodyRaw, {
    appendMode: "line"
  });

  return {
    model_used: model,
    subject_options: normalizedSubjects.slice(0, 3),
    improved_body: improvedBody,
    short_body: shortBody
  };
}
