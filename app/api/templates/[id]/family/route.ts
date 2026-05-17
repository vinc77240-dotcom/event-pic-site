import { NextResponse } from "next/server";
import { getTemplateFamilyVariants } from "@/src/server/eventPicTemplateService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type FamilyResponseBody = {
  family: string;
  selected: unknown;
  templates: unknown[];
  preferredRequiredPortraitId: string | null;
};

const familyInFlight = new Map<string, Promise<FamilyResponseBody | null>>();

async function loadFamilyPayload(templateId: string) {
  const inFlight = familyInFlight.get(templateId);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const result = await getTemplateFamilyVariants(templateId);

    if (!result) {
      return null;
    }

    const payload: FamilyResponseBody = {
      family: result.family,
      selected: result.selected,
      templates: result.templates,
      preferredRequiredPortraitId: result.preferredRequiredPortraitId ?? null
    };

    return payload;
  })().finally(() => {
    familyInFlight.delete(templateId);
  });

  familyInFlight.set(templateId, request);
  return request;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = await loadFamilyPayload(id);

    if (!payload) {
      return NextResponse.json({ error: "Template introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Event Pic] /api/templates/[id]/family", error);
    return NextResponse.json({ error: "Impossible de charger les declinaisons." }, { status: 500 });
  }
}
