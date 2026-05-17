import { NextResponse } from "next/server";
import path from "node:path";
import { getEventPicTemplateRequest } from "@/src/server/eventPicTemplateRequests";
import { importCanvaLinksFromHarvester } from "@/src/server/canvaHarvesterImportService";
import {
  LocalCanvaHarvesterError,
  LocalCanvaHarvesterErrorCode,
  runLocalCanvaHarvester
} from "@/src/server/localCanvaHarvesterService";

type HarvestCanvaPayload = {
  request_id?: string;
  template_name?: string;
  post_url?: string;
  family_key?: string;
  formats?: Array<{
    id?: string;
    name?: string;
    post_url?: string;
    format_label?: string;
    layout?: string;
    no_of_images?: number | string | null;
  }>;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePostUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.split("?")[0]?.replace(/\/$/, "") ?? value;
}

function isValidTemplateBoothPostUrl(value: string) {
  return /^https:\/\/templatesbooth\.com\//i.test(value);
}

function isLocalOnlyAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
}

function getHarvesterManualCommands() {
  const harvesterDirectory = path.join(process.cwd(), "tools", "templatebooth-canva-harvester");
  return [`cd /d "${harvesterDirectory}"`, "npm.cmd install", "npm.cmd run harvest"];
}

function getHarvesterLoginCommands() {
  const harvesterDirectory = path.join(process.cwd(), "tools", "templatebooth-canva-harvester");
  return [`cd /d "${harvesterDirectory}"`, "npm.cmd run login"];
}

function getHarvesterDebugCommands() {
  const harvesterDirectory = path.join(process.cwd(), "tools", "templatebooth-canva-harvester");
  return [`cd /d "${harvesterDirectory}"`, "npm.cmd run harvest -- --debug --keep-open"];
}

function harvesterErrorMessageFromCode(code: LocalCanvaHarvesterErrorCode) {
  switch (code) {
    case "HARVESTER_DIRECTORY_MISSING":
      return "Impossible de lancer l'extracteur Canva local: dossier tools/templatebooth-canva-harvester introuvable.";
    case "HARVESTER_PACKAGE_MISSING":
      return "Impossible de lancer l'extracteur Canva local: package.json introuvable dans l'outil harvester.";
    case "HARVESTER_SCRIPT_MISSING":
      return "Impossible de lancer l'extracteur Canva local: script harvest-canva-links.ts introuvable.";
    case "HARVESTER_DEPENDENCIES_MISSING":
      return "Impossible de lancer l'extracteur Canva local: dependances Playwright/tsx non installees.";
    case "HARVESTER_POST_URL_MISSING":
      return "Impossible de lancer l'extracteur Canva local: aucun post_url TemplateBooth exploitable.";
    case "HARVESTER_TEMPLATE_NAME_MISSING":
      return "Impossible de lancer l'extracteur Canva local: template_name manquant.";
    case "HARVESTER_SPAWN_FAILED":
      return "Impossible de lancer l'extracteur Canva local.";
    case "HARVESTER_PROCESS_FAILED":
      return "L'extracteur Canva local a demarre mais s'est termine en erreur.";
    case "HARVESTER_RESULT_MISSING":
      return "L'extracteur Canva local n'a pas retourne de resultat exploitable.";
    default:
      return "Impossible de lancer l'extracteur Canva local.";
  }
}

