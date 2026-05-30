import type { EventDossier } from "@/src/shared/eventPicDossiers";
import { getQuoteStatusLabel } from "@/src/shared/eventPicDossiers";
import { EVENT_PIC_CONTACT, EVENT_PIC_OPTIONS, EVENT_PIC_PHOTOBOOTH_PACKAGES } from "@/src/shared/eventPicPublic";

type QuoteLine = {
  designation: string;
  detail: string;
  amount: string;
};

type EventPicOption = (typeof EVENT_PIC_OPTIONS)[number];

type PdfPage = {
  commands: string[];
  y: number;
};

type PdfFont = "F1" | "F2";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const TEXT_COLOR = "0.12 0.10 0.08";
const MUTED_COLOR = "0.38 0.33 0.27";
const GOLD_COLOR = "0.62 0.42 0.12";
const LIGHT_GOLD = "0.93 0.86 0.72";
const PANEL_FILL = "0.99 0.97 0.92";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function displayText(value: unknown, fallback = "À confirmer") {
  return cleanText(value) || fallback;
}

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isFormulaToDefine(value: string) {
  const normalized = normalizeForComparison(value);
  return !normalized || normalized.includes("definir") || normalized.includes("a confirmer");
}

function formatDate(value: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "À confirmer";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? cleaned : parsed.toLocaleDateString("fr-FR");
}

function formatEditionDate() {
  return new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatMoney(value: number, fallback = "À confirmer") {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return `${Math.round(value).toLocaleString("fr-FR")} €`;
}

function stripPriceSuffix(label: string) {
  return label.replace(/\s*[-–—]\s*\d+\s*(?:eur|€)\s*$/i, "").trim();
}

function getClientCompany(dossier: EventDossier) {
  const client = dossier.client as EventDossier["client"] & {
    company?: string;
    company_name?: string;
    society?: string;
  };

  return cleanText(client.company) || cleanText(client.company_name) || cleanText(client.society);
}

function findPackage(dossier: EventDossier) {
  const byId = EVENT_PIC_PHOTOBOOTH_PACKAGES.find((item) => item.id === dossier.quote.package_id);

  if (byId) {
    return byId;
  }

  const packageLabel = cleanText(dossier.quote.package_label).toLowerCase();
  return EVENT_PIC_PHOTOBOOTH_PACKAGES.find((item) => item.label.toLowerCase() === packageLabel);
}

const OPTION_BY_ID: Map<string, EventPicOption> = new Map(EVENT_PIC_OPTIONS.map((option) => [option.id, option]));
const OPTION_BY_LABEL: Map<string, EventPicOption> = new Map(
  EVENT_PIC_OPTIONS.map((option) => [option.label.toLowerCase(), option])
);

function resolveOption(optionId: string | undefined, optionLabel: string | undefined) {
  const fromId = optionId ? OPTION_BY_ID.get(optionId) : undefined;

  if (fromId) {
    return fromId;
  }

  const normalizedLabel = stripPriceSuffix(cleanText(optionLabel)).toLowerCase();
  return normalizedLabel ? OPTION_BY_LABEL.get(normalizedLabel) : undefined;
}

function buildOptionLines(dossier: EventDossier): QuoteLine[] {
  const maxLength = Math.max(dossier.quote.option_ids.length, dossier.quote.options.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const option = resolveOption(dossier.quote.option_ids[index], dossier.quote.options[index]);
    const fallbackLabel = stripPriceSuffix(dossier.quote.options[index] ?? dossier.quote.option_ids[index] ?? "Option");

    return {
      designation: option?.label ?? fallbackLabel,
      detail: option?.description ?? "Option complémentaire sélectionnée pour l'événement.",
      amount: typeof option?.price === "number" ? formatMoney(option.price, "Inclus dans le total") : "Inclus dans le total"
    };
  }).filter((line) => cleanText(line.designation).length > 0);
}

