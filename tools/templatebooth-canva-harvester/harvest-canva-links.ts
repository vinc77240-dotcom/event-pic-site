import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Confidence = "high" | "medium" | "low";
type HarvesterMode = "file" | "eventpic";

type RawCandidate = {
  canva_url: string;
  nearby_text: string;
  source_hint: string;
};

type DetectedLinkType = "folder_global" | "format_link" | "unknown";

type HarvestedItem = {
  template_name: string;
  page_url: string;
  canva_folder_url: string;
  canva_template_url: string;
  canva_url: string;
  detected_type: DetectedLinkType;
  detected_format: string;
  detected_layout: string;
  detected_no_of_images: string;
  confidence: Confidence;
  nearby_text: string;
  detected_at: string;
  extraction_source: string;
};

type EventPicExportItem = {
  family_key?: string;
  template_name?: string;
  post_url?: string;
};

type HarvesterConfig = {
  mode: HarvesterMode;
  delayMs: number;
  autoImport: boolean;
  eventPicBaseUrl: string;
  exportEndpoint: string;
  importEndpoint: string;
  inputFilePath: string;
  outputDirectory: string;
  maxClickableChecks: number;
};

type HarvestStatus = "completed" | "pending_login" | "no_links_found" | "error";

type HarvestDebugPage = {
  page_url: string;
  pageTitle: string;
  currentUrl: string;
  loggedInLikely: boolean | "uncertain";
  canvaTextFound: boolean;
  editButtonsFound: number;
  canvaLinksDetected: number;
  linksScanned: number;
  buttonsScanned: number;
  buttonTexts: string[];
  screenshotPath: string;
  htmlPath: string;
};

type HarvestDebugPayload = {
  loggedInLikely: boolean | "uncertain";
  pageTitle: string;
  currentUrl: string;
  canvaTextFound: boolean;
  editButtonsFound: number;
  canvaLinksDetected: number;
  linksScanned: number;
  buttonsScanned: number;
  buttonTexts: string[];
  screenshotPath: string;
  htmlPath: string;
  pages: HarvestDebugPage[];
};

type CliOptions = {
  postUrls: string[];
  templateName?: string;
  familyKey?: string;
  requestId?: string;
  nonInteractive: boolean;
  waitForLoginSeconds: number;
  autoImportOverride?: boolean;
  eventPicBaseUrl?: string;
  outputResultFile?: string;
  runLabel?: string;
  debug: boolean;
  keepOpen: boolean;
  autoClose: boolean;
};

type HarvestResultPayload = {
  ok: boolean;
  status: HarvestStatus;
  message: string;
  generated_at: string;
  mode: HarvesterMode;
  request_id?: string;
  family_key?: string;
  template_name?: string;
  total_urls: number;
  processed_urls: number;
  found_links: number;
  items: HarvestedItem[];
  report_path?: string;
  debug?: HarvestDebugPayload;
};

const HARVESTER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(HARVESTER_DIR, ".browser-profile");
const DEBUG_DIR = path.join(HARVESTER_DIR, "debug");
const DEBUG_SCREENSHOT_PATH = path.join(DEBUG_DIR, "templatebooth-page.png");
const DEBUG_HTML_PATH = path.join(DEBUG_DIR, "templatebooth-page.html");
const DEFAULT_INPUT_FILE = path.join(HARVESTER_DIR, "input-templatebooth-urls.txt");
const DEFAULT_OUTPUT_DIR = path.join(HARVESTER_DIR, "output");
const DEFAULT_EVENT_PIC_BASE_URL = "http://localhost:3000";
const DEFAULT_EXPORT_ENDPOINT = "/api/admin/templates/export-templatebooth-urls";
const DEFAULT_IMPORT_ENDPOINT = "/api/admin/template-source-links/canva-import";

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

function normalizePostUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? value;
}

function parseEnvFile(filePath: string): Promise<Record<string, string>> {
  return fs
    .readFile(filePath, "utf8")
    .then((raw) => {
      const parsed: Record<string, string> = {};
      const lines = raw.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const separator = trimmed.indexOf("=");
        if (separator <= 0) {
          continue;
        }

        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
        parsed[key] = value;
      }

      return parsed;
    })
    .catch(() => ({} as Record<string, string>));
}

