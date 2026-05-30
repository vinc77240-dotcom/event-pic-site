import { getEventDossierById } from "@/src/server/eventDossierService";
import { generateDossierQuotePdf, getDossierQuotePdfFileName } from "@/src/server/dossierQuotePdf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dossier = await getEventDossierById(id);

  if (!dossier) {
    return Response.json({ ok: false, error: "Dossier introuvable." }, { status: 404 });
  }

  const pdf = generateDossierQuotePdf(dossier);
  const filename = getDossierQuotePdfFileName(dossier);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
