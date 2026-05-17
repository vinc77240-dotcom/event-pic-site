import { NextResponse } from "next/server";
import { getPublicDossierByToken, verifyPublicDossierSignature } from "@/src/server/eventDossierService";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type SignPayload = {
  otp?: string;
  accepted?: boolean;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const dossier = await getPublicDossierByToken(token);
    if (!dossier) {
      return NextResponse.json({ ok: false, error: "Lien dossier invalide ou expire." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, dossier });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Chargement dossier impossible." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = (await request.json()) as SignPayload;
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
    const userAgent = request.headers.get("user-agent") || "";

    const dossier = await verifyPublicDossierSignature({
      token,
      otp: typeof body.otp === "string" ? body.otp : "",
      accepted: body.accepted === true,
      ip,
      userAgent
    });
    return NextResponse.json({
      ok: true,
      dossier,
      message: "Votre devis et les CGV ont bien ete valides."
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Validation impossible." },
      { status: 400 }
    );
  }
}