function boolFromEnv(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function numberFromEnv(value: string | undefined, fallback: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function modeFromEnv(value: string | undefined): HarvesterMode {
  const normalized = normalizeSearchText(value ?? "");
  return normalized === "eventpic" ? "eventpic" : "file";
}

async function loadConfig(): Promise<HarvesterConfig> {
  const envPath = path.join(HARVESTER_DIR, ".env");
  const envFile = await parseEnvFile(envPath);

  function env(name: string) {
    const fromProcess = process.env[name];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }

    const fromFile = envFile[name];
    if (typeof fromFile === "string" && fromFile.trim()) {
      return fromFile.trim();
    }

    return undefined;
  }

  const mode = modeFromEnv(env("HARVEST_MODE"));
  const delayMs = Math.max(1500, numberFromEnv(env("HARVEST_DELAY_MS"), 2500));
  const autoImport = boolFromEnv(env("AUTO_IMPORT"), true);
  const eventPicBaseUrl = (env("EVENT_PIC_BASE_URL") ?? DEFAULT_EVENT_PIC_BASE_URL).replace(/\/$/, "");
  const exportEndpoint = env("EVENT_PIC_EXPORT_ENDPOINT") ?? DEFAULT_EXPORT_ENDPOINT;
  const importEndpoint = env("EVENT_PIC_IMPORT_ENDPOINT") ?? DEFAULT_IMPORT_ENDPOINT;
  const inputFilePath = path.resolve(HARVESTER_DIR, env("INPUT_URL_FILE") ?? DEFAULT_INPUT_FILE);
  const outputDirectory = path.resolve(HARVESTER_DIR, env("OUTPUT_DIR") ?? DEFAULT_OUTPUT_DIR);
  const maxClickableChecks = Math.max(4, numberFromEnv(env("MAX_CLICKABLE_CHECKS"), 16));

  return {
    mode,
    delayMs,
    autoImport,
    eventPicBaseUrl,
    exportEndpoint,
    importEndpoint,
    inputFilePath,
    outputDirectory,
    maxClickableChecks
  };
}

function parseBooleanCliValue(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeSearchText(value);
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    postUrls: [],
    nonInteractive: false,
    waitForLoginSeconds: 150,
    debug: false,
    keepOpen: false,
    autoClose: false
  };

  const setKeyValue = (key: string, rawValue?: string) => {
    const value = normalizeText(rawValue);

    if (key === "post-url" && value) {
      options.postUrls.push(value);
      return;
    }
    if (key === "template-name" && value) {
      options.templateName = value;
      return;
    }
    if (key === "family-key" && value) {
      options.familyKey = value;
      return;
    }
    if (key === "request-id" && value) {
      options.requestId = value;
      return;
    }
    if (key === "event-pic-base-url" && value) {
      options.eventPicBaseUrl = value;
      return;
    }
    if (key === "result-file" && value) {
      options.outputResultFile = path.resolve(HARVESTER_DIR, value);
      return;
    }
    if (key === "run-label" && value) {
      options.runLabel = value;
      return;
    }
    if (key === "wait-for-login-seconds" && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.waitForLoginSeconds = parsed;
      }
      return;
    }
    if (key === "auto-import") {
      const parsed = parseBooleanCliValue(value);
      if (typeof parsed === "boolean") {
        options.autoImportOverride = parsed;
      }
      return;
    }
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const withoutPrefix = token.slice(2);
    const separatorIndex = withoutPrefix.indexOf("=");
    if (separatorIndex >= 0) {
      const key = withoutPrefix.slice(0, separatorIndex).trim();
      const value = withoutPrefix.slice(separatorIndex + 1).trim();
      setKeyValue(key, value);
      continue;
    }

    if (withoutPrefix === "non-interactive") {
      options.nonInteractive = true;
      continue;
    }

    if (withoutPrefix === "interactive") {
      options.nonInteractive = false;
      continue;
    }

    if (withoutPrefix === "no-auto-import") {
      options.autoImportOverride = false;
      continue;
    }

    if (withoutPrefix === "debug") {
      options.debug = true;
      continue;
    }

    if (withoutPrefix === "keep-open") {
      options.keepOpen = true;
      continue;
    }

    if (withoutPrefix === "auto-close") {
      options.autoClose = true;
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      setKeyValue(withoutPrefix, nextToken);
      index += 1;
      continue;
    }

    setKeyValue(withoutPrefix, undefined);
  }

  options.postUrls = uniqueUrls(options.postUrls);
  return options;
}

function isCanvaUrl(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes("canva.com") || normalized.includes("/design/") || normalized.includes("/template/");
}

function normalizeCanvaUrl(value: string) {
  return value.replace(/[)\]}>,.;]+$/g, "");
}

function detectLayout(text: string) {
  const normalized = normalizeSearchText(text);

  if (
    normalized.includes("2x6") ||
    normalized.includes("strip") ||
    normalized.includes("bande verticale")
  ) {
    return "26strip";
  }

  if (normalized.includes("portrait")) {
    return "46postcard-p";
  }

  if (normalized.includes("paysage") || normalized.includes("landscape")) {
    return "46postcard-l";
  }

  if (
    normalized.includes("welcome") ||
    normalized.includes("lumabooth") ||
    normalized.includes("1920x1080") ||
    normalized.includes("1366x1024")
  ) {
    return "welcome";
  }

  return "";
}

function detectFormatLabel(layout: string, text: string) {
  if (layout === "26strip") {
    return "Bande verticale 2x6";
  }

  if (layout === "46postcard-p") {
    return "Portrait 10x15 / 4x6";
  }

  if (layout === "46postcard-l") {
    return "Paysage 10x15 / 4x6";
  }

  const normalized = normalizeSearchText(text);
  if (
    normalized.includes("welcome") ||
    normalized.includes("1920x1080") ||
    normalized.includes("1366x1024")
  ) {
    return "Fond d'ecran 1920x1080";
  }

  return "";
}

function detectNoOfImages(text: string) {
  const normalized = normalizeSearchText(text);
  const match = normalized.match(/(\d+)\s*(?:photo|photos|image|images)\b/i);
  if (!match) {
    return "";
  }

  return `${match[1]}images`;
}

function detectLinkType(canvaUrl: string, contextText: string): DetectedLinkType {
  const normalizedUrl = normalizeSearchText(canvaUrl);
  const normalizedContext = normalizeSearchText(contextText);

  if (
    normalizedUrl.includes("/folder") ||
    normalizedUrl.includes("/folders") ||
    normalizedUrl.includes("/projects") ||
    normalizedUrl.includes("/team")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("folder") ||
    normalizedContext.includes("dossier") ||
    normalizedContext.includes("pack canva")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("2x6") ||
    normalizedContext.includes("portrait") ||
    normalizedContext.includes("paysage") ||
    normalizedContext.includes("welcome") ||
    normalizedContext.includes("1920x1080") ||
    normalizedContext.includes("1366x1024")
  ) {
    return "format_link";
  }

  return "unknown";
}

