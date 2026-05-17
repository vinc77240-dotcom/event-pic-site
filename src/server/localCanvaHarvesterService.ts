import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LocalHarvesterStatus = "completed" | "pending_login" | "no_links_found" | "error";

export type LocalHarvesterItem = {
  template_name: string;
  page_url: string;
  canva_folder_url: string;
  canva_template_url: string;
  canva_url: string;
  detected_type: "folder_global" | "format_link" | "unknown";
  detected_format: string;
  detected_layout: string;
  detected_no_of_images: string;
  confidence: "high" | "medium" | "low";
  nearby_text: string;
  detected_at: string;
  extraction_source: string;
};

export type LocalHarvesterResult = {
  ok: boolean;
  status: LocalHarvesterStatus;
  message: string;
  generated_at: string;
  mode: string;
  request_id?: string;
  family_key?: string;
  template_name?: string;
  total_urls: number;
  processed_urls: number;
  found_links: number;
  items: LocalHarvesterItem[];
  report_path?: string;
  debug?: {
    loggedInLikely?: boolean | "uncertain";
    pageTitle?: string;
    currentUrl?: string;
    canvaTextFound?: boolean;
    editButtonsFound?: number;
    canvaLinksDetected?: number;
    linksScanned?: number;
    buttonsScanned?: number;
    buttonTexts?: string[];
    screenshotPath?: string;
    htmlPath?: string;
    pages?: Array<{
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
    }>;
  };
};

type RunLocalHarvesterParams = {
  requestId?: string;
  templateName?: string;
  familyKey?: string;
  postUrls: string[];
  waitForLoginSeconds?: number;
  debug?: boolean;
  debugAutoClose?: boolean;
};

export type LocalCanvaHarvesterErrorCode =
  | "HARVESTER_POST_URL_MISSING"
  | "HARVESTER_TEMPLATE_NAME_MISSING"
  | "HARVESTER_DIRECTORY_MISSING"
  | "HARVESTER_PACKAGE_MISSING"
  | "HARVESTER_SCRIPT_MISSING"
  | "HARVESTER_DEPENDENCIES_MISSING"
  | "HARVESTER_SPAWN_FAILED"
  | "HARVESTER_PROCESS_FAILED"
  | "HARVESTER_RESULT_MISSING";

type HarvesterLaunchContext = {
  cwd: string;
  command: string;
  argCount: number;
  requestId: string | null;
  templateName: string | null;
  postUrlCount: number;
};

type HarvesterRuntimePaths = {
  harvesterDirectory: string;
  packageJsonPath: string;
  scriptPath: string;
  tsxCliPath: string;
  playwrightPackagePath: string;
};

const HARVESTER_GENERIC_ERROR_MESSAGE = "Impossible de lancer l'extracteur Canva local.";

export class LocalCanvaHarvesterError extends Error {
  readonly code: LocalCanvaHarvesterErrorCode;
  readonly details: string;
  readonly diagnostics?: HarvesterLaunchContext;

  constructor(
    code: LocalCanvaHarvesterErrorCode,
    message: string,
    details: string,
    diagnostics?: HarvesterLaunchContext
  ) {
    super(message);
    this.name = "LocalCanvaHarvesterError";
    this.code = code;
    this.details = details;
    this.diagnostics = diagnostics;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePostUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? value;
}

async function pathExists(pathValue: string) {
  try {
    await fs.access(pathValue);
    return true;
  } catch {
    return false;
  }
}

function createHarvesterError(
  code: LocalCanvaHarvesterErrorCode,
  details: string,
  diagnostics?: HarvesterLaunchContext
) {
  return new LocalCanvaHarvesterError(code, HARVESTER_GENERIC_ERROR_MESSAGE, details, diagnostics);
}

async function resolveRuntimePaths(): Promise<HarvesterRuntimePaths> {
  const harvesterDirectory = path.join(process.cwd(), "tools", "templatebooth-canva-harvester");
  const packageJsonPath = path.join(harvesterDirectory, "package.json");
  const scriptPath = path.join(harvesterDirectory, "harvest-canva-links.ts");
  const tsxCliPath = path.join(harvesterDirectory, "node_modules", "tsx", "dist", "cli.mjs");
  const playwrightPackagePath = path.join(harvesterDirectory, "node_modules", "playwright", "package.json");

  if (!(await pathExists(harvesterDirectory))) {
    throw createHarvesterError("HARVESTER_DIRECTORY_MISSING", `Dossier introuvable: ${harvesterDirectory}`);
  }

  if (!(await pathExists(packageJsonPath))) {
    throw createHarvesterError("HARVESTER_PACKAGE_MISSING", `Fichier package.json introuvable: ${packageJsonPath}`);
  }

  if (!(await pathExists(scriptPath))) {
    throw createHarvesterError("HARVESTER_SCRIPT_MISSING", `Script harvester introuvable: ${scriptPath}`);
  }

  if (!(await pathExists(tsxCliPath)) || !(await pathExists(playwrightPackagePath))) {
    throw createHarvesterError(
      "HARVESTER_DEPENDENCIES_MISSING",
      "Dependances harvester absentes. Executez `npm.cmd install` dans tools/templatebooth-canva-harvester."
    );
  }

  return {
    harvesterDirectory,
    packageJsonPath,
    scriptPath,
    tsxCliPath,
    playwrightPackagePath
  };
}

function parseResultFromStdout(stdout: string) {
  const marker = "HARVEST_RESULT_JSON ";
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    const markerIndex = line.indexOf(marker);
    if (markerIndex < 0) {
      continue;
    }

    const rawJson = line.slice(markerIndex + marker.length).trim();
    try {
      return JSON.parse(rawJson) as LocalHarvesterResult;
    } catch {
      return null;
    }
  }