function buildQuoteLines(dossier: EventDossier): QuoteLine[] {
  const selectedPackage = findPackage(dossier);
  const packageLabel = cleanText(dossier.quote.package_label);
  const formulaToDefine = isFormulaToDefine(packageLabel);
  const packageAmount = formulaToDefine
    ? "Montant à confirmer"
    : typeof selectedPackage?.price === "number"
      ? formatMoney(selectedPackage.price)
      : dossier.quote.custom_quote
        ? "Sur devis"
        : "Inclus dans le total";
  const deliveryAmount =
    dossier.quote.delivery_fee > 0
      ? formatMoney(dossier.quote.delivery_fee)
      : cleanText(dossier.event.address)
        ? "Inclus / offert"
        : "À confirmer";

  return [
    {
      designation: formulaToDefine ? "Formule à définir ensemble" : "Formule principale",
      detail: formulaToDefine
        ? "Nous vous orienterons vers la formule adaptée."
        : displayText(packageLabel, "Formule à définir"),
      amount: packageAmount
    },
    {
      designation: "Installation et reprise",
      detail: "Installation de la borne avant l'événement et reprise selon les horaires convenus.",
      amount: "Inclus"
    },
    {
      designation: "Personnalisation Event Pic",
      detail: "Cadre photo et écran d'accueil personnalisés selon les éléments transmis.",
      amount: "Inclus"
    },
    {
      designation: "Galerie numérique",
      detail: "Mise à disposition des photos après l'événement, selon la formule retenue.",
      amount: "Inclus"
    },
    ...buildOptionLines(dossier),
    {
      designation: "Frais de déplacement",
      detail: cleanText(dossier.event.address)
        ? `Adresse de référence : ${dossier.event.address}`
        : "Montant à confirmer selon l'adresse exacte de l'événement.",
      amount: deliveryAmount
    }
  ];
}

function winAnsiByte(character: string): number[] {
  const replacements = new Map<string, number | string>([
    ["€", 0x80],
    ["’", 0x92],
    ["‘", 0x91],
    ["“", 0x93],
    ["”", 0x94],
    ["•", "-"],
    ["…", "..."],
    ["–", "-"],
    ["—", "-"],
    ["œ", "oe"],
    ["Œ", "OE"]
  ]);
  const replacement = replacements.get(character);

  if (typeof replacement === "number") {
    return [replacement];
  }
  if (typeof replacement === "string") {
    return Array.from(replacement).flatMap((item) => winAnsiByte(item));
  }

  const code = character.codePointAt(0) ?? 63;
  return [code <= 255 ? code : 63];
}

function pdfTextHex(text: string): string {
  const bytes = Array.from(text).flatMap((character) => winAnsiByte(character));
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}

function commandText(text: string, x: number, y: number, size: number, font: PdfFont = "F1", color = TEXT_COLOR) {
  return `${color} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfTextHex(text)} Tj ET`;
}