function computeConfidence(sourceHint: string, contextText: string): Confidence {
  const normalizedSource = normalizeSearchText(sourceHint);
  const hasLayout = Boolean(detectLayout(contextText));
  const hasCanvaDomain = normalizeSearchText(contextText).includes("canva com");

  if (normalizedSource.includes("popup_click")) {
    return hasLayout ? "high" : "medium";
  }

  if (normalizedSource.includes("anchor") || normalizedSource.includes("data_attr")) {
    return hasLayout || hasCanvaDomain ? "high" : "medium";
  }

  if (normalizedSource.includes("onclick")) {
    return hasLayout ? "medium" : "low";
  }

  return "low";
}

function dedupeItems(items: HarvestedItem[]) {
  const map = new Map<string, HarvestedItem>();

  for (const item of items) {
    const key = `${normalizePostUrl(item.page_url)}::${item.detected_type}::${normalizeCanvaUrl(item.canva_folder_url || item.canva_template_url || item.canva_url)}::${item.detected_layout}::${item.detected_no_of_images}`;
    const current = map.get(key);

    if (!current) {
      map.set(key, item);
      continue;
    }

    const weight = (confidence: Confidence) => {
      if (confidence === "high") {
        return 3;
      }
      if (confidence === "medium") {
        return 2;
      }
      return 1;
    };

    if (weight(item.confidence) > weight(current.confidence)) {
      map.set(key, item);
      continue;
    }

    if (item.nearby_text.length > current.nearby_text.length) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

async function pause(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function askEnter(message: string) {
  const rl = createInterface({ input, output });
  try {
    await rl.question(`${message}\n`);
  } finally {
    rl.close();
  }
}

async function looksLikeLoginRequired(page: any) {
  const currentUrl = normalizeSearchText(page.url?.() ?? "");
  const suspiciousUrl =
    currentUrl.includes("login") ||
    currentUrl.includes("connexion") ||
    currentUrl.includes("sign-in") ||
    currentUrl.includes("wp-login");

  const domSignal = await page
    .evaluate(() => {
      const hasPassword = Boolean(document.querySelector("input[type='password']"));
      const hasEmail = Boolean(document.querySelector("input[type='email']"));
      const hasLoginForm = Boolean(
        document.querySelector(
          "form[action*='login'], form[action*='signin'], form[action*='connexion'], form input[type='password']"
        )
      );
      const bodyText = ((document.body?.innerText ?? "") + " " + (document.title ?? ""))
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const hasLogOutText = bodyText.includes("log out") || bodyText.includes("logout");
      const hasYourAccountText = bodyText.includes("your account");
      const mentionsLogin =
        bodyText.includes("login") ||
        bodyText.includes("log in") ||
        bodyText.includes("connexion") ||
        bodyText.includes("se connecter") ||
        bodyText.includes("sign in") ||
        bodyText.includes("wp-login");
      return {
        hasPassword,
        hasEmail,
        hasLoginForm,
        mentionsLogin,
        hasLogOutText,
        hasYourAccountText
      };
    })
    .catch(() => ({
      hasPassword: false,
      hasEmail: false,
      hasLoginForm: false,
      mentionsLogin: false,
      hasLogOutText: false,
      hasYourAccountText: false
    }));

  const hasSessionCookie = await page
    .context()
    .cookies("https://templatesbooth.com")
    .then((cookies: Array<{ name?: string }>) =>
      cookies.some((cookie) => {
        const name = normalizeSearchText(cookie?.name ?? "");
        return name.includes("wordpress_logged_in") || name.includes("wordpress_sec");
      })
    )
    .catch(() => false);

  const myAccountUrl = currentUrl.includes("/my-account/");
  const noLoginFormDetected = !domSignal.hasLoginForm && !domSignal.hasPassword && !domSignal.hasEmail;
  const connectedLikely =
    domSignal.hasLogOutText ||
    domSignal.hasYourAccountText ||
    (myAccountUrl && noLoginFormDetected) ||
    (hasSessionCookie && noLoginFormDetected);

  if (connectedLikely) {
    return false;
  }

  return (
    suspiciousUrl ||
    domSignal.hasLoginForm ||
    domSignal.hasPassword ||
    domSignal.hasEmail ||
    domSignal.mentionsLogin
  );
}

async function ensureAuthenticatedForTemplateBooth(page: any, options: CliOptions, pageUrl: string) {
  const loginRequired = await looksLikeLoginRequired(page);
  if (!loginRequired) {
    return {
      ok: true as const,
      status: "completed" as HarvestStatus,
      message: "",
      loggedInLikely: true as const
    };
  }

  const loginMessage = "Connexion TemplateBooth requise. Lancez npm.cmd run login.";

  if (!options.nonInteractive) {
    console.log(`[Harvester] ${loginMessage}`);
    console.log(
      "[Harvester] Ouvrez une session persistante avec `npm.cmd run login`, connectez-vous, puis relancez harvest."
    );
  }

  return {
    ok: false as const,
    status: "pending_login" as HarvestStatus,
    message: loginMessage,
    loggedInLikely: false as const
  };
}

async function readUrlsFromFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [] as string[];
  }
}

async function fetchUrlsFromEventPic(config: HarvesterConfig) {
  const endpoint = `${config.eventPicBaseUrl}${config.exportEndpoint}`;
  const response = await fetch(endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Export Event Pic impossible (${response.status}).`);
  }

  const payload = (await response.json()) as EventPicExportItem[];

  if (!Array.isArray(payload)) {
    return [] as string[];
  }

  return payload.map((entry) => normalizePostUrl(normalizeText(entry.post_url))).filter(Boolean);
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls.map((url) => normalizePostUrl(url)).filter(Boolean))];
}

function boolLikeLabel(value: boolean | "uncertain") {
  if (value === true) {
    return "oui";
  }
  if (value === false) {
    return "non";
  }
  return "incertain";
}

async function collectRawCandidatesFromPage(page: any): Promise<{
  templateName: string;
  pageTitle: string;
  linksScanned: number;
  buttonsScanned: number;
  editButtonsFound: number;
  canvaTextFound: boolean;
  buttonTexts: string[];
  candidates: RawCandidate[];
}> {
  const result = (await page.evaluate(() => {
    function cleanText(value: string | null | undefined) {
      return (value ?? "").replace(/\s+/g, " ").trim();
    }

    function extractNearbyText(el: Element | null) {
      if (!el) {
        return "";
      }

      const section = el.closest("section, article, .template, .card, .row, .col, li, div");
      const text = cleanText((section ?? el).textContent ?? "");
      if (text.length <= 380) {
        return text;
      }

      return text.slice(0, 380);
    }

    function pushCandidate(
      list: Array<{ canva_url: string; nearby_text: string; source_hint: string }>,
      url: string,
      sourceHint: string,
      nearbyText: string
    ) {
      const cleanedUrl = cleanText(url);
      if (!cleanedUrl) {
        return;
      }

      const normalizedUrl = cleanedUrl.toLowerCase();
      if (!normalizedUrl.includes("canva.com") && !normalizedUrl.includes("/design/") && !normalizedUrl.includes("/template/")) {
        return;
      }

      list.push({
        canva_url: cleanedUrl,
        nearby_text: cleanText(nearbyText),
        source_hint: sourceHint
      });
    }

    const candidates: Array<{ canva_url: string; nearby_text: string; source_hint: string }> = [];
    let linksScanned = 0;

    const anchors = Array.from(document.querySelectorAll("a[href]"));
    for (const anchor of anchors) {
      linksScanned += 1;
      pushCandidate(candidates, (anchor as HTMLAnchorElement).href, "anchor_href", extractNearbyText(anchor));
    }

    const dataElements = Array.from(document.querySelectorAll("[data-url], [data-href]"));
    for (const element of dataElements) {
      const dataUrl = element.getAttribute("data-url");
      const dataHref = element.getAttribute("data-href");
      if (dataUrl) {
        pushCandidate(candidates, dataUrl, "data_attr_url", extractNearbyText(element));
      }
      if (dataHref) {
        pushCandidate(candidates, dataHref, "data_attr_href", extractNearbyText(element));
      }
    }

    const onclickElements = Array.from(document.querySelectorAll("[onclick]"));
    for (const element of onclickElements) {
      const onclick = element.getAttribute("onclick");
      if (!onclick) {
        continue;
      }
      const matches = onclick.match(/https?:\/\/[^\s"'<>`]+/gi) ?? [];
      for (const match of matches) {
        pushCandidate(candidates, match, "onclick_url", extractNearbyText(element));
      }
    }

    const richClickable = Array.from(document.querySelectorAll("button, [role='button'], div[role='button'], [aria-label]"));
    const buttonTextSamples: string[] = [];
    let editButtonsFound = 0;
    for (const element of richClickable) {
      const text = cleanText(element.textContent);
      const ariaLabel = cleanText(element.getAttribute("aria-label"));
      const combinedText = cleanText([text, ariaLabel].filter(Boolean).join(" "));
      const normalizedText = combinedText.toLowerCase();
      const isSuspiciousText =
        normalizedText.includes("canva") ||
        normalizedText.includes("edit") ||
        normalizedText.includes("use template") ||
        normalizedText.includes("download");

      if (isSuspiciousText) {
        editButtonsFound += 1;
        if (buttonTextSamples.length < 30) {
          buttonTextSamples.push(combinedText || "(sans texte)");
        }
      }

      if (!isSuspiciousText) {
        continue;
      }

      const hrefAttr = cleanText(element.getAttribute("href"));
      const dataUrl = cleanText(element.getAttribute("data-url"));
      const dataHref = cleanText(element.getAttribute("data-href"));
      const onclick = cleanText(element.getAttribute("onclick"));
      const nearbyText = extractNearbyText(element);

      if (hrefAttr) {
        pushCandidate(candidates, hrefAttr, "clickable_href_attr", nearbyText);
      }
      if (dataUrl) {
        pushCandidate(candidates, dataUrl, "clickable_data_url", nearbyText);
      }
      if (dataHref) {
        pushCandidate(candidates, dataHref, "clickable_data_href", nearbyText);
      }

      if (onclick) {
        const matches = onclick.match(/https?:\/\/[^\s"'<>`]+/gi) ?? [];
        for (const match of matches) {
          pushCandidate(candidates, match, "clickable_onclick_url", nearbyText);
        }
      }
    }

    const scripts = Array.from(document.querySelectorAll("script"));
    for (const script of scripts) {
      const content = cleanText(script.textContent ?? "");
      if (!content) {
        continue;
      }
      const matches = content.match(/https?:\/\/[^\s"'<>`]+/gi) ?? [];
      for (const match of matches) {
        pushCandidate(candidates, match, "script_url", content.slice(0, 380));
      }
    }

    const h1 = cleanText(document.querySelector("h1")?.textContent ?? "");
    const title = cleanText(document.title ?? "");
    const bodyText = cleanText(document.body?.innerText ?? "").toLowerCase();
    const canvaTextFound =
      bodyText.includes("canva") ||
      bodyText.includes("edit in canva") ||
      bodyText.includes("use template");

    return {
      templateName: h1 || title,
      pageTitle: title,
      linksScanned,
      buttonsScanned: richClickable.length,
      editButtonsFound,
      canvaTextFound,
      buttonTexts: buttonTextSamples,
      candidates
    };
  })) as {
    templateName: string;
    pageTitle: string;
    linksScanned: number;
    buttonsScanned: number;
    editButtonsFound: number;
    canvaTextFound: boolean;
    buttonTexts: string[];
    candidates: RawCandidate[];
  };

  return result;
}

