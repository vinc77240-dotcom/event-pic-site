import { NextResponse } from "next/server";
import { EventPicTemplate } from "@/src/shared/eventPicTemplates";
import { getTemplateFamilyVariants } from "@/src/server/eventPicTemplateService";
import {
  getTemplateBoothWelcomeDiagnostic,
  isTouchToStartCandidate,
  isReliableWelcomeCandidate
} from "@/src/server/templateboothWelcomeService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WelcomeResponseBody =
  | {
      found: true;
      template: EventPicTemplate;
      score: number;
      reason: string;
    }
  | {
      found: false;
      reason: string;
    };

const WELCOME_CACHE_TTL_MS = 20 * 60 * 1000;
const welcomeResponseCache = new Map<string, { expiresAt: number; payload: WelcomeResponseBody }>();
const welcomeInFlight = new Map<string, Promise<WelcomeResponseBody>>();

function toPublicWelcomeTemplate(
  candidate: NonNullable<Awaited<ReturnType<typeof getTemplateBoothWelcomeDiagnostic>>["bestCandidate"]>
): EventPicTemplate {
  const sourceWidth = candidate.source_width;
  const sourceHeight = candidate.source_height;
  const exactTarget = sourceWidth === 1920 && sourceHeight === 1080;

  return {
    id: candidate.id,
    name: candidate.name,
    preview_url: candidate.src ?? candidate.poster ?? "/welcome-placeholder-event-pic.svg",
    layout: candidate.layout ?? "welcome",
    format_label: "Fond d'ecran 1920x1080",
    no_of_images: candidate.no_of_images,
    type: candidate.type ?? "static_welcome_screen",
    type_name: candidate.type_name ?? "Welcome screen",
    published_at: candidate.published_at,
    placeholder: false,
    production_needed: false,
    source_kind: "templatebooth",
    requires_resize: !exactTarget,
    source_width: sourceWidth,
    source_height: sourceHeight,
    target_width: 1920,
    target_height: 1080,
    source: "templatebooth"
  };
}

async function loadWelcomePayload(templateId: string, category: string | null) {
  const cacheKey = `${templateId}::${category ?? "all"}`;
  const now = Date.now();
  const cached = welcomeResponseCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const inFlight = welcomeInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const family = await getTemplateFamilyVariants(templateId);

    if (!family) {
      return {
        found: false,
        reason: "Template introuvable."
      } satisfies WelcomeResponseBody;
    }

    const fastDiagnostic = await getTemplateBoothWelcomeDiagnostic({
      templateId: family.selected.id,
      name: family.selected.name,
      postUrl: family.selected.post_url,
      category: category ?? undefined,
      deepSearch: false
    });
    let bestCandidate = fastDiagnostic.bestCandidate;

    if (!bestCandidate || !isReliableWelcomeCandidate(bestCandidate)) {
      const deepDiagnostic = await getTemplateBoothWelcomeDiagnostic({
        templateId: family.selected.id,
        name: family.selected.name,
        postUrl: family.selected.post_url,
        category: category ?? undefined,
        deepSearch: true
      });
      bestCandidate = deepDiagnostic.bestCandidate ?? bestCandidate;
    }

    const touchFallback = bestCandidate ? isTouchToStartCandidate(bestCandidate) : false;

    if (!bestCandidate || (!isReliableWelcomeCandidate(bestCandidate) && !touchFallback)) {
      return {
        found: false,
        reason: "Aucun welcome screen fiable detecte."
      } satisfies WelcomeResponseBody;
    }

    return {
      found: true,
      template: toPublicWelcomeTemplate(bestCandidate),
      score: bestCandidate.score,
      reason:
        bestCandidate.source_width === 1920 &&
        bestCandidate.source_height === 1080 &&
        touchFallback
          ? `${bestCandidate.match_reason} | Welcome screen 1920x1080 - Touch to Start selectionne.`
          : bestCandidate.source_width === 1366 && bestCandidate.source_height === 1024
            ? touchFallback
              ? `${bestCandidate.match_reason} | Source 1366x1024 - Touch to Start. Event Pic l'adaptera en 1920x1080.`
              : `${bestCandidate.match_reason} | Source 1366x1024. Event Pic l'adaptera en 1920x1080.`
            : bestCandidate.match_reason
    } satisfies WelcomeResponseBody;
  })().finally(() => {
    welcomeInFlight.delete(cacheKey);
  });

  welcomeInFlight.set(cacheKey, request);
  const payload = await request;

  welcomeResponseCache.set(cacheKey, {
    expiresAt: Date.now() + WELCOME_CACHE_TTL_MS,
    payload
  });

  return payload;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const payload = await loadWelcomePayload(id, category);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Event Pic] /api/templates/[id]/welcome", error);
    return NextResponse.json({ error: "Recherche welcome screen impossible." }, { status: 500 });
  }
}