export async function POST(request: Request) {
  if (!isLocalOnlyAllowed()) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        code: "HARVESTER_LOCAL_ONLY",
        found_links: 0,
        imported_links: 0,
        pending_links: 0,
        message: "Extraction automatique Canva disponible uniquement en local.",
        details: "Event Pic doit etre lance en local pour ouvrir le navigateur Playwright.",
        help: "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
        manual_commands: getHarvesterManualCommands(),
        debug_commands: getHarvesterDebugCommands()
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as HarvestCanvaPayload;
    const requestId = normalizeText(body.request_id);
    const templateNamePayload = normalizeText(body.template_name);
    const familyKey = normalizeText(body.family_key);
    const postUrlPayload = normalizePostUrl(normalizeText(body.post_url));

    if (!postUrlPayload) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          code: "MISSING_TEMPLATEBOOTH_URL",
          found_links: 0,
          imported_links: 0,
          pending_links: 0,
          message: "URL TemplateBooth manquante.",
          details: "URL TemplateBooth manquante : impossible de lancer l'extraction Canva.",
          help: "Selectionnez un template avec un post_url TemplateBooth valide.",
          manual_commands: getHarvesterManualCommands(),
          debug_commands: getHarvesterDebugCommands()
        },
        { status: 400 }
      );
    }

    if (!isValidTemplateBoothPostUrl(postUrlPayload)) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          code: "INVALID_TEMPLATEBOOTH_URL",
          found_links: 0,
          imported_links: 0,
          pending_links: 0,
          message: "URL TemplateBooth invalide.",
          details: "Le post_url doit commencer par https://templatesbooth.com/.",
          help: "Corrigez l'URL template avant de relancer l'extraction.",
          manual_commands: getHarvesterManualCommands(),
          debug_commands: getHarvesterDebugCommands()
        },
        { status: 400 }
      );
    }

    const formatPostUrls = Array.isArray(body.formats)
      ? body.formats
          .map((format) => normalizePostUrl(normalizeText(format?.post_url)))
          .filter((value) => value.length > 0)
      : [];

    const requestData = requestId ? await getEventPicTemplateRequest(requestId) : null;
    const requestPostUrls =
      requestData?.selected_templates
        ?.map((template) => normalizePostUrl(normalizeText(template.post_url)))
        .filter((value) => value.length > 0) ?? [];

    const postUrls = [
      ...new Set([postUrlPayload, ...formatPostUrls, ...requestPostUrls].filter((value) => isValidTemplateBoothPostUrl(value)))
    ];
    if (postUrls.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          code: "HARVESTER_POST_URL_MISSING",
          found_links: 0,
          imported_links: 0,
          pending_links: 0,
          message: "Aucun post_url TemplateBooth disponible pour cette demande.",
          details: "Ajoutez un template avec post_url dans la demande avant de lancer la recuperation automatique.",
          help: "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
          manual_commands: getHarvesterManualCommands(),
          debug_commands: getHarvesterDebugCommands()
        },
        { status: 400 }
      );
    }

    const templateName =
      templateNamePayload ||
      requestData?.selected_templates?.find((template) => normalizeText(template.name))?.name ||
      "";

    if (!normalizeText(templateName)) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          code: "HARVESTER_TEMPLATE_NAME_MISSING",
          found_links: 0,
          imported_links: 0,
          pending_links: 0,
          message: "Impossible de lancer l'extracteur Canva local: template_name manquant.",
          details: "Aucun nom de template n'a ete trouve dans la demande.",
          help: "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
          manual_commands: getHarvesterManualCommands(),
          debug_commands: getHarvesterDebugCommands()
        },
        { status: 400 }
      );
    }

    const { result } = await runLocalCanvaHarvester({
      requestId: requestId || undefined,
      templateName,
      familyKey: familyKey || undefined,
      postUrls,
      waitForLoginSeconds: 180,
      debug: true,
      debugAutoClose: true
    });

    if (result.status === "pending_login") {
      return NextResponse.json({
        ok: false,
        status: "pending_login",
        found_links: 0,
        imported_links: 0,
        pending_links: 0,
        message:
          "Connexion TemplateBooth requise. Lancez npm.cmd run login.",
        details:
          "Connectez-vous a TemplateBooth dans la fenetre ouverte par la commande login, puis relancez l'extraction. Si vous etes deja connecte dans Chrome, utilisez l'extension locale tools/canva-link-extractor-extension.",
        debug: result.debug ?? null,
        manual_commands: getHarvesterLoginCommands(),
        debug_commands: getHarvesterDebugCommands()
      });
    }

    if (result.found_links <= 0 || result.items.length === 0) {
      const debug = result.debug ?? null;
      const pageLoadedLikely = Boolean(
        debug &&
          normalizeText(debug.currentUrl ?? "") &&
          normalizeText(debug.pageTitle ?? "")
      );
      const loginLikelyMissing = debug?.loggedInLikely === false;

      let message = "Aucun lien Canva trouve sur la page TemplateBooth chargee.";
      let details = "Aucun lien Canva exploitable n'a ete detecte sur la page analysee.";

      if (!pageLoadedLikely) {
        message = "La page TemplateBooth n'a pas ete chargee.";
        details = "Verifiez que post_url existe et que l'extracteur ouvre bien la page.";
      } else if (loginLikelyMissing) {
        message = "Connexion TemplateBooth requise. Lancez npm.cmd run login.";
        details =
          "Connectez-vous a TemplateBooth via la commande login, puis relancez l'extraction. Si vous etes deja connecte dans Chrome, utilisez l'extension locale tools/canva-link-extractor-extension.";
      }

      return NextResponse.json({
        ok: false,
        status: "no_links_found",
        code: "HARVESTER_NO_LINKS_FOUND",
        found_links: 0,
        imported_links: 0,
        pending_links: 0,
        message,
        details,
        debug,
        manual_commands: loginLikelyMissing ? getHarvesterLoginCommands() : undefined,
        debug_commands: getHarvesterDebugCommands()
      });
    }

    const importResult = await importCanvaLinksFromHarvester({
      source: "templatebooth_harvester",
      items: result.items
    });

    return NextResponse.json({
      ok: true,
      status: "completed",
      found_links: result.found_links,
      imported_links: importResult.imported_count ?? 0,
      pending_links: importResult.pending_count ?? 0,
      message: "Extraction Canva terminee.",
      debug: result.debug ?? null
    });
  } catch (error) {
    if (error instanceof LocalCanvaHarvesterError) {
      console.error("[Event Pic] harvest-canva local error", {
        code: error.code,
        message: error.message,
        details: error.details,
        diagnostics: error.diagnostics ?? null
      });
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          code: error.code,
          found_links: 0,
          imported_links: 0,
          pending_links: 0,
          message: harvesterErrorMessageFromCode(error.code),
          details: error.details,
          help: "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
          manual_commands: getHarvesterManualCommands(),
          debug_commands: getHarvesterDebugCommands()
        },
        { status: error.code === "HARVESTER_POST_URL_MISSING" || error.code === "HARVESTER_TEMPLATE_NAME_MISSING" ? 400 : 500 }
      );
    }

    console.error("[Event Pic] POST /api/admin/template-source-links/harvest-canva", error);
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        code: "HARVESTER_SPAWN_FAILED",
        found_links: 0,
        imported_links: 0,
        pending_links: 0,
        message: "Impossible de lancer l'extracteur Canva local.",
        details: error instanceof Error ? error.message : "Erreur inconnue.",
        help: "Verifiez que le site est lance en local et que l'outil tools/templatebooth-canva-harvester est installe.",
        manual_commands: getHarvesterManualCommands(),
        debug_commands: getHarvesterDebugCommands()
      },
      { status: 500 }
    );
  }
}