async function collectPopupCandidates(page: any, maxClickableChecks: number) {
  const results: RawCandidate[] = [];
  const clickable = page.locator("a, button, [role='button'], div[role='button'], [onclick], [data-url], [data-href]");
  const count = await clickable.count();
  const maxChecks = Math.min(count, maxClickableChecks);

  for (let index = 0; index < maxChecks; index += 1) {
    const target = clickable.nth(index);
    let text = "";

    try {
      text = normalizeSearchText(await target.innerText());
    } catch {
      continue;
    }

    if (!text) {
      continue;
    }

    if (
      text.includes("download all") ||
      text.includes("download psd") ||
      text.includes("download zip") ||
      text.includes("psd") ||
      text.includes("zip")
    ) {
      continue;
    }

    if (
      !text.includes("canva") &&
      !text.includes("edit in canva") &&
      !text.includes("use template") &&
      !text.includes("edit") &&
      !text.includes("template")
    ) {
      continue;
    }

    const nearbyText = await target.evaluate((element: Element) => {
      const section = element.closest("section, article, .template, .card, .row, .col, li, div");
      const textContent = (section ?? element).textContent ?? "";
      return textContent.replace(/\s+/g, " ").trim().slice(0, 380);
    });

    const popupPromise = page.waitForEvent("popup", { timeout: 6000 }).catch(() => null);
    const beforeUrl = normalizeText(page.url());

    try {
      await target.click({ timeout: 5000, force: true });
    } catch {
      continue;
    }

    await pause(3500);

    const popup = await popupPromise;
    if (popup) {
      try {
        await popup.waitForLoadState("domcontentloaded", { timeout: 10000 });
      } catch {
        // noop
      }

      const popupUrl = normalizeText(popup.url());
      if (isCanvaUrl(popupUrl)) {
        results.push({
          canva_url: normalizeCanvaUrl(popupUrl),
          nearby_text: nearbyText,
          source_hint: "popup_click_edit_in_canva"
        });
      }

      try {
        await popup.close({ runBeforeUnload: true });
      } catch {
        // noop
      }
    }

    const currentUrl = normalizeText(page.url());
    if (currentUrl && currentUrl !== beforeUrl && isCanvaUrl(currentUrl)) {
      results.push({
        canva_url: normalizeCanvaUrl(currentUrl),
        nearby_text: nearbyText,
        source_hint: "same_tab_click_edit_in_canva"
      });

      try {
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 });
        await pause(500);
      } catch {
        // noop
      }
    }

    await pause(250);
  }

  return results;
}