  return null;
}

export async function runLocalCanvaHarvester(params: RunLocalHarvesterParams): Promise<{
  result: LocalHarvesterResult;
  stdout: string;
  stderr: string;
}> {
  const requestId = normalizeText(params.requestId);
  const templateName = normalizeText(params.templateName);
  const familyKey = normalizeText(params.familyKey);
  const waitForLoginSeconds = Math.max(0, params.waitForLoginSeconds ?? 150);
  const debug = Boolean(params.debug);
  const debugAutoClose = Boolean(params.debugAutoClose);
  const postUrls = [...new Set((params.postUrls ?? []).map((value) => normalizePostUrl(normalizeText(value))).filter(Boolean))];

  if (postUrls.length === 0) {
    throw createHarvesterError("HARVESTER_POST_URL_MISSING", "Aucun post_url TemplateBooth valide fourni.");
  }

  if (!templateName) {
    throw createHarvesterError("HARVESTER_TEMPLATE_NAME_MISSING", "template_name manquant.");
  }

  const runtimePaths = await resolveRuntimePaths();

  const args = [
    runtimePaths.tsxCliPath,
    runtimePaths.scriptPath,
    "--non-interactive",
    "--no-auto-import",
    `--wait-for-login-seconds=${waitForLoginSeconds}`,
    "--run-label=admin-demandes"
  ];

  if (debug) {
    args.push("--debug");
    if (debugAutoClose) {
      args.push("--auto-close");
    }
  }

  if (requestId) {
    args.push(`--request-id=${requestId}`);
  }
  if (templateName) {
    args.push(`--template-name=${templateName}`);
  }
  if (familyKey) {
    args.push(`--family-key=${familyKey}`);
  }
  for (const url of postUrls) {
    args.push(`--post-url=${url}`);
  }

  const launchContext: HarvesterLaunchContext = {
    cwd: runtimePaths.harvesterDirectory,
    command: process.execPath,
    argCount: args.length,
    requestId: requestId || null,
    templateName: templateName || null,
    postUrlCount: postUrls.length
  };

  console.info("[Event Pic] Canva harvester launch", launchContext);

  let child;
  try {
    child = spawn(process.execPath, args, {
      cwd: runtimePaths.harvesterDirectory,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    throw createHarvesterError(
      "HARVESTER_SPAWN_FAILED",
      `Echec spawn process local: ${error instanceof Error ? error.message : "Erreur inconnue."}`,
      launchContext
    );
  }

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", (error) => {
      reject(
        createHarvesterError(
          "HARVESTER_SPAWN_FAILED",
          `Echec spawn process local: ${error instanceof Error ? error.message : "Erreur inconnue."}`,
          launchContext
        )
      );
    });
    child.on("close", (code) => resolve(code ?? 1));
  });

  const parsed = parseResultFromStdout(stdout);

  if (!parsed) {
    if (exitCode !== 0) {
      throw createHarvesterError(
        "HARVESTER_PROCESS_FAILED",
        `Harvester Canva en erreur (code ${exitCode}). ${normalizeText(stderr) || normalizeText(stdout) || "Aucun detail."}`,
        launchContext
      );
    }

    throw createHarvesterError(
      "HARVESTER_RESULT_MISSING",
      "Resultat HARVEST_RESULT_JSON introuvable dans la sortie harvester.",
      launchContext
    );
  }

  if (exitCode !== 0 && parsed.status !== "pending_login") {
    throw createHarvesterError(
      "HARVESTER_PROCESS_FAILED",
      `Harvester Canva en erreur (code ${exitCode}). ${parsed.message || normalizeText(stderr) || "Aucun detail."}`,
      launchContext
    );
  }

  return {
    result: parsed,
    stdout,
    stderr
  };
}