function commandLine(x1: number, y1: number, x2: number, y2: number, color = LIGHT_GOLD, width = 0.7) {
  return `${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function commandRect(x: number, y: number, width: number, height: number, fillColor: string, strokeColor = LIGHT_GOLD) {
  return `${fillColor} rg ${strokeColor} RG 0.7 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`;
}

function wrapText(text: string, maxCharacters: number) {
  const words = cleanText(text).split(/\s+/g).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }
  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

class PdfBuilder {
  private readonly pages: PdfPage[] = [];

  constructor() {
    this.newPage();
  }

  private current() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push({ commands: [], y: PAGE_HEIGHT - MARGIN });
  }

  ensureSpace(height: number) {
    if (this.current().y - height < MARGIN) {
      this.newPage();
      this.current().commands.push(commandText("Devis Event Pic - suite", MARGIN, this.current().y, 10, "F2", GOLD_COLOR));
      this.current().y -= 22;
    }
  }

  raw(command: string) {
    this.current().commands.push(command);
  }

  text(text: string, x: number, y: number, size: number, font: PdfFont = "F1", color = TEXT_COLOR) {
    this.raw(commandText(text, x, y, size, font, color));
  }

  paragraph(text: string, x: number, widthCharacters: number, size = 9.5, lineHeight = 12, font: PdfFont = "F1", color = TEXT_COLOR) {
    const lines = wrapText(text, widthCharacters);
    this.ensureSpace(lines.length * lineHeight + 4);
    for (const line of lines) {
      this.text(line, x, this.current().y, size, font, color);
      this.current().y -= lineHeight;
    }
  }

  move(delta: number) {
    this.current().y -= delta;
  }

  getY() {
    return this.current().y;
  }

  setY(value: number) {
    this.current().y = value;
  }

  streams() {
    return this.pages.map((page) => page.commands.join("\n"));
  }
}

function addKeyValue(builder: PdfBuilder, x: number, y: number, label: string, value: string, width = 150) {
  builder.raw(commandRect(x, y - 42, width, 50, PANEL_FILL));
  builder.text(label.toUpperCase(), x + 10, y - 10, 7.5, "F2", GOLD_COLOR);
  builder.paragraph(value, x + 10, 24, 10, 11, "F2");
}

function addHeader(builder: PdfBuilder, dossier: EventDossier) {
  const top = builder.getY();
  builder.raw(commandRect(MARGIN, top - 52, 128, 42, "0.13 0.10 0.07", GOLD_COLOR));
  builder.text("Event Pic", MARGIN + 18, top - 33, 17, "F2", "1 0.97 0.88");
  builder.text("Photobooth premium", MARGIN + 18, top - 45, 7.5, "F1", "1 0.94 0.80");
  builder.text("Devis", PAGE_WIDTH - MARGIN - 120, top - 18, 28, "F2", TEXT_COLOR);
  builder.text(displayText(dossier.quote.quote_number, "À générer"), PAGE_WIDTH - MARGIN - 120, top - 36, 10, "F1", MUTED_COLOR);
  builder.text(getQuoteStatusLabel(dossier.quote.status), PAGE_WIDTH - MARGIN - 120, top - 50, 9, "F1", GOLD_COLOR);
  builder.raw(commandLine(MARGIN, top - 66, PAGE_WIDTH - MARGIN, top - 66, GOLD_COLOR, 1));
  builder.move(86);
}

function addParties(builder: PdfBuilder, dossier: EventDossier) {
  const y = builder.getY();
  const clientCompany = getClientCompany(dossier);
  const clientLines = [
    displayText(dossier.client.full_name, "Client à confirmer"),
    clientCompany ? `Société : ${clientCompany}` : "",
    `Email : ${displayText(dossier.client.email)}`,
    `Téléphone : ${displayText(dossier.client.phone)}`
  ].filter(Boolean);
  const eventLines = [
    `Événement : ${displayText(dossier.event.type)}`,
    `Date : ${formatDate(dossier.event.date)}`,
    `Horaires : ${
      cleanText(dossier.event.start_time) || cleanText(dossier.event.end_time)
        ? `${displayText(dossier.event.start_time, "Début à confirmer")} - ${displayText(dossier.event.end_time, "fin à confirmer")}`
        : "À confirmer"
    }`,
    `Invités : ${dossier.event.guest_count > 0 ? `${dossier.event.guest_count} invités` : "À confirmer"}`,
    `Adresse : ${displayText(dossier.event.address)}`
  ];

  builder.raw(commandRect(MARGIN, y - 104, 248, 112, PANEL_FILL));
  builder.text("CLIENT", MARGIN + 12, y - 14, 8, "F2", GOLD_COLOR);
  clientLines.forEach((line, index) => {
    builder.text(line, MARGIN + 12, y - 32 - index * 14, index === 0 ? 11 : 9, index === 0 ? "F2" : "F1");
  });

  builder.raw(commandRect(MARGIN + 266, y - 104, 245, 112, PANEL_FILL));
  builder.text("ÉVÉNEMENT", MARGIN + 278, y - 14, 8, "F2", GOLD_COLOR);
  eventLines.forEach((line, index) => {
    builder.text(line, MARGIN + 278, y - 32 - index * 14, 9, index === 0 ? "F2" : "F1");
  });
  builder.setY(y - 128);
}

function addMeta(builder: PdfBuilder, dossier: EventDossier) {
  const y = builder.getY();
  addKeyValue(builder, MARGIN, y, "Date d'édition", formatEditionDate());
  builder.setY(y);
  addKeyValue(builder, MARGIN + 172, y, "Numéro de devis", displayText(dossier.quote.quote_number, "À générer"));
  builder.setY(y);
  addKeyValue(builder, MARGIN + 344, y, "Formule", displayText(dossier.quote.package_label, "À définir ensemble"));
  builder.setY(y - 70);
}

function addQuoteTable(builder: PdfBuilder, dossier: EventDossier) {
  builder.ensureSpace(150);
  builder.text("Détail de la proposition", MARGIN, builder.getY(), 15, "F2");
  builder.move(18);
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const designationX = MARGIN + 10;
  const detailX = MARGIN + 142;
  const amountX = MARGIN + 392;

  const addTableHeader = () => {
    const y = builder.getY();
    builder.raw(`${GOLD_COLOR} rg ${MARGIN.toFixed(2)} ${(y - 16).toFixed(2)} ${tableWidth.toFixed(2)} 22 re f`);
    builder.text("Désignation", designationX, y - 10, 8, "F2", "1 0.98 0.92");
    builder.text("Détail", detailX, y - 10, 8, "F2", "1 0.98 0.92");
    builder.text("Montant", amountX, y - 10, 8, "F2", "1 0.98 0.92");
    builder.setY(y - 28);
  };

  addTableHeader();

  for (const line of buildQuoteLines(dossier)) {
    const designationLines = wrapText(line.designation, 22);
    const detailLines = wrapText(line.detail, 45);
    const amountLines = wrapText(line.amount, 18);
    const lineCount = Math.max(designationLines.length, detailLines.length, amountLines.length);
    const rowHeight = Math.max(28, lineCount * 11 + 12);
    builder.ensureSpace(rowHeight + 8);
    if (builder.getY() > PAGE_HEIGHT - MARGIN - 40) {
      addTableHeader();
    }
    const y = builder.getY();
    builder.raw(commandLine(MARGIN, y + 8, PAGE_WIDTH - MARGIN, y + 8, LIGHT_GOLD, 0.5));
    designationLines.forEach((text, index) => builder.text(text, designationX, y - index * 11, 8.7, index === 0 ? "F2" : "F1"));
    detailLines.forEach((text, index) => builder.text(text, detailX, y - index * 11, 8.5, "F1", TEXT_COLOR));
    amountLines.forEach((text, index) => builder.text(text, amountX, y - index * 11, 8.7, "F2", TEXT_COLOR));
    builder.setY(y - rowHeight);
  }
}

function addTotalsAndConditions(builder: PdfBuilder, dossier: EventDossier) {
  builder.ensureSpace(170);
  const y = builder.getY();
  const totalKnown = dossier.quote.amount_total > 0;
  const subtotal = totalKnown && dossier.quote.delivery_fee > 0
    ? Math.max(dossier.quote.amount_total - dossier.quote.delivery_fee, 0)
    : dossier.quote.amount_total;
  const balance = totalKnown ? dossier.quote.balance_amount : 0;

  builder.raw(commandRect(MARGIN, y - 132, 300, 142, PANEL_FILL));
  builder.text("CONDITIONS", MARGIN + 12, y - 14, 8, "F2", GOLD_COLOR);
  [
    "La date est bloquée après validation du devis et réception de l'acompte.",
    "Les prestations sont confirmées selon disponibilité au moment de la validation.",
    "Les détails définitifs peuvent être ajustés avant l'événement."
  ].forEach((condition, index) => {
    const startY = y - 34 - index * 30;
    builder.text(`- ${condition}`, MARGIN + 12, startY, 8.5, "F1");
  });

  builder.raw(commandRect(MARGIN + 318, y - 132, 193, 142, "0.13 0.10 0.07", GOLD_COLOR));
  const totals = [
    ["Sous-total prestations", totalKnown ? formatMoney(subtotal) : "À confirmer"],
    ["Frais de déplacement", dossier.quote.delivery_fee > 0 ? formatMoney(dossier.quote.delivery_fee) : "À confirmer"],
    ["Total estimé", totalKnown ? formatMoney(dossier.quote.amount_total) : "À confirmer"],
    ["Acompte de réservation", formatMoney(dossier.quote.deposit_amount)],
    ["Solde à régler", totalKnown ? formatMoney(balance) : "À confirmer"]
  ];

  totals.forEach(([label, value], index) => {
    const lineY = y - 18 - index * 24;
    builder.text(label, MARGIN + 332, lineY, 7.8, "F1", "0.90 0.82 0.62");
    builder.text(value, MARGIN + 455, lineY, index === 2 ? 11 : 9, "F2", "1 0.98 0.92");
  });

  builder.setY(y - 158);
}

function addFooter(builder: PdfBuilder, dossier: EventDossier) {
  builder.ensureSpace(48);
  const y = builder.getY();
  builder.raw(commandLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, LIGHT_GOLD, 0.6));
  builder.text("Merci pour votre confiance. Event Pic vous accompagne pour une animation élégante, fluide et mémorable.", MARGIN, y - 18, 8.2, "F1", MUTED_COLOR);
  builder.text(`Référence interne : ${dossier.id}`, MARGIN, y - 34, 7.2, "F1", "0.55 0.50 0.44");
}

function buildPdfObjects(pageStreams: string[]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];

  for (const stream of pageStreams) {
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      [
        "<< /Type /Page",
        `/Parent ${pagesId} 0 R`,
        `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
        `/Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
        `/Contents ${contentId} 0 R`,
        ">>"
      ].join(" ")
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = Buffer.byteLength(output, "utf8");
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}

export function generateDossierQuotePdf(dossier: EventDossier) {
  const builder = new PdfBuilder();
  addHeader(builder, dossier);
  addMeta(builder, dossier);
  addParties(builder, dossier);
  addQuoteTable(builder, dossier);
  addTotalsAndConditions(builder, dossier);
  addFooter(builder, dossier);
  return buildPdfObjects(builder.streams());
}

export function getDossierQuotePdfFileName(dossier: EventDossier) {
  const rawNumber = cleanText(dossier.quote.quote_number) || cleanText(dossier.quote.quote_id) || dossier.id;
  const safeNumber = rawNumber
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `devis-event-pic-${safeNumber || "dossier"}.pdf`;
}