async function collectDebugSnapshot(
  page: any,
  pageUrl: string,
  source: {
    pageTitle: string;
    linksScanned: number;
    buttonsScanned: number;
    editButtonsFound: number;
    canvaLinksDetected: number;
    canvaTextFound: boolean;
    buttonTexts: string[];
  },
  loggedInLikely: boolean | "uncertain",
  enabled: boolean
): Promise<HarvestDebugPage> {
  let screenshotPath = "";
  let htmlPath = "";
  const currentUrl = normalizeText(page.url());

  if (enabled) {
    await fs.mkdir(DEBUG_DIR, { recursive: true });
    screenshotPath = DEBUG_SCREENSHOT_PATH;
    htmlPath = DEBUG_HTML_PATH;

    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
    } catch {
      screenshotPath = "";
    }

    try {
      const html = await page.content();
      await fs.writeFile(htmlPath, html, "utf8");
    } catch {
      htmlPath = "";
    }
  }

  return {
    page_url: normalizePostUrl(pageUrl),
    pageTitle: source.pageTitle,
    currentUrl,
    loggedInLikely,
    canvaTextFound: source.canvaTextFound,
    editButtonsFound: source.editButtonsFound,
    canvaLinksDetected: source.canvaLinksDetected,
    linksScanned: source.linksScanned,
    buttonsScanned: source.buttonsScanned,
    buttonTexts: source.buttonTexts.slice(0, 30),
    screenshotPath,
    htmlPath
  };
}

