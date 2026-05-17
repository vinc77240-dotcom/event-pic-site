import { NextResponse } from "next/server";
import { upsertTemplateSourceLink } from "@/src/server/templateSourceLinks";

type PreferredPortraitPayload = {
  family_key?: string;
  preferred_required_portrait_id?: string;
  template_id?: string;
  post_url?: string;
  notes?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreferredPortraitPayload;
    const familyKey = cleanText(body.family_key);
    const preferredPortraitId = cleanText(body.preferred_required_portrait_id);
    const templateId = cleanText(body.template_id);
    const postUrl = cleanText(body.post_url);
    const notes = cleanText(body.notes);

    if (!familyKey) {
      return NextResponse.json({ ok: false, error: "family_key requis." }, { status: 400 });
    }

    if (!preferredPortraitId) {
      return NextResponse.json({ ok: false, error: "preferred_required_portrait_id requis." }, { status: 400 });
    }

    const saved = await upsertTemplateSourceLink({
      family_key: familyKey,
      preferred_required_portrait_id: preferredPortraitId,
      template_id: templateId || undefined,
      post_url: postUrl || undefined,
      notes: notes || undefined
    });

    return NextResponse.json({
      ok: true,
      entry: saved,
      message: "Portrait obligatoire prefere enregistre."
    });
  } catch (error) {
    console.error("[Event Pic] preferred portrait mapping", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Enregistrement du portrait prefere impossible."
      },
      { status: 500 }
    );
  }
}
