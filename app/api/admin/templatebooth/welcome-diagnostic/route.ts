import { NextResponse } from "next/server";
import { getTemplateBoothWelcomeDiagnostic } from "@/src/server/templateboothWelcomeService";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const diagnostic = await getTemplateBoothWelcomeDiagnostic({
      templateId: url.searchParams.get("templateId") ?? undefined,
      name: url.searchParams.get("name") ?? undefined,
      postUrl: url.searchParams.get("postUrl") ?? undefined,
      category: url.searchParams.get("category") ?? undefined
    });

    return NextResponse.json({
      ...diagnostic,
      bestCandidateSource: diagnostic.bestCandidateSource,
      bestCandidate: diagnostic.bestCandidate
        ? {
            ...diagnostic.bestCandidate,
            touchToStart: Boolean(diagnostic.bestCandidate.touch_to_start)
          }
        : null,
      welcomeCandidates: diagnostic.welcomeCandidates.map((candidate) => ({
        ...candidate,
        touchToStart: Boolean(candidate.touch_to_start)
      }))
    });
  } catch (error) {
    console.error("[TemplateBooth] GET /api/admin/templatebooth/welcome-diagnostic", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diagnostic welcome screen impossible."
      },
      { status: 500 }
    );
  }
}