function toHarvestedItems(input: {
  pageUrl: string;
  templateName: string;
  pageTitle: string;
  candidates: RawCandidate[];
}): HarvestedItem[] {
  const nowIso = new Date().toISOString();
  const templateName = normalizeText(input.templateName) || normalizeText(input.pageTitle) || "Template TemplateBooth";

  return input.candidates
    .map((candidate) => {
      const canvaUrl = normalizeCanvaUrl(normalizeText(candidate.canva_url));

      if (!isCanvaUrl(canvaUrl)) {
        return null;
      }

      const context = [candidate.nearby_text, candidate.source_hint].join(" ");
      const detectedLayout = detectLayout(context);
      const detectedFormat = detectFormatLabel(detectedLayout, context);
      const detectedNoOfImages = detectNoOfImages(context);
      const detectedType = detectLinkType(canvaUrl, context);

      return {
        template_name: templateName,
        page_url: normalizePostUrl(input.pageUrl),
        canva_folder_url: detectedType === "folder_global" ? canvaUrl : "",
        canva_template_url: detectedType === "folder_global" ? "" : canvaUrl,
        canva_url: canvaUrl,
        detected_type: detectedType,
        detected_format: detectedFormat,
        detected_layout: detectedLayout,
        detected_no_of_images: detectedNoOfImages,
        confidence: computeConfidence(candidate.source_hint, context),
        nearby_text: normalizeText(candidate.nearby_text),
        detected_at: nowIso,
        extraction_source: candidate.source_hint
      } satisfies HarvestedItem;
    })
    .filter((item): item is HarvestedItem => Boolean(item));
}

async function harvestOnePage(
  page: any,
  pageUrl: string,
  config: HarvesterConfig,
  options: CliOptions
) {
  console.log(`[Harvester] URL recue: ${pageUrl}`);
  let pageLoadError = "";
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pause(2400);
  } catch (error) {
    pageLoadError = error instanceof Error ? error.message : "Echec de chargement de la page.";
  }

  const openedTitle = normalizeText(await page.title().catch(() => ""));
  const openedUrl = normalizeText(page.url());

  if (options.debug) {
    console.log(`[Harvester][Debug] URL actuelle apres goto: ${openedUrl || "-"}`);
    console.log(`[Harvester][Debug] Titre page apres goto: ${openedTitle || "-"}`);
    if (pageLoadError) {
      console.log(`[Harvester][Debug] Erreur chargement page: ${pageLoadError}`);
    }
  }

  if (pageLoadError) {
    const failedDebug = await collectDebugSnapshot(
      page,
      pageUrl,
      {
        pageTitle: openedTitle,
        linksScanned: 0,
        buttonsScanned: 0,
        editButtonsFound: 0,
        canvaLinksDetected: 0,
        canvaTextFound: false,
        buttonTexts: []
      },
      "uncertain",
      options.debug
    );

    return {
      status: "completed" as HarvestStatus,
      message: `La page TemplateBooth n'a pas pu etre chargee: ${pageLoadError}`,
      items: [] as HarvestedItem[],
      debug: failedDebug
    };
  }

  const access = await ensureAuthenticatedForTemplateBooth(page, options, pageUrl);
  if (!access.ok) {
    const pageTitle = openedTitle || normalizeText(await page.title().catch(() => ""));
    const pendingDebug = await collectDebugSnapshot(
      page,
      pageUrl,
      {
        pageTitle,
        linksScanned: 0,
        buttonsScanned: 0,
        editButtonsFound: 0,
        canvaLinksDetected: 0,
        canvaTextFound: false,
        buttonTexts: []
      },
      access.loggedInLikely,
      options.debug
    );

    if (options.debug) {
      console.log(`[Harvester][Debug] URL ouverte: ${pendingDebug.currentUrl}`);
      console.log(`[Harvester][Debug] Titre page: ${pendingDebug.pageTitle}`);
      console.log(`[Harvester][Debug] Connecte probable: ${boolLikeLabel(pendingDebug.loggedInLikely)}`);
      console.log(`[Harvester][Debug] Boutons Canva/Edit detectes: ${pendingDebug.editButtonsFound}`);
      console.log(`[Harvester][Debug] Liens Canva detectes: ${pendingDebug.canvaLinksDetected}`);
      if (pendingDebug.screenshotPath) {
        console.log(`[Harvester][Debug] Capture: ${pendingDebug.screenshotPath}`);
      }
      if (pendingDebug.htmlPath) {
        console.log(`[Harvester][Debug] HTML: ${pendingDebug.htmlPath}`);
      }
    }

    return {
      status: access.status,
      message: access.message,
      items: [] as HarvestedItem[],
      debug: pendingDebug
    };
  }

  const base = await collectRawCandidatesFromPage(page);
  const popupCandidates = await collectPopupCandidates(page, config.maxClickableChecks);
  const allCandidates = [...base.candidates, ...popupCandidates];
  const debugSnapshot = await collectDebugSnapshot(
    page,
    pageUrl,
    {
      pageTitle: base.pageTitle || openedTitle,
      linksScanned: base.linksScanned,
      buttonsScanned: base.buttonsScanned,
      editButtonsFound: base.editButtonsFound,
      canvaLinksDetected: allCandidates.length,
      canvaTextFound: base.canvaTextFound,
      buttonTexts: base.buttonTexts
    },
    access.loggedInLikely,
    options.debug
  );

  if (options.debug) {
    console.log(`[Harvester][Debug] URL ouverte: ${debugSnapshot.currentUrl}`);
    console.log(`[Harvester][Debug] Titre page: ${debugSnapshot.pageTitle}`);
    console.log(`[Harvester][Debug] Connecte probable: ${boolLikeLabel(debugSnapshot.loggedInLikely)}`);
    console.log(`[Harvester][Debug] Liens scannes: ${debugSnapshot.linksScanned}`);
    console.log(`[Harvester][Debug] Boutons scannes: ${debugSnapshot.buttonsScanned}`);
    console.log(`[Harvester][Debug] Boutons Canva/Edit detectes: ${debugSnapshot.editButtonsFound}`);
    console.log(`[Harvester][Debug] Liens Canva detectes: ${debugSnapshot.canvaLinksDetected}`);
    if (debugSnapshot.buttonTexts.length > 0) {
      console.log(`[Harvester][Debug] Textes boutons suspects:`);
      for (const value of debugSnapshot.buttonTexts) {
        console.log(`- ${value}`);
      }
    }
    if (debugSnapshot.screenshotPath) {
      console.log(`[Harvester][Debug] Capture: ${debugSnapshot.screenshotPath}`);
    }
    if (debugSnapshot.htmlPath) {
      console.log(`[Harvester][Debug] HTML: ${debugSnapshot.htmlPath}`);
    }
  }

  const harvested = toHarvestedItems({
    pageUrl,
    templateName: base.templateName,
    pageTitle: base.pageTitle || openedTitle,
    candidates: allCandidates
  });

  return {
    status: "completed" as HarvestStatus,
    message: "",
    items: dedupeItems(harvested),
    debug: debugSnapshot
  };
}

async function importIntoEventPic(config: HarvesterConfig, items: HarvestedItem[]) {
  const endpoint = `${config.eventPicBaseUrl}${config.importEndpoint}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: "templatebooth_harvester",
      items
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      `Import Event Pic impossible (${response.status}): ${normalizeText(payload.error) || "erreur inconnue"}`
    );
  }

  return payload;
}

async function ensureOutputDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true });
}

function timestampLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

async function main() {
  const cli = parseCliOptions(process.argv.slice(2));
  const config = await loadConfig();
  if (typeof cli.autoImportOverride === "boolean") {
    config.autoImport = cli.autoImportOverride;
  }
  if (cli.eventPicBaseUrl) {
    config.eventPicBaseUrl = cli.eventPicBaseUrl.replace(/\/$/, "");
  }
  await ensureOutputDirectory(config.outputDirectory);

  let urls: string[] = [];
  if (cli.postUrls.length > 0) {
    urls = cli.postUrls;
  } else if (config.mode === "eventpic") {
    console.log(`[Harvester] Mode Event Pic: export ${config.eventPicBaseUrl}${config.exportEndpoint}`);
    urls = await fetchUrlsFromEventPic(config);
  } else {
    console.log(`[Harvester] Mode fichier: ${config.inputFilePath}`);
    urls = await readUrlsFromFile(config.inputFilePath);
  }

  const unique = uniqueUrls(urls);
  console.log(`[Harvester] URLs a traiter: ${unique.length}`);

  if (unique.length === 0) {
    console.log("[Harvester] Aucun URL a traiter.");
    const emptyResult: HarvestResultPayload = {
      ok: true,
      status: "no_links_found",
      message: "Aucun URL TemplateBooth a analyser.",
      generated_at: new Date().toISOString(),
      mode: cli.postUrls.length > 0 ? "file" : config.mode,
      request_id: cli.requestId,
      family_key: cli.familyKey,
      template_name: cli.templateName,
      total_urls: 0,
      processed_urls: 0,
      found_links: 0,
      items: [],
      debug: {
        loggedInLikely: "uncertain",
        pageTitle: "",
        currentUrl: "",
        canvaTextFound: false,
        editButtonsFound: 0,
        canvaLinksDetected: 0,
        linksScanned: 0,
        buttonsScanned: 0,
        buttonTexts: [],
        screenshotPath: "",
        htmlPath: "",
        pages: []
      }
    };

    if (cli.outputResultFile) {
      await fs.mkdir(path.dirname(cli.outputResultFile), { recursive: true });
      await fs.writeFile(cli.outputResultFile, `${JSON.stringify(emptyResult, null, 2)}\n`, "utf8");
    }

    console.log(`HARVEST_RESULT_JSON ${JSON.stringify(emptyResult)}`);
    return;
  }

  const playwright = await (0, eval)('import("playwright")');
  const context = await playwright.chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1480, height: 920 }
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto("https://templatesbooth.com", { waitUntil: "domcontentloaded", timeout: 60000 });

  const harvestedAll: HarvestedItem[] = [];
  const debugPages: HarvestDebugPage[] = [];
  let status: HarvestStatus = "completed";
  let statusMessage = "";
  let processedUrls = 0;
  let noLinkReason = "";

  for (let index = 0; index < unique.length; index += 1) {
    const currentUrl = unique[index];
    console.log(`[Harvester] (${index + 1}/${unique.length}) ${currentUrl}`);

    try {
      const pageResult = await harvestOnePage(page, currentUrl, config, cli);

      if (pageResult.debug) {
        debugPages.push(pageResult.debug);
      }

      if (pageResult.status === "pending_login") {
        status = "pending_login";
        statusMessage = pageResult.message;
        break;
      }

      harvestedAll.push(...pageResult.items);
      processedUrls += 1;
      console.log(`[Harvester] Liens Canva trouves sur la page: ${pageResult.items.length}`);
      if (pageResult.items.length === 0 && pageResult.message) {
        noLinkReason = pageResult.message;
      }
    } catch (error) {
      const currentPageUrl = normalizeText(page.url?.() ?? "");
      const currentPageTitle = normalizeText(await page.title().catch(() => ""));
      const fallbackDebug = await collectDebugSnapshot(
        page,
        currentUrl,
        {
          pageTitle: currentPageTitle,
          linksScanned: 0,
          buttonsScanned: 0,
          editButtonsFound: 0,
          canvaLinksDetected: 0,
          canvaTextFound: false,
          buttonTexts: []
        },
        "uncertain",
        cli.debug
      );
      debugPages.push(fallbackDebug);
      noLinkReason =
        `La page TemplateBooth n'a pas ete chargee. URL actuelle: ${currentPageUrl || "-"}. ` +
        `Titre: ${currentPageTitle || "-"}.`;
      console.error(
        `[Harvester] Erreur sur ${currentUrl}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    if (index < unique.length - 1) {
      await pause(config.delayMs);
    }
  }

  const shouldKeepOpen = cli.keepOpen || (cli.debug && !cli.autoClose);

  if (status === "pending_login" && !shouldKeepOpen) {
    console.log("[Harvester] Session en attente de connexion, fermeture differee de 8 secondes.");
    await pause(8000);
  }

  const deduped = dedupeItems(harvestedAll);
  const now = new Date().toISOString();

  const firstDebug = debugPages[0];
  const debugSummary: HarvestDebugPayload = {
    loggedInLikely:
      debugPages.length === 0
        ? "uncertain"
        : debugPages.every((pageDebug) => pageDebug.loggedInLikely === true)
          ? true
          : debugPages.some((pageDebug) => pageDebug.loggedInLikely === false)
            ? false
            : "uncertain",
    pageTitle: firstDebug?.pageTitle ?? "",
    currentUrl: firstDebug?.currentUrl ?? "",
    canvaTextFound: debugPages.some((pageDebug) => pageDebug.canvaTextFound),
    editButtonsFound: debugPages.reduce((sum, pageDebug) => sum + pageDebug.editButtonsFound, 0),
    canvaLinksDetected: debugPages.reduce((sum, pageDebug) => sum + pageDebug.canvaLinksDetected, 0),
    linksScanned: debugPages.reduce((sum, pageDebug) => sum + pageDebug.linksScanned, 0),
    buttonsScanned: debugPages.reduce((sum, pageDebug) => sum + pageDebug.buttonsScanned, 0),
    buttonTexts: debugPages.flatMap((pageDebug) => pageDebug.buttonTexts).slice(0, 30),
    screenshotPath: firstDebug?.screenshotPath ?? "",
    htmlPath: firstDebug?.htmlPath ?? "",
    pages: debugPages
  };

  if (status === "completed" && deduped.length === 0) {
    status = "no_links_found";
    statusMessage = noLinkReason || "Aucun lien Canva detecte sur les pages analysees.";
  } else if (status === "completed") {
    statusMessage = `${deduped.length} lien(s) Canva detecte(s).`;
  }

  const outputPayload = {
    generated_at: now,
    mode: cli.postUrls.length > 0 ? "file" : config.mode,
    total_urls: unique.length,
    processed_urls: processedUrls,
    status,
    message: statusMessage,
    total_found: deduped.length,
    items: deduped,
    debug: debugSummary
  };

  const outputPath = path.join(config.outputDirectory, `harvest-${timestampLabel()}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
  console.log(`[Harvester] Liens Canva detectes: ${deduped.length}`);
  console.log(`[Harvester] Rapport enregistre: ${outputPath}`);

  const resultPayload: HarvestResultPayload = {
    ok: true,
    status,
    message: statusMessage,
    generated_at: now,
    mode: cli.postUrls.length > 0 ? "file" : config.mode,
    request_id: cli.requestId,
    family_key: cli.familyKey,
    template_name: cli.templateName,
    total_urls: unique.length,
    processed_urls: processedUrls,
    found_links: deduped.length,
    items: deduped,
    report_path: outputPath,
    debug: debugSummary
  };

  if (cli.outputResultFile) {
    await fs.mkdir(path.dirname(cli.outputResultFile), { recursive: true });
    await fs.writeFile(cli.outputResultFile, `${JSON.stringify(resultPayload, null, 2)}\n`, "utf8");
  }

  console.log(`HARVEST_RESULT_JSON ${JSON.stringify(resultPayload)}`);

  if (shouldKeepOpen) {
    console.log("[Harvester] Navigateur conserve ouvert (--debug/--keep-open).");
    await askEnter("Appuyez sur Entree pour fermer le navigateur.");
  }

  await context.close();

  if (!config.autoImport || status === "pending_login" || deduped.length === 0) {
    console.log("[Harvester] Import Event Pic saute.");
    return;
  }

  try {
    const importResult = await importIntoEventPic(config, deduped);
    console.log("[Harvester] Import Event Pic termine.");
    console.log(
      JSON.stringify(
        {
          imported_count: importResult.imported_count ?? null,
          pending_count: importResult.pending_count ?? null,
          parsed: importResult.parsed ?? null
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      "[Harvester] Import Event Pic impossible:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[Harvester] Echec:", message);
  const errorResult: HarvestResultPayload = {
    ok: false,
    status: "error",
    message,
    generated_at: new Date().toISOString(),
    mode: "file",
    total_urls: 0,
    processed_urls: 0,
    found_links: 0,
    items: [],
    debug: {
      loggedInLikely: "uncertain",
      pageTitle: "",
      currentUrl: "",
      canvaTextFound: false,
      editButtonsFound: 0,
      canvaLinksDetected: 0,
      linksScanned: 0,
      buttonsScanned: 0,
      buttonTexts: [],
      screenshotPath: "",
      htmlPath: "",
      pages: []
    }
  };
  console.log(`HARVEST_RESULT_JSON ${JSON.stringify(errorResult)}`);
  process.exitCode = 1;
});
